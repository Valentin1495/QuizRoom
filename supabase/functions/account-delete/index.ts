// @ts-nocheck
/**
 * Account Delete Edge Function
 * Fully deletes authenticated user's auth identity + app data + authored content.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const authHeader = req.headers.get('Authorization');

    if (!supabaseUrl || !serviceRoleKey || !supabaseAnonKey || !authHeader) {
      return json(401, { error: 'UNAUTHORIZED' });
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: authData, error: authError } = await supabaseAuth.auth.getUser();
    const authUser = authData?.user ?? null;
    if (authError || !authUser) {
      return json(401, { error: 'UNAUTHORIZED' });
    }

    const { data: dbUser, error: dbUserError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('identity_id', authUser.id)
      .maybeSingle();

    if (dbUserError) {
      throw dbUserError;
    }

    if (dbUser?.id) {
      // 1) Remove rooms hosted by this identity.
      const { error: hostRoomDeleteError } = await supabaseAdmin
        .from('live_match_rooms')
        .delete()
        .eq('host_identity', authUser.id);
      if (hostRoomDeleteError) throw hostRoomDeleteError;

      // 2) Remove participant traces by identity from other rooms.
      const { error: participantDeleteError } = await supabaseAdmin
        .from('live_match_participants')
        .delete()
        .eq('identity_id', authUser.id);
      if (participantDeleteError) throw participantDeleteError;

      // 3) Remove authored decks (questions cascade delete).
      const { error: deckDeleteError } = await supabaseAdmin
        .from('decks')
        .delete()
        .eq('author_id', dbUser.id);
      if (deckDeleteError) throw deckDeleteError;

      // 4) Remove user row (answers/history/bookmarks/skills/reports/activity cascade delete).
      const { error: userDeleteError } = await supabaseAdmin
        .from('users')
        .delete()
        .eq('id', dbUser.id);
      if (userDeleteError) throw userDeleteError;
    }

    // 5) Remove auth account.
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(authUser.id, false);
    if (authDeleteError) throw authDeleteError;

    return json(200, { data: { ok: true } });
  } catch (error) {
    console.error('account-delete error', error);
    return json(500, { error: 'ACCOUNT_DELETE_FAILED' });
  }
});
