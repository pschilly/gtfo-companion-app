import React, { useEffect, useState } from 'react';
import {
  CheckCircle,
  Folder,
  FolderSimplePlus,
  HardDrive,
  Info,
  ShieldCheck,
  Sparkle,
  WarningCircle,
} from '@phosphor-icons/react';
import { useApp } from '../context/AppContext';

export const PathOnboardingModal: React.FC = () => {
  const {
    pathOnboardingOpen,
    setPathOnboardingOpen,
    confirmDcsPath,
    dcsEnv,
    refreshDcsEnv,
    settings,
    userSession,
  } = useApp();

  const [pathInput, setPathInput] = useState<string>(
    settings.dcsSavedGamesPath || dcsEnv?.activeSavedGamesPath || 'C:\\Users\\Pilot\\Saved Games\\DCS'
  );

  // Sync initial path when dcsEnv loads if pathInput was default/empty
  useEffect(() => {
    if (pathOnboardingOpen) {
      const active = settings.dcsSavedGamesPath || dcsEnv?.activeSavedGamesPath;
      if (active) {
        setPathInput(active);
      }
    }
  }, [pathOnboardingOpen, settings.dcsSavedGamesPath, dcsEnv?.activeSavedGamesPath]);

  if (!pathOnboardingOpen) return null;

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pathInput.trim()) return;
    confirmDcsPath(pathInput.trim());
  };

  const handleSelectCandidate = (candPath: string) => {
    setPathInput(candPath);
  };

  const matchedCandidate = dcsEnv?.detectedCandidates.find(
    (c) => c.path.toLowerCase() === pathInput.trim().toLowerCase()
  );
  const pathExists = matchedCandidate ? matchedCandidate.exists : false;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-stone-900 border border-stone-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Tactical Header */}
        <div className="px-6 py-5 border-b border-stone-800 bg-stone-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Folder className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Initial Setup // DCS Onboarding
                </span>
                <span className="text-[10px] font-mono text-stone-400 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  First Flight Authorization
                </span>
              </div>
              <h2 className="font-display text-lg font-bold text-stone-100 mt-0.5">
                Confirm DCS Saved Games Path
              </h2>
            </div>
          </div>
          {userSession && (
            <div className="hidden sm:block text-right">
              <span className="text-[11px] font-mono text-stone-400 block">Logged In Aviator</span>
              <span className="text-xs font-mono font-semibold text-amber-300">
                {userSession.globalName || userSession.username}
              </span>
            </div>
          )}
        </div>

        {/* Modal Body */}
        <form onSubmit={handleConfirm} className="p-6 space-y-5">
          {/* Introductory Notice */}
          <div className="p-4 rounded-xl bg-stone-950/80 border border-stone-800/90 text-xs text-stone-300 leading-relaxed space-y-1.5">
            <div className="flex items-center gap-2 text-amber-300 font-semibold font-display">
              <Sparkle className="w-4 h-4 text-amber-400" />
              Welcome to the GTFO Companion
            </div>
            <p>
              To ensure squadron liveries, DTC data cartridge plans, and airfield lighting are
              installed into the right DCS World environment, please verify your local{' '}
              <strong className="text-stone-100">Saved Games</strong> folder path below.
            </p>
          </div>

          {/* Active Path Field */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono uppercase text-stone-300 font-semibold flex items-center gap-2">
                <HardDrive className="w-3.5 h-3.5 text-amber-400" />
                Target DCS Saved Games Directory
              </label>
              <button
                type="button"
                onClick={() => refreshDcsEnv()}
                className="text-[11px] font-mono text-stone-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
                title="Scan system for DCS Saved Games directories"
              >
                <FolderSimplePlus className="w-3 h-3 text-amber-400" />
                Re-scan System
              </button>
            </div>

            <div className="relative">
              <input
                type="text"
                value={pathInput}
                onChange={(e) => setPathInput(e.target.value)}
                placeholder="C:\Users\<Username>\Saved Games\DCS"
                className="w-full px-3.5 py-3 rounded-xl bg-stone-950 border border-stone-800 text-xs font-mono text-stone-100 focus:outline-none focus:border-amber-500 pr-28 shadow-inner"
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                {pathExists ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono">
                    <CheckCircle className="w-3 h-3" />
                    FOUND
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-mono">
                    <WarningCircle className="w-3 h-3" />
                    NEW
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-stone-400">
              <span>
                Standard DCS path:{' '}
                <code className="text-stone-300 font-mono">%USERPROFILE%\Saved Games\DCS</code>
              </span>
              {pathExists ? (
                <span className="text-emerald-400 font-mono flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 inline" /> Verified folder on disk
                </span>
              ) : (
                <span className="text-amber-400/90 font-mono flex items-center gap-1">
                  <Info className="w-3 h-3 inline" /> Will be created on install
                </span>
              )}
            </div>
          </div>

          {/* Detected Candidate Profiles */}
          {dcsEnv && dcsEnv.detectedCandidates.length > 0 && (
            <div className="space-y-2">
              <span className="text-[11px] font-mono uppercase text-stone-400">
                Detected DCS Directory Profiles:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {dcsEnv.detectedCandidates.map((cand) => {
                  const isSelected =
                    pathInput.trim().toLowerCase() === cand.path.toLowerCase();
                  return (
                    <button
                      type="button"
                      key={cand.path}
                      onClick={() => handleSelectCandidate(cand.path)}
                      className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                        isSelected
                          ? 'bg-amber-500/15 border-amber-500/50 text-amber-200 shadow-sm'
                          : 'bg-stone-950/80 border-stone-800 text-stone-300 hover:border-stone-700'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="text-xs font-display font-semibold flex items-center gap-1.5">
                          {cand.label}
                          {cand.variant === 'release' && (
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 uppercase">
                              Standard
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] font-mono text-stone-400 truncate mt-0.5">
                          {cand.path}
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded shrink-0 ${
                          cand.exists
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-stone-800 text-stone-400'
                        }`}
                      >
                        {cand.exists ? 'FOUND' : 'CREATE'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tactical Info Footer Note */}
          <div className="p-3 rounded-xl bg-stone-950/60 border border-stone-800/60 flex items-start gap-2.5 text-[11px] text-stone-400">
            <Info className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Your path choice is cached locally and will not prompt you on future logins. You can
              freely re-point or update this path at any time under{' '}
              <span className="text-stone-200 font-semibold">System Gear</span>.
            </p>
          </div>

          {/* Action Button */}
          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={!pathInput.trim()}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-stone-800 disabled:text-stone-500 text-stone-950 font-display font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all"
            >
              <CheckCircle className="w-4 h-4" />
              Confirm Path &amp; Proceed to Companion
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
