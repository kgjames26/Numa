import type { BudgetState, Expense, Frequency } from './model';
export const monthlyEquivalent = (amount: number, frequency: Frequency): number => {
  const factors: Record<Frequency, number> = { weekly: 52/12, biweekly: 26/12, monthly: 1, bimonthly: 1/2, quarterly: 1/3, semiannual: 1/6, annual: 1/12, once: 0, custom: 1 };
  return Math.round(amount * factors[frequency]);
};
export function monthlyIncome(state: BudgetState, month = new Date().toISOString().slice(0,7)): number { return state.incomes.filter(i => i.active && (!i.startMonth || i.startMonth <= month) && (!i.endMonth || i.endMonth >= month) && (i.frequency !== 'once' || i.startMonth === month)).reduce((s,i) => s + (i.frequency === 'once' ? i.amountCents : monthlyEquivalent(i.amountCents,i.frequency)),0); }
export function monthlyExpense(expense: Expense, month = new Date().toISOString().slice(0,7)): number { if (!expense.active || (expense.startMonth && expense.startMonth > month) || (expense.endMonth && expense.endMonth < month)) return 0; return expense.frequency === 'once' ? (expense.startMonth === month ? expense.amountCents : 0) : monthlyEquivalent(expense.amountCents,expense.frequency); }
export function calculateBudget(state: BudgetState, month = new Date().toISOString().slice(0,7)) {
  const incomeCents = monthlyIncome(state,month); const expenses = state.expenses.filter(e => e.active && (!e.startMonth || e.startMonth <= month) && (!e.endMonth || e.endMonth >= month));
  const regularCents = expenses.filter(e => e.funding === 'regular').reduce((s,e) => s + monthlyExpense(e,month),0);
  const provisionExpenseCents = expenses.filter(e => e.funding === 'provision').reduce((s,e) => s + monthlyExpense(e,month),0);
  const envelopeCents = state.envelopes.reduce((s,e) => s + e.monthlyCents,0);
  const goalCents = state.goals.filter(g => g.kind !== 'provision').reduce((s,g) => s + g.monthlyCents,0);
  const plannedCents = regularCents + provisionExpenseCents + envelopeCents + goalCents;
  const ledger = state.ledger.filter(entry => entry.date.slice(0,7) === month);
  const actualIncomeCents = ledger.filter(e => e.type === 'income').reduce((s,e) => s+e.amountCents,0);
  const actualExpenseCents = ledger.filter(e => e.type === 'expense').reduce((s,e) => s+e.amountCents,0);
  const actualBalanceCents = actualIncomeCents - actualExpenseCents;
  return { incomeCents, regularCents, provisionExpenseCents, envelopeCents, goalCents, plannedCents, unassignedCents: incomeCents - plannedCents, actualIncomeCents, actualExpenseCents, actualBalanceCents, reservedCents: Math.max(0,plannedCents), savingsRate: incomeCents > 0 ? Math.round(goalCents / incomeCents * 100) : 0, allocationRate: incomeCents > 0 ? Math.round(plannedCents / incomeCents * 100) : 0, upcoming: expenses.filter(e => e.dueDay).sort((a,b) => (a.dueDay ?? 0)-(b.dueDay ?? 0)) };
}
export function personContributions(expense: Expense, incomes: { person?: string; amountCents: number }[]) {
  const people = [...new Set(incomes.map(i => i.person).filter((p): p is string => Boolean(p)))]; const monthly = monthlyExpense(expense); if (!people.length) return [];
  if (expense.split === 'one') return people.map((person,i) => ({ person, amountCents: i === 0 ? monthly : 0 }));
  if (expense.split === 'custom') { const first = Math.round(monthly * (expense.splitPercent ?? 50) / 100); return people.map((person,i) => ({ person, amountCents: i === 0 ? first : monthly-first })); }
  if (expense.split === 'proportional') { const total = incomes.reduce((s,i) => s+i.amountCents,0); return people.map(person => ({ person, amountCents: total ? Math.round(monthly * incomes.filter(i=>i.person===person).reduce((s,i)=>s+i.amountCents,0)/total) : Math.round(monthly/people.length) })); }
  const each = Math.floor(monthly/people.length); let remainder = monthly - each*people.length; return people.map(person => { const extra = remainder-- > 0 ? 1 : 0; return { person, amountCents: each+extra }; });
}
export function formatMoney(cents: number, currency='EUR', locale='fr-BE') { return new Intl.NumberFormat(locale,{style:'currency',currency,maximumFractionDigits:2}).format(cents/100); }
