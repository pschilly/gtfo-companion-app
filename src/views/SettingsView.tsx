import React, { useState } from 'react';
import {
  ArrowCounterClockwise,
  ArrowSquareOut,
  ArrowsClockwise,
  CheckCircle,
  FloppyDisk,
  FolderSimplePlus,
  HardDrive,
  Info,
  ShieldCheck,
  Sliders,
  Sparkle,
} from '@phosphor-icons/react';
import { DEFAULT_SETTINGS, STATIC_CONFIG } from '../config/constants';
import { useApp } from '../context/AppContext';

type SettingsSubTab = 'general' | 'updates' | 'about';

export const SettingsView: React.FC = () => {
  const {
    settings,
    updateSettings,
    dcsEnv,
    refreshDcsEnv,
    hasConfirmedDcsPath,
    setPathOnboardingOpen,
    appUpdate,
    isCheckingAppUpdate,
    checkForAppUpdateAction,
    setIsUpdateModalOpen,
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<SettingsSubTab>('general');
  const [pathInput, setPathInput] = useState(
    settings.dcsSavedGamesPath || dcsEnv?.activeSavedGamesPath || ''
  );
  const [savedBanner, setSavedBanner] = useState(false);
  const [manualCheckFeedback, setManualCheckFeedback] = useState<string | null>(null);

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

  const handleManualCheck = async () => {
    setManualCheckFeedback(null);
    try {
      const info = await checkForAppUpdateAction();
      if (info.available) {
        setManualCheckFeedback(`Update found: v${info.version}`);
      } else {
        setManualCheckFeedback(`You are on the latest version (v${info.currentVersion || STATIC_CONFIG.appVersion}).`);
      }
    } catch {
      setManualCheckFeedback('Unable to check for updates right now. Please verify your internet connection.');
    }
  };

  const tabs: { id: SettingsSubTab; label: string; icon: React.ReactNode; badge?: React.ReactNode }[] = [
    {
      id: 'general',
      label: 'General & DCS',
      icon: <Sliders className="w-4 h-4" />,
    },
    {
      id: 'updates',
      label: 'Updates',
      icon: <ArrowsClockwise className="w-4 h-4" />,
      badge: appUpdate?.available ? (
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
      ) : undefined,
    },
    {
      id: 'about',
      label: 'About',
      icon: <Info className="w-4 h-4" />,
    },
  ];

  return (
    <div className="max-w-3xl space-y-6 pb-12 mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-800/80">
        <div>
          <h1 className="font-display text-2xl font-bold bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent">
            System Settings
          </h1>
          <p className="text-xs text-stone-400 mt-0.5">
            Simulator directory paths, application updates, and runtime specifications.
          </p>
        </div>

        {savedBanner && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-mono self-start sm:self-auto">
            <CheckCircle className="w-4 h-4" />
            Settings Saved
          </span>
        )}
      </div>

      {/* Sub-Page Navigation Pills */}
      <div className="flex items-center gap-2 p-1 rounded-2xl bg-stone-900/90 border border-stone-800 shadow-sm w-fit">
        {tabs.map((tab) => {
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono transition-all ${
                isActive
                  ? 'bg-amber-500 text-stone-950 font-bold shadow-md shadow-amber-500/20'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/80'
              }`}
            >
              <span className={isActive ? 'text-stone-950' : 'text-amber-400'}>{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.badge}
            </button>
          );
        })}
      </div>

      {/* ============================================================ */}
      {/* SUB-PAGE 1: GENERAL & DCS SETUP                              */}
      {/* ============================================================ */}
      {activeSubTab === 'general' && (
        <form
          onSubmit={handleSavePaths}
          className="p-6 rounded-2xl bg-stone-900/90 border border-stone-800 space-y-6 shadow-xl"
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
              className="px-3 py-1.5 rounded-xl bg-stone-950 hover:bg-stone-800 border border-stone-700 text-xs font-mono text-stone-300 flex items-center gap-1.5 transition-colors cursor-pointer"
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
                      className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
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
                className="text-xs font-mono text-stone-400 hover:text-stone-200 flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowCounterClockwise className="w-3.5 h-3.5" />
                Reset to Defaults
              </button>
              <button
                type="button"
                onClick={() => setPathOnboardingOpen(true)}
                className="text-xs font-mono text-stone-400 hover:text-amber-300 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <FolderSimplePlus className="w-3.5 h-3.5 text-amber-400" />
                Review Onboarding Prompt
              </button>
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-display font-bold text-xs flex items-center justify-center gap-2 shadow cursor-pointer"
            >
              <FloppyDisk className="w-4 h-4" />
              Save Settings
            </button>
          </div>
        </form>
      )}

      {/* ============================================================ */}
      {/* SUB-PAGE 2: APPLICATION UPDATES                              */}
      {/* ============================================================ */}
      {activeSubTab === 'updates' && (
        <div className="space-y-6">
          {/* Update Status Card */}
          <div className="p-6 rounded-2xl bg-stone-900/90 border border-stone-800 space-y-6 shadow-xl">
            <div className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
              <div className="flex items-center gap-3.5">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                    appUpdate?.available
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                      : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                  }`}
                >
                  {appUpdate?.available ? (
                    <Sparkle className="w-6 h-6 animate-pulse" />
                  ) : (
                    <CheckCircle className="w-6 h-6" />
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-lg font-bold text-stone-100">
                      {appUpdate?.available ? 'Update Available' : 'Application Up to Date'}
                    </h2>
                    <span
                      className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold uppercase tracking-wider border ${
                        appUpdate?.available
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                      }`}
                    >
                      {appUpdate?.available ? `v${appUpdate.version}` : `v${STATIC_CONFIG.appVersion}`}
                    </span>
                  </div>
                  <p className="text-xs text-stone-400 mt-0.5">
                    {appUpdate?.available
                      ? 'A newer build is ready for download and automatic installation.'
                      : 'You are running the official release version of the GTFO Companion App.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={handleManualCheck}
                  disabled={isCheckingAppUpdate}
                  className="px-4 py-2 rounded-xl bg-stone-950 hover:bg-stone-800 border border-stone-700 text-stone-200 font-mono text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <ArrowsClockwise
                    className={`w-3.5 h-3.5 text-amber-400 ${isCheckingAppUpdate ? 'animate-spin' : ''}`}
                  />
                  <span>{isCheckingAppUpdate ? 'Checking...' : 'Check for Updates'}</span>
                </button>

                {appUpdate?.available && (
                  <button
                    type="button"
                    onClick={() => setIsUpdateModalOpen(true)}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-display font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
                  >
                    <Sparkle className="w-3.5 h-3.5" />
                    <span>Install v{appUpdate.version}</span>
                  </button>
                )}
              </div>
            </div>

            {manualCheckFeedback && (
              <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 text-xs font-mono text-stone-300 flex items-center gap-2">
                <Info className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{manualCheckFeedback}</span>
              </div>
            )}

            {/* Release notes preview if available */}
            {appUpdate?.available && appUpdate.body && (
              <div className="p-4 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
                <span className="text-[11px] font-mono uppercase text-stone-400 tracking-wider">
                  Release Notes (v{appUpdate.version})
                </span>
                <p className="text-xs text-stone-300 leading-relaxed whitespace-pre-wrap font-mono">
                  {appUpdate.body}
                </p>
              </div>
            )}
          </div>

          {/* Update Channel & Technical Details Card */}
          <div className="p-6 rounded-2xl bg-stone-900/90 border border-stone-800 space-y-4 shadow-xl">
            <h3 className="font-display text-sm font-bold text-stone-200 uppercase tracking-wider">
              Deployment &amp; Security Specifications
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
              <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 space-y-1">
                <span className="text-stone-500 text-[10px] uppercase">Installed Version</span>
                <p className="text-stone-200 font-bold">v{STATIC_CONFIG.appVersion}</p>
              </div>

              <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 space-y-1">
                <span className="text-stone-500 text-[10px] uppercase">Release Channel</span>
                <p className="text-amber-300">Official Releases</p>
              </div>

              <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 space-y-1">
                <span className="text-stone-500 text-[10px] uppercase">Auto-Check On Launch</span>
                <p className="text-stone-300">Active (Background Service)</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* SUB-PAGE 3: ABOUT APPLICATION                                */}
      {/* ============================================================ */}
      {activeSubTab === 'about' && (
        <div className="space-y-6">
          {/* Branding Banner Card */}
          <div className="p-7 rounded-2xl bg-gradient-to-r from-stone-950 via-stone-900/95 to-stone-900 border border-stone-800 space-y-5 shadow-2xl relative overflow-hidden">
            <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

            <div className="flex items-center gap-5 relative z-10">
              <img
                src={STATIC_CONFIG.logoUrl}
                alt={STATIC_CONFIG.fullName}
                className="w-16 h-16 object-contain shrink-0"
              />
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="font-display text-xl sm:text-2xl font-bold text-stone-100">
                    GTFO Companion App
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[11px] font-bold border border-amber-500/40">
                    v{STATIC_CONFIG.appVersion}
                  </span>
                </div>
                {/* <p className="text-xs text-stone-300 max-w-xl leading-relaxed">
                  Official companion application for Global Task Force Overlord. The intent of this application is to ease the onboarding process for new pilots as well as streamline operations for all.
                </p> */}
              </div>
            </div>

            <p className="text-xs text-stone-400 leading-relaxed border-t border-stone-800/80 pt-4">
              Official companion application for Global Task Force Overlord. The intent of this application is to ease the onboarding process for new pilots as well as streamline operations for all.
            </p>
          </div>

          {/* Official Community Links */}
          <div className="p-6 rounded-2xl bg-stone-900/90 border border-stone-800 space-y-4 shadow-xl">
            <h3 className="font-display text-sm font-bold text-stone-200 uppercase tracking-wider">
              Community &amp; Knowledge Base
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <a
                href={STATIC_CONFIG.kbUrl}
                target="_blank"
                rel="noreferrer"
                className="p-3.5 rounded-xl bg-stone-950 hover:bg-stone-800/80 border border-stone-800 hover:border-amber-500/50 transition-all flex items-center justify-between group"
              >
                <div>
                  <div className="text-xs font-display font-semibold text-stone-200 group-hover:text-amber-300">
                    GTFO Knowledge Base
                  </div>
                  <div className="text-[11px] font-mono text-stone-500">
                    kb.globaltaskforceoverlord.org
                  </div>
                </div>
                <ArrowSquareOut className="w-4 h-4 text-stone-500 group-hover:text-amber-400 transition-colors" />
              </a>

              <a
                href={STATIC_CONFIG.portalBaseUrl.replace('/api/v1/companion', '')}
                target="_blank"
                rel="noreferrer"
                className="p-3.5 rounded-xl bg-stone-950 hover:bg-stone-800/80 border border-stone-800 hover:border-amber-500/50 transition-all flex items-center justify-between group"
              >
                <div>
                  <div className="text-xs font-display font-semibold text-stone-200 group-hover:text-amber-300">
                    Member Portal
                  </div>
                  <div className="text-[11px] font-mono text-stone-500">
                    members.globaltaskforceoverlord.org
                  </div>
                </div>
                <ArrowSquareOut className="w-4 h-4 text-stone-500 group-hover:text-amber-400 transition-colors" />
              </a>

              <a
                href={`https://discord.com/channels/${STATIC_CONFIG.discordGuildId}`}
                target="_blank"
                rel="noreferrer"
                className="p-3.5 rounded-xl bg-stone-950 hover:bg-stone-800/80 border border-stone-800 hover:border-amber-500/50 transition-all flex items-center justify-between group"
              >
                <div>
                  <div className="text-xs font-display font-semibold text-stone-200 group-hover:text-amber-300">
                    Official Discord
                  </div>
                  <div className="text-[11px] font-mono text-stone-500">
                    Global Task Force Overlord
                  </div>
                </div>
                <ArrowSquareOut className="w-4 h-4 text-stone-500 group-hover:text-amber-400 transition-colors" />
              </a>

              <a
                href="https://github.com/pschilly/gtfo-companion-app"
                target="_blank"
                rel="noreferrer"
                className="p-3.5 rounded-xl bg-stone-950 hover:bg-stone-800/80 border border-stone-800 hover:border-amber-500/50 transition-all flex items-center justify-between group"
              >
                <div>
                  <div className="text-xs font-display font-semibold text-stone-200 group-hover:text-amber-300">
                    GitHub Repository
                  </div>
                  <div className="text-[11px] font-mono text-stone-500">
                    pschilly/gtfo-companion-app
                  </div>
                </div>
                <ArrowSquareOut className="w-4 h-4 text-stone-500 group-hover:text-amber-400 transition-colors" />
              </a>
            </div>

            <p className="text-[11px] font-mono text-stone-500 pt-2 border-t border-stone-800/80">
              DCS World is a registered trademark of Eagle Dynamics SA. This software is built for members of the Global Task Force Overlord multiplayer DCS squadron and is not affiliated with Eagle Dynamics in any way.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
