import { Cloud, CloudOff, LoaderCircle, LogIn, LogOut, RefreshCw, ShieldCheck } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import type { BudgetState } from './model';
import type { SyncStatus } from './useCloudSync';

interface Props {
  configured: boolean; user: User | null; status: SyncStatus; error: string;
  onSignIn: () => void; onSignOut: () => void; onSync: () => void;
}

const statusLabels: Record<SyncStatus, string> = {
  'not-configured': 'Service cloud à configurer',
  'signed-out': 'Budget conservé sur cet appareil',
  checking: 'Vérification de votre espace…',
  syncing: 'Synchronisation en cours…',
  synced: 'Budget synchronisé',
  offline: 'Hors ligne · changements enregistrés ici',
  conflict: 'Choix de synchronisation requis',
  error: 'Synchronisation interrompue',
};

export function CloudPanel({ configured, user, status, error, onSignIn, onSignOut, onSync }: Props) {
  const BusyIcon = status === 'checking' || status === 'syncing' ? LoaderCircle : status === 'offline' || status === 'signed-out' ? CloudOff : Cloud;
  return <section className="panel setting-panel cloud-panel">
    <div className="cloud-panel-head"><div><span className="section-kicker">VOTRE ESPACE, PARTOUT</span><h3>Connexion & synchronisation</h3></div><div className={`cloud-status-mark ${status}`}><BusyIcon size={19}/></div></div>
    {!configured ? <>
      <p>La connexion Google est prête dans l’application. Elle s’activera après la configuration du service cloud et des identifiants OAuth.</p>
      <small className="cloud-setup-note">Aucune donnée n’est envoyée tant que cette configuration n’est pas terminée.</small>
    </> : user ? <>
      <div className="cloud-account-line"><span className="google-avatar">{user.email?.[0]?.toUpperCase() ?? 'G'}</span><div><b>{user.email ?? 'Compte Google connecté'}</b><small>{statusLabels[status]}</small></div></div>
      {error && <div className="cloud-error">{error}</div>}
      <div className="cloud-buttons"><button className="outline-btn" onClick={onSync} disabled={status === 'checking' || status === 'syncing'}><RefreshCw size={15}/> Synchroniser</button><button className="outline-btn" onClick={onSignOut}><LogOut size={15}/> Déconnecter</button></div>
      <div className="cloud-security-note"><ShieldCheck size={15}/> Seul ce compte peut lire ou modifier son budget cloud.</div>
    </> : <>
      <p>Connectez-vous avec Google pour retrouver le même budget sur vos autres appareils. NUMA ne demande que l’identité et l’adresse e-mail de votre compte.</p>
      <div className="cloud-status-line"><BusyIcon size={15}/><span>{statusLabels[status]}</span></div>
      {error && <div className="cloud-error">{error}</div>}
      <button className="primary-btn cloud-login" onClick={onSignIn}><LogIn size={16}/> Continuer avec Google</button>
      <small className="cloud-setup-note">Connexion facultative. Le mode local et l’export JSON restent disponibles.</small>
    </>}
  </section>;
}

export function SyncResolution({ local, remote, onUseLocal, onUseRemote, onKeepLocal }: {
  local: BudgetState; remote: { state: BudgetState; updatedAt: string } | null;
  onUseLocal: () => void; onUseRemote: () => void; onKeepLocal: () => void;
}) {
  const exportLocal = () => {
    const blob = new Blob([JSON.stringify(local, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = 'numa-budget-local-avant-synchronisation.json'; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const localCount = local.incomes.length + local.expenses.length + local.envelopes.length + local.goals.length + local.ledger.length;
  const remoteCount = remote ? remote.state.incomes.length + remote.state.expenses.length + remote.state.envelopes.length + remote.state.goals.length + remote.state.ledger.length : 0;
  return <main className={`sync-resolution ${local.settings.theme === 'dark' ? 'dark' : ''}`}>
    <section className="sync-resolution-card">
      <div className="logo-mark">n</div><span className="section-kicker">NUMA · PREMIÈRE SYNCHRONISATION</span>
      <h1>{remote ? 'Quel budget voulez-vous garder ?' : 'Associer ce budget à votre compte ?'}</h1>
      <p>{remote ? 'Un budget est déjà enregistré sur cet appareil et un autre existe dans votre compte. Choisissez la version à utiliser sur tous vos appareils.' : 'Ce budget existe sur cet appareil, mais votre compte ne contient pas encore de budget NUMA. Confirmez avant de le copier dans le cloud.'}</p>
      <div className="sync-choice-grid">
        <article><CloudOff size={20}/><b>Sur cet appareil</b><span>{localCount} élément{localCount === 1 ? '' : 's'} configuré{localCount === 1 ? '' : 's'}</span><button className="outline-btn" onClick={exportLocal}>Télécharger une copie JSON</button><button className="primary-btn" onClick={remote ? onUseLocal : onUseLocal}>{remote ? 'Garder ce budget et remplacer la copie cloud' : 'Synchroniser ce budget avec mon compte'}</button>{!remote && <button className="text-link" onClick={onKeepLocal}>Continuer sans synchronisation</button>}</article>
        {remote && <article><Cloud size={20}/><b>Dans votre compte</b><span>{remoteCount} élément{remoteCount === 1 ? '' : 's'} · mis à jour le {new Intl.DateTimeFormat('fr-BE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(remote.updatedAt))}</span><button className="primary-btn" onClick={onUseRemote}>Utiliser ce budget sur cet appareil</button></article>}
      </div>
      <small className="cloud-security-note"><ShieldCheck size={15}/> Les budgets restent privés au compte Google connecté. Votre budget local est conservé dans NUMA si vous choisissez la version cloud.</small>
    </section>
  </main>;
}
