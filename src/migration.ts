import { blankState, type BudgetState, type Expense, type Frequency, type LedgerEntry } from './model';

type LegacyPerson = { id?: string; name?: string; income?: number; personal?: number };
type LegacyExpense = { id?: string; name?: string; amount?: number; period?: string; category?: string };
type LegacyHistory = { id?: string; date?: string; balance?: number };
type LegacyState = { configured?: boolean; situation?: string; mode?: string; split?: string; customSplit?: number; people?: LegacyPerson[]; expenses?: LegacyExpense[]; history?: LegacyHistory[] };

const frequencies: Record<string, Frequency> = { monthly: 'monthly', yearly: 'annual', annual: 'annual', quarterly: 'quarterly', weekly: 'weekly' };
export function migrateLegacyState(value: unknown): BudgetState | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const old = value as LegacyState;
  if (!Array.isArray(old.people) || !Array.isArray(old.expenses) || !Array.isArray(old.history)) return undefined;
  const people = old.people.map((p,i)=>p.name?.trim()||`Personne ${i+1}`);
  const next: BudgetState = structuredClone(blankState);
  next.settings.householdMode = old.situation === 'single' ? 'solo' : old.mode === 'shared' ? 'pooled' : 'separate';
  next.settings.people = people;
  next.settings.onboardingDone = Boolean(old.configured);
  next.incomes = old.people.flatMap((p,i)=>Number(p.income)>0?[{id:`legacy-income-${p.id??i}`,name:`Revenu · ${people[i]}`,amountCents:Math.round(Number(p.income)*100),frequency:'monthly' as const,active:true,person:people[i]}]:[]);
  next.expenses = old.expenses.map((e,i)=>({id:`legacy-expense-${e.id??i}`,name:e.name?.trim()||'Dépense',amountCents:Math.round((Number(e.amount)||0)*100),frequency:frequencies[e.period??'']??'monthly',category:e.category??'',active:true,funding:'regular',split:old.mode==='separate'&&old.split==='income'?'proportional':old.mode==='separate'&&old.split==='custom'?'custom':'equal',splitPercent:Number(old.customSplit??50)} as Expense));
  next.ledger = old.history.flatMap((h,i)=>h.date&&Number.isFinite(Number(h.balance))?[{id:`legacy-balance-${h.id??i}`,date:h.date,type:'balance' as const,amountCents:Math.round(Number(h.balance)*100),title:'Solde relevé · ancienne version'} as LedgerEntry]:[]);
  return next;
}
