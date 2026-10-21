import React, { useState } from 'react';
import {
  ArrowCounterClockwise,
  CheckCircle,
  FloppyDisk,
  FolderSimplePlus,
  HardDrive,
} from '@phosphor-icons/react';
import { DEFAULT_SETTINGS } from '../config/constants';
import { useApp } from '../context/AppContext';

export const SettingsView: React.FC = () => {
  const {
    settings,
    updateSettings,
    dcsEnv,
    refreshDcsEnv,
    hasConfirmedDcsPath,
    setPathOnboardingOpen,
  } = useApp();

  const [pathInput, setPathInput] = useState(
    settings.dcsSavedGamesPath || dcsEnv?.activeSavedGamesPath || ''
  );
  const [savedBanner, setSavedBanner] = useState(false);

  const handleSavePaths = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      dcsSavedGamesPath: pathInput.trim(),
      hasConfirmedDcsPath: true,
    });
    refreshDcsEnv(pathInput.trim());
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 2500);
  };

  const handleSelectCandidate = (candidatePath: string) => {
    setPathInput(candidatePath);
    updateSettings({ dcsSavedGamesPath: candidatePath, autoDetectDcsPath: false });
    refreshDcsEnv(candidatePath);
  };

  return (
    <div className="max-w-3xl space-y-6 pb-10 mx-auto">
      <div className="flex items-center justify-between pb-4 border-b border-stone-800/80">
        <div>
          <h1 className="font-display text-2xl font-bold bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent">
            System Gear
          </h1>
          <p className="text-xs text-stone-400 mt-0.5">
            Configure your local DCS World <code className="font-mono text-stone-300">Saved Games</code>{' '}
            path and file verification preferences.
          </p>
        </div>
        {savedBanner && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-mono">
            <CheckCircle className="w-4 h-4" />
            Gear Saved
          </span>
        )}
      </div>

      {/* DCS Saved Games Directory Detection & Override */}
      <form
        onSubmit={handleSavePaths}
        className="p-6 rounded-2xl bg-stone-900/90 border border-stone-800 space-y-6"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <HardDrive className="w-5 h-5 text-amber-400" />
            <h2 className="font-display text-base font-bold text-stone-100">
              DCS Saved Games Directory Mapping
            </h2>
          </div>
          <button
            type="button"
            onClick={() => refreshDcsEnv()}
            className="px-3 py-1.5 rounded-xl bg-stone-950 hover:bg-stone-800 border border-stone-700 text-xs font-mono text-stone-300 flex items-center gap-1.5 transition-colors"
          >
            <FolderSimplePlus className="w-3.5 h-3.5 text-amber-400" />
            Auto-Detect Windows Paths
          </button>
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-mono uppercase text-stone-400">
            Active Target DCS Saved Games Path
          </label>
          <input
            type="text"
            value={pathInput}
            onChange={(e) => setPathInput(e.target.value)}
            placeholder="C:\Users\<Username>\Saved Games\DCS"
            className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-xs font-mono text-stone-100 focus:outline-none focus:border-amber-500"
          />
          <p className="text-[11px] text-stone-400 leading-relaxed">
            Liveries are deployed into{' '}
            <code className="font-mono text-stone-300">&lt;Path&gt;\Liveries\&lt;Aircraft&gt;</code>{' '}
            and mods/tech packages into{' '}
            <code className="font-mono text-stone-300">&lt;Path&gt;\Mods\tech\...</code>.
          </p>
        </div>

        {/* Detected Windows Candidates */}
        {dcsEnv && dcsEnv.detectedCandidates.length > 0 && (
          <div className="space-y-2">
            <span className="text-[11px] font-mono uppercase text-stone-400">
              Detected Local DCS Profiles:
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {dcsEnv.detectedCandidates.map((cand) => {
                const isSelected = pathInput === cand.path;
                return (
                  <button
                    type="button"
                    key={cand.path}
                    onClick={() => handleSelectCandidate(cand.path)}
                    className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-500/50 text-amber-200'
                        : 'bg-stone-950/90 border-stone-800 text-stone-300 hover:border-stone-700'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="text-xs font-display font-semibold">{cand.label}</div>
                      <div className="text-[11px] font-mono text-stone-400 truncate">
                        {cand.path}
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded ${
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

        {/* Verification & Sync Toggles */}
        <div className="pt-4 border-t border-stone-800/80 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            <label className="flex items-center gap-2 text-xs text-stone-300 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.autoSyncOnStartup}
                onChange={(e) => updateSettings({ autoSyncOnStartup: e.target.checked })}
                className="rounded border-stone-700 bg-stone-950 text-amber-500 focus:ring-amber-500"
              />
              Automatically sync Portal Dossier &amp; Asset Manifest on startup
            </label>

            <label className="flex items-center gap-2 text-xs text-stone-300 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.verifyFileHash}
                onChange={(e) => updateSettings({ verifyFileHash: e.target.checked })}
                className="rounded border-stone-700 bg-stone-950 text-amber-500 focus:ring-amber-500"
              />
              Verify file integrity hashes (Git Blob SHA-1 / SHA-256)
            </label>
          </div>
        </div>

        <div className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => {
                updateSettings(DEFAULT_SETTINGS);
                setPathInput(dcsEnv?.activeSavedGamesPath || '');
              }}
              className="text-xs font-mono text-stone-400 hover:text-stone-200 flex items-center gap-1.5"
            >
              <ArrowCounterClockwise className="w-3.5 h-3.5" />
              Reset to Defaults
            </button>
            <button
              type="button"
              onClick={() => setPathOnboardingOpen(true)}
              className="text-xs font-mono text-stone-400 hover:text-amber-300 flex items-center gap-1.5 transition-colors"
            >
              <FolderSimplePlus className="w-3.5 h-3.5 text-amber-400" />
              Review Onboarding Prompt
            </button>
          </div>

          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-display font-bold text-xs flex items-center gap-2 shadow"
          >
            <FloppyDisk className="w-4 h-4" />
            FloppyDisk Gear
          </button>
        </div>
      </form>
    </div>
  );
};
