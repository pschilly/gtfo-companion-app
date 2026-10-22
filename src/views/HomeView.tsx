import React, { useMemo } from 'react';
import {
  AirplaneTilt,
  ArrowCircleUp,
  ArrowRight,
  ArrowSquareOut,
  Certificate,
  CheckCircle,
  Compass,
  DownloadSimple,
  Folder,
  HardDrive,
  ListChecks,
  Medal,
  Package,
  PaintBrush,
  Shield,
  ShieldCheck,
  ShieldWarning,
  Sparkle,
  SquaresFour,
  Users,
  Warning,
} from '@phosphor-icons/react';
import { AssetCard } from '../components/AssetCard';
import { STATIC_CONFIG } from '../config/constants';
import { useApp } from '../context/AppContext';
import { formatBytes } from '../utils/formatters';

export const HomeView: React.FC = () => {
  const {
    manifest,
    installedAssets,
    outdatedAssets,
    missingRequiredAssets,
    effectiveTier,
    memberProfile,
    setActiveTab,
    updateAllOutdated,
    installAllRequiredForUser,
    dcsEnv,
    checklistSummary,
    memberFlightPlans,
    activeSortie,
    activeSortieFlightPlans,
  } = useApp();

  const totalAssets = manifest.assets.length;
  const installedCount = Object.keys(installedAssets).length;
  const totalInstalledBytes = useMemo(() => {
    return Object.keys(installedAssets).reduce((sum, id) => {
      const asset = manifest.assets.find((a) => a.id === id);
      return sum + (asset?.fileSizeBytes || 0);
    }, 0);
  }, [manifest.assets, installedAssets]);

  const requiredAllCount = manifest.assets.filter(
    (a) => a.requirementLevel === 'required_all'
  ).length;
  const requiredCoreCount = manifest.assets.filter(
    (a) => a.requirementLevel === 'required_core'
  ).length;

  const featuredAssets = useMemo(() => {
    const featured = manifest.assets.filter((a) => a.featured);
    return featured.length > 0 ? featured : manifest.assets.slice(0, 6);
  }, [manifest.assets]);

  const airframes = memberProfile.qualifiedAirframes || [];
  const primaryAirframe = airframes.find((a) => a.isPrimary) || airframes[0] || null;

  return (
    <div className="space-y-8 pb-10 max-w-7xl mx-auto">
      {/* LANDING PAGE HERO BANNER */}
      <div className="relative rounded-3xl overflow-hidden border border-stone-800 bg-stone-900/90 shadow-2xl p-6 sm:p-8">
        {/* Decorative Atmospheric Lighting */}
        <div className="absolute -top-32 -left-28 w-[450px] h-[450px] rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-28 w-[450px] h-[450px] rounded-full bg-red-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
              <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-stone-100 tracking-tight leading-tight">
              Welcome back,{' '}
              <span className="bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent">
                {memberProfile.callsign || 'Pilot'}
              </span>
            </h1>

            <p className="text-sm text-stone-300 leading-relaxed">
              
            </p>
          </div>

          {/* Quick Action CTA Controls */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0 self-start lg:self-center">
            {missingRequiredAssets.length > 0 ? (
              <button
                onClick={installAllRequiredForUser}
                className="px-5 py-3 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-mono font-bold text-xs flex items-center justify-center gap-2.5 transition-all shadow-lg shadow-red-950/50 hover:scale-[1.02]"
              >
                <DownloadSimple className="w-4 h-4 animate-bounce" />
                <span>Deploy {missingRequiredAssets.length} Required Assets</span>
              </button>
            ) : outdatedAssets.length > 0 ? (
              <button
                onClick={updateAllOutdated}
                className="px-5 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-mono font-bold text-xs flex items-center justify-center gap-2.5 transition-all shadow-lg shadow-amber-500/20 hover:scale-[1.02]"
              >
                <ArrowCircleUp className="w-4 h-4" />
                <span>Update {outdatedAssets.length} Packages</span>
              </button>
            ) : null}

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => setActiveTab('atc')}
                className="px-4 py-2.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/40 text-sky-300 font-mono text-xs font-semibold flex items-center gap-2 transition-colors shadow-sm"
              >
                <Compass className="w-4 h-4 text-sky-400" />
                <span>Flight Plans &amp; ATC</span>
              </button>

              <button
                onClick={() => setActiveTab('liveries')}
                className="px-4 py-2.5 rounded-xl bg-stone-950 hover:bg-stone-800 border border-stone-700 text-amber-400 font-mono text-xs font-semibold flex items-center gap-2 transition-colors"
              >
                <PaintBrush className="w-4 h-4" />
                <span>Browse Hangar</span>
              </button>

              <button
                onClick={() => setActiveTab('dashboard')}
                className="px-4 py-2.5 rounded-xl bg-stone-950 hover:bg-stone-800 border border-stone-700 text-stone-200 font-mono text-xs font-semibold flex items-center gap-2 transition-colors"
              >
                <SquaresFour className="w-4 h-4 text-stone-400" />
                <span>Pilot Dossier</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* PENDING ONBOARDING ACTION NOTIFICATION (Only shown if checklist items require attention) */}
      {!checklistSummary.allComplete && (
        <div
          onClick={() => setActiveTab('checklist')}
          className="relative rounded-2xl p-4 sm:p-5 bg-gradient-to-r from-amber-500/15 via-stone-900/95 to-stone-900/90 border border-amber-500/40 shadow-xl hover:border-amber-400 cursor-pointer transition-all group flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-md shadow-amber-500/10">
              <ListChecks className="w-5 h-5 text-amber-400" />
            </div>

            <div className="space-y-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display font-bold text-stone-100 text-sm sm:text-base">
                  Member Readiness: Action Required
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold uppercase tracking-wider border border-amber-500/30">
                  {checklistSummary.pendingCount} Item{checklistSummary.pendingCount === 1 ? '' : 's'} Pending
                </span>
              </div>
              <p className="text-xs text-stone-300">
                You have {checklistSummary.pendingCount} incomplete onboarding step{checklistSummary.pendingCount === 1 ? '' : 's'}. Review required flight mods, liveries, DCS callsign tag, and bot linkage.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveTab('checklist');
              }}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-mono font-bold text-xs flex items-center gap-2 transition-all shadow-md shadow-amber-500/20 group-hover:translate-x-0.5"
            >
              <span>View Checklist</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* TELEMETRY & STATS STRIP */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          onClick={() => setActiveTab('liveries')}
          className="p-4 rounded-2xl bg-stone-900/90 border border-stone-800 hover:border-amber-500/40 cursor-pointer transition-all flex items-center justify-between shadow-md group"
        >
          <div>
            <p className="text-[11px] font-mono uppercase text-stone-400">Available Packages</p>
            <p className="text-2xl font-bold font-display text-stone-100 mt-1">{totalAssets}</p>
            <p className="text-[11px] font-mono text-stone-400 mt-0.5">
              {requiredAllCount} Mandatory • {requiredCoreCount} CORE
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center group-hover:scale-105 transition-transform">
            <Package className="w-5 h-5 text-amber-400" />
          </div>
        </div>

        <div
          onClick={() => setActiveTab('library')}
          className="p-4 rounded-2xl bg-stone-900/90 border border-stone-800 hover:border-emerald-500/40 cursor-pointer transition-all flex items-center justify-between shadow-md group"
        >
          <div>
            <p className="text-[11px] font-mono uppercase text-stone-400">Installed Locally</p>
            <p className="text-2xl font-bold font-display text-emerald-400 mt-1">
              {installedCount}
            </p>
            <p className="text-[11px] font-mono text-stone-400 mt-0.5">
              {outdatedAssets.length > 0
                ? `${outdatedAssets.length} update(s) ready`
                : 'All packages verified'}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center group-hover:scale-105 transition-transform">
            <Folder className="w-5 h-5 text-emerald-400" />
          </div>
        </div>

        <div
          onClick={() => setActiveTab('checklist')}
          className={`p-4 rounded-2xl bg-stone-900/90 border transition-all cursor-pointer flex items-center justify-between shadow-md group ${
            !checklistSummary.allComplete
              ? 'border-amber-500/40 hover:border-amber-500/70 bg-amber-950/10'
              : 'border-stone-800 hover:border-emerald-500/40'
          }`}
          title="View Member Readiness checklist"
        >
          <div>
            <p className="text-[11px] font-mono uppercase text-stone-400">Flight Readiness</p>
            <p
              className={`text-2xl font-bold font-display mt-1 ${
                !checklistSummary.allComplete ? 'text-amber-400' : 'text-emerald-400'
              }`}
            >
              {!checklistSummary.allComplete
                ? `${checklistSummary.pendingCount} Pending`
                : '100% Ready'}
            </p>
            <p className="text-[11px] font-mono text-stone-400 mt-0.5">
              {!checklistSummary.allComplete ? (
                <span className="text-amber-400/90 font-semibold group-hover:underline">
                  Review Member Readiness
                </span>
              ) : (
                <span>All readiness checks passed</span>
              )}
            </p>
          </div>
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform ${
              !checklistSummary.allComplete
                ? 'bg-amber-500/10 border border-amber-500/30'
                : 'bg-emerald-500/10 border border-emerald-500/30'
            }`}
          >
            {!checklistSummary.allComplete ? (
              <ListChecks className="w-5 h-5 text-amber-400" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            )}
          </div>
        </div>
      </div>

      {/* FEATURED ASSETS SHOWCASE */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-stone-800/80">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-xl font-bold text-stone-100">
                Featured Tactical Assets
              </h2>
              <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-[10px] font-bold">
                NEW &amp; UPDATED
              </span>
            </div>
            <p className="text-xs text-stone-400 mt-0.5">
              Highlighted community liveries, official squadron skins, and essential simulator modifications.
            </p>
          </div>

          <button
            onClick={() => setActiveTab('liveries')}
            className="text-xs font-mono text-amber-400 hover:text-amber-300 flex items-center gap-1.5 transition-colors shrink-0"
          >
            <span>View All Assets</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {featuredAssets.map((asset) => (
            <AssetCard key={asset.id} asset={asset} />
          ))}
        </div>
      </div>

      {/* QUICK OPERATIONS PORTALS */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 pt-2">
        {/* Air Traffic Control & Flight Plans Shortcut */}
        <div
          onClick={() => setActiveTab('atc')}
          className="p-5 rounded-2xl bg-stone-900/90 border border-stone-800 hover:border-sky-500/50 cursor-pointer transition-all space-y-3 group shadow-lg"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Compass className="w-5 h-5 text-sky-400" />
              </div>
              <div>
                <h3 className="font-display font-bold text-stone-100 text-sm group-hover:text-sky-400 transition-colors">
                  Flight Plans &amp; ATC
                </h3>
                <p className="text-[11px] font-mono text-stone-400">
                  {memberFlightPlans.length} Plan{memberFlightPlans.length === 1 ? '' : 's'} • {activeSortieFlightPlans.length} in Package
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-stone-500 group-hover:text-sky-400 group-hover:translate-x-0.5 transition-all" />
          </div>
          <p className="text-xs text-stone-400 leading-relaxed">
            Dispatch routes, DTC cartridges, comms ladders, and DCS Route Tool presets for assigned sorties.
          </p>
          <div className="pt-2 border-t border-stone-800/80 flex items-center justify-between text-[11px] font-mono text-stone-400">
            <span>Sortie: {activeSortie?.name || 'Active Package'}</span>
            <span className="text-sky-400">Dispatch &rarr;</span>
          </div>
        </div>

        {/* Pilot Dossier Shortcut */}
        <div
          onClick={() => setActiveTab('dashboard')}
          className="p-5 rounded-2xl bg-stone-900/90 border border-stone-800 hover:border-amber-500/40 cursor-pointer transition-all space-y-3 group shadow-lg"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <SquaresFour className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="font-display font-bold text-stone-100 text-sm group-hover:text-amber-400 transition-colors">
                  Member Dossier
                </h3>
                <p className="text-[11px] font-mono text-stone-400">
                  {memberProfile.gradeTitle} • {memberProfile.grade}
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-stone-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
          </div>
          <p className="text-xs text-stone-400 leading-relaxed">
            Review your squadron assignment, flight credentials, qualified airframes, and military ribbon rack.
          </p>
          <div className="pt-2 border-t border-stone-800/80 flex items-center justify-between text-[11px] font-mono text-stone-400">
            <span>Squadron: {memberProfile.squadronAssignment?.name || 'General Community'}</span>
            <span className="text-amber-400">Open &rarr;</span>
          </div>
        </div>

        {/* Airframe Liveries Shortcut */}
        <div
          onClick={() => setActiveTab('liveries')}
          className="p-5 rounded-2xl bg-stone-900/90 border border-stone-800 hover:border-amber-500/40 cursor-pointer transition-all space-y-3 group shadow-lg"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <PaintBrush className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="font-display font-bold text-stone-100 text-sm group-hover:text-amber-400 transition-colors">
                  Airframe Liveries
                </h3>
                <p className="text-[11px] font-mono text-stone-400">
                  {totalAssets} Total Packages
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-stone-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
          </div>
          <p className="text-xs text-stone-400 leading-relaxed">
            Browse and deploy 4K/8K aircraft paint schemes for Hornet, Strike Eagle, Viper, and Tomcat airframes.
          </p>
          <div className="pt-2 border-t border-stone-800/80 flex items-center justify-between text-[11px] font-mono text-stone-400">
            <span>Primary: {primaryAirframe?.name || 'F/A-18C'}</span>
            <span className="text-amber-400">Browse &rarr;</span>
          </div>
        </div>

        {/* Knowledge Base SOP Shortcut */}
        <a
          href={STATIC_CONFIG.kbUrl}
          target="_blank"
          rel="noreferrer"
          className="p-5 rounded-2xl bg-stone-900/90 border border-stone-800 hover:border-amber-500/40 cursor-pointer transition-all space-y-3 group shadow-lg block"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <ArrowSquareOut className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="font-display font-bold text-stone-100 text-sm group-hover:text-amber-400 transition-colors">
                  Briefing Room &amp; SOP
                </h3>
                <p className="text-[11px] font-mono text-stone-400">
                  GTFO Knowledge Base
                </p>
              </div>
            </div>
            <ArrowSquareOut className="w-4 h-4 text-stone-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
          </div>
          <p className="text-xs text-stone-400 leading-relaxed">
            Access training materials, squadron SOPs, standard flight communications, and server connection guides.
          </p>
          <div className="pt-2 border-t border-stone-800/80 flex items-center justify-between text-[11px] font-mono text-stone-400">
            <span>Official Portal</span>
            <span className="text-amber-400">Launch &rarr;</span>
          </div>
        </a>
      </div>
    </div>
  );
};