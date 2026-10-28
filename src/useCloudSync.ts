import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { cloudConfigured, readRemoteBudget, supabase, writeRemoteBudget, type RemoteBudget } from './cloud';
import { getSyncMarker, hasLocalState, saveCloudConflictBackup, saveState, setSyncMarker } from './db';
import type { BudgetState } from './model';

export type SyncStatus = 'not-configured' | 'signed-out' | 'checking' | 'syncing' | 'synced' | 'offline' | 'conflict' | 'error';

export function useCloudSync(data: BudgetState, setData: (value: BudgetState) => void, localReady: boolean) {
  const [user, setUser] = useState<Session['user'] | null>(null);
  const [status, setStatus] = useState<SyncStatus>(cloudConfigured ? 'checking' : 'not-configured');
  const [remote, setRemote] = useState<RemoteBudget | null>(null);
  const [error, setError] = useState('');
  const [authReady, setAuthReady] = useState(!cloudConfigured);
  const baseline = useRef<string | null>(null);
  const readyToSync = useRef(false);
  const paused = useRef(false);
  const pendingPush = useRef<ReturnType<typeof setTimeout> | null>(null);
  const running = useRef(false);
  const dataRef = useRef(data);
  const statusRef = useRef(status);
  useEffect(() => { dataRef.current = data; }, [data]);
  useEffect(() => { statusRef.current = status; }, [status]);

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    void supabase.auth.getSession().then(({ data: result }) => {
      if (mounted) { setUser(result.session?.user ?? null); setAuthReady(true); }
    }).catch(() => { if (mounted) { setAuthReady(true); setStatus('error'); setError('Impossible de vérifier la session.'); } });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthReady(true);
    });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);

  const reconcile = useCallback(async (currentUser: NonNullable<typeof user>) => {
    if (!localReady || !supabase) return;
    readyToSync.current = false;
    setStatus('checking'); setError(''); setRemote(null);
    try {
      const [cloudBudget, marker, localExists] = await Promise.all([
        readRemoteBudget(currentUser.id), getSyncMarker(currentUser.id), hasLocalState(),
      ]);
      if (!cloudBudget) {
        const local = dataRef.current;
        const localHasWork = localExists && (local.settings.onboardingDone || local.incomes.length + local.expenses.length + local.envelopes.length + local.goals.length + local.ledger.length > 0);
        if (localHasWork) {
          baseline.current = null;
          setRemote(null);
          setStatus('conflict');
          return;
        }
        const savedAt = await writeRemoteBudget(currentUser.id, dataRef.current, null);
        baseline.current = savedAt;
        await setSyncMarker(currentUser.id, savedAt);
        readyToSync.current = true;
        setStatus(navigator.onLine ? 'synced' : 'offline');
        return;
      }
      const local = dataRef.current;
      const localHasWork = localExists && (local.settings.onboardingDone || local.incomes.length + local.expenses.length + local.envelopes.length + local.goals.length + local.ledger.length > 0);
      if (!localHasWork || marker?.remoteUpdatedAt === cloudBudget.updatedAt) {
        if (localHasWork && marker?.remoteUpdatedAt === cloudBudget.updatedAt) {
          baseline.current = cloudBudget.updatedAt;
        } else {
          paused.current = true;
          setData(cloudBudget.state);
          await saveState(cloudBudget.state);
          await setSyncMarker(currentUser.id, cloudBudget.updatedAt);
          baseline.current = cloudBudget.updatedAt;
          paused.current = false;
        }
        readyToSync.current = true;
        setStatus(navigator.onLine ? 'synced' : 'offline');
      } else {
        setRemote(cloudBudget);
        baseline.current = cloudBudget.updatedAt;
        setStatus('conflict');
      }
    } catch (cause) {
      setStatus(navigator.onLine ? 'error' : 'offline');
      setError(cause instanceof Error ? cause.message : 'La synchronisation a échoué.');
    }
  }, [localReady, setData]);

  useEffect(() => {
    if (!authReady || !localReady) return;
    if (!user) {
      readyToSync.current = false; baseline.current = null;
      setStatus(cloudConfigured ? 'signed-out' : 'not-configured');
      return;
    }
    void reconcile(user);
  }, [authReady, localReady, user, reconcile]);

  const uploadLatest = useCallback(async (currentUser: NonNullable<typeof user>) => {
    if (!readyToSync.current || paused.current || running.current) return;
    const latestState = dataRef.current;
    await saveState(latestState);
    if (!navigator.onLine) { setStatus('offline'); return; }
    running.current = true; setStatus('syncing'); setError('');
    try {
      const savedAt = await writeRemoteBudget(currentUser.id, latestState, baseline.current);
      baseline.current = savedAt;
      await setSyncMarker(currentUser.id, savedAt);
      setStatus('synced');
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : 'Erreur inconnue';
      if (detail.includes('NUMA_SYNC_CONFLICT') || detail.includes('40001')) {
        readyToSync.current = false;
        try {
          const latest = await readRemoteBudget(currentUser.id);
          if (latest) { setRemote(latest); baseline.current = latest.updatedAt; setStatus('conflict'); }
          else { setStatus('error'); setError('La version distante a changé. Réessayez la synchronisation.'); }
        } catch { setStatus('error'); setError('Impossible de récupérer la version cloud la plus récente.'); }
      } else { setStatus(navigator.onLine ? 'error' : 'offline'); setError(detail); }
    } finally { running.current = false; }
  }, []);

  useEffect(() => {
    if (!user || !readyToSync.current || paused.current || statusRef.current === 'conflict' || !localReady) return;
    if (pendingPush.current) clearTimeout(pendingPush.current);
    pendingPush.current = setTimeout(() => {
      if (user) void uploadLatest(user);
    }, 700);
    return () => { if (pendingPush.current) clearTimeout(pendingPush.current); };
  }, [data, localReady, uploadLatest, user]);

  useEffect(() => {
    const online = () => { if (user) void reconcile(user).then(() => uploadLatest(user)); };
    const focused = () => { if (user && document.visibilityState === 'visible') void reconcile(user); };
    window.addEventListener('online', online);
    document.addEventListener('visibilitychange', focused);
    return () => { window.removeEventListener('online', online); document.removeEventListener('visibilitychange', focused); };
  }, [reconcile, uploadLatest, user]);

  const signIn = useCallback(async () => {
    if (!supabase) return;
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin, queryParams: { access_type: 'offline', prompt: 'consent' } },
    });
    if (authError) { setError(authError.message); setStatus('error'); }
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    const { error: authError } = await supabase.auth.signOut();
    if (authError) { setError(authError.message); setStatus('error'); }
  }, []);

  const chooseRemote = useCallback(async () => {
    if (!remote || !user) return;
    paused.current = true;
    try {
      await saveCloudConflictBackup(data);
      await saveState(remote.state);
      await setSyncMarker(user.id, remote.updatedAt);
      baseline.current = remote.updatedAt;
      setData(remote.state);
      setRemote(null); readyToSync.current = true; setStatus('synced');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible de conserver les budgets sur cet appareil.');
      setStatus('error');
    } finally { paused.current = false; }
  }, [data, remote, setData, user]);

  const chooseLocal = useCallback(async () => {
    if (!user) return;
    readyToSync.current = false;
    paused.current = true;
    setStatus('syncing');
    try {
      await saveState(data);
      const savedAt = await writeRemoteBudget(user.id, data, remote?.updatedAt ?? null);
      baseline.current = savedAt; await setSyncMarker(user.id, savedAt);
      setRemote(null); readyToSync.current = true; setStatus('synced');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Le budget cloud a changé pendant le choix.');
      setStatus('error');
      void reconcile(user);
    } finally { paused.current = false; }
  }, [data, reconcile, remote, user]);

  return { configured: cloudConfigured, user, status, remote, error, signIn, signOut, chooseRemote, chooseLocal, syncNow: () => user && void uploadLatest(user) };
}
