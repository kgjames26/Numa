export type Frequency = 'weekly' | 'biweekly' | 'monthly' | 'bimonthly' | 'quarterly' | 'semiannual' | 'annual' | 'once' | 'custom';
export type HouseholdMode = 'solo' | 'pooled' | 'separate';
export interface Income { id: string; name: string; amountCents: number; frequency: Frequency; day?: number; startMonth?: string; endMonth?: string; active: boolean; person?: string; }
export interface Expense { id: string; name: string; amountCents: number; frequency: Frequency; category: string; dueDay?: number; startMonth?: string; endMonth?: string; active: boolean; person?: string; funding: 'regular'|'provision'|'envelope'; split: 'equal'|'proportional'|'custom'|'one'; splitPercent?: number; }
export interface Envelope { id: string; name: string; icon: string; color: string; monthlyCents: number; carry: boolean; spentCents: number; }
export interface Goal { id: string; name: string; icon: string; color: string; targetCents: number; savedCents: number; monthlyCents: number; dueMonth?: string; kind: 'goal'|'provision'|'saving'; }
export interface LedgerEntry { id: string; date: string; type: 'income'|'expense'|'deposit'|'withdrawal'|'balance'; amountCents: number; title: string; category?: string; envelopeId?: string; goalId?: string; }
export interface Settings { householdMode: HouseholdMode; people: string[]; currency: string; locale: string; theme: 'light'|'dark'; onboardingDone: boolean; }
export interface BudgetState { settings: Settings; incomes: Income[]; expenses: Expense[]; envelopes: Envelope[]; goals: Goal[]; ledger: LedgerEntry[]; }
export const blankState: BudgetState = { settings: { householdMode: 'solo', people: [], currency: 'EUR', locale: 'fr-BE', theme: 'light', onboardingDone: false }, incomes: [], expenses: [], envelopes: [], goals: [], ledger: [] };
