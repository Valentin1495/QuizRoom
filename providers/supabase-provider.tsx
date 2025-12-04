/**
 * Supabase Provider
 * Top-level provider for Supabase services
 */

import { type ReactNode } from 'react';

import { SupabaseAuthProvider } from '@/hooks/use-supabase-auth';

type SupabaseProviderProps = {
  children: ReactNode;
};

/**
 * Main Supabase provider that wraps the app
 * Provides authentication context
 */
export function SupabaseProvider({ children }: SupabaseProviderProps) {
  return (
    <SupabaseAuthProvider>
      {children}
    </SupabaseAuthProvider>
  );
}
