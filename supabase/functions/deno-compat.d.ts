// Minimal type shims so the workspace TypeScript server doesn't error on Deno/URL imports.
// These files run on Supabase Edge Functions (Deno), not in the Expo app runtime.

declare namespace Deno {
  namespace env {
    function get(key: string): string | undefined;
  }
}

declare module 'https://deno.land/std@0.168.0/http/server.ts' {
  export function serve(
    handler: (req: any) => any,
    options?: any
  ): void;
}

declare module 'https://esm.sh/@supabase/supabase-js@2.45.0' {
  export function createClient(...args: any[]): any;
}

