import Dexie, { type Table } from 'dexie';
import { blankState, type BudgetState } from './model';
class NumaDB extends Dexie { state!: Table<{ id: string; data: BudgetState }, string>; constructor() { super('numa-local'); this.version(1).stores({ state: 'id' }); } }
export const db = new NumaDB();
export async function loadState(): Promise<BudgetState> { return (await db.state.get('main'))?.data ?? structuredClone(blankState); }
export async function saveState(data: BudgetState) { await db.state.put({ id: 'main', data }); }
export function validateBackup(value: unknown): value is BudgetState { if (!value || typeof value !== 'object') return false; const v = value as Partial<BudgetState>; return !!v.settings && Array.isArray(v.incomes) && Array.isArray(v.expenses) && Array.isArray(v.envelopes) && Array.isArray(v.goals) && Array.isArray(v.ledger); }
