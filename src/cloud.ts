import { createClient } from '@supabase/supabase-js';
import type { BudgetState } from './model';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const cloudConfigured = Boolean(url && key);
export const supabase = cloudConfigured
  ? createClient(url, key, { auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;

export interface RemoteBudget { state: BudgetState; updatedAt: string }

export async function readRemoteBudget(userId: string): Promise<RemoteBudget | null> {
  if (!supabase) throw new Error('La synchronisation cloud n’est pas configurée.');
  const { data, error } = await supabase.from('numa_budgets').select('payload, updated_at').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  if (!isBudgetState(data.payload)) throw new Error('Le budget cloud est illisible. Les données locales n’ont pas été remplacées.');
  return { state: data.payload, updatedAt: data.updated_at };
}

export async function writeRemoteBudget(userId: string, state: BudgetState, expectedUpdatedAt: string | null): Promise<string> {
  if (!supabase) throw new Error('La synchronisation cloud n’est pas configurée.');
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || authData.user?.id !== userId) throw new Error('La session du compte a changé. Reconnectez-vous.');
  const { data, error } = await supabase.rpc('save_numa_budget', {
    p_payload: state,
    p_expected_updated_at: expectedUpdatedAt,
  });
  if (error) throw error;
  if (typeof data !== 'string') throw new Error('Réponse de synchronisation invalide.');
  return data;
}

function isBudgetState(value: unknown): value is BudgetState {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<BudgetState>;
  return Boolean(candidate.settings && Array.isArray(candidate.incomes) && Array.isArray(candidate.expenses)
    && Array.isArray(candidate.envelopes) && Array.isArray(candidate.goals) && Array.isArray(candidate.ledger));
}
