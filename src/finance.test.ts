import { describe, expect, it } from 'vitest';
import { calculateBudget, monthlyEquivalent, personContributions } from './finance';
import { blankState, type Expense } from './model';
import { migrateLegacyState } from './migration';
describe('finance engine', () => {
  it('annual and quarterly costs become monthly provisions', () => { expect(monthlyEquivalent(120000,'annual')).toBe(10000); expect(monthlyEquivalent(30000,'quarterly')).toBe(10000); });
  it('does not count envelope-funded costs as a second planned expense', () => { const s = structuredClone(blankState); s.incomes.push({ id:'i',name:'Income',amountCents:300000,frequency:'monthly',active:true }); s.envelopes.push({ id:'e',name:'Food',icon:'🥕',color:'#83a98e',monthlyCents:50000,carry:true,spentCents:0 }); s.expenses.push({ id:'x',name:'Groceries',amountCents:20000,frequency:'monthly',category:'Food',active:true,funding:'envelope',split:'equal' }); expect(calculateBudget(s).plannedCents).toBe(50000); });
  it('handles zero income and deficit budgets', () => { const s=structuredClone(blankState); s.expenses.push({id:'x',name:'Rent',amountCents:100000,frequency:'monthly',category:'',active:true,funding:'regular',split:'equal'}); expect(calculateBudget(s).unassignedCents).toBe(-100000); expect(calculateBudget(s).savingsRate).toBe(0); });
  it('splits cents without losing the remainder', () => { const e: Expense={id:'x',name:'Shared',amountCents:10001,frequency:'monthly',category:'',active:true,funding:'regular',split:'equal'}; const parts=personContributions(e,[{person:'A',amountCents:1},{person:'B',amountCents:1}]); expect(parts.map(p=>p.amountCents)).toEqual([5001,5000]); });
  it('includes one-off income and expenses only in their selected month', () => {
    const s=structuredClone(blankState); s.incomes.push({id:'once-in',name:'One-off',amountCents:75000,frequency:'once',startMonth:'2026-10',active:true}); s.expenses.push({id:'once-out',name:'One-off charge',amountCents:20000,frequency:'once',startMonth:'2026-10',category:'',active:true,funding:'regular',split:'equal'});
    expect(calculateBudget(s,'2026-10').incomeCents).toBe(75000); expect(calculateBudget(s,'2026-10').regularCents).toBe(20000); expect(calculateBudget(s,'2026-11').incomeCents).toBe(0); expect(calculateBudget(s,'2026-11').regularCents).toBe(0);
  });
  it('observes income start and end months', () => {
    const s=structuredClone(blankState); s.incomes.push({id:'limited',name:'Temporary',amountCents:100000,frequency:'monthly',startMonth:'2026-10',endMonth:'2026-11',active:true});
    expect(calculateBudget(s,'2026-09').incomeCents).toBe(0); expect(calculateBudget(s,'2026-10').incomeCents).toBe(100000); expect(calculateBudget(s,'2026-12').incomeCents).toBe(0);
  });
  it('migrates the previous local budget without losing income, expenses, or balance history', () => {
    const migrated=migrateLegacyState({configured:true,situation:'couple',mode:'separate',split:'custom',customSplit:60,people:[{id:'a',name:'Alex',income:2400,personal:200},{id:'b',name:'Sam',income:1600,personal:100}],expenses:[{id:'r',name:'Rent',amount:900,period:'monthly',category:'Home'}],history:[{id:'h',date:'2026-10-01',balance:1250}]});
    expect(migrated?.incomes.map(x=>x.amountCents)).toEqual([240000,160000]); expect(migrated?.expenses[0].amountCents).toBe(90000); expect(migrated?.expenses[0].split).toBe('custom'); expect(migrated?.ledger[0]).toMatchObject({type:'balance',amountCents:125000}); expect(migrated?.settings.onboardingDone).toBe(true);
  });
});
