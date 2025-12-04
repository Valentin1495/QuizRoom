// @ts-nocheck
/**
 * Daily Quiz Edge Function
 * Replaces convex/daily.ts - getDailyQuiz
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// KST timezone offset
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function resolveKstDateString(date = new Date()) {
  const adjusted = new Date(date.getTime() + KST_OFFSET_MS);
  const year = adjusted.getUTCFullYear();
  const month = `${adjusted.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${adjusted.getUTCDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Parse request body
    const { date } = await req.json().catch(() => ({}));
    const targetDate = date ?? resolveKstDateString();

    // Query daily quiz
    const { data: quiz, error } = await supabase
      .from('daily_quizzes')
      .select('*')
      .eq('available_date', targetDate)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    if (!quiz) {
      // Fallback: reuse an existing quiz with the same weekday (keep its original available_date)
      const targetWeekday = new Date(`${targetDate}T00:00:00Z`).getUTCDay();
      const { data: weekly, error: weeklyError } = await supabase
        .from('daily_quizzes')
        .select('*')
        .order('available_date', { ascending: true });

      if (weeklyError) {
        throw weeklyError;
      }

      const fallbackQuiz = weekly?.find((q) => {
        const d = new Date(`${q.available_date}T00:00:00Z`);
        return d.getUTCDay() === targetWeekday;
      });

      if (!fallbackQuiz) {
        return new Response(
          JSON.stringify({ data: null }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      }

      return new Response(
        JSON.stringify({
          data: {
            id: fallbackQuiz.id,
            availableDate: fallbackQuiz.available_date, // keep original date
            category: fallbackQuiz.category,
            questions: fallbackQuiz.questions,
            shareTemplate: fallbackQuiz.share_template,
          },
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    return new Response(
      JSON.stringify({
        data: {
          id: quiz.id,
          availableDate: quiz.available_date,
          category: quiz.category,
          questions: quiz.questions,
          shareTemplate: quiz.share_template,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error fetching daily quiz:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
