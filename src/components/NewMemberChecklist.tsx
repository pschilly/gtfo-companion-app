import React, { useState } from 'react';
import {
  ArrowSquareOut,
  ArrowsClockwise,
  CaretDown,
  CaretUp,
  Check,
  CheckCircle,
  Copy,
  DownloadSimple,
  Link,
  Package,
  PaintBrush,
  ShieldCheck,
  Sparkle,
  Tag,
  UserCheck,
  Warning,
  X,
} from '@phosphor-icons/react';
import { STATIC_CONFIG } from '../config/constants';
import { useApp } from '../context/AppContext';
import { openExternalUrl } from '../services/tauriBridge';

export interface NewMemberChecklistProps {
  alwaysOpen?: boolean;
}

export const NewMemberChecklist: React.FC<NewMemberChecklistProps> = ({
  alwaysOpen = false,
}) => {
  const {
    manifest,
    installedAssets,
    missingRequiredAssets,
    memberProfile,
    userSession,
    dcsNicknameInfo,
    isLoadingNickname,
    refreshDcsNickname,
    updateDcsNickname,
    expectedDcsNickname,
    isNicknameMatching,
    installRequiredMods,
    installRequiredLiveries,
    isRequiredForCurrentUser,
    canAccessAsset,
    setActiveTab,
    syncMemberPortal,
    checklistSummary,
  } = useApp();

  const [isInstallingMods, setIsInstallingMods] = useState(false);
  const [isInstallingLiveries, setIsInstallingLiveries] = useState(false);
  const [isUpdatingNick, setIsUpdatingNick] = useState(false);
  const [nickSuccessMsg, setNickSuccessMsg] = useState<string | null>(null);
  const [collapsedOverride, setCollapsedOverride] = useState<boolean | null>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [copiedLinkme, setCopiedLinkme] = useState(false);
  const [isSyncingPortalInModal, setIsSyncingPortalInModal] = useState(false);

  const {
    isModsComplete,
    isLiveriesComplete,
    isNickComplete,
    isDcsBotLinked,
    completedSteps,
    totalSteps,
    allComplete,
  } = checklistSummary;

  const requiredMods = manifest.assets.filter(
    (a) => a.category === 'mod' && isRequiredForCurrentUser(a) && canAccessAsset(a)
  );
  const missingRequiredMods = missingRequiredAssets.filter((a) => a.category === 'mod');
  const installedModsCount = Object.values(installedAssets).filter(
    (a) =>
      a.category === 'mod' ||
      manifest.assets.find((m) => m.id === a.assetId)?.category === 'mod'
  ).length;

  const missingRequiredLiveries = missingRequiredAssets.filter((a) => a.category === 'livery');
  const installedLiveriesCount = Object.values(installedAssets).filter(
    (a) =>
      a.category === 'livery' ||
      manifest.assets.find((m) => m.id === a.assetId)?.category === 'livery'
  ).length;

  const isCollapsed = alwaysOpen
    ? false
    : collapsedOverride !== null
    ? collapsedOverride
    : allComplete;

  const handleInstallMods = async () => {
    setIsInstallingMods(true);
    try {
      await installRequiredMods();
    } finally {
      setIsInstallingMods(false);
    }
  };

  const handleInstallLiveries = async () => {
    if (missingRequiredLiveries.length > 0) {
      setIsInstallingLiveries(true);
      try {
        await installRequiredLiveries();
      } finally {
        setIsInstallingLiveries(false);
      }
    } else {
      setActiveTab('liveries');
    }
  };

  const handleApplyExpectedNickname = async () => {
    const target = expectedDcsNickname.trim();
    if (!target) return;
    setIsUpdatingNick(true);
    setNickSuccessMsg(null);
    try {
      await updateDcsNickname(target);
      setNickSuccessMsg(`Callsign & tag updated to "${target}"`);
      setTimeout(() => setNickSuccessMsg(null), 5000);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsUpdatingNick(false);
    }
  };

  const handleCopyLinkme = () => {
    navigator.clipboard.writeText('/linkme');
    setCopiedLinkme(true);
    setTimeout(() => setCopiedLinkme(false), 2000);
  };

  const handleModalSync = async () => {
    setIsSyncingPortalInModal(true);
    try {
      await syncMemberPortal();
    } finally {
      setIsSyncingPortalInModal(false);
    }
  };

  const discordServerNick =
    userSession?.serverNickname ||
    memberProfile?.callsign ||
    userSession?.globalName ||
    userSession?.username ||
    'Pilot';

  return (
    <div className="relative rounded-2xl border border-stone-800 bg-stone-900/90 shadow-xl overflow-hidden transition-all">
      {/* Decorative Glow */}
      <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-amber-500/5 blur-3xl pointer-events-none" />

      {/* HEADER STRIP */}
      <div className="px-5 py-4 border-b border-stone-800 bg-stone-950/70 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
              allComplete
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
            }`}
          >
            {allComplete ? (
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            ) : (
              <Sparkle className="w-5 h-5 text-amber-400" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display font-bold text-stone-100 text-base tracking-tight">
                Member Readiness
              </h2>
              {allComplete ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono text-[10px] font-bold uppercase tracking-wider">
                  <Check className="w-3 h-3 text-emerald-400" />
                  All Systems Go
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-[10px] font-bold uppercase tracking-wider">
                  Onboarding
                </span>
              )}
            </div>
            <p className="text-xs text-stone-400 mt-0.5">
              Mandatory flight line onboarding: mods, liveries, DCS callsign tag, and server bot linkage.
            </p>
          </div>
        </div>

        {/* Progress & Controls */}
        <div className="flex items-center gap-3 ml-auto">
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="font-mono text-xs font-bold text-stone-200">
                {completedSteps} / {totalSteps} Complete
              </div>
              <div className="w-24 h-1.5 rounded-full bg-stone-800 overflow-hidden mt-1">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    allComplete ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                  style={{ width: `${(completedSteps / totalSteps) * 100}%` }}
                />
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              refreshDcsNickname();
              syncMemberPortal();
            }}
            disabled={isLoadingNickname}
            title="Refresh status from DCS and Member Portal"
            className="p-1.5 rounded-lg bg-stone-800/80 hover:bg-stone-700 text-stone-300 hover:text-stone-100 transition-colors"
          >
            <ArrowsClockwise
              className={`w-3.5 h-3.5 ${isLoadingNickname ? 'animate-spin text-amber-400' : ''}`}
            />
          </button>

          {!alwaysOpen && (
            <button
              onClick={() => setCollapsedOverride(!isCollapsed)}
              className="p-1.5 rounded-lg bg-stone-800/80 hover:bg-stone-700 text-stone-300 hover:text-stone-100 transition-colors"
              title={isCollapsed ? 'Expand checklist' : 'Collapse checklist'}
            >
              {isCollapsed ? (
                <CaretDown className="w-4 h-4" />
              ) : (
                <CaretUp className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* CHECKLIST BODY */}
      {!isCollapsed && (
        <div className="p-5 space-y-4">
          {/* SUCCESS BANNER WHEN 4/4 */}
          {allComplete && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-3 text-xs text-emerald-300">
              <div className="flex items-center gap-2.5">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  <strong>Outstanding, Pilot!</strong> You have installed required mods, liveries, verified your DCS callsign &amp; tag, and linked your DCS Server Bot account. You are combat-ready for GTFO operations.
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* STEP 1: REQUIRED MODS */}
            <div
              className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                isModsComplete
                  ? 'bg-stone-950/40 border-stone-800 hover:border-emerald-500/30'
                  : 'bg-stone-950/70 border-amber-500/40 shadow-sm'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-stone-800 border border-stone-700 text-stone-300 font-mono text-[10px] font-bold flex items-center justify-center">
                      1
                    </span>
                    <h3 className="font-display font-semibold text-stone-100 text-sm">
                      Required Mods
                    </h3>
                  </div>

                  {isModsComplete ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[10px] font-bold uppercase">
                      <Check className="w-3 h-3" />
                      Ready
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-[10px] font-bold uppercase">
                      Action Required
                    </span>
                  )}
                </div>

                <p className="text-xs text-stone-400 leading-relaxed">
                  Mandatory modifications required to access GTFO servers.
                </p>

                <div className="p-2.5 rounded-lg bg-stone-900/90 border border-stone-800/80 text-[11px] font-mono space-y-1">
                  <div className="flex items-center justify-between text-stone-400">
                    <span>Mandatory Mods:</span>
                    <span className="text-stone-200 font-semibold">{requiredMods.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-stone-400">
                    <span>Installed Locally:</span>
                    <span
                      className={`font-semibold ${
                        isModsComplete ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      {requiredMods.length > 0
                        ? `${requiredMods.length - missingRequiredMods.length} / ${requiredMods.length}`
                        : `${installedModsCount} installed`}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4 mt-2 border-t border-stone-800/80">
                {missingRequiredMods.length > 0 ? (
                  <button
                    onClick={handleInstallMods}
                    disabled={isInstallingMods}
                    className="w-full py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-stone-800 text-stone-950 font-mono font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-amber-500/10"
                  >
                    {isInstallingMods ? (
                      <>
                        <ArrowsClockwise className="w-3.5 h-3.5 animate-spin" />
                        <span>Installing Mods...</span>
                      </>
                    ) : (
                      <>
                        <DownloadSimple className="w-3.5 h-3.5" />
                        <span>Deploy {missingRequiredMods.length} Missing Mod{missingRequiredMods.length === 1 ? '' : 's'}</span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={() => setActiveTab('mods')}
                    className="w-full py-2 px-3 rounded-lg bg-stone-800/80 hover:bg-stone-700 text-stone-300 hover:text-stone-100 font-mono text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Package className="w-3.5 h-3.5 text-stone-400" />
                    <span>Browse All Mods</span>
                  </button>
                )}
              </div>
            </div>

            {/* STEP 2: LIVERIES */}
            <div
              className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                isLiveriesComplete
                  ? 'bg-stone-950/40 border-stone-800 hover:border-emerald-500/30'
                  : 'bg-stone-950/70 border-amber-500/40 shadow-sm'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-stone-800 border border-stone-700 text-stone-300 font-mono text-[10px] font-bold flex items-center justify-center">
                      2
                    </span>
                    <h3 className="font-display font-semibold text-stone-100 text-sm">
                      Airframe Liveries
                    </h3>
                  </div>

                  {isLiveriesComplete ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[10px] font-bold uppercase">
                      <Check className="w-3 h-3" />
                      Ready
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-[10px] font-bold uppercase">
                      Action Required
                    </span>
                  )}
                </div>

                <p className="text-xs text-stone-400 leading-relaxed">
                  Official squadron aircraft liveries and community paint schemes.
                </p>

                <div className="p-2.5 rounded-lg bg-stone-900/90 border border-stone-800/80 text-[11px] font-mono space-y-1">
                  
                  <div className="flex items-center justify-between text-stone-400">
                    <span>Installed Liveries:</span>
                    <span
                      className={`font-semibold ${
                        isLiveriesComplete ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      {missingRequiredLiveries.length > 0
                        ? `${missingRequiredLiveries.length} Required Missing`
                        : `${installedLiveriesCount}`}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4 mt-2 border-t border-stone-800/80">
                {missingRequiredLiveries.length > 0 ? (
                  <button
                    onClick={handleInstallLiveries}
                    disabled={isInstallingLiveries}
                    className="w-full py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-stone-800 text-stone-950 font-mono font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-amber-500/10"
                  >
                    {isInstallingLiveries ? (
                      <>
                        <ArrowsClockwise className="w-3.5 h-3.5 animate-spin" />
                        <span>Deploying Liveries...</span>
                      </>
                    ) : (
                      <>
                        <DownloadSimple className="w-3.5 h-3.5" />
                        <span>Deploy {missingRequiredLiveries.length} Required Liveries</span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={() => setActiveTab('liveries')}
                    className="w-full py-2 px-3 rounded-lg bg-stone-800/80 hover:bg-stone-700 text-stone-300 hover:text-stone-100 font-mono text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <PaintBrush className="w-3.5 h-3.5 text-stone-400" />
                    <span>{installedLiveriesCount > 0 ? 'Browse Hangar' : 'Select Liveries'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* STEP 3: CALLSIGN & TAG */}
            <div
              className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                isNickComplete
                  ? 'bg-stone-950/40 border-stone-800 hover:border-emerald-500/30'
                  : 'bg-stone-950/70 border-amber-500/40 shadow-sm'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-stone-800 border border-stone-700 text-stone-300 font-mono text-[10px] font-bold flex items-center justify-center">
                      3
                    </span>
                    <h3 className="font-display font-semibold text-stone-100 text-sm">
                      Callsign &amp; Tag
                    </h3>
                  </div>

                  {isNickComplete ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[10px] font-bold uppercase">
                      <Check className="w-3 h-3" />
                      Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-[10px] font-bold uppercase">
                      Action Required
                    </span>
                  )}
                </div>

                <p className="text-xs text-stone-400 leading-relaxed">
                  Automatically assigns your callsign in DCS in accordance with GTFO Charter.
                </p>

                {/* Nickname Comparison Card */}
                <div className="p-2.5 rounded-lg bg-stone-900/90 border border-stone-800/80 text-[11px] font-mono space-y-1.5">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-stone-400">Required DCS Tag:</span>
                    <span className="text-amber-300 font-bold truncate max-w-[120px]" title={expectedDcsNickname}>
                      {expectedDcsNickname}
                    </span>
                  </div>

                  <div className="pt-1 border-t border-stone-800/70 flex items-center justify-between gap-1">
                    <span className="text-stone-400">Active:</span>
                    <span
                      className={`font-bold truncate max-w-[120px] ${
                        isNickComplete ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                      title={dcsNicknameInfo?.currentNickname || 'None'}
                    >
                      {dcsNicknameInfo?.currentNickname || '(Not configured)'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4 mt-2 border-t border-stone-800/80 space-y-2">
                {nickSuccessMsg && (
                  <p className="text-[11px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 p-1.5 rounded text-center">
                    {nickSuccessMsg}
                  </p>
                )}

                {!isNickComplete ? (
                  <button
                    onClick={handleApplyExpectedNickname}
                    disabled={isUpdatingNick}
                    className="w-full py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-stone-800 text-stone-950 font-mono font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-amber-500/10"
                  >
                    {isUpdatingNick ? (
                      <>
                        <ArrowsClockwise className="w-3.5 h-3.5 animate-spin" />
                        <span>Updating Lua...</span>
                      </>
                    ) : (
                      <>
                        <Tag className="w-3.5 h-3.5" />
                        <span>Set DCS Nickname</span>
                      </>
                    )}
                  </button>
                ) : (
                  <div className="w-full py-2 px-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-xs flex items-center justify-center gap-1.5">
                    <Check className="w-3.5 h-3.5" />
                    <span>Active in DCS</span>
                  </div>
                )}
              </div>
            </div>

            {/* STEP 4: DCS SERVER BOT (UCID LINKAGE) */}
            <div
              className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                isDcsBotLinked
                  ? 'bg-stone-950/40 border-stone-800 hover:border-emerald-500/30'
                  : 'bg-stone-950/70 border-amber-500/40 shadow-sm'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-stone-800 border border-stone-700 text-stone-300 font-mono text-[10px] font-bold flex items-center justify-center">
                      4
                    </span>
                    <h3 className="font-display font-semibold text-stone-100 text-sm">
                      DCS Server Bot
                    </h3>
                  </div>

                  {isDcsBotLinked ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[10px] font-bold uppercase">
                      <Check className="w-3 h-3" />
                      Linked
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-[10px] font-bold uppercase">
                      Action Required
                    </span>
                  )}
                </div>

                <p className="text-xs text-stone-400 leading-relaxed">
                  Connects your DCS World account (UCID) to track server flight time and sortie logs.
                </p>

                <div className="p-2.5 rounded-lg bg-stone-900/90 border border-stone-800/80 text-[11px] font-mono space-y-1">
                  <div className="flex items-center justify-between text-stone-400">
                    <span>Link Status:</span>
                    <span
                      className={`font-semibold ${
                        isDcsBotLinked ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      {isDcsBotLinked ? 'Active & Linked' : 'Unlinked'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-stone-400">
                    <span>DCS UCID:</span>
                    <span
                      className="text-stone-300 font-semibold truncate max-w-[120px]"
                      title={memberProfile?.dcsUcid || 'Not Linked'}
                    >
                      {memberProfile?.dcsUcid
                        ? `${memberProfile.dcsUcid.slice(0, 6)}...${memberProfile.dcsUcid.slice(-4)}`
                        : '(Requires /linkme)'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4 mt-2 border-t border-stone-800/80">
                {isDcsBotLinked ? (
                  <div className="w-full py-2 px-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-xs flex items-center justify-center gap-1.5">
                    <Check className="w-3.5 h-3.5" />
                    <span>Bot Account Linked</span>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowLinkModal(true)}
                    className="w-full py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-mono font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-amber-500/10"
                  >
                    <Link className="w-3.5 h-3.5" />
                    <span>How to Link (/linkme)</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DCS SERVER BOT LINK INSTRUCTIONS POPUP MODAL */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-lg rounded-2xl bg-stone-900 border border-stone-700 shadow-2xl p-6 space-y-5 text-stone-200">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 border-b border-stone-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
                  <Link className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base text-stone-100">
                    Link DCS World to GTFO Server Bot
                  </h3>
                  <p className="text-xs text-stone-400 mt-0.5">
                    Follow these quick steps to pair your DCS client ID with your Discord profile.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowLinkModal(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step-by-Step Instructions */}
            <div className="space-y-3.5 text-xs text-stone-300">
              {/* Step 1 & 2 */}
              <div className="p-3 rounded-xl bg-stone-950/70 border border-stone-800/80 space-y-2">
                <div className="flex items-center gap-2 font-display font-bold text-stone-200">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[11px] flex items-center justify-center">
                    1
                  </span>
                  <span>Go to Discord #qualification-chat</span>
                </div>
                <p className="text-stone-400 pl-7">
                  Open the official GTFO Discord server and navigate to the{' '}
                  <span className="text-amber-300 font-semibold font-mono">#qualification-chat</span> channel.
                </p>
              </div>

              {/* Step 3: Type /linkme */}
              <div className="p-3 rounded-xl bg-stone-950/70 border border-stone-800/80 space-y-2">
                <div className="flex items-center gap-2 font-display font-bold text-stone-200">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[11px] flex items-center justify-center">
                    2
                  </span>
                  <span>Type the Link Command</span>
                </div>
                <p className="text-stone-400 pl-7">
                  In <span className="text-stone-300 font-mono">#qualification-chat</span>, type the following slash command and send it:
                </p>

                <div className="pl-7 pt-1 flex items-center gap-2">
                  <div className="px-3 py-2 rounded-lg bg-stone-900 border border-amber-500/30 text-amber-300 font-mono text-sm font-bold flex-1 select-all">
                    /linkme
                  </div>
                  <button
                    onClick={handleCopyLinkme}
                    className="px-3 py-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 font-mono text-xs flex items-center gap-1.5 transition-colors shrink-0"
                  >
                    {copiedLinkme ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Step 4: Prompts */}
              <div className="p-3 rounded-xl bg-stone-950/70 border border-stone-800/80 space-y-2">
                <div className="flex items-center gap-2 font-display font-bold text-stone-200">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[11px] flex items-center justify-center">
                    3
                  </span>
                  <span>Follow the Bot Prompts</span>
                </div>
                <p className="text-stone-400 pl-7 leading-relaxed">
                  The GTFO DCS Server Bot will reply with a verification prompt and instructions. Connect to the designated GTFO multiplayer server in DCS World to complete account linking.
                </p>
              </div>

              {/* Step 5: Verify */}
              <div className="p-3 rounded-xl bg-stone-950/70 border border-stone-800/80 space-y-2">
                <div className="flex items-center gap-2 font-display font-bold text-stone-200">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[11px] flex items-center justify-center">
                    4
                  </span>
                  <span>Verify Here</span>
                </div>
                <p className="text-stone-400 pl-7">
                  After completing the in-game prompt, click <strong>Sync Dossier Now</strong> below. Your DCS UCID will appear and this check will mark as complete.
                </p>
              </div>
            </div>

            {/* Modal Footer Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-stone-800">
              <button
                onClick={() =>
                  openExternalUrl(
                    `https://discord.com/channels/${STATIC_CONFIG.discordGuildId}`
                  )
                }
                className="px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-mono text-xs flex items-center gap-2 transition-colors"
              >
                <span>Open Discord</span>
                <ArrowSquareOut className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleModalSync}
                  disabled={isSyncingPortalInModal}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-stone-800 text-stone-950 font-mono font-bold text-xs flex items-center gap-2 transition-colors"
                >
                  <ArrowsClockwise
                    className={`w-3.5 h-3.5 ${
                      isSyncingPortalInModal ? 'animate-spin' : ''
                    }`}
                  />
                  <span>
                    {isSyncingPortalInModal ? 'Syncing...' : 'Sync Dossier Now'}
                  </span>
                </button>

                <button
                  onClick={() => setShowLinkModal(false)}
                  className="px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-mono text-xs transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
