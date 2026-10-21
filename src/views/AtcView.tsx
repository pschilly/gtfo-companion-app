import React, { useEffect, useMemo, useState } from 'react';
import {
  AirplaneTilt,
  ArrowsClockwise,
  BookOpen,
  CheckCircle,
  Code,
  Compass,
  Cpu,
  DownloadSimple,
  FileCode,
  FileXls,
  FolderSimple,
  MapPin,
  NavigationArrow,
  Path,
  Radio,
  ShieldWarning,
  Sparkle,
  Stack,
} from '@phosphor-icons/react';
import { useApp } from '../context/AppContext';
import {
  formatRoutePresetToLuaSnippet,
  generateKneeboardSvgCard,
  GTFO_SQUADRONS,
} from '../data/samplePortalData';
import { RoutePresetManifestInfo } from '../services/tauriBridge';
import { AtcFlightPlanPackage, DcsTheatre } from '../types';

export const AtcView: React.FC = () => {
  const {
    atcPackages,
    installedAtc,
    deployAtcDtc,
    mergeAtcRoutePreset,
    deployAtcKneeboards,
    deployFullAtcPackage,
    inspectTheatreRouteLua,
    syncMemberPortal,
    dcsEnv,
    settings,
  } = useApp();

  const [selectedTheatre, setSelectedTheatre] = useState<string>('ALL');
  const [selectedSquadron, setSelectedSquadron] = useState<string>('ALL');
  const [selectedPkgId, setSelectedPkgId] = useState<string>(atcPackages[0]?.id || '');
  const [activeSubTab, setActiveSubTab] = useState<'waypoints' | 'dtc' | 'lua' | 'kneeboard'>(
    'waypoints'
  );
  const [theatreManifestInfo, setTheatreManifestInfo] = useState<RoutePresetManifestInfo | null>(
    null
  );
  const [isDeploying, setIsDeploying] = useState(false);
  const [isSyncingPortal, setIsSyncingPortal] = useState(false);

  const filteredPackages = useMemo(() => {
    return atcPackages.filter((pkg) => {
      if (selectedTheatre !== 'ALL' && pkg.theatre !== selectedTheatre) return false;
      if (selectedSquadron !== 'ALL' && pkg.squadron !== selectedSquadron) return false;
      return true;
    });
  }, [atcPackages, selectedSquadron, selectedTheatre]);

  const activePkg: AtcFlightPlanPackage | undefined = useMemo(() => {
    return (
      filteredPackages.find((p) => p.id === selectedPkgId) ||
      filteredPackages[0] ||
      atcPackages[0]
    );
  }, [atcPackages, filteredPackages, selectedPkgId]);

  const activeDcsPath =
    settings.dcsSavedGamesPath ||
    dcsEnv?.activeSavedGamesPath ||
    'C:\\Users\\Pilot\\Saved Games\\DCS';

  const activeTheatreFileName = activePkg
    ? `${activePkg.routePreset.theatre}.lua`
    : 'Syria.lua';

  const refreshTheatreInspection = async (theatreFileName: string) => {
    try {
      const info = await inspectTheatreRouteLua(theatreFileName);
      setTheatreManifestInfo(info);
    } catch {
      setTheatreManifestInfo(null);
    }
  };

  useEffect(() => {
    if (activePkg) {
      refreshTheatreInspection(`${activePkg.routePreset.theatre}.lua`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePkg?.id, activeDcsPath]);

  const handleSyncPortal = async () => {
    setIsSyncingPortal(true);
    try {
      await syncMemberPortal();
      if (activePkg) {
        await refreshTheatreInspection(`${activePkg.routePreset.theatre}.lua`);
      }
    } finally {
      setIsSyncingPortal(false);
    }
  };

  const handleDeployAll = async (pkg: AtcFlightPlanPackage) => {
    setIsDeploying(true);
    try {
      await deployFullAtcPackage(pkg);
      await refreshTheatreInspection(`${pkg.routePreset.theatre}.lua`);
    } finally {
      setIsDeploying(false);
    }
  };

  const handleMergePreset = async (pkg: AtcFlightPlanPackage) => {
    setIsDeploying(true);
    try {
      await mergeAtcRoutePreset(pkg);
      await refreshTheatreInspection(`${pkg.routePreset.theatre}.lua`);
    } finally {
      setIsDeploying(false);
    }
  };

  const theatres: { id: string; label: string }[] = [
    { id: 'ALL', label: 'All Theatres' },
    { id: 'Syria', label: 'Syria' },
    { id: 'PersianGulf', label: 'Persian Gulf' },
    { id: 'Kola', label: 'Kola Peninsula' },
  ];

  const squadronOptions = [
    { id: 'ALL', label: 'All Squadrons' },
    { id: '507th FS', label: '507th FS (F-16C)' },
    { id: '449th TFS', label: '449th TFS (F/A-18C)' },
    { id: '19th AAB', label: '19th AAB (Rotary)' },
    { id: 'VF-141', label: 'VF-141 (F-14A/B)' },
  ];

  const isDtcInstalled = activePkg ? Boolean(installedAtc.installedDtcIds[activePkg.id]) : false;
  const isRouteMerged = activePkg
    ? Boolean(installedAtc.mergedRoutePresets[activePkg.id]) ||
      Boolean(theatreManifestInfo?.presetNames.includes(activePkg.routePreset.presetName))
    : false;
  const areKneeboardsInstalled = activePkg
    ? activePkg.kneeboards.every((k) => Boolean(installedAtc.installedKneeboardIds[k.id]))
    : false;

  const squadronMeta = activePkg ? GTFO_SQUADRONS[activePkg.squadron] : null;
  const activeLuaSnippet = activePkg
    ? formatRoutePresetToLuaSnippet(activePkg.routePreset)
    : '';

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top ATC Header Banner */}
      <div className="relative rounded-2xl overflow-hidden border border-stone-800 bg-stone-900/85 p-6 shadow-xl">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono uppercase tracking-wider">
              <Compass className="w-3.5 h-3.5" />
              <span>GTFO Air Traffic Control &amp; Mission Planning Dispatch</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent">
              Air Traffic Control // Flight Plans, DTC &amp; Path Tool Presets
            </h1>
            <p className="text-sm text-stone-400 leading-relaxed">
              DownloadSimple authorized squadron flight plans from the GTFO Member Portal, deploy aircraft
              Data Cartridges (<code className="text-amber-300 font-mono">.dtc</code> &amp;{' '}
              <code className="text-amber-300 font-mono">DCS-DTC .json</code>), and non-destructively
              append route presets into your per-theatre{' '}
              <code className="text-stone-300 font-mono">
                Saved Games\DCS\Config\RouteToolPresets\&lt;Theatre&gt;.lua
              </code>{' '}
              manifest.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={handleSyncPortal}
              disabled={isSyncingPortal}
              className="px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-200 text-xs font-mono font-semibold flex items-center gap-2 transition-all disabled:opacity-50"
            >
              <ArrowsClockwise
                className={`w-4 h-4 text-amber-400 ${isSyncingPortal ? 'animate-spin' : ''}`}
              />
              <span>SYNC PORTAL FLIGHT PLANS</span>
            </button>
          </div>
        </div>

        {/* Funnel Bar */}
        <div className="relative z-10 mt-6 pt-5 border-t border-stone-800/90 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-stone-400 mr-1">
              Theatre:
            </span>
            {theatres.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTheatre(t.id as DcsTheatre | 'ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  selectedTheatre === t.id
                    ? 'bg-amber-500 text-stone-950 font-semibold shadow-sm shadow-amber-500/20'
                    : 'bg-stone-950/70 text-stone-400 hover:text-stone-200 border border-stone-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-stone-400 mr-1">
              Squadron:
            </span>
            {squadronOptions.map((sq) => (
              <button
                key={sq.id}
                onClick={() => setSelectedSquadron(sq.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  selectedSquadron === sq.id
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 font-semibold'
                    : 'bg-stone-950/70 text-stone-400 hover:text-stone-200 border border-stone-800'
                }`}
              >
                {sq.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Master-Detail Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Flight Plan Packages List (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-amber-400">
              Active Portal Flight Plans ({filteredPackages.length})
            </h2>
            <span className="text-[11px] font-mono text-stone-400">Select to inspect</span>
          </div>

          {filteredPackages.map((pkg) => {
            const isSelected = activePkg?.id === pkg.id;
            const dtcDone = Boolean(installedAtc.installedDtcIds[pkg.id]);
            const routeDone = Boolean(installedAtc.mergedRoutePresets[pkg.id]);
            const sq = GTFO_SQUADRONS[pkg.squadron];

            return (
              <div
                key={pkg.id}
                onClick={() => setSelectedPkgId(pkg.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-stone-900 border-amber-500/60 shadow-lg shadow-amber-500/5 ring-1 ring-amber-500/30'
                    : 'bg-stone-900/60 border-stone-800/90 hover:border-stone-700 hover:bg-stone-900/90'
                }`}
              >
                <div className="flex items-start justify-between gap-2.5 mb-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {sq?.emblemUrl ? (
                      <img
                        src={sq.emblemUrl}
                        alt={pkg.squadron}
                        className="w-9 h-9 rounded-lg object-contain bg-stone-950 p-1 border border-stone-800 shrink-0"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-stone-950 border border-stone-800 flex items-center justify-center shrink-0">
                        <AirplaneTilt className="w-4 h-4 text-amber-400" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 block truncate">
                        {pkg.operationName} // {pkg.theatre}
                      </span>
                      <h3 className="font-display text-sm font-semibold text-stone-100 truncate">
                        {pkg.missionTitle}
                      </h3>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono text-stone-400 mt-2">
                  <span className="px-2 py-0.5 rounded bg-stone-950 border border-stone-800 text-stone-300">
                    {pkg.callsign}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-stone-950 border border-stone-800">
                    {pkg.aircraft}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-stone-950 border border-stone-800">
                    {pkg.routePreset.waypoints.length} WPTs
                  </span>
                </div>

                <div className="mt-3 pt-2.5 border-t border-stone-800/80 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-stone-400 truncate">
                    {pkg.depAirfield.split(' ')[0]} → {pkg.arrAirfield.split(' ')[0]}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {dtcDone && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px]">
                        DTC
                      </span>
                    )}
                    {routeDone && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px]">
                        ROUTE
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Column: Selected Flight Plan Detail & Deployment Workbench (8 cols) */}
        <div className="lg:col-span-8 space-y-5">
          {activePkg ? (
            <>
              {/* Package Dossier Header Card */}
              <div className="rounded-2xl border border-stone-800 bg-stone-900/90 p-6 space-y-5">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    {squadronMeta?.emblemUrl && (
                      <img
                        src={squadronMeta.emblemUrl}
                        alt={activePkg.squadron}
                        className="w-14 h-14 rounded-xl object-contain bg-stone-950 p-1.5 border border-stone-800 shrink-0"
                      />
                    )}
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[11px] font-mono font-semibold uppercase">
                          {activePkg.operationName}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full bg-stone-800 text-stone-300 text-[11px] font-mono">
                          {activePkg.squadron}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full bg-stone-800 text-stone-300 text-[11px] font-mono">
                          {activePkg.aircraft}
                        </span>
                      </div>
                      <h2 className="font-display text-xl font-bold text-stone-100">
                        {activePkg.missionTitle}
                      </h2>
                      <p className="text-xs font-mono text-stone-400">
                        Mission Date:{' '}
                        <span className="text-stone-200">
                          {activePkg.missionDate} @ {activePkg.zuluTime}
                        </span>{' '}
                        &bull; Flight Callsign:{' '}
                        <span className="text-amber-400 font-semibold">{activePkg.callsign}</span>{' '}
                        &bull; Package Lead:{' '}
                        <span className="text-stone-200">{activePkg.packageCommander}</span>
                      </p>
                    </div>
                  </div>

                  {/* Master One-Click Deploy Button */}
                  <button
                    onClick={() => handleDeployAll(activePkg)}
                    disabled={isDeploying}
                    className="px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-display font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all shrink-0 disabled:opacity-50"
                  >
                    <DownloadSimple className="w-4 h-4" />
                    <span>
                      {isDtcInstalled && isRouteMerged
                        ? 'Re-Deploy Full Flight Package'
                        : 'Deploy Full Flight Package'}
                    </span>
                  </button>
                </div>

                {/* Operational Parameters Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <div className="p-3 rounded-xl bg-stone-950/80 border border-stone-800/80">
                    <div className="text-[10px] font-mono uppercase text-stone-400">
                      Departure / Recovery
                    </div>
                    <div className="text-xs font-mono font-semibold text-stone-200 mt-1 truncate">
                      {activePkg.depAirfield}
                    </div>
                    <div className="text-[11px] font-mono text-stone-400 truncate">
                      ARR: {activePkg.arrAirfield}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-stone-950/80 border border-stone-800/80">
                    <div className="text-[10px] font-mono uppercase text-stone-400">
                      Alternate / Divert
                    </div>
                    <div className="text-xs font-mono font-semibold text-stone-200 mt-1 truncate">
                      {activePkg.altAirfield || 'Primary Recovery'}
                    </div>
                    <div className="text-[11px] font-mono text-amber-400/90 truncate">
                      Theatre: {activePkg.theatre}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-stone-950/80 border border-stone-800/80">
                    <div className="text-[10px] font-mono uppercase text-stone-400">
                      Cruise Profile
                    </div>
                    <div className="text-xs font-mono font-semibold text-stone-200 mt-1 truncate">
                      {activePkg.cruiseAlt}
                    </div>
                    <div className="text-[11px] font-mono text-stone-400 truncate">
                      Bingo: {activePkg.dtcPackage.bingoFuelLbs || 3000} lbs
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-stone-950/80 border border-stone-800/80">
                    <div className="text-[10px] font-mono uppercase text-stone-400">
                      Primary Tasking
                    </div>
                    <div className="text-xs font-mono font-semibold text-amber-300 mt-1 truncate">
                      {activePkg.tasking}
                    </div>
                    <div className="text-[11px] font-mono text-stone-400 truncate">
                      CMS: {activePkg.dtcPackage.cmsProgram || 'Standard'}
                    </div>
                  </div>
                </div>

                {/* Remarks Box */}
                <div className="p-3.5 rounded-xl bg-stone-950/90 border-l-2 border-amber-500 text-xs text-stone-300 leading-relaxed">
                  <span className="font-mono font-bold uppercase text-amber-400 mr-2">
                    ATC Tactical Brief:
                  </span>
                  {activePkg.tacticalSummary}
                </div>

                {/* 3 Component Deployment Action Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1">
                  {/* 1. DTC Card */}
                  <div className="p-4 rounded-xl bg-stone-950/90 border border-stone-800 flex flex-col justify-between gap-3">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="inline-flex items-center gap-1.5 text-xs font-display font-semibold text-stone-200">
                          <Cpu className="w-4 h-4 text-amber-400" />
                          Data Cartridge (DTC)
                        </span>
                        {isDtcInstalled && (
                          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] font-mono text-stone-400 break-all">
                        Saved Games\DCS\{activePkg.dtcPackage.targetSubfolder}\
                        {activePkg.dtcPackage.fileName}
                      </p>
                      <span className="inline-block mt-1.5 px-2 py-0.5 rounded bg-stone-900 border border-stone-800 text-[10px] font-mono text-amber-300">
                        {activePkg.dtcPackage.format === 'dcs_dtc_mod'
                          ? 'DCS-DTC JSON Format'
                          : 'Native DCS .dtc Format'}
                      </span>
                    </div>
                    <button
                      onClick={() => deployAtcDtc(activePkg)}
                      className="w-full py-2 px-3 rounded-lg bg-stone-800 hover:bg-amber-500 hover:text-stone-950 text-stone-200 font-mono font-semibold text-xs transition-all flex items-center justify-center gap-1.5"
                    >
                      <DownloadSimple className="w-3.5 h-3.5" />
                      <span>{isDtcInstalled ? 'Update DTC File' : 'Install DTC File'}</span>
                    </button>
                  </div>

                  {/* 2. Path Tool Preset Card */}
                  <div className="p-4 rounded-xl bg-stone-950/90 border border-stone-800 flex flex-col justify-between gap-3">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="inline-flex items-center gap-1.5 text-xs font-display font-semibold text-stone-200">
                          <Path className="w-4 h-4 text-amber-400" />
                          Path Tool Preset
                        </span>
                        {isRouteMerged && (
                          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] font-mono text-stone-400 break-all">
                        Saved Games\DCS\Config\RouteToolPresets\{activeTheatreFileName}
                      </p>
                      <span className="inline-block mt-1.5 px-2 py-0.5 rounded bg-stone-900 border border-stone-800 text-[10px] font-mono text-amber-300 truncate max-w-full">
                        Key: [&quot;{activePkg.routePreset.presetName}&quot;]
                      </span>
                    </div>
                    <button
                      onClick={() => handleMergePreset(activePkg)}
                      className="w-full py-2 px-3 rounded-lg bg-stone-800 hover:bg-amber-500 hover:text-stone-950 text-stone-200 font-mono font-semibold text-xs transition-all flex items-center justify-center gap-1.5"
                    >
                      <FolderSimple className="w-3.5 h-3.5" />
                      <span>
                        {isRouteMerged
                          ? 'Update Preset in Theatre Lua'
                          : 'Append to Theatre Lua'}
                      </span>
                    </button>
                  </div>

                  {/* 3. Kneeboard Card */}
                  <div className="p-4 rounded-xl bg-stone-950/90 border border-stone-800 flex flex-col justify-between gap-3">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="inline-flex items-center gap-1.5 text-xs font-display font-semibold text-stone-200">
                          <BookOpen className="w-4 h-4 text-amber-400" />
                          Briefing Kneeboards
                        </span>
                        {areKneeboardsInstalled && (
                          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] font-mono text-stone-400 break-all">
                        Saved Games\DCS\Kneeboard\{activePkg.kneeboards[0]?.aircraftFolder || 'ALL'}
                      </p>
                      <span className="inline-block mt-1.5 px-2 py-0.5 rounded bg-stone-900 border border-stone-800 text-[10px] font-mono text-stone-300">
                        {activePkg.kneeboards.length} Comms / Path Card(s)
                      </span>
                    </div>
                    <button
                      onClick={() => deployAtcKneeboards(activePkg)}
                      className="w-full py-2 px-3 rounded-lg bg-stone-800 hover:bg-amber-500 hover:text-stone-950 text-stone-200 font-mono font-semibold text-xs transition-all flex items-center justify-center gap-1.5"
                    >
                      <DownloadSimple className="w-3.5 h-3.5" />
                      <span>
                        {areKneeboardsInstalled ? 'Re-Install Kneeboards' : 'Install Kneeboards'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Sub-NavigationArrow Tabs for Detailed Inspection */}
              <div className="rounded-2xl border border-stone-800 bg-stone-900/90 overflow-hidden">
                <div className="border-b border-stone-800 px-4 pt-3 flex flex-wrap items-center gap-2 bg-stone-950/60">
                  <button
                    onClick={() => setActiveSubTab('waypoints')}
                    className={`px-4 py-2.5 text-xs font-display font-semibold border-b-2 transition-all flex items-center gap-2 ${
                      activeSubTab === 'waypoints'
                        ? 'border-amber-400 text-amber-400'
                        : 'border-transparent text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    <NavigationArrow className="w-3.5 h-3.5" />
                    <span>Flight Plan Waypoints ({activePkg.dtcPackage.waypoints.length})</span>
                  </button>

                  <button
                    onClick={() => setActiveSubTab('dtc')}
                    className={`px-4 py-2.5 text-xs font-display font-semibold border-b-2 transition-all flex items-center gap-2 ${
                      activeSubTab === 'dtc'
                        ? 'border-amber-400 text-amber-400'
                        : 'border-transparent text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    <Radio className="w-3.5 h-3.5" />
                    <span>Radio Matrix &amp; DTC Payload</span>
                  </button>

                  <button
                    onClick={() => setActiveSubTab('lua')}
                    className={`px-4 py-2.5 text-xs font-display font-semibold border-b-2 transition-all flex items-center gap-2 ${
                      activeSubTab === 'lua'
                        ? 'border-amber-400 text-amber-400'
                        : 'border-transparent text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    <Code className="w-3.5 h-3.5" />
                    <span>Theatre RouteToolPresets Manifest ({activeTheatreFileName})</span>
                  </button>

                  <button
                    onClick={() => setActiveSubTab('kneeboard')}
                    className={`px-4 py-2.5 text-xs font-display font-semibold border-b-2 transition-all flex items-center gap-2 ${
                      activeSubTab === 'kneeboard'
                        ? 'border-amber-400 text-amber-400'
                        : 'border-transparent text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    <FileXls className="w-3.5 h-3.5" />
                    <span>Kneeboard Preview</span>
                  </button>
                </div>

                <div className="p-5">
                  {/* SUB-TAB 1: WAYPOINTS TABLE */}
                  {activeSubTab === 'waypoints' && (
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <h3 className="font-display text-sm font-semibold text-stone-200">
                            Steerpoint / Waypoint Sequence — {activePkg.routePreset.presetName}
                          </h3>
                          <p className="text-xs text-stone-400">
                            Synchronized across both the aircraft DTC cartridge and the DCS F10 Map
                            Path Tool preset.
                          </p>
                        </div>
                      </div>

                      <div className="overflow-x-auto rounded-xl border border-stone-800">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-stone-950 text-[11px] font-mono uppercase text-stone-400 border-b border-stone-800">
                              <th className="py-2.5 px-3">WPT</th>
                              <th className="py-2.5 px-3">Fix / Waypoint Name</th>
                              <th className="py-2.5 px-3">Coordinates (Lat / Lon)</th>
                              <th className="py-2.5 px-3">Alt (MSL)</th>
                              <th className="py-2.5 px-3">GS (KT)</th>
                              <th className="py-2.5 px-3">Action / Notes</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-800/70 text-xs font-mono">
                            {activePkg.dtcPackage.waypoints.map((wp) => (
                              <tr
                                key={wp.index}
                                className="hover:bg-stone-800/40 transition-colors"
                              >
                                <td className="py-2.5 px-3 font-bold text-amber-400">
                                  #{wp.index}
                                </td>
                                <td className="py-2.5 px-3 font-sans font-medium text-stone-100">
                                  {wp.name}
                                </td>
                                <td className="py-2.5 px-3 text-stone-300">
                                  {wp.lat.toFixed(4)}° N / {wp.lon.toFixed(4)}° E
                                </td>
                                <td className="py-2.5 px-3 text-stone-200">
                                  {wp.altFeet.toLocaleString()} ft
                                </td>
                                <td className="py-2.5 px-3 text-stone-300">{wp.speedKnots} kt</td>
                                <td className="py-2.5 px-3 font-sans text-stone-400">
                                  {wp.action ? (
                                    <span className="text-amber-300 font-mono mr-1.5">
                                      [{wp.action}]
                                    </span>
                                  ) : null}
                                  {wp.notes || ''}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* SUB-TAB 2: RADIO MATRIX & DTC PAYLOAD */}
                  {activeSubTab === 'dtc' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                      <div className="space-y-3">
                        <h3 className="font-display text-sm font-semibold text-amber-400 flex items-center gap-2">
                          <Radio className="w-4 h-4" />
                          <span>Pre-Programmed Radio Presets</span>
                        </h3>
                        <div className="rounded-xl border border-stone-800 overflow-hidden">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-stone-950 text-[11px] font-mono uppercase text-stone-400 border-b border-stone-800">
                                <th className="py-2 px-3">Radio</th>
                                <th className="py-2 px-3">Ch</th>
                                <th className="py-2 px-3">Freq</th>
                                <th className="py-2 px-3">Agency / Net</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-800/70 text-xs font-mono">
                              {activePkg.dtcPackage.radioPresets.flatMap((radioGroup) =>
                                radioGroup.channels.map((ch) => (
                                  <tr
                                    key={`${radioGroup.radioName}-${ch.channel}`}
                                    className="hover:bg-stone-800/40"
                                  >
                                    <td className="py-2 px-3 text-stone-300">
                                      {radioGroup.radioName}
                                    </td>
                                    <td className="py-2 px-3 text-amber-400 font-bold">
                                      CH {ch.channel}
                                    </td>
                                    <td className="py-2 px-3 text-stone-100">{ch.frequencyMhz}</td>
                                    <td className="py-2 px-3 font-sans text-stone-300">
                                      {ch.label}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="font-display text-sm font-semibold text-amber-400 flex items-center gap-2">
                            <FileCode className="w-4 h-4" />
                            <span>Cartridge File Content ({activePkg.dtcPackage.fileName})</span>
                          </h3>
                          <span className="text-[11px] font-mono text-stone-400">
                            {activePkg.dtcPackage.targetSubfolder}\{activePkg.dtcPackage.fileName}
                          </span>
                        </div>
                        <pre className="p-3.5 rounded-xl bg-stone-950 border border-stone-800 text-[11px] font-mono text-stone-300 overflow-x-auto max-h-72">
                          {JSON.stringify(activePkg.dtcPackage.rawPayload, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* SUB-TAB 3: THEATRE ROUTETOOLPRESETS LUA MANIFEST INSPECTOR */}
                  {activeSubTab === 'lua' && (
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-stone-950 border border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Stack className="w-4 h-4 text-amber-400" />
                            <span className="font-display text-sm font-semibold text-stone-100">
                              Per-Theatre Path Tool Manifest:{' '}
                              <code className="text-amber-400 font-mono">
                                Config\RouteToolPresets\{activeTheatreFileName}
                              </code>
                            </span>
                          </div>
                          <p className="text-xs text-stone-400">
                            DCS stores all F10 Path Tool presets for a theatre inside a single Lua
                            table (
                            <code className="text-stone-300 font-mono">
                              presets = &#123; ... &#125;
                            </code>
                            ). Clicking <strong>Append / Update</strong> injects{' '}
                            <code className="text-amber-300 font-mono">
                              [&quot;{activePkg.routePreset.presetName}&quot;]
                            </code>{' '}
                            while keeping all your existing presets in{' '}
                            <code className="text-stone-300 font-mono">
                              {activeTheatreFileName}
                            </code>{' '}
                            intact.
                          </p>
                        </div>

                        <button
                          onClick={() => handleMergePreset(activePkg)}
                          disabled={isDeploying}
                          className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-mono font-bold text-xs uppercase tracking-wider shrink-0 transition-all"
                        >
                          {isRouteMerged ? 'Update Preset in Manifest' : 'Append Preset to Manifest'}
                        </button>
                      </div>

                      {/* Detected Presets in this Theatre File */}
                      <div className="space-y-2">
                        <div className="text-xs font-mono uppercase tracking-wider text-stone-400">
                          Presets Currently Stored in {activeTheatreFileName} (
                          {theatreManifestInfo?.presetNames.length || 0}):
                        </div>
                        {theatreManifestInfo && theatreManifestInfo.presetNames.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {theatreManifestInfo.presetNames.map((name) => {
                              const isCurrentPkg = name === activePkg.routePreset.presetName;
                              return (
                                <span
                                  key={name}
                                  className={`px-3 py-1 rounded-lg text-xs font-mono flex items-center gap-1.5 border ${
                                    isCurrentPkg
                                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-semibold'
                                      : 'bg-stone-950 border-stone-800 text-stone-300'
                                  }`}
                                >
                                  <MapPin className="w-3 h-3 text-amber-400" />
                                  <span>[&quot;{name}&quot;]</span>
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="p-3 rounded-xl bg-stone-950/70 border border-stone-800 text-xs font-mono text-stone-400 flex items-center gap-2">
                            <ShieldWarning className="w-4 h-4 text-amber-400 shrink-0" />
                            <span>
                              No existing{' '}
                              <code className="text-stone-200">{activeTheatreFileName}</code> found
                              yet. Clicking Append will initialize the theatre manifest and insert
                              this route preset.
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Two-column Lua view: Incoming Snippet vs Live Merged Theatre File */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="text-xs font-mono text-amber-400 uppercase">
                            Package Preset Entry ([&quot;{activePkg.routePreset.presetName}&quot;])
                          </div>
                          <pre className="p-3.5 rounded-xl bg-stone-950 border border-stone-800 text-[11px] font-mono text-stone-300 overflow-x-auto max-h-72">
                            {activeLuaSnippet}
                          </pre>
                        </div>

                        <div className="space-y-2">
                          <div className="text-xs font-mono text-emerald-400 uppercase">
                            Live Theatre Manifest ({activeTheatreFileName})
                          </div>
                          <pre className="p-3.5 rounded-xl bg-stone-950 border border-stone-800 text-[11px] font-mono text-stone-300 overflow-x-auto max-h-72">
                            {theatreManifestInfo?.rawContent ||
                              `-- ${activeTheatreFileName} not yet created.\n-- Click "Append Preset to Manifest" to create or merge.`}
                          </pre>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SUB-TAB 4: KNEEBOARD PREVIEW */}
                  {activeSubTab === 'kneeboard' && (
                    <div className="space-y-4">
                      {activePkg.kneeboards.map((kb) => {
                        const svgStr = generateKneeboardSvgCard(activePkg, kb);
                        return (
                          <div
                            key={kb.id}
                            className="p-4 rounded-xl bg-stone-950 border border-stone-800 flex flex-col md:flex-row items-start gap-5"
                          >
                            <div className="w-full md:w-72 shrink-0 rounded-lg overflow-hidden border border-stone-800 bg-stone-900">
                              <img
                                src={`data:image/svg+xml;utf8,${encodeURIComponent(svgStr)}`}
                                alt={kb.title}
                                className="w-full h-auto block"
                              />
                            </div>
                            <div className="space-y-3 flex-1">
                              <div>
                                <span className="text-[11px] font-mono uppercase text-amber-400">
                                  Cockpit Kneeboard Card ({kb.pageType})
                                </span>
                                <h4 className="font-display text-base font-bold text-stone-100">
                                  {kb.title}
                                </h4>
                                <p className="text-xs font-mono text-stone-400 mt-1">
                                  Target Destination: Saved Games\DCS\Kneeboard\{kb.aircraftFolder}\
                                  {kb.fileName}
                                </p>
                              </div>
                              <p className="text-xs text-stone-300 leading-relaxed">
                                Automatically formatted for the in-cockpit DCS Kneeboard (
                                <code className="text-amber-300 font-mono">RShift + K</code>) with
                                package frequencies, steerpoints, and mission dispatch summary.
                              </p>
                              <button
                                onClick={() => deployAtcKneeboards(activePkg)}
                                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-mono font-bold text-xs uppercase tracking-wider inline-flex items-center gap-2 transition-all"
                              >
                                <Sparkle className="w-3.5 h-3.5" />
                                <span>Deploy Kneeboard to Kneeboard\{kb.aircraftFolder}</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="p-12 rounded-2xl border border-stone-800 bg-stone-900/60 text-center space-y-2">
              <p className="font-display text-base text-stone-300">
                No flight plans match the current theatre/squadron filter.
              </p>
              <button
                onClick={() => {
                  setSelectedTheatre('ALL');
                  setSelectedSquadron('ALL');
                }}
                className="text-xs font-mono text-amber-400 hover:underline"
              >
                Reset Filters
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
