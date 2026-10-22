import React, { useEffect, useMemo, useState } from 'react';
import {
  AirplaneTilt,
  ArrowsClockwise,
  BookOpen,
  Check,
  CheckCircle,
  Code,
  Compass,
  Copy,
  Cpu,
  DownloadSimple,
  Eye,
  FileCode,
  FilePdf,
  FolderSimple,
  ListChecks,
  MapPin,
  NavigationArrow,
  Path,
  Radio,
  ShieldWarning,
  Sparkle,
  Terminal,
  User,
  UsersFour,
  WarningCircle,
} from '@phosphor-icons/react';
import { useApp } from '../context/AppContext';
import {
  formatFlightPlanToLuaPreset,
  buildDtcJsonPayload,
} from '../data/sampleFlightPlans';
import {
  downloadFlightPlanDcsRoute,
  downloadFlightPlanDtc,
  getFlightPlanPdfUrl,
  installAircraftKneeboardPageCommand,
  normalizeDcsTheatreFileName,
  triggerBrowserFileDownload,
} from '../services/flightPlanService';
import {
  FlightPlanDetail,
  FlightPlanSummary,
} from '../types';

export const AtcView: React.FC = () => {
  const {
    memberFlightPlans,
    memberFlightPlansMeta,
    activeSortie,
    activeSortieFlightPlans,
    isLoadingFlightPlans,
    syncFlightPlans,
    loadFlightPlanDetail,
    saveRouteToDcs,
    copyDcsRoutePresetsPathToClipboard,
    saveDtcCartridgeDirect,
    openPdfKneeboardViewer,
    dcsEnv,
    settings,
  } = useApp();

  // Mode: 'member' (Assigned/Private plans) or 'sortie' (Active Sortie Package View)
  const [viewMode, setViewMode] = useState<'member' | 'sortie'>('member');
  const [selectedPlanId, setSelectedPlanId] = useState<number | string>(
    memberFlightPlans[0]?.id || 14
  );
  const [selectedDetail, setSelectedDetail] = useState<FlightPlanDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSquadron, setSelectedSquadron] = useState<string>('ALL');
  const [selectedAirframe, setSelectedAirframe] = useState<string>('ALL');

  // Active sub-tab in workbench
  const [activeTab, setActiveTab] = useState<'waypoints' | 'comms' | 'avionics' | 'route_lua' | 'dtc'>(
    'waypoints'
  );

  // Action status states
  const [isSavingRoute, setIsSavingRoute] = useState(false);
  const [isSavingDtc, setIsSavingDtc] = useState(false);
  const [isOpeningPdf, setIsOpeningPdf] = useState(false);
  const [isExportingKneeboard, setIsExportingKneeboard] = useState(false);
  const [routeSavedPath, setRouteSavedPath] = useState<string | null>(null);
  const [dtcSavedPath, setDtcSavedPath] = useState<string | null>(null);
  const [hasCopiedPath, setHasCopiedPath] = useState(false);
  const [hasCopiedLua, setHasCopiedLua] = useState(false);
  const [hasCopiedDtc, setHasCopiedDtc] = useState(false);
  const [copiedWptIdx, setCopiedWptIdx] = useState<number | null>(null);

  // Active source list based on mode
  const currentPlans = useMemo(() => {
    return viewMode === 'member' ? memberFlightPlans : activeSortieFlightPlans;
  }, [viewMode, memberFlightPlans, activeSortieFlightPlans]);

  // Filtered list
  const filteredPlans = useMemo(() => {
    return currentPlans.filter((p) => {
      if (selectedSquadron !== 'ALL' && p.squadron?.abbreviation !== selectedSquadron && p.squadron?.name !== selectedSquadron) {
        return false;
      }
      if (selectedAirframe !== 'ALL' && p.airframe?.abbreviation !== selectedAirframe && p.airframe?.dcs_entity !== selectedAirframe) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchCallsign = p.callsign?.toLowerCase().includes(q);
        const matchName = p.name?.toLowerCase().includes(q);
        const matchId = p.identifier?.toLowerCase().includes(q);
        const matchAirframe = p.airframe?.name?.toLowerCase().includes(q);
        const matchSquadron = p.squadron?.name?.toLowerCase().includes(q);
        const matchMission = p.mission?.name?.toLowerCase().includes(q);
        const matchSortie = p.sortie?.name?.toLowerCase().includes(q);
        const matchRemarks = p.remarks?.toLowerCase().includes(q);
        if (!matchCallsign && !matchName && !matchId && !matchAirframe && !matchSquadron && !matchMission && !matchSortie && !matchRemarks) {
          return false;
        }
      }
      return true;
    });
  }, [currentPlans, searchQuery, selectedAirframe, selectedSquadron]);

  // Selected plan summary
  const activeSummary: FlightPlanSummary | undefined = useMemo(() => {
    return (
      filteredPlans.find((p) => p.id === selectedPlanId || p.identifier === selectedPlanId) ||
      filteredPlans[0] ||
      currentPlans[0]
    );
  }, [currentPlans, filteredPlans, selectedPlanId]);

  // Fetch full details whenever the active selected plan changes
  useEffect(() => {
    if (!activeSummary) return;
    let isCancelled = false;

    const fetchDetail = async () => {
      setIsLoadingDetail(true);
      setRouteSavedPath(null);
      setDtcSavedPath(null);
      try {
        const detail = await loadFlightPlanDetail(activeSummary.id || activeSummary.identifier);
        if (!isCancelled) {
          setSelectedDetail(detail);
        }
      } catch (err) {
        console.warn('Failed loading flight plan detail:', err);
      } finally {
        if (!isCancelled) {
          setIsLoadingDetail(false);
        }
      }
    };

    fetchDetail();

    return () => {
      isCancelled = true;
    };
  }, [activeSummary?.id, activeSummary?.identifier, loadFlightPlanDetail]);

  // Active Theatre for presets
  const activeTheatre = useMemo(() => {
    if (viewMode === 'sortie' && activeSortie?.theatre) return activeSortie.theatre;
    if ((selectedDetail as any)?.theatre) return (selectedDetail as any).theatre;
    if (
      selectedDetail?.departure_airfield?.includes('Incirlik') ||
      selectedDetail?.departure_airfield?.includes('Ramat')
    ) {
      return 'Syria';
    }
    if (
      selectedDetail?.departure_airfield?.includes('Nellis') ||
      selectedDetail?.departure_airfield?.includes('Creech')
    ) {
      return 'Nevada';
    }
    if (
      selectedDetail?.departure_airfield?.includes('Krymsk') ||
      selectedDetail?.departure_airfield?.includes('Batumi')
    ) {
      return 'Caucasus';
    }
    if (
      selectedDetail?.departure_airfield?.includes('Al Dhafra') ||
      selectedDetail?.departure_airfield?.includes('Khasab')
    ) {
      return 'Persian Gulf';
    }
    return activeSortie?.theatre || 'Persian Gulf';
  }, [viewMode, activeSortie?.theatre, selectedDetail]);

  // DCS Route Tool Lua file name without space (e.g. 'PersianGulf.lua')
  const activeTheatreFileName = useMemo(() => {
    return normalizeDcsTheatreFileName(activeTheatre);
  }, [activeTheatre]);

  // Generated or downloaded Lua snippet
  const activeLuaSnippet = useMemo(() => {
    if (!selectedDetail) return '';
    return formatFlightPlanToLuaPreset(selectedDetail);
  }, [selectedDetail]);

  // Formatted DTC JSON payload
  const activeDtcJson = useMemo(() => {
    if (!selectedDetail) return '';
    return JSON.stringify(buildDtcJsonPayload(selectedDetail), null, 2);
  }, [selectedDetail]);

  // Squadrons and airframes options for filter
  const squadronFilterOptions = useMemo(() => {
    const set = new Set<string>();
    currentPlans.forEach((p) => {
      if (p.squadron?.abbreviation) set.add(p.squadron.abbreviation);
    });
    return Array.from(set);
  }, [currentPlans]);

  const airframeFilterOptions = useMemo(() => {
    const set = new Set<string>();
    currentPlans.forEach((p) => {
      if (p.airframe?.abbreviation) set.add(p.airframe.abbreviation);
    });
    return Array.from(set);
  }, [currentPlans]);

  // --- Actions ---

  // 1. One-Click Save Route to DCS
  const handleSaveRouteToDcs = async () => {
    if (!selectedDetail) return;
    setIsSavingRoute(true);
    setRouteSavedPath(null);
    try {
      const res = await saveRouteToDcs(activeTheatreFileName, activeLuaSnippet);
      setRouteSavedPath(res.filePath);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingRoute(false);
    }
  };

  // 2. Copy Route Presets Path Fallback
  const handleCopyPresetsPath = async () => {
    const path = await copyDcsRoutePresetsPathToClipboard();
    setHasCopiedPath(true);
    setTimeout(() => setHasCopiedPath(false), 2500);
  };

  // 3. Save DTC Cartridge Directly
  const handleSaveDtcToDcs = async () => {
    if (!selectedDetail || !selectedDetail.is_dtc_compatible) return;
    setIsSavingDtc(true);
    setDtcSavedPath(null);
    try {
      const fileName = `${selectedDetail.callsign.replace(/[^a-zA-Z0-9_-]/g, '_')}.dtc`;
      const path = await saveDtcCartridgeDirect(fileName, activeDtcJson, 'DTC');
      setDtcSavedPath(path);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingDtc(false);
    }
  };

  // 4. Download DTC File
  const handleDownloadDtc = () => {
    if (!selectedDetail) return;
    const fileName = `${selectedDetail.callsign.replace(/[^a-zA-Z0-9_-]/g, '_')}.dtc`;
    triggerBrowserFileDownload(fileName, activeDtcJson, 'application/json');
  };

  // 5. Open PDF Kneeboard
  const handleOpenPdf = async () => {
    if (!selectedDetail) return;
    setIsOpeningPdf(true);
    try {
      const baseUrl = settings.memberPortalApiUrl;
      const pdfUrl = selectedDetail.download_urls?.pdf || getFlightPlanPdfUrl(baseUrl, selectedDetail.id);
      const fileName = `${selectedDetail.callsign.replace(/[^a-zA-Z0-9_-]/g, '_')}_Kneeboard.pdf`;
      await openPdfKneeboardViewer(pdfUrl, fileName);
    } finally {
      setIsOpeningPdf(false);
    }
  };

  // 6. Download PDF File
  const handleDownloadPdf = () => {
    if (!selectedDetail) return;
    const baseUrl = settings.memberPortalApiUrl;
    const pdfUrl = selectedDetail.download_urls?.pdf || getFlightPlanPdfUrl(baseUrl, selectedDetail.id);
    window.open(pdfUrl, '_blank');
  };

  // 7. Export Kneeboard page directly to DCS aircraft folder
  const handleExportToKneeboardFolder = async () => {
    if (!selectedDetail) return;
    setIsExportingKneeboard(true);
    try {
      const aircraftFolder = selectedDetail.airframe.dcs_entity || 'ALL';
      const fileName = `GTFO_${selectedDetail.callsign.replace(/[^a-zA-Z0-9_-]/g, '_')}_BRIEF.txt`;
      const briefContent = [
        `=== GTFO FLIGHT PLAN BRIEF: ${selectedDetail.callsign} (${selectedDetail.identifier}) ===`,
        `Mission: ${selectedDetail.mission?.name || (selectedDetail.is_private ? 'Private / Standalone Flight Plan' : 'Unassigned')} | Sortie: ${selectedDetail.sortie?.name || 'None'}`,
        `Airframe: ${selectedDetail.airframe.name} (${selectedDetail.airframe.dcs_entity})`,
        `Squadron: ${selectedDetail.squadron.name}`,
        `Departure: ${selectedDetail.departure_airfield || 'N/A'} | Arrival: ${selectedDetail.destination_airfield || 'N/A'}`,
        `Launch Time: ${selectedDetail.launch_time || 'N/A'} | Fuel: ${selectedDetail.fuel_amount || 'N/A'}`,
        `Remarks: ${selectedDetail.remarks || 'None'}`,
        ``,
        `=== WAYPOINTS ===`,
        ...(selectedDetail.route_points || []).map(
          (wp) => `[${wp.index}] ${wp.name.padEnd(20)} Alt: ${wp.alt}ft  Spd: ${wp.speed}kts  MGRS: ${wp.mgrs || 'N/A'}  ${wp.remarks || ''}`
        ),
      ].join('\n');

      const customDcsPath = settings.dcsSavedGamesPath || dcsEnv?.activeSavedGamesPath;
      await installAircraftKneeboardPageCommand(
        aircraftFolder,
        fileName,
        briefContent,
        false,
        customDcsPath
      );
    } finally {
      setIsExportingKneeboard(false);
    }
  };

  // Copy Lua to clipboard
  const handleCopyLua = async () => {
    await navigator.clipboard.writeText(activeLuaSnippet);
    setHasCopiedLua(true);
    setTimeout(() => setHasCopiedLua(false), 2000);
  };

  // Download Lua file
  const handleDownloadLua = () => {
    if (!selectedDetail) return;
    const fileName = `${selectedDetail.callsign.replace(/[^a-zA-Z0-9_-]/g, '_')}_route.lua`;
    triggerBrowserFileDownload(fileName, activeLuaSnippet, 'text/plain');
  };

  // Copy DTC JSON to clipboard
  const handleCopyDtc = async () => {
    await navigator.clipboard.writeText(activeDtcJson);
    setHasCopiedDtc(true);
    setTimeout(() => setHasCopiedDtc(false), 2000);
  };

  // Copy single waypoint coordinates
  const handleCopyCoordinates = async (wp: any, idx: number) => {
    const text = wp.mgrs ? `${wp.mgrs} (${wp.lat.toFixed(4)}, ${wp.lng.toFixed(4)})` : `${wp.lat.toFixed(4)}, ${wp.lng.toFixed(4)}`;
    await navigator.clipboard.writeText(text);
    setCopiedWptIdx(idx);
    setTimeout(() => setCopiedWptIdx(null), 1800);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header Banner */}
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
              Connect to the GTFO Laravel REST API to inspect member flight plans and package sorties.
              One-click append route presets directly into{' '}
              <code className="text-stone-300 font-mono">
                Saved Games\DCS\Config\RouteToolPresets\&lt;Theatre&gt;.lua
              </code>
              , save native DTC cartridges, and export briefing kneeboards.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={() => syncFlightPlans()}
              disabled={isLoadingFlightPlans}
              className="px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-200 text-xs font-mono font-semibold flex items-center gap-2 transition-all disabled:opacity-50"
            >
              <ArrowsClockwise
                className={`w-4 h-4 text-amber-400 ${isLoadingFlightPlans ? 'animate-spin' : ''}`}
              />
              <span>SYNC PORTAL FLIGHT PLANS</span>
            </button>
          </div>
        </div>

        {/* View Mode Switcher & Stats Bar */}
        <div className="relative z-10 mt-6 pt-5 border-t border-stone-800/90 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="inline-flex p-1 bg-stone-950/80 border border-stone-800 rounded-xl">
            <button
              onClick={() => {
                setViewMode('member');
                if (memberFlightPlans[0]) setSelectedPlanId(memberFlightPlans[0].id);
              }}
              className={`px-4 py-2 rounded-lg text-xs font-display font-semibold transition-all flex items-center gap-2 ${
                viewMode === 'member'
                  ? 'bg-amber-500 text-stone-950 shadow-md font-bold'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <User className="w-4 h-4" />
              <span>My Assigned &amp; Private Plans</span>
              <span className="px-1.5 py-0.2 rounded-full bg-stone-900/60 text-[10px] font-mono">
                {memberFlightPlans.length}
              </span>
            </button>

            <button
              onClick={() => {
                setViewMode('sortie');
                if (activeSortieFlightPlans[0]) setSelectedPlanId(activeSortieFlightPlans[0].id);
              }}
              className={`px-4 py-2 rounded-lg text-xs font-display font-semibold transition-all flex items-center gap-2 ${
                viewMode === 'sortie'
                  ? 'bg-amber-500 text-stone-950 shadow-md font-bold'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <UsersFour className="w-4 h-4" />
              <span>Active Sortie Package</span>
              <span className="px-1.5 py-0.2 rounded-full bg-stone-900/60 text-[10px] font-mono">
                {activeSortieFlightPlans.length}
              </span>
            </button>
          </div>

          {/* Stat Badges for Active Mode */}
          {viewMode === 'member' ? (
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
              <span className="px-2.5 py-1 rounded-lg bg-stone-950 border border-stone-800 text-stone-300">
                Missions: <strong className="text-amber-400">{memberFlightPlansMeta.missions_count}</strong>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-stone-950 border border-stone-800 text-stone-300">
                Authored: <strong className="text-amber-400">{memberFlightPlansMeta.authored_count}</strong>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-stone-950 border border-stone-800 text-stone-300">
                Private: <strong className="text-purple-400">{memberFlightPlansMeta.private_count}</strong>
              </span>
            </div>
          ) : (
            activeSortie && (
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                <span className="px-2.5 py-1 rounded-lg bg-stone-950 border border-stone-800 text-amber-300 font-semibold">
                  {activeSortie.name} (Sortie #{activeSortie.sortie_number})
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-stone-950 border border-stone-800 text-stone-300">
                  Campaign: <strong className="text-stone-100">{activeSortie.campaign_name}</strong>
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-stone-950 border border-stone-800 text-stone-300">
                  Theatre: <strong className="text-amber-400">{activeSortie.theatre}</strong>
                </span>
              </div>
            )
          )}
        </div>
      </div>

      {/* Active Sortie Overview Banner (When in Sortie Mode) */}
      {viewMode === 'sortie' && activeSortie && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-mono font-bold uppercase">
                Active Sortie Package View
              </span>
              <h3 className="font-display text-base font-bold text-stone-100">
                {activeSortie.mission_name} // {activeSortie.name}
              </h3>
            </div>
            {activeSortie.notes && (
              <p className="text-xs text-stone-400 font-mono">
                Notes: <span className="text-stone-300">{activeSortie.notes}</span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs font-mono shrink-0">
            <span className={`px-2.5 py-1 rounded-lg border ${
              activeSortie.is_signup_open
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-stone-800 border-stone-700 text-stone-400'
            }`}>
              {activeSortie.is_signup_open ? 'Sign-Ups Open' : 'Sign-Ups Closed'}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-stone-900 border border-stone-800 text-stone-300">
              Scheduled: {new Date(activeSortie.scheduled_at).toUTCString()}
            </span>
          </div>
        </div>
      )}

      {/* Main Master-Detail Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Flight Plans List (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          {/* Search & Filters */}
          <div className="p-3 rounded-xl bg-stone-900/80 border border-stone-800 space-y-2.5">
            <input
              type="text"
              placeholder="Search by callsign, airframe, remarks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-stone-950 border border-stone-800 text-stone-200 text-xs font-mono placeholder-stone-500 focus:outline-none focus:border-amber-500/60"
            />

            <div className="flex items-center gap-2">
              <select
                value={selectedSquadron}
                onChange={(e) => setSelectedSquadron(e.target.value)}
                className="w-1/2 px-2.5 py-1.5 rounded-lg bg-stone-950 border border-stone-800 text-stone-300 text-xs font-mono focus:outline-none focus:border-amber-500"
              >
                <option value="ALL">All Squadrons</option>
                {squadronFilterOptions.map((sq) => (
                  <option key={sq} value={sq}>
                    {sq}
                  </option>
                ))}
              </select>

              <select
                value={selectedAirframe}
                onChange={(e) => setSelectedAirframe(e.target.value)}
                className="w-1/2 px-2.5 py-1.5 rounded-lg bg-stone-950 border border-stone-800 text-stone-300 text-xs font-mono focus:outline-none focus:border-amber-500"
              >
                <option value="ALL">All Airframes</option>
                {airframeFilterOptions.map((af) => (
                  <option key={af} value={af}>
                    {af}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between px-1">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-amber-400">
              {viewMode === 'member' ? 'My Assigned Flight Plans' : 'Sortie Package Plans'} ({filteredPlans.length})
            </h2>
            <span className="text-[11px] font-mono text-stone-400">Select to inspect</span>
          </div>

          {filteredPlans.length === 0 ? (
            <div className="p-8 rounded-xl border border-stone-800 bg-stone-900/40 text-center text-xs font-mono text-stone-500">
              No flight plans matched your criteria.
            </div>
          ) : (
            filteredPlans.map((plan) => {
              const isSelected = activeSummary?.id === plan.id || activeSummary?.identifier === plan.identifier;
              const hasColor = plan.color || '#3b82f6';

              return (
                <div
                  key={plan.id || plan.identifier}
                  onClick={() => setSelectedPlanId(plan.id || plan.identifier)}
                  style={{ borderLeftColor: isSelected ? '#f59e0b' : hasColor, borderLeftWidth: 4 }}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-stone-900 border-amber-500/60 shadow-lg shadow-amber-500/5 ring-1 ring-amber-500/30'
                      : 'bg-stone-900/60 border-stone-800/90 hover:border-stone-700 hover:bg-stone-900/90'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2.5 mb-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {plan.squadron?.patch_url ? (
                        <img
                          src={plan.squadron.patch_url}
                          alt={plan.squadron.name}
                          className="w-9 h-9 rounded-lg object-contain bg-stone-950 p-1 border border-stone-800 shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-stone-950 border border-stone-800 flex items-center justify-center shrink-0">
                          <AirplaneTilt className="w-4 h-4 text-amber-400" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold block truncate">
                            {plan.identifier || `FP-${plan.id}`}
                          </span>
                          {plan.is_private && (
                            <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[9px] font-mono">
                              PRIVATE
                            </span>
                          )}
                          {plan.is_opfor && (
                            <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[9px] font-mono">
                              OPFOR
                            </span>
                          )}
                        </div>
                        <h3 className="font-display text-sm font-semibold text-stone-100 truncate">
                          {plan.callsign} // {plan.name}
                        </h3>
                      </div>
                    </div>
                  </div>

                  {/* Mission / Sortie Affiliation Badge */}
                  <div className="flex items-center gap-1.5 mb-2 text-[11px] font-mono">
                    {plan.mission ? (
                      <span className="text-amber-400 font-medium truncate flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                        <span className="truncate">{plan.mission.name}</span>
                        {plan.sortie?.name && (
                          <span className="text-stone-400 font-normal shrink-0">
                            • {plan.sortie.name}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-purple-300 font-mono text-[10px] bg-purple-500/15 border border-purple-500/30 px-1.5 py-0.5 rounded">
                        Standalone / Private Plan
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-stone-400 line-clamp-1 mb-2">
                    {plan.description || plan.remarks || 'Standard tactical routing.'}
                  </p>

                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono text-stone-400">
                    <span className="px-2 py-0.5 rounded bg-stone-950 border border-stone-800 text-stone-300">
                      {plan.airframe?.name || 'Airframe'}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-stone-950 border border-stone-800">
                      {plan.squadron?.abbreviation || 'Squadron'}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-stone-950 border border-stone-800">
                      {plan.route_summary?.waypoint_count || 0} WPTs
                    </span>
                    {plan.is_dtc_compatible && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px]">
                        DTC
                      </span>
                    )}
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-stone-800/80 flex items-center justify-between text-[11px] font-mono">
                    <span className="text-stone-400 truncate">
                      {plan.departure_airfield || 'DEP'} → {plan.destination_airfield || 'ARR'}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {plan.is_slotted && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px]">
                          SLOTTED
                        </span>
                      )}
                      {plan.is_creator && (
                        <span className="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30 text-[10px]">
                          AUTHOR
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Selected Flight Plan Detail & Deployment Workbench (8 cols) */}
        <div className="lg:col-span-8 space-y-5">
          {activeSummary && selectedDetail ? (
            <>
              {/* Dossier Header Card */}
              <div className="rounded-2xl border border-stone-800 bg-stone-900/90 p-6 space-y-5">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    {selectedDetail.airframe?.image_url ? (
                      <img
                        src={selectedDetail.airframe.image_url}
                        alt={selectedDetail.airframe.name}
                        className="w-16 h-16 rounded-xl object-contain bg-stone-950 p-1.5 border border-stone-800 shrink-0"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-stone-950 border border-stone-800 flex items-center justify-center shrink-0">
                        <AirplaneTilt className="w-8 h-8 text-amber-400" />
                      </div>
                    )}
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[11px] font-mono font-semibold uppercase">
                          {selectedDetail.identifier}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full bg-stone-800 text-stone-300 text-[11px] font-mono">
                          {selectedDetail.squadron?.name}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full bg-stone-800 text-stone-300 text-[11px] font-mono">
                          {selectedDetail.airframe?.name}
                        </span>
                        {selectedDetail.flight_rules && (
                          <span className="px-2 py-0.5 rounded bg-stone-800 text-amber-400 text-[10px] font-mono">
                            {selectedDetail.flight_rules}
                          </span>
                        )}
                      </div>
                      <h2 className="font-display text-xl font-bold text-stone-100">
                        {selectedDetail.callsign} // {selectedDetail.name}
                      </h2>
                      <p className="text-xs font-mono text-stone-400">
                        Launch:{' '}
                        <span className="text-stone-200 font-semibold">
                          {selectedDetail.launch_time || '18:00Z'}
                        </span>{' '}
                        &bull; Fuel:{' '}
                        <span className="text-amber-400 font-semibold">{selectedDetail.fuel_amount || '7,100 lbs'}</span>{' '}
                        &bull; Theatre:{' '}
                        <span className="text-stone-200">{activeTheatre}</span>
                      </p>
                    </div>
                  </div>

                  {/* Top Action Badges / Status */}
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    {selectedDetail.mission ? (
                      <span className="text-[11px] font-mono text-amber-400 font-semibold flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        Mission: {selectedDetail.mission.name}
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-purple-300 bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 rounded">
                        Standalone / Private Plan
                      </span>
                    )}

                    {selectedDetail.sortie ? (
                      <span className="text-[11px] font-mono text-stone-400">
                        Sortie: {selectedDetail.sortie.name} (Sortie #{selectedDetail.sortie.sortie_number})
                      </span>
                    ) : (
                      <span className="text-[11px] font-mono text-stone-500 italic">
                        Not Assigned to Mission Sortie
                      </span>
                    )}
                  </div>
                </div>

                {/* Tactical Parameters Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <div className="p-3 rounded-xl bg-stone-950/80 border border-stone-800/80">
                    <div className="text-[10px] font-mono uppercase text-stone-400">
                      Departure / Destination
                    </div>
                    <div className="text-xs font-mono font-semibold text-stone-200 mt-1 truncate">
                      {selectedDetail.departure_airfield || 'Nellis AFB'}
                    </div>
                    <div className="text-[11px] font-mono text-stone-400 truncate">
                      ARR: {selectedDetail.destination_airfield || 'Creech AFB'}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-stone-950/80 border border-stone-800/80">
                    <div className="text-[10px] font-mono uppercase text-stone-400">
                      Diverts &amp; Alternates
                    </div>
                    <div className="text-xs font-mono font-semibold text-stone-200 mt-1 truncate">
                      {selectedDetail.diverts?.join(', ') || 'Primary Recovery'}
                    </div>
                    <div className="text-[11px] font-mono text-amber-400/90 truncate">
                      {selectedDetail.diverts?.length || 0} Alternate(s)
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-stone-950/80 border border-stone-800/80">
                    <div className="text-[10px] font-mono uppercase text-stone-400">
                      Route Altitude
                    </div>
                    <div className="text-xs font-mono font-semibold text-stone-200 mt-1 truncate">
                      {selectedDetail.route_summary?.min_altitude_feet} - {selectedDetail.route_summary?.max_altitude_feet} FT
                    </div>
                    <div className="text-[11px] font-mono text-stone-400 truncate">
                      Speed: {selectedDetail.route_summary?.min_speed_knots} - {selectedDetail.route_summary?.max_speed_knots} KTS
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-stone-950/80 border border-stone-800/80">
                    <div className="text-[10px] font-mono uppercase text-stone-400">
                      Airframe / Compatibility
                    </div>
                    <div className="text-xs font-mono font-semibold text-amber-300 mt-1 truncate">
                      {selectedDetail.airframe?.dcs_entity}
                    </div>
                    <div className="text-[11px] font-mono text-stone-400 truncate">
                      {selectedDetail.is_dtc_compatible ? 'DTC Supported' : 'No Native DTC'}
                    </div>
                  </div>
                </div>

                {/* Remarks & Loadout */}
                <div className="space-y-2">
                  {selectedDetail.remarks && (
                    <div className="p-3.5 rounded-xl bg-stone-950/90 border-l-2 border-amber-500 text-xs text-stone-300 leading-relaxed font-mono">
                      <span className="font-bold uppercase text-amber-400 mr-2">Dispatch Remarks:</span>
                      {selectedDetail.remarks}
                    </div>
                  )}
                  {selectedDetail.formatted_loadout && (
                    <div className="px-3.5 py-2 rounded-xl bg-stone-950/60 border border-stone-800 text-xs font-mono text-stone-400 flex items-center gap-2">
                      <span className="text-amber-400 font-semibold uppercase">Loadout:</span>
                      <span>{selectedDetail.formatted_loadout}</span>
                    </div>
                  )}
                </div>

                {/* --- Action Integration Cards: Route Preset, DTC, Kneeboard --- */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-2">
                  {/* 1. One-Click Save Route to DCS */}
                  <div className="p-4 rounded-xl bg-stone-950/90 border border-stone-800 flex flex-col justify-between gap-3">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="inline-flex items-center gap-1.5 text-xs font-display font-semibold text-stone-200">
                          <Path className="w-4 h-4 text-amber-400" />
                          Save Route to DCS
                        </span>
                        {routeSavedPath && (
                          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] font-mono text-stone-400 break-all">
                        Saved Games\DCS\Config\RouteToolPresets\{activeTheatreFileName}
                      </p>
                      <span className="inline-block mt-1.5 px-2 py-0.5 rounded bg-stone-900 border border-stone-800 text-[10px] font-mono text-amber-300">
                        Prepends route preset
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <button
                        onClick={handleSaveRouteToDcs}
                        disabled={isSavingRoute}
                        className="w-full py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-mono font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/10 disabled:opacity-50"
                      >
                        <DownloadSimple className="w-3.5 h-3.5" />
                        <span>{isSavingRoute ? 'Saving Route...' : 'Save Route to DCS'}</span>
                      </button>

                      <button
                        onClick={handleCopyPresetsPath}
                        className="w-full py-1.5 px-3 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-300 font-mono text-[11px] transition-all flex items-center justify-center gap-1.5 border border-stone-800"
                      >
                        {hasCopiedPath ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400">Path Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-stone-400" />
                            <span>Copy RouteToolPresets Path</span>
                          </>
                        )}
                      </button>
                    </div>

                    {routeSavedPath && (
                      <p className="text-[10px] font-mono text-emerald-400 truncate mt-1">
                        Saved to: {routeSavedPath}
                      </p>
                    )}
                  </div>

                  {/* 2. DTC Export */}
                  <div className="p-4 rounded-xl bg-stone-950/90 border border-stone-800 flex flex-col justify-between gap-3">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="inline-flex items-center gap-1.5 text-xs font-display font-semibold text-stone-200">
                          <Cpu className="w-4 h-4 text-amber-400" />
                          Data Cartridge (DTC)
                        </span>
                        {dtcSavedPath && (
                          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] font-mono text-stone-400 break-all">
                        Saved Games\DCS\DTC\{selectedDetail.callsign.replace(/[^a-zA-Z0-9_-]/g, '_')}.dtc
                      </p>
                      <span className={`inline-block mt-1.5 px-2 py-0.5 rounded text-[10px] font-mono ${
                        selectedDetail.is_dtc_compatible
                          ? 'bg-stone-900 border border-stone-800 text-emerald-400'
                          : 'bg-stone-900 border border-stone-800 text-rose-400'
                      }`}>
                        {selectedDetail.is_dtc_compatible ? 'DTC Supported' : 'Not DTC Compatible'}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <button
                        onClick={handleSaveDtcToDcs}
                        disabled={!selectedDetail.is_dtc_compatible || isSavingDtc}
                        className="w-full py-2 px-3 rounded-lg bg-stone-800 hover:bg-stone-700 disabled:opacity-40 text-stone-200 font-mono font-semibold text-xs transition-all flex items-center justify-center gap-1.5 border border-stone-700"
                      >
                        <DownloadSimple className="w-3.5 h-3.5 text-amber-400" />
                        <span>{isSavingDtc ? 'Saving DTC...' : 'Save DTC to DCS'}</span>
                      </button>

                      <button
                        onClick={handleDownloadDtc}
                        disabled={!selectedDetail.is_dtc_compatible}
                        className="w-full py-1.5 px-3 rounded-lg bg-stone-900 hover:bg-stone-800 disabled:opacity-40 text-stone-300 font-mono text-[11px] transition-all flex items-center justify-center gap-1.5 border border-stone-800"
                      >
                        <FileCode className="w-3.5 h-3.5 text-stone-400" />
                        <span>Download .dtc File</span>
                      </button>
                    </div>

                    {dtcSavedPath && (
                      <p className="text-[10px] font-mono text-emerald-400 truncate mt-1">
                        Saved to: {dtcSavedPath}
                      </p>
                    )}
                  </div>

                  {/* 3. Kneeboard PDF & Export */}
                  <div className="p-4 rounded-xl bg-stone-950/90 border border-stone-800 flex flex-col justify-between gap-3">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="inline-flex items-center gap-1.5 text-xs font-display font-semibold text-stone-200">
                          <BookOpen className="w-4 h-4 text-amber-400" />
                          Kneeboard PDF
                        </span>
                      </div>
                      <p className="text-[11px] font-mono text-stone-400 break-all">
                        Saved Games\DCS\Kneeboard\{selectedDetail.airframe.dcs_entity}
                      </p>
                      <span className="inline-block mt-1.5 px-2 py-0.5 rounded bg-stone-900 border border-stone-800 text-[10px] font-mono text-stone-300">
                        Aircraft Briefing Card
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <button
                        onClick={handleOpenPdf}
                        disabled={isOpeningPdf}
                        className="w-full py-2 px-3 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 font-mono font-semibold text-xs transition-all flex items-center justify-center gap-1.5 border border-stone-700"
                      >
                        <Eye className="w-3.5 h-3.5 text-amber-400" />
                        <span>{isOpeningPdf ? 'Opening PDF...' : 'Open PDF in Viewer'}</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={handleDownloadPdf}
                          className="w-1/2 py-1.5 px-2 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-300 font-mono text-[11px] transition-all flex items-center justify-center gap-1 border border-stone-800"
                        >
                          <FilePdf className="w-3.5 h-3.5 text-stone-400" />
                          <span>PDF</span>
                        </button>
                        <button
                          onClick={handleExportToKneeboardFolder}
                          disabled={isExportingKneeboard}
                          className="w-1/2 py-1.5 px-2 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-300 font-mono text-[11px] transition-all flex items-center justify-center gap-1 border border-stone-800 disabled:opacity-50"
                        >
                          <FolderSimple className="w-3.5 h-3.5 text-stone-400" />
                          <span>{isExportingKneeboard ? 'Exporting...' : 'To Folder'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sub-Navigation Tabs */}
              <div className="rounded-2xl border border-stone-800 bg-stone-900/90 overflow-hidden">
                <div className="border-b border-stone-800 px-4 pt-3 flex flex-wrap items-center gap-2 bg-stone-950/60">
                  <button
                    onClick={() => setActiveTab('waypoints')}
                    className={`px-4 py-2.5 text-xs font-display font-semibold border-b-2 transition-all flex items-center gap-2 ${
                      activeTab === 'waypoints'
                        ? 'border-amber-400 text-amber-400'
                        : 'border-transparent text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    <NavigationArrow className="w-3.5 h-3.5" />
                    <span>Waypoints ({selectedDetail.route_points?.length || 0})</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('comms')}
                    className={`px-4 py-2.5 text-xs font-display font-semibold border-b-2 transition-all flex items-center gap-2 ${
                      activeTab === 'comms'
                        ? 'border-amber-400 text-amber-400'
                        : 'border-transparent text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    <Radio className="w-3.5 h-3.5" />
                    <span>Comms &amp; Frequencies</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('avionics')}
                    className={`px-4 py-2.5 text-xs font-display font-semibold border-b-2 transition-all flex items-center gap-2 ${
                      activeTab === 'avionics'
                        ? 'border-amber-400 text-amber-400'
                        : 'border-transparent text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    <Cpu className="w-3.5 h-3.5" />
                    <span>Avionics &amp; Loadout</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('route_lua')}
                    className={`px-4 py-2.5 text-xs font-display font-semibold border-b-2 transition-all flex items-center gap-2 ${
                      activeTab === 'route_lua'
                        ? 'border-amber-400 text-amber-400'
                        : 'border-transparent text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    <Code className="w-3.5 h-3.5" />
                    <span>DCS Route Lua</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('dtc')}
                    className={`px-4 py-2.5 text-xs font-display font-semibold border-b-2 transition-all flex items-center gap-2 ${
                      activeTab === 'dtc'
                        ? 'border-amber-400 text-amber-400'
                        : 'border-transparent text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    <Terminal className="w-3.5 h-3.5" />
                    <span>DTC JSON Payload</span>
                  </button>
                </div>

                <div className="p-5">
                  {/* TAB 1: WAYPOINTS TABLE */}
                  {activeTab === 'waypoints' && (
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <h3 className="font-display text-sm font-semibold text-stone-200">
                            Steerpoint Sequence — {selectedDetail.callsign}
                          </h3>
                          <p className="text-xs font-mono text-stone-400">
                            Exact geographic coordinates with copy shortcuts for DCS cockpit entry.
                          </p>
                        </div>
                      </div>

                      <div className="rounded-xl border border-stone-800 bg-stone-950 overflow-hidden">
                        <table className="w-full text-left border-collapse text-xs font-mono">
                          <thead>
                            <tr className="border-b border-stone-800 bg-stone-900/80 text-[11px] text-stone-400 uppercase tracking-wider">
                              <th className="py-2.5 px-3">#</th>
                              <th className="py-2.5 px-3">Name</th>
                              <th className="py-2.5 px-3">Coordinates (DD / DDM)</th>
                              <th className="py-2.5 px-3">MGRS</th>
                              <th className="py-2.5 px-3">Altitude</th>
                              <th className="py-2.5 px-3">Speed</th>
                              <th className="py-2.5 px-3">TOT</th>
                              <th className="py-2.5 px-3">Remarks / Action</th>
                              <th className="py-2.5 px-3 text-right">Copy</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-800/60">
                            {(selectedDetail.route_points || []).map((wp, idx) => (
                              <tr key={wp.index ?? idx} className="hover:bg-stone-900/50 transition-colors">
                                <td className="py-2.5 px-3 text-amber-400 font-bold">{wp.index ?? idx}</td>
                                <td className="py-2.5 px-3 font-semibold text-stone-200">{wp.name}</td>
                                <td className="py-2.5 px-3 text-stone-300">
                                  <div>{wp.ddm || `${wp.lat.toFixed(4)}°, ${wp.lng.toFixed(4)}°`}</div>
                                  <div className="text-[10px] text-stone-400">
                                    {wp.lat.toFixed(4)}, {wp.lng.toFixed(4)}
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 text-amber-300">{wp.mgrs || '—'}</td>
                                <td className="py-2.5 px-3 text-stone-300">
                                  {wp.alt} ft <span className="text-stone-400">({Math.round(wp.alt * 0.3048)}m)</span>
                                </td>
                                <td className="py-2.5 px-3 text-stone-300">
                                  {wp.speed} kts <span className="text-stone-400">({Math.round(wp.speed * 1.852)}kph)</span>
                                </td>
                                <td className="py-2.5 px-3 text-stone-400">{wp.tot || '—'}</td>
                                <td className="py-2.5 px-3 text-stone-400">
                                  {wp.remarks || wp.action || wp.type || '—'}
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  <button
                                    onClick={() => handleCopyCoordinates(wp, idx)}
                                    title="Copy MGRS / Decimal coordinates"
                                    className="p-1 rounded bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-amber-400 transition-all border border-stone-800"
                                  >
                                    {copiedWptIdx === idx ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: COMMS & FREQUENCIES */}
                  {activeTab === 'comms' && (
                    <div className="space-y-6">
                      {/* Custom Comms Ladder */}
                      <div className="space-y-2">
                        <h4 className="font-display text-xs font-semibold uppercase tracking-wider text-amber-400">
                          Flight Comms Ladder
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                          {Array.isArray(selectedDetail.comms_ladder) &&
                            selectedDetail.comms_ladder.map((c: any, i: number) => (
                              <div
                                key={i}
                                className="p-3 rounded-xl bg-stone-950 border border-stone-800 flex items-center justify-between"
                              >
                                <div>
                                  <span className="text-[10px] font-mono uppercase text-stone-400 block">
                                    {c.label || c.name || `Channel ${c.channel || i + 1}`}
                                  </span>
                                  <span className="font-mono text-sm font-bold text-amber-300">
                                    {c.frequency} {c.modulation || 'AM'}
                                  </span>
                                </div>
                                {c.channel && (
                                  <span className="px-2 py-0.5 rounded bg-stone-900 border border-stone-800 text-[10px] font-mono text-stone-300">
                                    CH {c.channel}
                                  </span>
                                )}
                              </div>
                            ))}
                        </div>
                      </div>

                      {/* Default Comms Ladder (Task Force, Squadron, Support) */}
                      {selectedDetail.default_comms_ladder && (
                        <div className="space-y-4">
                          <h4 className="font-display text-xs font-semibold uppercase tracking-wider text-amber-400">
                            Default Task Force &amp; Support Frequencies
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {/* Task Force Common */}
                            <div className="p-3.5 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
                              <span className="text-[10px] font-mono uppercase font-bold text-stone-300 block border-b border-stone-800 pb-1">
                                Task Force Common
                              </span>
                              {Array.isArray(selectedDetail.default_comms_ladder.task_force) &&
                                selectedDetail.default_comms_ladder.task_force.map((tf: any, i: number) => (
                                  <div key={i} className="flex items-center justify-between text-xs font-mono">
                                    <span className="text-stone-400">{tf.label}</span>
                                    <span className="text-amber-400 font-bold">{tf.frequency}</span>
                                  </div>
                                ))}
                            </div>

                            {/* Squadron Net */}
                            <div className="p-3.5 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
                              <span className="text-[10px] font-mono uppercase font-bold text-stone-300 block border-b border-stone-800 pb-1">
                                Squadron Tactical Nets
                              </span>
                              {Array.isArray(selectedDetail.default_comms_ladder.squadron) &&
                                selectedDetail.default_comms_ladder.squadron.map((sq: any, i: number) => (
                                  <div key={i} className="flex items-center justify-between text-xs font-mono">
                                    <span className="text-stone-400">{sq.label}</span>
                                    <span className="text-amber-400 font-bold">{sq.frequency}</span>
                                  </div>
                                ))}
                            </div>

                            {/* Support (AWACS / Tanker) */}
                            <div className="p-3.5 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
                              <span className="text-[10px] font-mono uppercase font-bold text-stone-300 block border-b border-stone-800 pb-1">
                                AWACS &amp; Tanker Support
                              </span>
                              {Array.isArray(selectedDetail.default_comms_ladder.support) &&
                                selectedDetail.default_comms_ladder.support.map((sp: any, i: number) => (
                                  <div key={i} className="flex items-center justify-between text-xs font-mono">
                                    <span className="text-stone-400 truncate max-w-[130px]">{sp.label}</span>
                                    <span className="text-amber-400 font-bold">{sp.frequency}</span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Airfield Frequencies */}
                      {selectedDetail.airfield_frequencies && (
                        <div className="space-y-2">
                          <h4 className="font-display text-xs font-semibold uppercase tracking-wider text-amber-400">
                            Airfield Frequencies (Departure, Destination, Diverts)
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {Object.entries(selectedDetail.airfield_frequencies).map(([field, freqs]: [string, any]) => (
                              <div key={field} className="p-3.5 rounded-xl bg-stone-950 border border-stone-800 space-y-1.5">
                                <span className="text-xs font-mono font-bold text-stone-200 block">{field}</span>
                                <div className="space-y-1 pt-1 border-t border-stone-800/80">
                                  {Array.isArray(freqs) &&
                                    freqs.map((f: any, i: number) => (
                                      <div key={i} className="flex items-center justify-between text-xs font-mono">
                                        <span className="text-stone-400">{f.type || f.name}</span>
                                        <span className="text-amber-300 font-semibold">{f.frequency}</span>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* MIDS Settings */}
                      {selectedDetail.mids_settings && (
                        <div className="p-3.5 rounded-xl bg-stone-950 border border-stone-800 flex flex-wrap items-center gap-6 text-xs font-mono">
                          <span className="text-amber-400 font-bold uppercase">MIDS Datalink:</span>
                          <span>MIDS A: <strong className="text-stone-100">{selectedDetail.mids_settings.mids_a_channel || 'N/A'}</strong></span>
                          <span>MIDS B: <strong className="text-stone-100">{selectedDetail.mids_settings.mids_b_channel || 'N/A'}</strong></span>
                          <span>Net Label: <strong className="text-stone-100">{selectedDetail.mids_settings.net_label || 'STRIKE'}</strong></span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 3: AVIONICS & LOADOUT */}
                  {activeTab === 'avionics' && (
                    <div className="space-y-6">
                      {/* Station Loadout Grid */}
                      <div className="space-y-2">
                        <h4 className="font-display text-xs font-semibold uppercase tracking-wider text-amber-400">
                          Aircraft Station Weapons Loadout
                        </h4>
                        {selectedDetail.station_loadout ? (
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                            {Object.entries(selectedDetail.station_loadout).map(([station, weapon]) => (
                              <div key={station} className="p-3 rounded-xl bg-stone-950 border border-stone-800 space-y-1">
                                <span className="text-[10px] font-mono uppercase text-amber-400 font-bold">
                                  Station {station}
                                </span>
                                <p className="text-xs font-mono text-stone-200 truncate">{weapon}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs font-mono text-stone-400">
                            {selectedDetail.formatted_loadout || 'Standard clean configuration.'}
                          </p>
                        )}
                      </div>

                      {/* CMDS Dispenser Programs */}
                      {selectedDetail.cmds_settings && (
                        <div className="space-y-2">
                          <h4 className="font-display text-xs font-semibold uppercase tracking-wider text-amber-400">
                            CMDS Chaff / Flare Dispenser Programs
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                            {Object.entries(selectedDetail.cmds_settings).map(([progKey, prog]: [string, any]) => (
                              <div key={progKey} className="p-3 rounded-xl bg-stone-950 border border-stone-800 space-y-1 text-xs font-mono">
                                <span className="text-[10px] uppercase font-bold text-amber-400 block">
                                  {prog?.label || progKey}
                                </span>
                                {typeof prog === 'object' ? (
                                  <div className="text-stone-300 space-y-0.5 text-[11px]">
                                    <div>Chaff: {prog.chaff} / Flare: {prog.flare}</div>
                                    <div className="text-stone-400">Int: {prog.interval}s | Cyc: {prog.cycles}</div>
                                  </div>
                                ) : (
                                  <div className="text-stone-300">{String(prog)}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* SA / Navigation Avionics */}
                      {selectedDetail.sa_settings && (
                        <div className="p-3.5 rounded-xl bg-stone-950 border border-stone-800 flex flex-wrap items-center gap-6 text-xs font-mono">
                          <span className="text-amber-400 font-bold uppercase">Avionics Sensors:</span>
                          <span>TACAN: <strong className="text-stone-100">{selectedDetail.sa_settings.tacan_channel || 'N/A'}</strong></span>
                          <span>ILS: <strong className="text-stone-100">{selectedDetail.sa_settings.ils_frequency || 'N/A'}</strong></span>
                          <span>Laser Code: <strong className="text-stone-100">{selectedDetail.sa_settings.laser_code || '1688'}</strong></span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 4: DCS ROUTE LUA SCRIPT */}
                  {activeTab === 'route_lua' && (
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <h4 className="font-display text-xs font-semibold uppercase tracking-wider text-amber-400">
                            DCS Route Tool Lua Manifest Preset
                          </h4>
                          <p className="text-xs font-mono text-stone-400">
                            Auto-prepended to{' '}
                            <code className="text-stone-200">Saved Games\DCS\Config\RouteToolPresets\{activeTheatreFileName}</code>
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={handleCopyLua}
                            className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-mono flex items-center gap-1.5 border border-stone-700 transition-all"
                          >
                            {hasCopiedLua ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-emerald-400">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 text-amber-400" />
                                <span>Copy Lua</span>
                              </>
                            )}
                          </button>
                          <button
                            onClick={handleDownloadLua}
                            className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-mono flex items-center gap-1.5 border border-stone-700 transition-all"
                          >
                            <DownloadSimple className="w-3.5 h-3.5 text-amber-400" />
                            <span>Download .lua</span>
                          </button>
                        </div>
                      </div>

                      <div className="relative rounded-xl border border-stone-800 bg-stone-950 p-4 font-mono text-xs text-stone-300 max-h-96 overflow-y-auto leading-relaxed">
                        <pre className="whitespace-pre">{activeLuaSnippet}</pre>
                      </div>
                    </div>
                  )}

                  {/* TAB 5: DTC JSON PAYLOAD */}
                  {activeTab === 'dtc' && (
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <h4 className="font-display text-xs font-semibold uppercase tracking-wider text-amber-400">
                            Data Cartridge (.dtc) JSON Structure
                          </h4>
                          <p className="text-xs font-mono text-stone-400">
                            Compatible with DCS native DTC cartridge readers and DCS-DTC software.
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={handleCopyDtc}
                            className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-mono flex items-center gap-1.5 border border-stone-700 transition-all"
                          >
                            {hasCopiedDtc ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-emerald-400">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 text-amber-400" />
                                <span>Copy JSON</span>
                              </>
                            )}
                          </button>
                          <button
                            onClick={handleDownloadDtc}
                            disabled={!selectedDetail.is_dtc_compatible}
                            className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 disabled:opacity-40 text-stone-200 text-xs font-mono flex items-center gap-1.5 border border-stone-700 transition-all"
                          >
                            <DownloadSimple className="w-3.5 h-3.5 text-amber-400" />
                            <span>Download .dtc</span>
                          </button>
                        </div>
                      </div>

                      <div className="relative rounded-xl border border-stone-800 bg-stone-950 p-4 font-mono text-xs text-stone-300 max-h-96 overflow-y-auto leading-relaxed">
                        <pre className="whitespace-pre">{activeDtcJson}</pre>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="p-12 rounded-2xl border border-stone-800 bg-stone-900/60 text-center space-y-3">
              <AirplaneTilt className="w-8 h-8 text-amber-400 mx-auto animate-pulse" />
              <h3 className="font-display text-base font-semibold text-stone-200">
                {isLoadingDetail ? 'Loading Flight Plan Dossier...' : 'Select a Flight Plan'}
              </h3>
              <p className="text-xs font-mono text-stone-400 max-w-sm mx-auto">
                Choose an assigned or sortie flight plan on the left to inspect waypoints, communications,
                avionics, and export files to DCS.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
