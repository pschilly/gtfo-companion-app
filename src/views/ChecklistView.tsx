import React from 'react';
import {
  ArrowSquareOut,
  ArrowsClockwise,
  CheckCircle,
  ListChecks,
  ShieldCheck,
  ShieldWarning,
  Sparkle,
} from '@phosphor-icons/react';
import { DossierNav } from '../components/DossierNav';
import { NewMemberChecklist } from '../components/NewMemberChecklist';
import { STATIC_CONFIG } from '../config/constants';
import { useApp } from '../context/AppContext';

export const ChecklistView: React.FC = () => {
  const { checklistSummary, syncMemberPortal, syncManifest, refreshDcsNickname } =
    useApp();
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        syncMemberPortal(),
        syncManifest(),
        refreshDcsNickname(),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="space-y-6 pb-8 max-w-7xl mx-auto">
      {/* Dossier Sub NavigationArrow */}
      <DossierNav />

      {/* Hero Header Card */}
      <div className="relative rounded-2xl overflow-hidden border border-stone-800 bg-stone-900/90 shadow-2xl p-6 sm:p-7">
        {/* Atmospheric Lighting */}
        <div className="absolute -top-24 -left-20 w-80 h-80 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-20 w-80 h-80 rounded-full bg-red-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-[11px] font-bold uppercase tracking-wider">
                <ListChecks className="w-3.5 h-3.5 text-amber-400" />
                <span>Flight Line Onboarding</span>
              </span>

              {checklistSummary.allComplete ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono text-[11px] font-bold uppercase tracking-wider">
                  <CheckCircle className="w-3 h-3 text-emerald-400" />
                  Combat Ready (4/4)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono text-[11px] font-bold uppercase tracking-wider animate-pulse">
                  <ShieldWarning className="w-3 h-3 text-amber-400" />
                  {checklistSummary.pendingCount} Action Item{checklistSummary.pendingCount === 1 ? '' : 's'} Pending
                </span>
              )}
            </div>

            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-stone-100 tracking-tight">
              Member Readiness
            </h1>

            <p className="text-sm text-stone-300 leading-relaxed">
              Complete these 4 mandatory onboarding steps to prepare your DCS World simulator environment for official GTFO squadron sorties, training missions, and automated sortie logging.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 shrink-0 self-start lg:self-center">
            <button
              onClick={handleRefreshAll}
              disabled={isRefreshing}
              className="px-4 py-2.5 rounded-xl bg-stone-950 hover:bg-stone-800 border border-stone-700 text-stone-200 font-mono text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <ArrowsClockwise
                className={`w-3.5 h-3.5 text-amber-400 ${
                  isRefreshing ? 'animate-spin' : ''
                }`}
              />
              <span>{isRefreshing ? 'Re-checking...' : 'Re-check Status'}</span>
            </button>

            <a
              href={STATIC_CONFIG.kbUrl}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2.5 rounded-xl bg-stone-950 hover:bg-stone-800 border border-stone-700 text-amber-400 font-mono text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <span>Onboarding SOP</span>
              <ArrowSquareOut className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* Main Checklist Card (Always Open on dedicated view) */}
      <NewMemberChecklist alwaysOpen={true} />
    </div>
  );
};
