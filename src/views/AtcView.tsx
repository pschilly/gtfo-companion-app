import React, { useEffect, useMemo, useState } from 'react';
import {
  AirplaneLanding,
  AirplaneTilt,
  ArrowsClockwise,
  BookOpen,
  Broadcast,
  Check,
  CheckCircle,
  Clock,
  Code,
  Compass,
  Copy,
  Cpu,
  Crosshair,
  DownloadSimple,
  Eye,
  FileCode,
  FilePdf,
  FolderSimple,
  Gauge,
  GlobeHemisphereWest,
  ListChecks,
  MagnifyingGlass,
  MapPin,
  NavigationArrow,
  Notepad,
  Path,
  Radio,
  ShieldCheck,
  ShieldWarning,
  Sparkle,
  Target,
  Terminal,
  User,
  WarningCircle,
} from '@phosphor-icons/react';
import { useApp } from '../context/AppContext';
import {
  downloadFlightPlanDcsRoute,
  downloadFlightPlanDtc,
  downloadFlightPlanJf17Airspace,
  formatFlightPlanToLuaPreset,
  generateFallbackJf17Airspace,
  getFlightPlanPdfUrl,
  getJf17AirspaceFileName,
  installAircraftKneeboardPageCommand,
  normalizeDcsTheatreFileName,
  normalizeJf17TerrainName,
  triggerBrowserFileDownload,
} from '../services/flightPlanService';
import {
  exportFlightPlanKneeboardPages,
  ExportKneeboardResult,
} from '../services/pdfKneeboardService';
import { openLocalPath } from '../services/tauriBridge';
import {
  FlightPlanDetail,
  FlightPlanDivert,
  FlightPlanSummary,
} from '../types';

function formatFiledTime(isoString?: string | null): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) + 'Z';
  } catch {
    return isoString;
  }
}

function formatDiverts(diverts?: Array<FlightPlanDivert | string>): string {
  if (!diverts || diverts.length === 0) return 'None assigned';
  return diverts
    .map((d) => (typeof d === 'string' ? d : d.icao ? `${d.name} (${d.icao})` : d.name))
    .join(', ');
}

export function isF18Airframe(plan?: FlightPlanSummary | FlightPlanDetail | null): boolean {
  if (!plan) return false;
  const entity = (plan.airframe?.dcs_entity || '').toLowerCase();
  const name = (plan.airframe?.name || '').toLowerCase();
  const abbr = (plan.airframe?.abbreviation || '').toLowerCase();
  return (
    entity.includes('fa-18') ||
    entity.includes('f-18') ||
    entity.includes('hornet') ||
    name.includes('hornet') ||
    abbr.includes('fa-18') ||
    abbr.includes('f-18')
  );
}

export function isF16Airframe(plan?: FlightPlanSummary | FlightPlanDetail | null): boolean {
  if (!plan) return false;
  const entity = (plan.airframe?.dcs_entity || '').toLowerCase();
  const name = (plan.airframe?.name || '').toLowerCase();
  const abbr = (plan.airframe?.abbreviation || '').toLowerCase();
  return (
    entity.includes('f-16') ||
    entity.includes('viper') ||
    name.includes('viper') ||
    abbr.includes('f-16')
  );
}

export function isF14Airframe(plan?: FlightPlanSummary | FlightPlanDetail | null): boolean {
  if (!plan) return false;
  const entity = (plan.airframe?.dcs_entity || '').toLowerCase();
  const name = (plan.airframe?.name || '').toLowerCase();
  const abbr = (plan.airframe?.abbreviation || '').toLowerCase();
  return (
    entity.includes('f-14') ||
    entity.includes('tomcat') ||
    name.includes('tomcat') ||
    abbr.includes('f-14') ||
    abbr.includes('14b') ||
    abbr.includes('14bu')
  );
}

export function isJf17Airframe(plan?: FlightPlanSummary | FlightPlanDetail | null): boolean {
  if (!plan) return false;
  const entity = (plan.airframe?.dcs_entity || '').toLowerCase();
  const name = (plan.airframe?.name || '').toLowerCase();
  const abbr = (plan.airframe?.abbreviation || '').toLowerCase();
  const aircraft = ((plan as any).aircraft || '').toLowerCase();
  return (
    entity.includes('jf-17') ||
    entity.includes('thunder') ||
    entity.includes('jf17') ||
    name.includes('thunder') ||
    name.includes('jf-17') ||
    abbr.includes('jf-17') ||
    abbr.includes('jf17') ||
    aircraft.includes('jf-17') ||
    aircraft.includes('jf17')
  );
}

export const AtcView: React.FC = () => {
  const {
    memberFlightPlans,
    memberFlightPlansMeta,
    activeSortie,
    filedFlightPlans,
    isLoadingFlightPlans,
    syncFlightPlans,
    fetchFiledPlans,
    loadFlightPlanDetail,
    saveRouteToDcs,
    copyDcsRoutePresetsPathToClipboard,
    saveDtcCartridgeDirect,
    saveJf17AirspaceDirect,
    copyJf17AirspacePathToClipboard,
    openPdfKneeboardViewer,
    dcsEnv,
    settings,
    addNotification,
    addLog,
    userSession,
    selectedFlightPlanId,
    setSelectedFlightPlanId,
  } = useApp();

  // Mode: 'member' (Assigned/Private plans) or 'filed' (ATC Filed Plans)
  const [viewMode, setViewMode] = useState<'member' | 'filed'>('member');
  const [selectedPlanId, setSelectedPlanId] = useState<number | string>(
    memberFlightPlans[0]?.id || ''
  );
  const [selectedDetail, setSelectedDetail] = useState<FlightPlanDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSquadron, setSelectedSquadron] = useState<string>('ALL');
  const [selectedAirframe, setSelectedAirframe] = useState<string>('ALL');

  // Active sub-tab in workbench (mirrors GTFO Flight Planner)
  const [activeTab, setActiveTab] = useState<
    | 'summary'
    | 'routes'
    | 'targets'
    | 'loadouts'
    | 'comms'
    | 'mids'
    | 'sa'
    | 'destpts'
    | 'additionalpts'
    | 'cmds'
    | 'airspace'
    | 'notes'
  >('summary');

  const [activeCommRadio, setActiveCommRadio] = useState<'all' | 'comm1' | 'comm2'>('all');
  const [activeSaSubTab, setActiveSaSubTab] = useState<'flot' | 'faor' | 'cap' | 'corridors'>('flot');
  const [copiedFreqKey, setCopiedFreqKey] = useState<string | null>(null);

  // Synchronize with external selectedFlightPlanId (e.g. from Global Search)
  useEffect(() => {
    if (selectedFlightPlanId !== null && selectedFlightPlanId !== undefined) {
      const idStr = String(selectedFlightPlanId).toLowerCase();
      const inMember = memberFlightPlans.some(
        (p) => String(p.id).toLowerCase() === idStr || p.identifier?.toLowerCase() === idStr
      );
      const inFiled = filedFlightPlans.some(
        (p) => String(p.id).toLowerCase() === idStr || p.identifier?.toLowerCase() === idStr
      );

      if (inMember) setViewMode('member');
      else if (inFiled) setViewMode('filed');

      setSelectedPlanId(selectedFlightPlanId);
    }
  }, [selectedFlightPlanId, memberFlightPlans, filedFlightPlans]);

  // Action status states
  const [isSavingRoute, setIsSavingRoute] = useState(false);
  const [isSavingDtc, setIsSavingDtc] = useState(false);
  const [isOpeningPdf, setIsOpeningPdf] = useState(false);
  const [isExportingKneeboard, setIsExportingKneeboard] = useState(false);
  const [exportKneeboardStatus, setExportKneeboardStatus] = useState<string | null>(null);
  const [kneeboardExportResult, setKneeboardExportResult] = useState<ExportKneeboardResult | null>(null);
  const [hasExportedKneeboard, setHasExportedKneeboard] = useState(false);
  const [routeSavedPath, setRouteSavedPath] = useState<string | null>(null);
  const [dtcSavedPath, setDtcSavedPath] = useState<string | null>(null);
  const [isSavingAirspace, setIsSavingAirspace] = useState(false);
  const [airspaceSavedPath, setAirspaceSavedPath] = useState<string | null>(null);
  const [hasCopiedAirspacePath, setHasCopiedAirspacePath] = useState(false);
  const [hasCopiedAirspaceSnippet, setHasCopiedAirspaceSnippet] = useState(false);
  const [activeAirspaceSnippet, setActiveAirspaceSnippet] = useState<string>('');
  const [serverAirspaceFileName, setServerAirspaceFileName] = useState<string | null>(null);
  const [hasCopiedPath, setHasCopiedPath] = useState(false);
  const [hasCopiedLua, setHasCopiedLua] = useState(false);
  const [hasCopiedDtc, setHasCopiedDtc] = useState(false);
  const [copiedWptIdx, setCopiedWptIdx] = useState<number | null>(null);

  // Fetch filed flight plans on mount
  useEffect(() => {
    fetchFiledPlans({ limit: 50 });
  }, [fetchFiledPlans]);

  // Active source list based on mode
  const currentPlans = useMemo(() => {
    if (viewMode === 'member') return memberFlightPlans;
    return filedFlightPlans;
  }, [viewMode, memberFlightPlans, filedFlightPlans]);

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
      setKneeboardExportResult(null);
      setHasExportedKneeboard(false);
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
  }, [activeSortie?.theatre, selectedDetail]);

  // DCS Route Tool Lua file name without space (e.g. 'PersianGulf.lua')
  const activeTheatreFileName = useMemo(() => {
    return normalizeDcsTheatreFileName(activeTheatre);
  }, [activeTheatre]);

  // Generated or downloaded Lua snippet
  const activeLuaSnippet = useMemo(() => {
    if (!selectedDetail) return '';
    return formatFlightPlanToLuaPreset(selectedDetail);
  }, [selectedDetail]);

  // Designated target points from route (matching Flight Planner Targets tab)
  const targetPoints = useMemo(() => {
    if (!selectedDetail?.route_points) return [];
    return selectedDetail.route_points.filter((wp) => {
      const act = (wp.action || '').toLowerCase();
      const tp = (wp.type || '').toLowerCase();
      const nm = (wp.name || '').toUpperCase();
      return (
        act.includes('strike') ||
        act.includes('target') ||
        act.includes('attack') ||
        tp.includes('target') ||
        nm.startsWith('TGT') ||
        nm.includes('TARGET') ||
        nm.includes('STRIKE')
      );
    });
  }, [selectedDetail?.route_points]);

  // Airframe capability flags
  const isF18 = useMemo(() => isF18Airframe(selectedDetail), [selectedDetail]);
  const isF16 = useMemo(() => isF16Airframe(selectedDetail), [selectedDetail]);
  const isF14 = useMemo(() => isF14Airframe(selectedDetail), [selectedDetail]);
  const isJf17 = useMemo(() => isJf17Airframe(selectedDetail), [selectedDetail]);
  const isNotJf17 = useMemo(() => !isJf17Airframe(selectedDetail), [selectedDetail]);

  const hasMids = !isF14 && (isF18 || isJf17 || (!isF16 && !!selectedDetail?.mids_settings));
  const hasSa = isF18; // Only F-18 has SA tab! (no SA for F-16 or F-14 or JF-17)
  const hasDestPts = isF16; // F-16 destination points
  const hasAdditionalPts = isF14; // F-14 / 14BU additional points
  const hasCmds = !isJf17 && (!!selectedDetail?.cmds_settings || isF18 || isF16 || isF14);
  const hasAirspace = isJf17;

  const planTheatre = selectedDetail?.campaign?.theatre || (selectedDetail as any)?.theatre;

  const computedFallbackFileName = useMemo(() => {
    if (!selectedDetail) return 'Custom_AirSpace_Syria.lua';
    return getJf17AirspaceFileName(planTheatre);
  }, [selectedDetail, planTheatre]);

  const activeAirspaceFileName = useMemo(() => {
    if (planTheatre) {
      return getJf17AirspaceFileName(planTheatre);
    }
    return serverAirspaceFileName || computedFallbackFileName;
  }, [planTheatre, serverAirspaceFileName, computedFallbackFileName]);

  const activeAirspaceTerrain = useMemo(() => {
    if (planTheatre) {
      return normalizeJf17TerrainName(planTheatre);
    }
    if (serverAirspaceFileName) {
      const match = serverAirspaceFileName.match(/^Custom_AirSpace_(.+)\.lua$/i);
      if (match && match[1]) return match[1];
    }
    return 'Syria';
  }, [planTheatre, serverAirspaceFileName]);

  // Fallback if current activeTab is not supported by current airframe
  useEffect(() => {
    if (activeTab === 'sa' && !hasSa) setActiveTab('summary');
    if (activeTab === 'mids' && !hasMids) setActiveTab('summary');
    if (activeTab === 'destpts' && !hasDestPts) setActiveTab('summary');
    if (activeTab === 'additionalpts' && !hasAdditionalPts) setActiveTab('summary');
    if (activeTab === 'cmds' && !hasCmds) setActiveTab('summary');
    if (activeTab === 'airspace' && !hasAirspace) setActiveTab('summary');
  }, [activeTab, hasSa, hasMids, hasDestPts, hasAdditionalPts, hasCmds, hasAirspace]);

  // Load JF-17 Custom Airspace from server endpoint (e.g. /api/v1/companion/flight-plans/{id}/jf17-airspace)
  useEffect(() => {
    if (!selectedDetail || !isJf17) {
      setActiveAirspaceSnippet('');
      setServerAirspaceFileName(null);
      return;
    }
    let isCancelled = false;
    setActiveAirspaceSnippet('');
    setServerAirspaceFileName(null);

    const loadAirspace = async () => {
      try {
        const targetUrlOrId =
          selectedDetail.download_urls?.jf17_airspace ||
          selectedDetail.download_urls?.custom_airspace ||
          selectedDetail.id ||
          selectedDetail.identifier;
        const res = await downloadFlightPlanJf17Airspace(
          settings.memberPortalApiUrl,
          targetUrlOrId,
          selectedDetail,
          userSession?.accessToken
        );
        if (!isCancelled && res.content) {
          setActiveAirspaceSnippet(res.content);
          if (res.fileName) {
            setServerAirspaceFileName(res.fileName);
          }
        }
      } catch {
        if (!isCancelled && selectedDetail) {
          setActiveAirspaceSnippet(generateFallbackJf17Airspace(selectedDetail));
        }
      }
    };
    loadAirspace();
    return () => {
      isCancelled = true;
    };
  }, [selectedDetail, isJf17, settings.memberPortalApiUrl, userSession?.accessToken]);

  // Handler for copying frequency to clipboard with feedback
  const handleCopyFrequency = async (freq: string, key: string) => {
    try {
      await navigator.clipboard.writeText(freq);
      setCopiedFreqKey(key);
      setTimeout(() => setCopiedFreqKey(null), 1600);
    } catch {
      // ignore
    }
  };

  // COMMS data resolver
  const commsData = useMemo(() => {
    if (!selectedDetail?.comms_ladder) return { comm1: [], comm2: [], flat: [] };
    const raw = selectedDetail.comms_ladder;

    if (Array.isArray(raw)) {
      return { comm1: [], comm2: [], flat: raw };
    }

    if (typeof raw === 'object' && raw !== null) {
      const comm1 = Array.isArray((raw as any).comm1) ? (raw as any).comm1 : [];
      const comm2 = Array.isArray((raw as any).comm2) ? (raw as any).comm2 : [];
      if (comm1.length > 0 || comm2.length > 0) {
        return { comm1, comm2, flat: [...comm1, ...comm2] };
      }
      const values = Object.values(raw).filter(
        (v) => typeof v === 'object' && v !== null && (v as any).frequency
      );
      return { comm1: [], comm2: [], flat: values as any[] };
    }

    return { comm1: [], comm2: [], flat: [] };
  }, [selectedDetail]);

  // Normalized default comms ladder (handles flat array from API or categorized object)
  const normalizedDefaultComms = useMemo(() => {
    const raw = selectedDetail?.default_comms_ladder;
    if (!raw) return { task_force: [], squadron: [], support: [] };

    if (Array.isArray(raw)) {
      const task_force: any[] = [];
      const squadron: any[] = [];
      const support: any[] = [];

      raw.forEach((item: any) => {
        const src = (item.source || '').toLowerCase();
        const nm = (item.name || item.label || '').toLowerCase();
        if (
          src.includes('task force') ||
          src.includes('common') ||
          src.includes('taskforce') ||
          nm.includes('strike') ||
          nm.includes('ctaf')
        ) {
          task_force.push({
            label: item.name || item.label || 'Task Force Common',
            frequency: item.frequency,
            modulation: item.modulation,
            band: item.band,
          });
        } else if (
          src.includes('support') ||
          src.includes('awacs') ||
          src.includes('tanker') ||
          nm.includes('awacs') ||
          nm.includes('texaco') ||
          nm.includes('shell') ||
          nm.includes('arco') ||
          nm.includes('tanker') ||
          nm.includes('magic') ||
          nm.includes('overlord') ||
          nm.includes('wizard') ||
          nm.includes('focus')
        ) {
          support.push({
            label: item.name || item.label || 'Support Asset',
            frequency: item.frequency,
            modulation: item.modulation,
            band: item.band,
          });
        } else if (!src.includes('airfield')) {
          squadron.push({
            label: item.name || item.label || 'Squadron Net',
            frequency: item.frequency,
            modulation: item.modulation,
            band: item.band,
          });
        }
      });

      return { task_force, squadron, support };
    }

    if (typeof raw === 'object') {
      return {
        task_force: Array.isArray((raw as any).task_force) ? (raw as any).task_force : [],
        squadron: Array.isArray((raw as any).squadron) ? (raw as any).squadron : [],
        support: Array.isArray((raw as any).support) ? (raw as any).support : [],
      };
    }

    return { task_force: [], squadron: [], support: [] };
  }, [selectedDetail?.default_comms_ladder]);

  // Normalized airfield frequencies (handles flat array from API or object keyed by airfield)
  const normalizedAirfieldFrequencies = useMemo(() => {
    const raw = selectedDetail?.airfield_frequencies;
    if (!raw) return {};

    if (Array.isArray(raw)) {
      const map: Record<string, any[]> = {};
      raw.forEach((f: any) => {
        const fieldName =
          f.airbase_name ||
          f.airfield ||
          (f.notes && f.notes.startsWith('DEP:') ? f.notes.replace('DEP:', '').trim() : null) ||
          f.source ||
          'Airfield';
        if (!map[fieldName]) map[fieldName] = [];
        map[fieldName].push({
          type: f.name || f.type || 'Frequency',
          frequency: f.frequency,
          modulation: f.modulation,
          band: f.band,
        });
      });
      return map;
    }

    if (typeof raw === 'object' && raw !== null) {
      return raw;
    }

    return {};
  }, [selectedDetail?.airfield_frequencies]);

  // CMDS data resolver
  const cmdsData = useMemo(() => {
    const raw = selectedDetail?.cmds_settings || (selectedDetail?.metadata as any)?.cmds;
    if (!raw) return null;

    let programs: Record<string, any> = {};
    let bingo: Record<string, any> | null = null;
    let delay = 0;
    let airframeType = '';

    if (typeof raw === 'object' && raw !== null) {
      if (raw.programs && typeof raw.programs === 'object') {
        programs = raw.programs;
      } else {
        for (const [k, v] of Object.entries(raw)) {
          if (
            k !== 'type' &&
            k !== 'delay_between_programs' &&
            k !== 'bingo' &&
            typeof v === 'object' &&
            v !== null
          ) {
            programs[k] = v;
          }
        }
      }

      if (raw.bingo && typeof raw.bingo === 'object') {
        bingo = raw.bingo;
      }
      if (typeof raw.delay_between_programs === 'number') {
        delay = raw.delay_between_programs;
      }
      if (typeof raw.type === 'string') {
        airframeType = raw.type;
      }
    }

    return {
      type: airframeType || (isF18 ? 'FA-18C' : isF16 ? 'F-16C' : isF14 ? 'F-14B' : 'DISPENSER'),
      delay,
      bingo,
      programs,
    };
  }, [selectedDetail, isF18, isF16, isF14]);

  // SA data resolver (Hornet only)
  const saData = useMemo(() => {
    if (!isF18) return null;
    const raw = selectedDetail?.sa_settings || (selectedDetail?.metadata as any)?.sa;
    if (!raw || typeof raw !== 'object') return null;

    return {
      default_flot: raw.default_flot ?? 1,
      default_faor: raw.default_faor ?? 1,
      default_cap: raw.default_cap ?? 1,
      default_corridor: raw.default_corridor ?? 1,
      flot: Array.isArray(raw.flot) ? raw.flot : [],
      faor: Array.isArray(raw.faor) ? raw.faor : [],
      cap_points: Array.isArray(raw.cap_points) ? raw.cap_points : [],
      corridors: Array.isArray(raw.corridors) ? raw.corridors : [],
    };
  }, [selectedDetail, isF18]);

  // F-14 Additional Points resolver
  const resolvedAdditionalPoints = useMemo(() => {
    if (!isF14) return [];
    const metaPts =
      (selectedDetail?.metadata as any)?.additional_points ||
      (selectedDetail as any)?.additional_points;
    if (Array.isArray(metaPts) && metaPts.length > 0) return metaPts;

    return (selectedDetail?.route_points || []).filter((wp: any) => {
      const name = (wp.name || '').toUpperCase();
      const type = (wp.type || '').toUpperCase();
      const action = (wp.action || '').toUpperCase();
      return (
        wp.is_lantirn ||
        wp.is_additional ||
        type === 'LANTIRN' ||
        type === 'ADDITIONAL' ||
        action === 'LANTIRN' ||
        name.includes('XL') ||
        name.startsWith('AP') ||
        name.includes('LANTIRN')
      );
    });
  }, [selectedDetail, isF14]);

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

  // 3. Save DTC Cartridge Directly (fetches authentic 840KB DTC built by the portal's FlightPlanExportService)
  const handleSaveDtcToDcs = async () => {
    if (!selectedDetail || !selectedDetail.is_dtc_compatible) return;
    setIsSavingDtc(true);
    setDtcSavedPath(null);
    try {
      const targetUrlOrId = selectedDetail.download_urls?.dtc || selectedDetail.identifier || selectedDetail.id;
      const token = userSession?.accessToken;
      const res = await downloadFlightPlanDtc(
        settings.memberPortalApiUrl,
        targetUrlOrId,
        token
      );

      const dtcContent = res.rawText || (res.data ? JSON.stringify(res.data, null, 2) : '');
      if (!res.success || !dtcContent) {
        throw new Error(res.error || 'Failed to download DTC from portal');
      }

      const fileName = `${selectedDetail.callsign.replace(/[^a-zA-Z0-9_-]/g, '_')}.dtc`;
      const path = await saveDtcCartridgeDirect(fileName, dtcContent, 'DTC');
      setDtcSavedPath(path);
      addNotification({
        title: 'Saved DTC Cartridge',
        message: `Saved DTC to ${path}`,
        category: 'flight_plan',
        actionTab: 'atc',
      });
    } catch (err: any) {
      console.error(err);
      addLog('error', 'ATC', `Failed saving DTC: ${err?.message || err}`);
      addNotification({
        title: 'DTC Save Failed',
        message: String(err?.message || err),
        category: 'flight_plan',
        actionTab: 'atc',
      });
    } finally {
      setIsSavingDtc(false);
    }
  };

  // 4. Download DTC File (downloads authentic DTC built by the portal)
  const handleDownloadDtc = async () => {
    if (!selectedDetail) return;
    setIsSavingDtc(true);
    try {
      const targetUrlOrId = selectedDetail.download_urls?.dtc || selectedDetail.identifier || selectedDetail.id;
      const token = userSession?.accessToken;
      const res = await downloadFlightPlanDtc(
        settings.memberPortalApiUrl,
        targetUrlOrId,
        token
      );

      const dtcContent = res.rawText || (res.data ? JSON.stringify(res.data, null, 2) : '');
      if (!res.success || !dtcContent) {
        throw new Error(res.error || 'Failed to download DTC from portal');
      }

      const fileName = `${selectedDetail.callsign.replace(/[^a-zA-Z0-9_-]/g, '_')}.dtc`;
      triggerBrowserFileDownload(fileName, dtcContent, 'application/json');
    } catch (err: any) {
      console.error(err);
      addNotification({
        title: 'DTC Download Failed',
        message: String(err?.message || err),
        category: 'flight_plan',
        actionTab: 'atc',
      });
    } finally {
      setIsSavingDtc(false);
    }
  };

  // 4b. Save JF-17 Custom Airspace Directly to DCS World Core Folder
  const handleSaveAirspaceToDcs = async () => {
    if (!selectedDetail || !isJf17) return;
    setIsSavingAirspace(true);
    setAirspaceSavedPath(null);
    try {
      let content = activeAirspaceSnippet;
      let fileName = activeAirspaceFileName;
      if (!content) {
        const targetUrlOrId =
          selectedDetail.download_urls?.jf17_airspace ||
          selectedDetail.download_urls?.custom_airspace ||
          selectedDetail.id ||
          selectedDetail.identifier;
        const res = await downloadFlightPlanJf17Airspace(
          settings.memberPortalApiUrl,
          targetUrlOrId,
          selectedDetail,
          userSession?.accessToken
        );
        content = res.content || generateFallbackJf17Airspace(selectedDetail);
        if (res.fileName) fileName = res.fileName;
      }
      const installedPath = await saveJf17AirspaceDirect(fileName, content);
      setAirspaceSavedPath(installedPath);
      addNotification({
        title: 'Saved Custom Airspace',
        message: `JF-17 airspace saved as ${fileName} to ${installedPath}`,
        category: 'flight_plan',
        actionTab: 'atc',
      });
    } catch (err: any) {
      console.error(err);
      addLog('error', 'ATC', `Failed saving JF-17 Custom Airspace: ${err?.message || err}`);
      addNotification({
        title: 'Airspace Save Failed',
        message: String(err?.message || err),
        category: 'flight_plan',
        actionTab: 'atc',
      });
    } finally {
      setIsSavingAirspace(false);
    }
  };

  // 4c. Download JF-17 Custom Airspace File (.lua)
  const handleDownloadAirspaceFile = async () => {
    if (!selectedDetail) return;
    let content = activeAirspaceSnippet;
    let fileName = activeAirspaceFileName;
    if (!content) {
      const targetUrlOrId =
        selectedDetail.download_urls?.jf17_airspace ||
        selectedDetail.download_urls?.custom_airspace ||
        selectedDetail.id ||
        selectedDetail.identifier;
      const res = await downloadFlightPlanJf17Airspace(
        settings.memberPortalApiUrl,
        targetUrlOrId,
        selectedDetail,
        userSession?.accessToken
      );
      content = res.content || generateFallbackJf17Airspace(selectedDetail);
      if (res.fileName) fileName = res.fileName;
    }
    triggerBrowserFileDownload(fileName, content, 'text/plain');
  };

  // 4d. Copy Airspace Directory Path
  const handleCopyAirspacePath = async () => {
    const path = await copyJf17AirspacePathToClipboard();
    setHasCopiedAirspacePath(true);
    setTimeout(() => setHasCopiedAirspacePath(false), 2500);
  };

  // 4e. Copy Airspace Lua Content Snippet
  const handleCopyAirspaceSnippet = async () => {
    const content = activeAirspaceSnippet || (selectedDetail ? generateFallbackJf17Airspace(selectedDetail) : '');
    if (!content) return;
    await navigator.clipboard.writeText(content);
    setHasCopiedAirspaceSnippet(true);
    setTimeout(() => setHasCopiedAirspaceSnippet(false), 2500);
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
    setExportKneeboardStatus('Preparing PDF...');
    setKneeboardExportResult(null);

    const customDcsPath = settings.dcsSavedGamesPath || dcsEnv?.activeSavedGamesPath;
    const baseUrl = settings.memberPortalApiUrl;
    const token = userSession?.accessToken;

    try {
      addLog('info', 'ATC', `Exporting kneeboard pages for ${selectedDetail.callsign}...`);

      const result = await exportFlightPlanKneeboardPages(
        selectedDetail,
        baseUrl,
        customDcsPath,
        token,
        (progress) => setExportKneeboardStatus(progress)
      );

      setKneeboardExportResult(result);
      setHasExportedKneeboard(true);

      addLog(
        'success',
        'ATC',
        `Successfully saved ${result.pageCount} kneeboard image(s) to Kneeboard/${result.folderName}/ (${result.fileNames.join(', ')})`
      );

      addNotification({
        title: 'Kneeboard Export Complete',
        message: `Saved ${result.pageCount} page(s) (${result.prefix}) to DCS Kneeboard/${result.folderName}/`,
        category: 'flight_plan',
        actionTab: 'atc',
      });

      setTimeout(() => setHasExportedKneeboard(false), 5000);
    } catch (err: any) {
      console.error('Kneeboard export failed:', err);
      addLog('error', 'ATC', `Failed to export kneeboard pages: ${String(err?.message || err)}`);
      addNotification({
        title: 'Kneeboard Export Failed',
        message: String(err?.message || err),
        category: 'flight_plan',
        actionTab: 'atc',
      });
    } finally {
      setIsExportingKneeboard(false);
      setExportKneeboardStatus(null);
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
    if (!selectedDetail) return;
    try {
      const targetUrlOrId = selectedDetail.download_urls?.dtc || selectedDetail.identifier || selectedDetail.id;
      const token = userSession?.accessToken;
      const res = await downloadFlightPlanDtc(
        settings.memberPortalApiUrl,
        targetUrlOrId,
        token
      );
      const dtcContent = res.rawText || (res.data ? JSON.stringify(res.data, null, 2) : '');
      if (dtcContent) {
        await navigator.clipboard.writeText(dtcContent);
        setHasCopiedDtc(true);
        setTimeout(() => setHasCopiedDtc(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy DTC', err);
    }
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
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent">
              Operational Air Traffic Control
            </h1>
            <p className="text-sm text-stone-400 leading-relaxed">
              Centralized hub for filed flight plans, data cartridges, and route presets.
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
              className={`px-3.5 py-2 rounded-lg text-xs font-display font-semibold transition-all flex items-center gap-2 ${
                viewMode === 'member'
                  ? 'bg-amber-500 text-stone-950 shadow-md font-bold'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <User className="w-4 h-4" />
              <span>My Plans</span>
              <span className="px-1.5 py-0.2 rounded-full bg-stone-900/60 text-[10px] font-mono">
                {memberFlightPlans.length}
              </span>
            </button>

            <button
              onClick={() => {
                setViewMode('filed');
                if (filedFlightPlans[0]) setSelectedPlanId(filedFlightPlans[0].id);
              }}
              className={`px-3.5 py-2 rounded-lg text-xs font-display font-semibold transition-all flex items-center gap-2 ${
                viewMode === 'filed'
                  ? 'bg-emerald-500 text-stone-950 shadow-md font-bold'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <Broadcast className="w-4 h-4" />
              <span>ATC Filed Plans</span>
              <span className="px-1.5 py-0.2 rounded-full bg-stone-900/60 text-[10px] font-mono">
                {filedFlightPlans.length}
              </span>
            </button>
          </div>

          {/* Stat Badges for Active Mode */}
          {viewMode === 'member' && (
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
          )}

          {viewMode === 'filed' && (
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
              <span className="px-2.5 py-1 rounded-lg bg-stone-950 border border-stone-800 text-stone-300">
                Total Filed: <strong className="text-emerald-400">{filedFlightPlans.length}</strong>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Main Master-Detail Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Flight Plans List (4 cols) */}
        <div className="lg:col-span-4 lg:sticky lg:top-4 self-start flex flex-col space-y-2.5">
          {/* Search & Filters */}
          <div className="p-2.5 rounded-xl bg-stone-900/90 border border-stone-800 space-y-2 shrink-0 shadow-sm">
            <div className="relative">
              <MagnifyingGlass className="w-3.5 h-3.5 text-stone-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Filter callsign, airframe, airfield..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-stone-950 border border-stone-800 text-stone-200 text-xs font-mono placeholder-stone-500 focus:outline-none focus:border-amber-500/60"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300 text-xs font-mono px-1"
                  title="Clear filter"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <select
                value={selectedSquadron}
                onChange={(e) => setSelectedSquadron(e.target.value)}
                className="w-1/2 px-2 py-1 rounded-lg bg-stone-950 border border-stone-800 text-stone-300 text-[11px] font-mono focus:outline-none focus:border-amber-500 truncate"
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
                className="w-1/2 px-2 py-1 rounded-lg bg-stone-950 border border-stone-800 text-stone-300 text-[11px] font-mono focus:outline-none focus:border-amber-500 truncate"
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

          <div className="flex items-center justify-between px-1 shrink-0">
            <h2 className="font-display text-xs font-semibold uppercase tracking-wider text-amber-400">
              {viewMode === 'member' ? 'My Plans' : 'ATC Filed Plans'} ({filteredPlans.length})
            </h2>
            <span className="text-[10px] font-mono text-stone-500">
              {filteredPlans.length > 0 ? 'Select to inspect' : ''}
            </span>
          </div>

          {/* Dedicated Scrollable List Container */}
          <div className="overflow-y-auto pr-1.5 space-y-1.5 max-h-[calc(100vh-22rem)] min-h-[360px] scrollbar-thin scrollbar-thumb-stone-800 scrollbar-track-stone-950/40">
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
                    onClick={() => {
                      setSelectedPlanId(plan.id || plan.identifier);
                      setSelectedFlightPlanId(plan.id || plan.identifier);
                    }}
                    style={{ borderLeftColor: isSelected ? '#f59e0b' : hasColor, borderLeftWidth: 3 }}
                    className={`px-3 py-2 rounded-xl border transition-all cursor-pointer select-none ${
                      isSelected
                        ? 'bg-stone-900 border-amber-500/60 shadow-md shadow-amber-500/5 ring-1 ring-amber-500/30'
                        : 'bg-stone-900/60 border-stone-800/80 hover:border-stone-700 hover:bg-stone-900/90'
                    }`}
                  >
                    {/* Top Row: Identifier, Callsign/Name, Status Badges */}
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono bg-stone-950 border border-stone-800 text-amber-400 px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0">
                          #{plan.identifier || `FP-${plan.id}`}
                        </span>
                        <h3 className={`text-xs font-semibold truncate ${isSelected ? 'text-amber-200' : 'text-stone-100'}`}>
                          {plan.callsign && plan.name && plan.callsign !== plan.name
                            ? `${plan.callsign} (${plan.name})`
                            : plan.callsign || plan.name || plan.identifier}
                        </h3>
                      </div>

                      {/* Status Badges */}
                      <div className="flex items-center gap-1 shrink-0">
                        {plan.is_filed ? (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[9px] font-mono font-semibold"
                            title={`Filed with ATC at ${plan.filed_at || ''}`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span>{formatFiledTime(plan.filed_at) ? `Filed ${formatFiledTime(plan.filed_at)}` : 'Filed'}</span>
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded bg-stone-950 text-stone-500 border border-stone-800/80 text-[9px] font-mono">
                            Draft
                          </span>
                        )}
                        {plan.is_opfor && (
                          <span className="px-1 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[8px] font-mono font-bold">
                            OPFOR
                          </span>
                        )}
                        {plan.is_private && (
                          <span className="px-1 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[8px] font-mono font-bold">
                            PRIV
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bottom Row: Airframe, Route, WPT count & DTC */}
                    <div className="flex items-center justify-between gap-2 mt-1 text-[11px] font-mono text-stone-400">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="text-stone-300 font-medium shrink-0">
                          {plan.airframe?.abbreviation || plan.airframe?.name || 'Aircraft'}
                        </span>
                        <span className="text-stone-600">•</span>
                        <span className="truncate text-stone-400">
                          {plan.departure_airfield || 'DEP'} ➔ {plan.destination_airfield || 'ARR'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 text-[10px]">
                        <span className="text-stone-500">
                          {plan.route_summary?.waypoint_count || 0} wpts
                        </span>
                        {plan.is_dtc_compatible && (
                          <span className="px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px]">
                            DTC
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
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
                        <span
                          className="font-mono bg-stone-950 border border-amber-500/40 text-amber-300 px-2.5 py-0.5 rounded-lg text-xs font-bold tracking-wide select-all"
                          title="Permanent Flight Plan Identifier (Immutable)"
                        >
                          #{selectedDetail.identifier}
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
                      <h2 className="font-display text-xl font-bold text-stone-100 truncate">
                        {selectedDetail.callsign && selectedDetail.name && selectedDetail.callsign !== selectedDetail.name
                          ? `${selectedDetail.callsign} // ${selectedDetail.name}`
                          : selectedDetail.callsign || selectedDetail.name}
                      </h2>
                      <p className="text-xs font-mono text-stone-400">
                        Launch:{' '}
                        <span className="text-stone-200 font-semibold">
                          {selectedDetail.launch_time || '—'}
                        </span>{' '}
                        &bull; Fuel:{' '}
                        <span className="text-amber-400 font-semibold">
                          {selectedDetail.fuel_amount ? `${selectedDetail.fuel_amount} lbs` : 'Standard'}
                        </span>{' '}
                        &bull; Theatre:{' '}
                        <span className="text-stone-200">{activeTheatre}</span>
                      </p>
                    </div>
                  </div>

                  {/* Top Action Badges & ATC Filing Status (Read-Only) */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {/* Read-Only ATC Filing Badge */}
                    {selectedDetail.is_filed ? (
                      <span className="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold flex items-center gap-1.5 shadow-sm">
                        <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Filed with ATC • {formatFiledTime(selectedDetail.filed_at)}</span>
                      </span>
                    ) : (
                      <span className="px-3 py-1.5 rounded-lg bg-stone-950 border border-stone-800 text-stone-400 text-xs font-mono flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-stone-600" />
                        <span>Draft / Unfiled</span>
                      </span>
                    )}

                    <div className="flex items-center gap-2 text-[11px] font-mono">
                      {selectedDetail.mission ? (
                        <span className="text-amber-400 font-semibold flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          Mission: {selectedDetail.mission.name}
                        </span>
                      ) : (
                        <span className="text-purple-300 bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 rounded text-[10px]">
                          Standalone / Private Plan
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Tactical Parameters Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <div className="p-3 rounded-xl bg-stone-950/80 border border-stone-800/80">
                    <div className="text-[10px] font-mono uppercase text-stone-400">
                      Departure / Destination
                    </div>
                    <div className="text-xs font-mono font-semibold text-stone-200 mt-1 truncate">
                      {selectedDetail.departure_airfield || '—'}
                    </div>
                    <div className="text-[11px] font-mono text-stone-400 truncate">
                      ARR: {selectedDetail.destination_airfield || '—'}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-stone-950/80 border border-stone-800/80">
                    <div className="text-[10px] font-mono uppercase text-stone-400">
                      Diverts &amp; Alternates
                    </div>
                    <div className="text-xs font-mono font-semibold text-stone-200 mt-1 truncate">
                      {formatDiverts(selectedDetail.diverts)}
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

                {/* --- Action Integration Cards: Route Preset, JF-17 Airspace, DTC, Kneeboard --- */}
                <div className={`grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-2`}>
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

                  {/* 1b. JF-17 Custom Airspace (Specific to JF-17) */}
                  {isJf17 && (
                    <div className="p-4 rounded-xl bg-stone-950/90 border border-cyan-800/60 flex flex-col justify-between gap-3 shadow-lg shadow-cyan-950/20">
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="inline-flex items-center gap-1.5 text-xs font-display font-semibold text-cyan-200">
                            <GlobeHemisphereWest className="w-4 h-4 text-cyan-400" />
                            JF-17 Custom Airspace
                          </span>
                          {airspaceSavedPath && (
                            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="inline-block px-2 py-0.5 rounded bg-cyan-950/50 border border-cyan-800/60 text-[10px] font-mono text-cyan-300 font-semibold">
                            {activeAirspaceTerrain} Airspace
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <button
                          onClick={handleSaveAirspaceToDcs}
                          disabled={isSavingAirspace}
                          className="w-full py-2 px-3 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-stone-950 font-mono font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-md shadow-cyan-500/10 disabled:opacity-50 cursor-pointer"
                        >
                          <DownloadSimple className="w-3.5 h-3.5" />
                          <span>{isSavingAirspace ? 'Saving Airspace...' : 'Save Airspace to DCS'}</span>
                        </button>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={handleDownloadAirspaceFile}
                            className="w-1/2 py-1.5 px-2 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-300 font-mono text-[11px] transition-all flex items-center justify-center gap-1 border border-stone-800 cursor-pointer"
                            title="Download .lua file for manual placement"
                          >
                            <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Download</span>
                          </button>
                          <button
                            onClick={handleCopyAirspacePath}
                            className="w-1/2 py-1.5 px-2 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-300 font-mono text-[11px] transition-all flex items-center justify-center gap-1 border border-stone-800 cursor-pointer"
                            title="Copy target airspace folder path"
                          >
                            {hasCopiedAirspacePath ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-emerald-400">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 text-stone-400" />
                                <span>Copy Path</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {airspaceSavedPath && (
                        <p className="text-[10px] font-mono text-emerald-400 truncate mt-1">
                          Saved to: {airspaceSavedPath}
                        </p>
                      )}
                    </div>
                  )}

                  {/* 2. DTC Export */}
                  {isNotJf17 && (
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
                  )}
                  {/* 3. Kneeboard PDF & Export */}
                  <div className="p-4 rounded-xl bg-stone-950/90 border border-stone-800 flex flex-col justify-between gap-3">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="inline-flex items-center gap-1.5 text-xs font-display font-semibold text-stone-200">
                          <BookOpen className="w-4 h-4 text-amber-400" />
                          Kneeboard PDF
                        </span>
                      </div>
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
                          className={`w-1/2 py-1.5 px-2 rounded-lg font-mono text-[11px] transition-all flex items-center justify-center gap-1 border disabled:opacity-50 ${
                            hasExportedKneeboard
                              ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/60 shadow-sm shadow-emerald-500/20 font-bold'
                              : isExportingKneeboard
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 animate-pulse'
                              : 'bg-stone-900 hover:bg-stone-800 text-stone-300 border-stone-800 hover:text-amber-400'
                          }`}
                          title="Convert flight plan PDF into DCS kneeboard PNG images"
                        >
                          {isExportingKneeboard ? (
                            <>
                              <ArrowsClockwise className="w-3.5 h-3.5 animate-spin text-amber-400" />
                              <span className="truncate">{exportKneeboardStatus || 'Exporting...'}</span>
                            </>
                          ) : hasExportedKneeboard ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" weight="bold" />
                              <span>Saved!</span>
                            </>
                          ) : (
                            <>
                              <FolderSimple className="w-3.5 h-3.5 text-stone-400" />
                              <span>To Folder</span>
                            </>
                          )}
                        </button>
                      </div>

                      {kneeboardExportResult && (
                        <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/40 space-y-1.5">
                          <div className="flex items-center justify-between gap-1 text-[11px] font-mono font-semibold text-emerald-300">
                            <span className="flex items-center gap-1.5">
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" weight="bold" />
                              <span>Exported {kneeboardExportResult.pageCount} Page(s)</span>
                            </span>
                            <button
                              onClick={() => openLocalPath(kneeboardExportResult.targetDirectory)}
                              className="px-1.5 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10px] font-mono border border-emerald-500/30 hover:border-emerald-500/50 transition-colors flex items-center gap-1"
                              title="Open kneeboard directory in Windows Explorer"
                            >
                              <FolderSimple className="w-3 h-3" />
                              <span>Open Folder</span>
                            </button>
                          </div>
                          <div className="text-[10px] font-mono text-stone-400 space-y-0.5">
                            {kneeboardExportResult.fileNames.map((name) => (
                              <div key={name} className="truncate text-stone-300 flex items-center gap-1">
                                <span className="text-emerald-500 font-bold">•</span>
                                <span className="truncate">{name}</span>
                              </div>
                            ))}
                            <p className="text-[9px] text-stone-500 truncate pt-0.5" title={kneeboardExportResult.targetDirectory}>
                              {kneeboardExportResult.targetDirectory}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sub-Navigation Tabs (Mirrors GTFO Flight Planner) */}
              <div className="rounded-2xl border border-stone-800 bg-stone-900/90 overflow-hidden">
                <div className="border-b border-stone-800 px-4 pt-3 flex flex-wrap items-center gap-1.5 bg-stone-950/60 overflow-x-auto">
                  {/* 1. Summary */}
                  <button
                    onClick={() => setActiveTab('summary')}
                    className={`px-3 py-2 text-xs font-display font-semibold border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${
                      activeTab === 'summary'
                        ? 'border-amber-400 text-amber-400'
                        : 'border-transparent text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    <Gauge className="w-3.5 h-3.5" />
                    <span>Summary</span>
                  </button>

                  {/* 2. Routes */}
                  <button
                    onClick={() => setActiveTab('routes')}
                    className={`px-3 py-2 text-xs font-display font-semibold border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${
                      activeTab === 'routes'
                        ? 'border-amber-400 text-amber-400'
                        : 'border-transparent text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    <Path className="w-3.5 h-3.5" />
                    <span>Routes</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-stone-800 text-stone-300">
                      {selectedDetail.route_points?.length || 0}
                    </span>
                  </button>

                  {/* 3. Targets */}
                  <button
                    onClick={() => setActiveTab('targets')}
                    className={`px-3 py-2 text-xs font-display font-semibold border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${
                      activeTab === 'targets'
                        ? 'border-red-500 text-red-400'
                        : 'border-transparent text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    <Target className="w-3.5 h-3.5 text-red-400" />
                    <span>Targets</span>
                    {targetPoints.length > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/30">
                        {targetPoints.length}
                      </span>
                    )}
                  </button>

                  {/* 4. Loadout */}
                  {(selectedDetail.station_loadout || selectedDetail.formatted_loadout) && (
                    <button
                      onClick={() => setActiveTab('loadouts')}
                      className={`px-3 py-2 text-xs font-display font-semibold border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${
                        activeTab === 'loadouts'
                          ? 'border-amber-400 text-amber-400'
                          : 'border-transparent text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      <Crosshair className="w-3.5 h-3.5" />
                      <span>Loadout</span>
                    </button>
                  )}

                  {/* 5. COMMS */}
                  <button
                    onClick={() => setActiveTab('comms')}
                    className={`px-3 py-2 text-xs font-display font-semibold border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${
                      activeTab === 'comms'
                        ? 'border-amber-400 text-amber-400'
                        : 'border-transparent text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    <Radio className="w-3.5 h-3.5" />
                    <span>COMMS</span>
                  </button>

                  {/* 6. MIDS */}
                  {hasMids && (
                    <button
                      onClick={() => setActiveTab('mids')}
                      className={`px-3 py-2 text-xs font-display font-semibold border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${
                        activeTab === 'mids'
                          ? 'border-cyan-400 text-cyan-400'
                          : 'border-transparent text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      <Broadcast className="w-3.5 h-3.5 text-cyan-400" />
                      <span>MIDS</span>
                      <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-mono">L16</span>
                    </button>
                  )}

                  {/* 7. SA (Hornet Only) */}
                  {hasSa && (
                    <button
                      onClick={() => setActiveTab('sa')}
                      className={`px-3 py-2 text-xs font-display font-semibold border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${
                        activeTab === 'sa'
                          ? 'border-emerald-400 text-emerald-400'
                          : 'border-transparent text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    <Compass className="w-3.5 h-3.5 text-emerald-400" />
                    <span>SA</span>
                    <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono">DTC</span>
                  </button>
                  )}

                  {/* 8. DEST PTS (F-16 Viper Only) */}
                  {hasDestPts && (
                    <button
                      onClick={() => setActiveTab('destpts')}
                      className={`px-3 py-2 text-xs font-display font-semibold border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${
                        activeTab === 'destpts'
                          ? 'border-indigo-400 text-indigo-400'
                          : 'border-transparent text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      <AirplaneLanding className="w-3.5 h-3.5 text-indigo-400" />
                      <span>DEST PTS</span>
                      <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-mono">DTC</span>
                    </button>
                  )}

                  {/* 9. ADDITIONAL PTS (F-14 / 14BU Only) */}
                  {hasAdditionalPts && (
                    <button
                      onClick={() => setActiveTab('additionalpts')}
                      className={`px-3 py-2 text-xs font-display font-semibold border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${
                        activeTab === 'additionalpts'
                          ? 'border-orange-400 text-orange-400'
                          : 'border-transparent text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      <MapPin className="w-3.5 h-3.5 text-orange-400" />
                      <span>ADD PTS</span>
                      <span className="text-[9px] px-1 py-0.2 rounded bg-orange-500/20 text-orange-300 font-mono">
                        {resolvedAdditionalPoints.length > 0 ? resolvedAdditionalPoints.length : '14BU'}
                      </span>
                    </button>
                  )}

                  {/* 10. CMDS (Hornet, Viper, Tomcat) */}
                  {hasCmds && (
                    <button
                      onClick={() => setActiveTab('cmds')}
                      className={`px-3 py-2 text-xs font-display font-semibold border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${
                        activeTab === 'cmds'
                          ? 'border-rose-400 text-rose-400'
                          : 'border-transparent text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-rose-400" />
                      <span>CMDS</span>
                      <span className="text-[9px] px-1 py-0.2 rounded bg-rose-500/20 text-rose-300 font-mono">EW</span>
                    </button>
                  )}

                  {/* 11. AIRSPACE (JF-17 Thunder Only) */}
                  {hasAirspace && (
                    <button
                      onClick={() => setActiveTab('airspace')}
                      className={`px-3 py-2 text-xs font-display font-semibold border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${
                        activeTab === 'airspace'
                          ? 'border-cyan-400 text-cyan-400'
                          : 'border-transparent text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      <GlobeHemisphereWest className="w-3.5 h-3.5 text-cyan-400" />
                      <span>AIRSPACE</span>
                      <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-mono">JF-17</span>
                    </button>
                  )}

                  {/* 10. Notes */}
                  <button
                    onClick={() => setActiveTab('notes')}
                    className={`px-3 py-2 text-xs font-display font-semibold border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${
                      activeTab === 'notes'
                        ? 'border-amber-400 text-amber-400'
                        : 'border-transparent text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    <Notepad className="w-3.5 h-3.5" />
                    <span>Notes</span>
                  </button>
                </div>

                <div className="p-5">
                  {/* TAB 1: SUMMARY */}
                  {activeTab === 'summary' && (
                    <div className="space-y-6">
                      {/* Top Metrics Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        {/* Callsign & Rules */}
                        <div className="p-4 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-stone-500 block">
                            Flight Identity
                          </span>
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3.5 h-3.5 rounded-full shrink-0 border border-stone-700"
                              style={{ backgroundColor: selectedDetail.color || '#3b82f6' }}
                            />
                            <span className="font-display font-bold text-stone-100 text-base">
                              {selectedDetail.callsign || selectedDetail.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 pt-1 text-[11px] font-mono">
                            <span
                              className={`px-2 py-0.5 rounded font-bold ${
                                selectedDetail.is_opfor
                                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                  : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                              }`}
                            >
                              {selectedDetail.is_opfor ? 'OPFOR' : 'BLUFOR'}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-stone-900 border border-stone-800 text-stone-300">
                              {selectedDetail.flight_rules || 'VFR'}
                            </span>
                            <span className="text-stone-500 font-mono text-[10px] truncate">
                              ID: {selectedDetail.identifier || `#${selectedDetail.id}`}
                            </span>
                          </div>
                        </div>

                        {/* Airframe & Squadron */}
                        <div className="p-4 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-stone-500 block">
                            Airframe &amp; Squadron
                          </span>
                          <div className="font-display font-bold text-stone-100 text-sm truncate">
                            {selectedDetail.airframe?.name || 'Standard Airframe'}
                          </div>
                          <div className="text-[11px] font-mono text-stone-400 space-y-0.5">
                            <div className="text-amber-400/90 font-semibold truncate">
                              {selectedDetail.squadron?.name || selectedDetail.squadron?.abbreviation || 'Tactical Wing'}
                            </div>
                          </div>
                        </div>

                        {/* Mission & Sortie */}
                        <div className="p-4 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-stone-500 block">
                            Mission Tasking
                          </span>
                          <div className="font-display font-bold text-stone-100 text-sm truncate">
                            {selectedDetail.mission?.name || 'Assigned Campaign Mission'}
                          </div>
                          <div className="text-[11px] font-mono text-stone-400 space-y-0.5">
                            <div className="text-stone-300">
                              Sortie: {selectedDetail.sortie?.name || 'General Sortie'}
                            </div>
                            {selectedDetail.launch_time && (
                              <div className="text-stone-500 text-[10px]">
                                Launch: {selectedDetail.launch_time}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Route Summary */}
                        <div className="p-4 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-stone-500 block">
                            Route Nav Profile
                          </span>
                          <div className="flex items-baseline gap-2">
                            <span className="font-mono font-bold text-amber-400 text-base">
                              {(selectedDetail.route_summary as any)?.total_distance_nm
                                ? `${(selectedDetail.route_summary as any).total_distance_nm} NM`
                                : `${selectedDetail.route_summary?.waypoint_count || selectedDetail.route_points?.length || 0} pts`}
                            </span>
                            {(selectedDetail.route_summary as any)?.estimated_flight_time_formatted && (
                              <span className="text-xs font-mono text-stone-400">
                                ~{(selectedDetail.route_summary as any).estimated_flight_time_formatted}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-[10px] font-mono text-stone-400 pt-0.5">
                            <span>
                              Waypoints:{' '}
                              <strong className="text-stone-200">
                                {selectedDetail.route_summary?.waypoint_count || selectedDetail.route_points?.length || 0}
                              </strong>
                            </span>
                            {(selectedDetail.route_summary?.max_altitude_feet || (selectedDetail.route_summary as any)?.max_altitude_ft) && (
                              <span>
                                Max:{' '}
                                <strong className="text-stone-200">
                                  {(
                                    selectedDetail.route_summary?.max_altitude_feet ||
                                    (selectedDetail.route_summary as any)?.max_altitude_ft
                                  ).toLocaleString()}{' '}
                                  ft
                                </strong>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Aerodromes & Operational Plan */}
                      <div className="p-4 rounded-xl bg-stone-950 border border-stone-800 space-y-4">
                        <h4 className="font-display text-xs font-semibold uppercase tracking-wider text-amber-400">
                          Operational Aerodromes &amp; Fuel Planning
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
                          <div className="p-3 rounded-lg bg-stone-900/60 border border-stone-800/80">
                            <span className="text-[10px] text-stone-500 uppercase block">Departure</span>
                            <span className="font-bold text-stone-200">{selectedDetail.departure_airfield || '—'}</span>
                          </div>
                          <div className="p-3 rounded-lg bg-stone-900/60 border border-stone-800/80">
                            <span className="text-[10px] text-stone-500 uppercase block">Destination</span>
                            <span className="font-bold text-stone-200">{selectedDetail.destination_airfield || '—'}</span>
                          </div>
                          <div className="p-3 rounded-lg bg-stone-900/60 border border-stone-800/80">
                            <span className="text-[10px] text-stone-500 uppercase block">Planned Fuel</span>
                            <span className="font-bold text-stone-200">
                              {selectedDetail.fuel_amount ? `${selectedDetail.fuel_amount} lbs` : 'Standard'}
                            </span>
                          </div>
                          <div className="p-3 rounded-lg bg-stone-900/60 border border-stone-800/80">
                            <span className="text-[10px] text-stone-500 uppercase block">Diverts</span>
                            <span className="font-bold text-stone-200">
                              {formatDiverts(selectedDetail.diverts)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Remarks & Description Preview */}
                      {(selectedDetail.remarks || selectedDetail.description) && (
                        <div className="p-4 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
                          <h4 className="font-display text-xs font-semibold uppercase tracking-wider text-amber-400">
                            Briefing Remarks &amp; Objectives
                          </h4>
                          {selectedDetail.description && (
                            <p className="text-xs font-mono text-stone-300 leading-relaxed">
                              {selectedDetail.description}
                            </p>
                          )}
                          {selectedDetail.remarks && (
                            <p className="text-xs font-mono text-stone-400 border-t border-stone-800/80 pt-2 italic">
                              {selectedDetail.remarks}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 2: ROUTES TABLE */}
                  {activeTab === 'routes' && (
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

                  {/* TAB 3: TARGETS */}
                  {activeTab === 'targets' && (
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-display text-sm font-semibold text-stone-200 flex items-center gap-2">
                          <Target className="w-4 h-4 text-red-400" />
                          <span>Designated Strike Targets</span>
                          {targetPoints.length > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-red-500/20 text-red-300 border border-red-500/30">
                              {targetPoints.length} target{targetPoints.length === 1 ? '' : 's'}
                            </span>
                          )}
                        </h3>
                        <p className="text-xs font-mono text-stone-400">
                          Target points and attack ingress/egress waypoints designated for ground strikes and CAS.
                        </p>
                      </div>

                      {targetPoints.length > 0 ? (
                        <div className="rounded-xl border border-stone-800 bg-stone-950 overflow-hidden">
                          <table className="w-full text-left border-collapse text-xs font-mono">
                            <thead>
                              <tr className="border-b border-stone-800 bg-stone-900/80 text-[11px] text-stone-400 uppercase tracking-wider">
                                <th className="py-2.5 px-3">#</th>
                                <th className="py-2.5 px-3">Target Name</th>
                                <th className="py-2.5 px-3">Coordinates (DD / DDM)</th>
                                <th className="py-2.5 px-3">MGRS</th>
                                <th className="py-2.5 px-3">Target Elev / Alt</th>
                                <th className="py-2.5 px-3">Mission Action / Remarks</th>
                                <th className="py-2.5 px-3 text-right">Copy</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-800/60">
                              {targetPoints.map((wp, idx) => (
                                <tr key={wp.index ?? idx} className="hover:bg-stone-900/50 transition-colors">
                                  <td className="py-2.5 px-3 text-red-400 font-bold">{wp.index ?? idx}</td>
                                  <td className="py-2.5 px-3 font-semibold text-stone-200 flex items-center gap-1.5">
                                    <Target className="w-3.5 h-3.5 text-red-400 shrink-0" />
                                    <span>{wp.name}</span>
                                  </td>
                                  <td className="py-2.5 px-3 text-stone-300">
                                    <div>{wp.ddm || `${wp.lat.toFixed(4)}°, ${wp.lng.toFixed(4)}°`}</div>
                                    <div className="text-[10px] text-stone-400">
                                      {wp.lat.toFixed(4)}, {wp.lng.toFixed(4)}
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3 text-amber-300 font-bold">{wp.mgrs || '—'}</td>
                                  <td className="py-2.5 px-3 text-stone-300">
                                    {wp.alt} ft <span className="text-stone-400">({Math.round(wp.alt * 0.3048)}m)</span>
                                  </td>
                                  <td className="py-2.5 px-3 text-stone-400">
                                    <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-300 border border-red-500/20 text-[10px] mr-1.5 font-bold">
                                      {wp.action || wp.type || 'STRIKE'}
                                    </span>
                                    {wp.remarks || '—'}
                                  </td>
                                  <td className="py-2.5 px-3 text-right">
                                    <button
                                      onClick={() => handleCopyCoordinates(wp, idx)}
                                      title="Copy Target MGRS / Decimal coordinates"
                                      className="p-1 rounded bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-red-400 transition-all border border-stone-800"
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
                      ) : (
                        <div className="p-8 rounded-xl border border-stone-800 bg-stone-950 text-center space-y-2">
                          <Target className="w-8 h-8 text-stone-600 mx-auto" />
                          <h4 className="font-display text-sm font-semibold text-stone-300">
                            No Specific Target Waypoints Designated
                          </h4>
                          <p className="text-xs font-mono text-stone-500 max-w-md mx-auto">
                            This flight plan does not have dedicated ground strike target steerpoints flagged.
                            All navigation waypoints and legs can be inspected in the Routes tab.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 4: LOADOUT */}
                  {activeTab === 'loadouts' && (
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <h4 className="font-display text-xs font-semibold uppercase tracking-wider text-amber-400">
                          Aircraft Station Weapons Loadout
                        </h4>
                        {selectedDetail.station_loadout && Object.keys(selectedDetail.station_loadout).length > 0 ? (
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
                          <div className="p-4 rounded-xl bg-stone-950 border border-stone-800">
                            <p className="text-xs font-mono text-stone-300">
                              {selectedDetail.formatted_loadout || 'Standard configuration.'}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Formatted Loadout Remarks if present */}
                      {selectedDetail.formatted_loadout && selectedDetail.station_loadout && (
                        <div className="p-4 rounded-xl bg-stone-950 border border-stone-800 space-y-1 text-xs font-mono">
                          <span className="text-[10px] uppercase font-bold text-stone-400 block">
                            Loadout Summary
                          </span>
                          <p className="text-stone-300">{selectedDetail.formatted_loadout}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 5: COMMS */}
                  {activeTab === 'comms' && (
                    <div className="space-y-6">
                      {/* Custom Comms Ladder */}
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h4 className="font-display text-xs font-semibold uppercase tracking-wider text-amber-400">
                            Flight Radio Comms Ladder
                          </h4>
                          {(commsData.comm1.length > 0 || commsData.comm2.length > 0) && (
                            <div className="flex items-center gap-1 bg-stone-950 p-1 rounded-lg border border-stone-800 text-[11px] font-mono">
                              <button
                                onClick={() => setActiveCommRadio('all')}
                                className={`px-2 py-0.5 rounded transition-colors ${
                                  activeCommRadio === 'all'
                                    ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40'
                                    : 'text-stone-400 hover:text-stone-200'
                                }`}
                              >
                                All Radios ({commsData.flat.length})
                              </button>
                              {commsData.comm1.length > 0 && (
                                <button
                                  onClick={() => setActiveCommRadio('comm1')}
                                  className={`px-2 py-0.5 rounded transition-colors ${
                                    activeCommRadio === 'comm1'
                                      ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40'
                                      : 'text-stone-400 hover:text-stone-200'
                                  }`}
                                >
                                  COMM 1 ({commsData.comm1.length})
                                </button>
                              )}
                              {commsData.comm2.length > 0 && (
                                <button
                                  onClick={() => setActiveCommRadio('comm2')}
                                  className={`px-2 py-0.5 rounded transition-colors ${
                                    activeCommRadio === 'comm2'
                                      ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40'
                                      : 'text-stone-400 hover:text-stone-200'
                                  }`}
                                >
                                  COMM 2 ({commsData.comm2.length})
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {(() => {
                          const list =
                            activeCommRadio === 'comm1'
                              ? commsData.comm1
                              : activeCommRadio === 'comm2'
                              ? commsData.comm2
                              : commsData.flat;

                          if (!list || list.length === 0) {
                            return (
                              <div className="p-4 rounded-xl bg-stone-950 border border-stone-800 text-center">
                                <p className="text-xs font-mono text-stone-500">
                                  No tactical radio channels configured in custom ladder. Review default task force and airfield frequencies below.
                                </p>
                              </div>
                            );
                          }

                          return (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                              {list.map((c: any, i: number) => {
                                const copyKey = `comm-${i}-${c.frequency}`;
                                const isCopied = copiedFreqKey === copyKey;
                                return (
                                  <div
                                    key={i}
                                    className="p-3.5 rounded-xl bg-stone-950 border border-stone-800 flex items-start justify-between gap-2 transition-colors hover:border-stone-700"
                                  >
                                    <div className="space-y-1 min-w-0">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-[10px] font-mono uppercase text-stone-400 font-semibold truncate">
                                          {c.name || c.label || `Channel ${c.channel || i + 1}`}
                                        </span>
                                        {c.band && (
                                          <span className="text-[9px] px-1 py-0.2 rounded bg-stone-900 border border-stone-800 text-stone-400 font-mono">
                                            {c.band}
                                          </span>
                                        )}
                                        {c.source && (
                                          <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
                                            {c.source}
                                          </span>
                                        )}
                                      </div>
                                      <div className="font-mono text-base font-bold text-amber-300 tracking-wide">
                                        {c.frequency} <span className="text-xs font-normal text-amber-400/80">{c.modulation || 'AM'}</span>
                                      </div>
                                      {c.notes && (
                                        <p className="text-[10px] font-mono text-stone-400 line-clamp-2 leading-relaxed">
                                          {c.notes}
                                        </p>
                                      )}
                                    </div>
                                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                                      {c.channel !== undefined && c.channel !== null && (
                                        <span className="px-2 py-0.5 rounded bg-stone-900 border border-stone-800 text-[10px] font-mono text-stone-300 font-bold">
                                          CH {c.channel}
                                        </span>
                                      )}
                                      <button
                                        onClick={() => handleCopyFrequency(c.frequency, copyKey)}
                                        title={`Copy ${c.frequency} to clipboard`}
                                        className="p-1 rounded bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-amber-400 transition-all border border-stone-800"
                                      >
                                        {isCopied ? (
                                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                                        ) : (
                                          <Copy className="w-3.5 h-3.5" />
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>

                      {/* Default Comms Ladder (Task Force, Squadron, Support) */}
                      {(normalizedDefaultComms.task_force.length > 0 ||
                        normalizedDefaultComms.squadron.length > 0 ||
                        normalizedDefaultComms.support.length > 0) && (
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
                              {normalizedDefaultComms.task_force.length > 0 ? (
                                normalizedDefaultComms.task_force.map((tf: any, i: number) => {
                                  const copyKey = `tf-${i}-${tf.frequency}`;
                                  const isCopied = copiedFreqKey === copyKey;
                                  return (
                                    <div key={i} className="flex items-center justify-between text-xs font-mono py-0.5">
                                      <span className="text-stone-400 truncate max-w-[130px]">{tf.label || tf.name}</span>
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <span className="text-amber-400 font-bold">{tf.frequency}</span>
                                        <button
                                          onClick={() => handleCopyFrequency(tf.frequency, copyKey)}
                                          title={`Copy ${tf.frequency}`}
                                          className="p-1 rounded bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-amber-400 transition-all border border-stone-800"
                                        >
                                          {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })
                              ) : (
                                <span className="text-[11px] font-mono text-stone-600 italic block">None listed</span>
                              )}
                            </div>

                            {/* Squadron Net */}
                            <div className="p-3.5 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
                              <span className="text-[10px] font-mono uppercase font-bold text-stone-300 block border-b border-stone-800 pb-1">
                                Squadron Tactical Nets
                              </span>
                              {normalizedDefaultComms.squadron.length > 0 ? (
                                normalizedDefaultComms.squadron.map((sq: any, i: number) => {
                                  const copyKey = `sq-${i}-${sq.frequency}`;
                                  const isCopied = copiedFreqKey === copyKey;
                                  return (
                                    <div key={i} className="flex items-center justify-between text-xs font-mono py-0.5">
                                      <span className="text-stone-400 truncate max-w-[130px]">{sq.label || sq.name}</span>
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <span className="text-amber-400 font-bold">{sq.frequency}</span>
                                        <button
                                          onClick={() => handleCopyFrequency(sq.frequency, copyKey)}
                                          title={`Copy ${sq.frequency}`}
                                          className="p-1 rounded bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-amber-400 transition-all border border-stone-800"
                                        >
                                          {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })
                              ) : (
                                <span className="text-[11px] font-mono text-stone-600 italic block">None listed</span>
                              )}
                            </div>

                            {/* Support (AWACS / Tanker) */}
                            <div className="p-3.5 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
                              <span className="text-[10px] font-mono uppercase font-bold text-stone-300 block border-b border-stone-800 pb-1">
                                AWACS &amp; Tanker Support
                              </span>
                              {normalizedDefaultComms.support.length > 0 ? (
                                normalizedDefaultComms.support.map((sp: any, i: number) => {
                                  const copyKey = `sp-${i}-${sp.frequency}`;
                                  const isCopied = copiedFreqKey === copyKey;
                                  return (
                                    <div key={i} className="flex items-center justify-between text-xs font-mono py-0.5">
                                      <span className="text-stone-400 truncate max-w-[130px]">{sp.label || sp.name}</span>
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <span className="text-amber-400 font-bold">{sp.frequency}</span>
                                        <button
                                          onClick={() => handleCopyFrequency(sp.frequency, copyKey)}
                                          title={`Copy ${sp.frequency}`}
                                          className="p-1 rounded bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-amber-400 transition-all border border-stone-800"
                                        >
                                          {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })
                              ) : (
                                <span className="text-[11px] font-mono text-stone-600 italic block">None listed</span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Airfield Frequencies */}
                      {Object.keys(normalizedAirfieldFrequencies).length > 0 && (
                        <div className="space-y-2">
                          <h4 className="font-display text-xs font-semibold uppercase tracking-wider text-amber-400">
                            Airfield Frequencies (Departure, Destination, Diverts)
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {Object.entries(normalizedAirfieldFrequencies).map(([field, freqs]: [string, any]) => (
                              <div key={field} className="p-3.5 rounded-xl bg-stone-950 border border-stone-800 space-y-1.5">
                                <span className="text-xs font-mono font-bold text-stone-200 block truncate">{field}</span>
                                <div className="space-y-1 pt-1 border-t border-stone-800/80">
                                  {Array.isArray(freqs) &&
                                    freqs.map((f: any, i: number) => {
                                      const copyKey = `airfield-${field}-${i}-${f.frequency}`;
                                      const isCopied = copiedFreqKey === copyKey;
                                      return (
                                        <div key={i} className="flex items-center justify-between text-xs font-mono py-0.5">
                                          <span className="text-stone-400 truncate max-w-[160px]">{f.type || f.name}</span>
                                          <div className="flex items-center gap-1.5 shrink-0">
                                            <span className="text-amber-300 font-semibold">{f.frequency}</span>
                                            <button
                                              onClick={() => handleCopyFrequency(f.frequency, copyKey)}
                                              title={`Copy ${f.frequency}`}
                                              className="p-1 rounded bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-amber-400 transition-all border border-stone-800"
                                            >
                                              {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 6: MIDS */}
                  {activeTab === 'mids' && (
                    <div className="space-y-6">
                      <div>
                        <h3 className="font-display text-sm font-semibold text-stone-200 flex items-center gap-2">
                          <Broadcast className="w-4 h-4 text-cyan-400" />
                          <span>Link 16 / MIDS Datalink Network Configuration</span>
                        </h3>
                        <p className="text-xs font-mono text-stone-400">
                          Tactical digital information link settings and channel assignments.
                        </p>
                      </div>

                      {selectedDetail.mids_settings || (selectedDetail.comms_ladder as any)?.mids ? (
                        (() => {
                          const mids = {
                            ...(selectedDetail.mids_settings || {}),
                            ...((selectedDetail.comms_ladder as any)?.mids || {}),
                          };
                          return (
                            <div className="space-y-3">
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                <div className="p-4 rounded-xl bg-stone-950 border border-stone-800 space-y-1.5 text-xs font-mono">
                                  <span className="text-[10px] uppercase font-bold text-stone-500 block">MIDS A Channel</span>
                                  <span className="text-xl font-bold text-cyan-300">
                                    {mids.mids_a_channel || 'N/A'}
                                  </span>
                                  {(mids.mids_a_name || mids.mids_a_notes) && (
                                    <p className="text-[11px] text-stone-400 pt-0.5 leading-relaxed">
                                      {mids.mids_a_name ? `${mids.mids_a_name}: ` : ''}
                                      {mids.mids_a_notes || ''}
                                    </p>
                                  )}
                                </div>
                                <div className="p-4 rounded-xl bg-stone-950 border border-stone-800 space-y-1.5 text-xs font-mono">
                                  <span className="text-[10px] uppercase font-bold text-stone-500 block">MIDS B Channel</span>
                                  <span className="text-xl font-bold text-cyan-300">
                                    {mids.mids_b_channel || 'N/A'}
                                  </span>
                                  {(mids.mids_b_name || mids.mids_b_notes) && (
                                    <p className="text-[11px] text-stone-400 pt-0.5 leading-relaxed">
                                      {mids.mids_b_name ? `${mids.mids_b_name}: ` : ''}
                                      {mids.mids_b_notes || ''}
                                    </p>
                                  )}
                                </div>
                                <div className="p-4 rounded-xl bg-stone-950 border border-stone-800 space-y-1.5 text-xs font-mono">
                                  <span className="text-[10px] uppercase font-bold text-stone-500 block">Network / Airframe Label</span>
                                  <span className="text-xl font-bold text-cyan-300">
                                    {mids.net_label || (isJf17 ? 'THUNDER-LINK' : 'STRIKE')}
                                  </span>
                                  <p className="text-[10px] text-stone-500 pt-0.5">
                                    {isJf17 ? 'JF-17 Datalink Terminal' : 'Hornet Link 16 MIDS Terminal'}
                                  </p>
                                </div>
                              </div>

                              {(mids.voice_1 || mids.voice_2 || mids.crypto) && (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                  {mids.voice_1 && (
                                    <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 font-mono text-xs">
                                      <span className="text-[10px] uppercase text-stone-500 block font-bold">Voice 1 Net</span>
                                      <span className="text-stone-200 font-semibold">{mids.voice_1}</span>
                                    </div>
                                  )}
                                  {mids.voice_2 && (
                                    <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 font-mono text-xs">
                                      <span className="text-[10px] uppercase text-stone-500 block font-bold">Voice 2 Net</span>
                                      <span className="text-stone-200 font-semibold">{mids.voice_2}</span>
                                    </div>
                                  )}
                                  {mids.crypto && (
                                    <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 font-mono text-xs">
                                      <span className="text-[10px] uppercase text-stone-500 block font-bold">Crypto / Mode</span>
                                      <span className="text-emerald-400 font-bold">{mids.crypto}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })()
                      ) : (
                        <div className="p-8 rounded-xl border border-stone-800 bg-stone-950 text-center space-y-2">
                          <Broadcast className="w-8 h-8 text-stone-600 mx-auto" />
                          <p className="text-xs font-mono text-stone-400">
                            No Link 16 / MIDS parameters configured for this flight plan.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 7: SA (F/A-18 Hornet Only) */}
                  {activeTab === 'sa' && (
                    <div className="space-y-6">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="font-display text-sm font-semibold text-stone-200 flex items-center gap-2">
                            <Compass className="w-4 h-4 text-emerald-400" />
                            <span>Situational Awareness Tactical Overlays (F/A-18C SA DTC)</span>
                          </h3>
                          <p className="text-xs font-mono text-stone-400">
                            Forward Line of Own Troops (FLOT), Fighter Area of Responsibility (FAOR), CAP stations, and safe corridors.
                          </p>
                        </div>

                        {saData && (
                          <div className="flex items-center gap-1.5 text-[11px] font-mono">
                            <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                              FLOT {saData.default_flot} Active
                            </span>
                            <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                              FAOR {saData.default_faor}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                              CAP {saData.default_cap}
                            </span>
                          </div>
                        )}
                      </div>

                      {saData ? (
                        <div className="space-y-4">
                          {/* SA Sub-navigation Tabs */}
                          <div className="flex items-center gap-2 border-b border-stone-800 pb-2">
                            <button
                              onClick={() => setActiveSaSubTab('flot')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors flex items-center gap-1.5 ${
                                activeSaSubTab === 'flot'
                                  ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40'
                                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'
                              }`}
                            >
                              <span>FLOT Points</span>
                              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-stone-900 text-stone-300">
                                {saData.flot.length}
                              </span>
                            </button>

                            <button
                              onClick={() => setActiveSaSubTab('faor')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors flex items-center gap-1.5 ${
                                activeSaSubTab === 'faor'
                                  ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40'
                                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'
                              }`}
                            >
                              <span>FAOR Boundary</span>
                              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-stone-900 text-stone-300">
                                {saData.faor.length}
                              </span>
                            </button>

                            <button
                              onClick={() => setActiveSaSubTab('cap')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors flex items-center gap-1.5 ${
                                activeSaSubTab === 'cap'
                                  ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40'
                                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'
                              }`}
                            >
                              <span>CAP Stations</span>
                              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-stone-900 text-stone-300">
                                {saData.cap_points.length}
                              </span>
                            </button>

                            <button
                              onClick={() => setActiveSaSubTab('corridors')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors flex items-center gap-1.5 ${
                                activeSaSubTab === 'corridors'
                                  ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40'
                                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'
                              }`}
                            >
                              <span>Safe Corridors</span>
                              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-stone-900 text-stone-300">
                                {saData.corridors.length}
                              </span>
                            </button>
                          </div>

                          {/* Sub-tab 1: FLOT */}
                          {activeSaSubTab === 'flot' && (
                            <div className="space-y-3">
                              <div className="text-xs font-mono text-stone-400">
                                Forward Line of Own Troops (FLOT) coordinates rendered on the Hornet SA display.
                              </div>
                              {saData.flot.length > 0 ? (
                                <div className="rounded-xl border border-stone-800 bg-stone-950 overflow-hidden">
                                  <table className="w-full text-left border-collapse text-xs font-mono">
                                    <thead>
                                      <tr className="border-b border-stone-800 bg-stone-900/80 text-[11px] text-stone-400 uppercase tracking-wider">
                                        <th className="py-2 px-3">Point #</th>
                                        <th className="py-2 px-3">FLOT Station Name</th>
                                        <th className="py-2 px-3">Latitude / Longitude</th>
                                        <th className="py-2 px-3">MGRS / Remarks</th>
                                        <th className="py-2 px-3 text-right">Copy</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-800/60">
                                      {saData.flot.map((pt: any, i: number) => {
                                        const copyKey = `flot-${i}`;
                                        const isCopied = copiedFreqKey === copyKey;
                                        return (
                                          <tr key={i} className="hover:bg-stone-900/50 transition-colors">
                                            <td className="py-2 px-3 text-emerald-400 font-bold">{i + 1}</td>
                                            <td className="py-2 px-3 font-semibold text-stone-200">{pt.name || `FLOT Point ${i + 1}`}</td>
                                            <td className="py-2 px-3 text-stone-300">
                                              {pt.lat?.toFixed ? `${pt.lat.toFixed(4)}°, ${pt.lng.toFixed(4)}°` : `${pt.lat}, ${pt.lng}`}
                                            </td>
                                            <td className="py-2 px-3 text-amber-300/90 font-mono">{pt.mgrs || pt.remarks || '—'}</td>
                                            <td className="py-2 px-3 text-right">
                                              <button
                                                onClick={() => handleCopyFrequency(`${pt.lat}, ${pt.lng}`, copyKey)}
                                                className="p-1 rounded bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-emerald-400 transition-all border border-stone-800"
                                                title="Copy coordinates"
                                              >
                                                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                              </button>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p className="text-xs font-mono text-stone-500 p-4 rounded-xl bg-stone-950 border border-stone-800">
                                  No FLOT boundary coordinates defined.
                                </p>
                              )}
                            </div>
                          )}

                          {/* Sub-tab 2: FAOR */}
                          {activeSaSubTab === 'faor' && (
                            <div className="space-y-3">
                              <div className="text-xs font-mono text-stone-400">
                                Fighter Area of Responsibility (FAOR) boundary polygon vertices.
                              </div>
                              {saData.faor.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                                  {saData.faor.map((pt: any, i: number) => {
                                    const copyKey = `faor-${i}`;
                                    const isCopied = copiedFreqKey === copyKey;
                                    return (
                                      <div key={i} className="p-3.5 rounded-xl bg-stone-950 border border-stone-800 space-y-1.5 font-mono text-xs">
                                        <div className="flex items-center justify-between">
                                          <span className="text-[10px] uppercase font-bold text-emerald-400">Vertex {i + 1}</span>
                                          <button
                                            onClick={() => handleCopyFrequency(`${pt.lat}, ${pt.lng}`, copyKey)}
                                            className="p-1 rounded bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-emerald-400 border border-stone-800"
                                          >
                                            {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                          </button>
                                        </div>
                                        <div className="font-bold text-stone-200">{pt.name || `FAOR Corner ${i + 1}`}</div>
                                        <div className="text-stone-400 text-[11px]">
                                          {pt.lat?.toFixed ? `${pt.lat.toFixed(4)}°, ${pt.lng.toFixed(4)}°` : `${pt.lat}, ${pt.lng}`}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p className="text-xs font-mono text-stone-500 p-4 rounded-xl bg-stone-950 border border-stone-800">
                                  No FAOR boundary vertices assigned.
                                </p>
                              )}
                            </div>
                          )}

                          {/* Sub-tab 3: CAP Stations */}
                          {activeSaSubTab === 'cap' && (
                            <div className="space-y-3">
                              <div className="text-xs font-mono text-stone-400">
                                Designated Combat Air Patrol (CAP) holding stations and racetrack profiles.
                              </div>
                              {saData.cap_points.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                  {saData.cap_points.map((cap: any, i: number) => {
                                    const copyKey = `cap-${i}`;
                                    const isCopied = copiedFreqKey === copyKey;
                                    return (
                                      <div key={i} className="p-4 rounded-xl bg-stone-950 border border-stone-800 space-y-2.5 font-mono text-xs">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                            <span className="font-display font-bold text-sm text-stone-100">{cap.name}</span>
                                          </div>
                                          <button
                                            onClick={() => handleCopyFrequency(`${cap.lat}, ${cap.lng}`, copyKey)}
                                            className="p-1 rounded bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-emerald-400 border border-stone-800"
                                            title="Copy coordinates"
                                          >
                                            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                          </button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-stone-800">
                                          <div>
                                            <span className="text-stone-500 block text-[10px]">Altitude:</span>
                                            <span className="text-emerald-300 font-bold">{cap.alt ? `${cap.alt.toLocaleString()} FT` : 'FL280'}</span>
                                          </div>
                                          <div>
                                            <span className="text-stone-500 block text-[10px]">Speed:</span>
                                            <span className="text-stone-200 font-bold">{cap.speed ? `${cap.speed} KTS` : '420 KTS'}</span>
                                          </div>
                                          <div>
                                            <span className="text-stone-500 block text-[10px]">Leg Distance:</span>
                                            <span className="text-stone-200">{cap.leg_distance ? `${cap.leg_distance} NM` : '20 NM'}</span>
                                          </div>
                                          <div>
                                            <span className="text-stone-500 block text-[10px]">Orbit Time:</span>
                                            <span className="text-amber-400 font-bold">{cap.leg_time || '4 min'}</span>
                                          </div>
                                        </div>
                                        <div className="text-[10px] text-stone-400 pt-1">
                                          Coords: {cap.lat?.toFixed ? `${cap.lat.toFixed(4)}°, ${cap.lng.toFixed(4)}°` : `${cap.lat}, ${cap.lng}`}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p className="text-xs font-mono text-stone-500 p-4 rounded-xl bg-stone-950 border border-stone-800">
                                  No CAP stations loaded.
                                </p>
                              )}
                            </div>
                          )}

                          {/* Sub-tab 4: Safe Corridors */}
                          {activeSaSubTab === 'corridors' && (
                            <div className="space-y-3">
                              <div className="text-xs font-mono text-stone-400">
                                Designated ingress/egress safe passage corridors and altitude containment blocks.
                              </div>
                              {saData.corridors.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                  {saData.corridors.map((c: any, i: number) => {
                                    const copyKey = `corridor-${i}`;
                                    const isCopied = copiedFreqKey === copyKey;
                                    return (
                                      <div key={i} className="p-4 rounded-xl bg-stone-950 border border-stone-800 space-y-2.5 font-mono text-xs">
                                        <div className="flex items-center justify-between">
                                          <span className="font-display font-bold text-sm text-stone-100">{c.name}</span>
                                          <button
                                            onClick={() => handleCopyFrequency(`${c.lat}, ${c.lng}`, copyKey)}
                                            className="p-1 rounded bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-emerald-400 border border-stone-800"
                                            title="Copy coordinates"
                                          >
                                            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                          </button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-stone-800">
                                          <div>
                                            <span className="text-stone-500 block text-[10px]">Corridor Width:</span>
                                            <span className="text-emerald-300 font-bold">{c.width_nm ? `${c.width_nm} NM` : '10 NM'}</span>
                                          </div>
                                          <div>
                                            <span className="text-stone-500 block text-[10px]">Safe Altitudes:</span>
                                            <span className="text-amber-400 font-bold">
                                              {c.min_alt && c.max_alt ? `${c.min_alt} - ${c.max_alt} FT` : 'FL160 - FL240'}
                                            </span>
                                          </div>
                                        </div>
                                        <div className="text-[10px] text-stone-400 pt-1">
                                          Center Anchor: {c.lat?.toFixed ? `${c.lat.toFixed(4)}°, ${c.lng.toFixed(4)}°` : `${c.lat}, ${c.lng}`}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p className="text-xs font-mono text-stone-500 p-4 rounded-xl bg-stone-950 border border-stone-800">
                                  No safe transit corridors designated.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="p-8 rounded-xl border border-stone-800 bg-stone-950 text-center space-y-2">
                          <Compass className="w-8 h-8 text-stone-600 mx-auto" />
                          <p className="text-xs font-mono text-stone-400">
                            No Hornet SA display overlays configured for this flight plan.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 8: DEST PTS (F-16) */}
                  {activeTab === 'destpts' && (
                    <div className="space-y-6">
                      <div>
                        <h3 className="font-display text-sm font-semibold text-stone-200 flex items-center gap-2">
                          <AirplaneLanding className="w-4 h-4 text-indigo-400" />
                          <span>Destination &amp; Alternate Recovery Points</span>
                        </h3>
                        <p className="text-xs font-mono text-stone-400">
                          Bullseye reference coordinates and Viper alternate recovery points.
                        </p>
                      </div>

                      {selectedDetail.dest_points_settings ? (
                        <div className="p-4 rounded-xl bg-stone-950 border border-stone-800 space-y-3 font-mono text-xs">
                          <pre className="text-stone-300 whitespace-pre-wrap">
                            {typeof selectedDetail.dest_points_settings === 'string'
                              ? selectedDetail.dest_points_settings
                              : JSON.stringify(selectedDetail.dest_points_settings, null, 2)}
                          </pre>
                        </div>
                      ) : (
                        <div className="p-8 rounded-xl border border-stone-800 bg-stone-950 text-center space-y-2">
                          <AirplaneLanding className="w-8 h-8 text-stone-600 mx-auto" />
                          <p className="text-xs font-mono text-stone-400">
                            No custom destination points loaded for this airframe.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 9: ADDITIONAL PTS (F-14 / 14BU Only) */}
                  {activeTab === 'additionalpts' && (
                    <div className="space-y-6">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="font-display text-sm font-semibold text-stone-200 flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-orange-400" />
                            <span>F-14 / 14BU Additional Steerpoints &amp; LANTIRN Target Points</span>
                          </h3>
                          <p className="text-xs font-mono text-stone-400">
                            Tactical Computer &amp; AWG-9 / LANTIRN Additional Points (AP 1–40 / XL 1–40) for targeting and offset navigation.
                          </p>
                        </div>
                        {resolvedAdditionalPoints.length > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-orange-500/20 text-orange-300 border border-orange-500/30">
                            {resolvedAdditionalPoints.length} point{resolvedAdditionalPoints.length === 1 ? '' : 's'} loaded
                          </span>
                        )}
                      </div>

                      {resolvedAdditionalPoints.length > 0 ? (
                        <div className="rounded-xl border border-stone-800 bg-stone-950 overflow-hidden">
                          <table className="w-full text-left border-collapse text-xs font-mono">
                            <thead>
                              <tr className="border-b border-stone-800 bg-stone-900/80 text-[11px] text-stone-400 uppercase tracking-wider">
                                <th className="py-2.5 px-3">Point #</th>
                                <th className="py-2.5 px-3">Point / Target Name</th>
                                <th className="py-2.5 px-3">Coordinates (DD / DDM)</th>
                                <th className="py-2.5 px-3">MGRS</th>
                                <th className="py-2.5 px-3">Target Elev / Alt</th>
                                <th className="py-2.5 px-3">Type / Remarks</th>
                                <th className="py-2.5 px-3 text-right">Copy</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-800/60">
                              {resolvedAdditionalPoints.map((pt: any, idx: number) => {
                                const copyKey = `addpt-${idx}`;
                                const isCopied = copiedFreqKey === copyKey;
                                return (
                                  <tr key={idx} className="hover:bg-stone-900/50 transition-colors">
                                    <td className="py-2.5 px-3 text-orange-400 font-bold">
                                      {pt.name?.toUpperCase().startsWith('XL')
                                        ? pt.name.split(' ')[0]
                                        : `AP ${pt.index ?? idx + 1}`}
                                    </td>
                                    <td className="py-2.5 px-3 font-semibold text-stone-200 flex items-center gap-1.5">
                                      <Crosshair className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                                      <span>{pt.name}</span>
                                    </td>
                                    <td className="py-2.5 px-3 text-stone-300">
                                      <div>{pt.ddm || (pt.lat?.toFixed ? `${pt.lat.toFixed(4)}°, ${pt.lng.toFixed(4)}°` : `${pt.lat}, ${pt.lng}`)}</div>
                                      <div className="text-[10px] text-stone-500">
                                        {pt.lat?.toFixed ? `${pt.lat.toFixed(4)}, ${pt.lng.toFixed(4)}` : `${pt.lat}, ${pt.lng}`}
                                      </div>
                                    </td>
                                    <td className="py-2.5 px-3 text-amber-300 font-bold">{pt.mgrs || '—'}</td>
                                    <td className="py-2.5 px-3 text-stone-300">
                                      {pt.alt !== undefined ? `${pt.alt} ft` : '—'}
                                    </td>
                                    <td className="py-2.5 px-3 text-stone-400">
                                      <span className="px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-300 border border-orange-500/20 text-[10px] mr-1.5 font-bold">
                                        {pt.type || (pt.name?.toUpperCase().startsWith('XL') ? 'LANTIRN' : 'ADDITIONAL')}
                                      </span>
                                      {pt.remarks || '—'}
                                    </td>
                                    <td className="py-2.5 px-3 text-right">
                                      <button
                                        onClick={() => handleCopyFrequency(`${pt.lat}, ${pt.lng}`, copyKey)}
                                        title="Copy coordinates"
                                        className="p-1 rounded bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-orange-400 transition-all border border-stone-800"
                                      >
                                        {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="p-8 rounded-xl border border-stone-800 bg-stone-950 text-center space-y-2">
                          <MapPin className="w-8 h-8 text-stone-600 mx-auto" />
                          <h4 className="font-display text-sm font-semibold text-stone-300">
                            No Additional Points Designated in Flight Plan
                          </h4>
                          <p className="text-xs font-mono text-stone-500 max-w-md mx-auto">
                            The F-14 Tomcat AWG-9 / LANTIRN navigation computer supports up to 40 additional target points (AP 1–40 / XL 1–40) designated in the dispatch route or entered directly in the RIO cockpit.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 10: CMDS */}
                  {activeTab === 'cmds' && (
                    <div className="space-y-6">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="font-display text-sm font-semibold text-stone-200 flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-rose-400" />
                            <span>Countermeasures Dispenser Programs (CMDS)</span>
                          </h3>
                          <p className="text-xs font-mono text-stone-400">
                            Chaff and flare expenditure bursts, dispense intervals, salvo presets, and bingo reserves.
                          </p>
                        </div>

                        {cmdsData && (
                          <div className="flex items-center gap-2 text-[11px] font-mono">
                            <span className="px-2.5 py-1 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 font-bold">
                              {cmdsData.type}
                            </span>
                            <span className="px-2.5 py-1 rounded bg-stone-900 border border-stone-800 text-stone-400">
                              Delay: {cmdsData.delay}s
                            </span>
                          </div>
                        )}
                      </div>

                      {cmdsData && cmdsData.bingo && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="p-3.5 rounded-xl bg-stone-950 border border-stone-800 font-mono">
                            <span className="text-[10px] uppercase text-stone-500 font-bold block">Chaff Bingo</span>
                            <span className="text-lg font-bold text-stone-200">{cmdsData.bingo.ChaffNum ?? '—'}</span>
                          </div>
                          <div className="p-3.5 rounded-xl bg-stone-950 border border-stone-800 font-mono">
                            <span className="text-[10px] uppercase text-stone-500 font-bold block">Flare Bingo</span>
                            <span className="text-lg font-bold text-amber-300">{cmdsData.bingo.FlaresNum ?? '—'}</span>
                          </div>
                          <div className="p-3.5 rounded-xl bg-stone-950 border border-stone-800 font-mono">
                            <span className="text-[10px] uppercase text-stone-500 font-bold block">Bingo Audio Warning</span>
                            <span className={`text-sm font-bold ${cmdsData.bingo.BINGO ? 'text-emerald-400' : 'text-stone-500'}`}>
                              {cmdsData.bingo.BINGO ? 'ENABLED' : 'OFF'}
                            </span>
                          </div>
                          <div className="p-3.5 rounded-xl bg-stone-950 border border-stone-800 font-mono">
                            <span className="text-[10px] uppercase text-stone-500 font-bold block">Feedback Audio</span>
                            <span className={`text-sm font-bold ${cmdsData.bingo.FDBK ? 'text-emerald-400' : 'text-stone-500'}`}>
                              {cmdsData.bingo.FDBK ? 'ENABLED' : 'OFF'}
                            </span>
                          </div>
                        </div>
                      )}

                      {cmdsData && Object.keys(cmdsData.programs).length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                          {Object.entries(cmdsData.programs).map(([progKey, prog]: [string, any]) => {
                            const chaff = prog?.chaff;
                            const flare = prog?.flare;

                            return (
                              <div
                                key={progKey}
                                className="p-4 rounded-xl bg-stone-950 border border-stone-800 space-y-3 font-mono text-xs hover:border-stone-700 transition-colors"
                              >
                                <div className="border-b border-stone-800 pb-2">
                                  <span className="text-[10px] uppercase font-bold text-rose-400 block tracking-wider">
                                    {progKey}
                                  </span>
                                  <div className="font-display font-semibold text-stone-200 text-xs truncate">
                                    {prog?.label || progKey}
                                  </div>
                                </div>

                                {/* Chaff Expenditure */}
                                <div className="p-2.5 rounded-lg bg-stone-900/60 border border-stone-800/80 space-y-1">
                                  <div className="flex items-center justify-between text-[11px]">
                                    <span className="font-bold text-stone-300">Chaff</span>
                                    {typeof chaff === 'object' && chaff !== null ? (
                                      <span className="text-amber-400 font-bold">
                                        {chaff.quantity !== undefined && chaff.repeat !== undefined
                                          ? `${chaff.quantity * chaff.repeat} total`
                                          : chaff.burst_qty !== undefined && chaff.salvo_qty !== undefined
                                          ? `${chaff.burst_qty * chaff.salvo_qty} total`
                                          : '—'}
                                      </span>
                                    ) : (
                                      <span className="text-stone-200">{String(chaff ?? '—')}</span>
                                    )}
                                  </div>
                                  {typeof chaff === 'object' && chaff !== null && (
                                    <div className="text-[10px] text-stone-400 space-y-0.5">
                                      {chaff.quantity !== undefined && (
                                        <div>Qty: {chaff.quantity} × {chaff.repeat} reps @ {chaff.interval}s</div>
                                      )}
                                      {chaff.burst_qty !== undefined && (
                                        <div>Burst: {chaff.burst_qty} | Salvo: {chaff.salvo_qty} @ {chaff.salvo_interval ?? chaff.burst_interval}s</div>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* Flare Expenditure */}
                                <div className="p-2.5 rounded-lg bg-stone-900/60 border border-stone-800/80 space-y-1">
                                  <div className="flex items-center justify-between text-[11px]">
                                    <span className="font-bold text-stone-300">Flare</span>
                                    {typeof flare === 'object' && flare !== null ? (
                                      <span className="text-amber-400 font-bold">
                                        {flare.quantity !== undefined && flare.repeat !== undefined
                                          ? `${flare.quantity * flare.repeat} total`
                                          : flare.burst_qty !== undefined && flare.salvo_qty !== undefined
                                          ? `${flare.burst_qty * flare.salvo_qty} total`
                                          : '—'}
                                      </span>
                                    ) : (
                                      <span className="text-stone-200">{String(flare ?? '—')}</span>
                                    )}
                                  </div>
                                  {typeof flare === 'object' && flare !== null && (
                                    <div className="text-[10px] text-stone-400 space-y-0.5">
                                      {flare.quantity !== undefined && (
                                        <div>Qty: {flare.quantity} × {flare.repeat} reps @ {flare.interval}s</div>
                                      )}
                                      {flare.burst_qty !== undefined && (
                                        <div>Burst: {flare.burst_qty} | Salvo: {flare.salvo_qty} @ {flare.salvo_interval ?? flare.burst_interval}s</div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-8 rounded-xl border border-stone-800 bg-stone-950 text-center space-y-2">
                          <ShieldCheck className="w-8 h-8 text-stone-600 mx-auto" />
                          <p className="text-xs font-mono text-stone-400">
                            No CMDS dispense programs configured for this airframe.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 11: AIRSPACE (JF-17 Thunder Only) */}
                  {activeTab === 'airspace' && (
                    <div className="space-y-6">
                      <div className="p-4 rounded-xl bg-stone-900/90 border border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                            <GlobeHemisphereWest className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-display text-sm font-bold text-stone-100 flex items-center gap-2">
                              JF-17 Custom Airspace Definition
                              
                            </h3>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={handleCopyAirspaceSnippet}
                            className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 font-mono text-xs flex items-center gap-1.5 border border-stone-700 transition-colors cursor-pointer"
                          >
                            {hasCopiedAirspaceSnippet ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-emerald-400">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 text-stone-400" />
                                <span>Copy Lua</span>
                              </>
                            )}
                          </button>

                          <button
                            onClick={handleDownloadAirspaceFile}
                            className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 font-mono text-xs flex items-center gap-1.5 border border-stone-700 transition-colors cursor-pointer"
                          >
                            <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Download</span>
                          </button>

                          <button
                            onClick={handleSaveAirspaceToDcs}
                            disabled={isSavingAirspace}
                            className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-stone-950 font-mono font-bold text-xs flex items-center gap-1.5 shadow transition-all cursor-pointer disabled:opacity-50"
                          >
                            <DownloadSimple className="w-3.5 h-3.5" />
                            <span>{isSavingAirspace ? 'Saving...' : 'Save to DCS'}</span>
                          </button>
                        </div>
                      </div>

                      {airspaceSavedPath && (
                        <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-xs font-mono text-emerald-300 flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>Custom Airspace deployed to: <code className="text-stone-100">{airspaceSavedPath}</code></span>
                        </div>
                      )}

                      {/* Airspace Properties & Overview */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="p-3.5 rounded-xl bg-stone-950 border border-stone-800 font-mono">
                          <span className="text-[10px] text-stone-400 uppercase block">Airframe Target</span>
                          <span className="text-xs font-bold text-cyan-300 mt-1 block">JF-17 Thunder</span>
                          <span className="text-[10px] text-stone-500">Customization / Airspace</span>
                        </div>
                        <div className="p-3.5 rounded-xl bg-stone-950 border border-stone-800 font-mono">
                          <span className="text-[10px] text-stone-400 uppercase block">Target File Name</span>
                          <span className="text-xs font-bold text-stone-200 mt-1 block truncate">
                            {activeAirspaceFileName}
                          </span>
                          <span className="text-[10px] text-stone-500">Terrain: {activeAirspaceTerrain} (.lua)</span>
                        </div>
                        <div className="p-3.5 rounded-xl bg-stone-950 border border-stone-800 font-mono">
                          <span className="text-[10px] text-stone-400 uppercase block">Airspace Route Points</span>
                          <span className="text-xs font-bold text-emerald-400 mt-1 block">
                            {selectedDetail.route_points?.length || 0} Waypoints
                          </span>
                          <span className="text-[10px] text-stone-500">Bound to HSD Airspace Preset</span>
                        </div>
                      </div>

                      {/* Raw Airspace Lua Preview */}
                      <div className="p-4 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
                        <div className="flex items-center justify-between text-xs font-mono text-stone-400">
                          <span className="uppercase tracking-wider text-cyan-400 font-bold">
                            Airspace Lua Configuration:
                          </span>
                          <button
                            type="button"
                            onClick={handleCopyAirspacePath}
                            className="text-[11px] text-stone-400 hover:text-cyan-300 flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Copy className="w-3 h-3 text-cyan-400" />
                            {hasCopiedAirspacePath ? 'Copied Folder Path!' : 'Copy Target Folder Path'}
                          </button>
                        </div>
                        <pre className="p-4 rounded-lg bg-stone-900 border border-stone-800/80 text-xs font-mono text-stone-200 overflow-x-auto max-h-96 leading-relaxed">
                          {activeAirspaceSnippet || generateFallbackJf17Airspace(selectedDetail)}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* TAB 10: NOTES */}
                  {activeTab === 'notes' && (
                    <div className="space-y-6">
                      <div>
                        <h3 className="font-display text-sm font-semibold text-stone-200 flex items-center gap-2">
                          <Notepad className="w-4 h-4 text-amber-400" />
                          <span>Flight Plan Notes &amp; Dispatch Remarks</span>
                        </h3>
                        <p className="text-xs font-mono text-stone-400">
                          Special instructions, mission objectives, and operational dispatch notes.
                        </p>
                      </div>

                      <div className="space-y-4">
                        {selectedDetail.remarks && (
                          <div className="p-4 rounded-xl bg-stone-950 border border-stone-800 space-y-1.5 font-mono text-xs">
                            <span className="text-[10px] uppercase font-bold text-amber-400 block">
                              Dispatch Remarks
                            </span>
                            <p className="text-stone-300 leading-relaxed whitespace-pre-wrap">
                              {selectedDetail.remarks}
                            </p>
                          </div>
                        )}

                        {selectedDetail.description && (
                          <div className="p-4 rounded-xl bg-stone-950 border border-stone-800 space-y-1.5 font-mono text-xs">
                            <span className="text-[10px] uppercase font-bold text-stone-400 block">
                              Mission Objective / Description
                            </span>
                            <p className="text-stone-300 leading-relaxed whitespace-pre-wrap">
                              {selectedDetail.description}
                            </p>
                          </div>
                        )}

                        {!selectedDetail.remarks && !selectedDetail.description && (
                          <div className="p-8 rounded-xl border border-stone-800 bg-stone-950 text-center space-y-2">
                            <Notepad className="w-8 h-8 text-stone-600 mx-auto" />
                            <p className="text-xs font-mono text-stone-400">
                              No special dispatch remarks or notes recorded for this flight plan.
                            </p>
                          </div>
                        )}
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
                Choose an assigned or filed flight plan on the left to inspect waypoints, communications,
                avionics, and export files to DCS.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
