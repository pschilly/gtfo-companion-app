import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AirplaneTilt,
  ArrowLeft,
  ArrowsClockwise,
  Broadcast,
  CaretDown,
  CaretLeft,
  CaretRight,
  Check,
  CheckCircle,
  Compass,
  Copy,
  Crosshair,
  Export as ExportIcon,
  FileArrowUp,
  FileCode,
  FilePdf,
  FloppyDisk,
  FloppyDiskBack,
  Gauge,
  MagnifyingGlass,
  Notepad,
  PaperPlaneTilt,
  Path,
  Plus,
  Polygon,
  Radio,
  ShieldCheck,
  Target,
  Trash,
  Warning,
  X,
} from '@phosphor-icons/react';
import {
  cloneCampaignFlightPlan,
  createCampaignFlightPlanDraft,
  deleteCampaignFlightPlan,
  fetchAirbaseWarehouse,
  importCampaignDtcFlightPlan,
  saveCampaignFlightPlan,
} from '../../../services/campaignMapService';
import {
  buildDtcJsonPayload,
  downloadFlightPlanDcsRoute,
  downloadFlightPlanDtc,
  downloadFlightPlanJf17Airspace,
  fileFlightPlanWithAtc,
  formatFlightPlanToLuaPreset,
  getFlightPlanPdfUrl,
  installDcsRoutePresetCommand,
  installDtcCartridgeDirect,
  installJf17AirspaceDirect,
  openPdfExternalViewer,
  triggerBrowserFileDownload,
} from '../../../services/flightPlanService';
import {
  CampaignMapAirframeCatalogItem,
  CampaignMapLoadoutPreset,
  CampaignMapPayload,
  CampaignMapProcedure,
  CampaignMapWarehouseInventory,
  FlightPlanDetail,
  FlightPlanRoutePoint,
} from '../../../types';
import { useApp } from '../../../context/AppContext';
import { FloatingToolWindow } from './FloatingToolWindow';
import {
  F14AdditionalPtsTab,
  F14PlotLinesTab,
  F16DestPtsTab,
  F16GeoLinesTab,
  F18SaTab,
  Jf17AirspaceTab,
} from './flightPlanner/AvionicsTabs';
import { CmdsTab, CommsTab, MidsTab } from './flightPlanner/CommsMidsCmdsTabs';
import {
  AutoSaveStatus,
  AvionicsDrawTarget,
  PlannerTabId,
  getAirframeKey,
  getOutOfStockWarnings,
  getStationsListFromConfig,
  hasCmdsSupport,
  hasMidsSupport,
  isDtcCompatibleAirframe,
  isF14Airframe,
  isF16Airframe,
  isF18Airframe,
  isJf17Airframe,
  isTargetPoint,
  normalizePlanForEditor,
  sanitizeF16Stations,
} from './flightPlanner/helpers';
import { LoadoutTab } from './flightPlanner/LoadoutTab';
import { RoutesTab } from './flightPlanner/RoutesTab';
import { SummaryTab } from './flightPlanner/SummaryTab';
import { TargetsTab } from './flightPlanner/TargetsTab';

export type PlannerPlotMode = 'none' | 'waypoint' | 'target';

export interface FlightPlannerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  initialPos?: { x: number; y: number };
  zIndex?: number;
  onFocus?: () => void;
  baseUrl: string;
  authToken?: string | null;
  discordId?: string | null;
  dcsSavedGamesPath?: string;
  dcsWorldRootPath?: string;
  mapData: CampaignMapPayload;
  activePlan: FlightPlanDetail | null;
  onPlanChange: (plan: FlightPlanDetail | null) => void;
  onMutatePlan: (updater: (prev: FlightPlanDetail) => FlightPlanDetail) => void;
  onFlightPlansListChange: (nextList: CampaignMapPayload['flightPlans']) => void;
  onLoadoutPresetsChange: (presets: CampaignMapLoadoutPreset[]) => void;
  onSelectFlightPlan: (flightPlanId: number) => Promise<void> | void;
  unit: 'nm' | 'km';
  activeSequence: number;
  setActiveSequence: (seq: number) => void;
  userCreatedSequences: number[];
  onAddSequence: () => void;
  onDeleteSequence: (seq: number) => void;
  sequenceColors: Record<number, string>;
  onSetSequenceColor: (seq: number, color: string) => void;
  avionicsDrawTarget: AvionicsDrawTarget | null;
  onSetAvionicsDrawTarget: (target: AvionicsDrawTarget | null) => void;
  dirtyVersion: number;
  isPlanDirty: boolean;
  onMarkSaved: () => void;
  onAddPointFromCoords: (lat: number, lng: number, name?: string) => void;
  onAddTargetPoint: (
    coords: { lat: number; lng: number },
    customData?: Partial<FlightPlanRoutePoint>
  ) => void;
  onAddAdditionalAtCenter: () => void;
  onApplyProcedure: (
    proc: CampaignMapProcedure,
    mode: 'auto' | 'prepend' | 'append',
    targetSeq?: number
  ) => void;
  onPanToPoint: (globalIdx: number, openPopup?: boolean) => void;
  onCenterMap: (lat: number, lng: number, zoom?: number) => void;
  onReorderWaypoints: (seq: number, fromSeqIdx: number, toSeqIdx: number) => void;
  onUpdatePoint: (globalIdx: number, patch: Partial<FlightPlanRoutePoint>) => void;
  onDeletePoint: (globalIdx: number) => void;
  onSetWaypointSequence: (globalIdx: number, seq: number) => void;
  onClearRoute: () => void;
  onNotify: (level: 'info' | 'success' | 'warning' | 'error', msg: string) => void;
}

export const FlightPlannerDrawer: React.FC<FlightPlannerDrawerProps> = ({
  isOpen,
  onClose,
  initialPos = { x: 16, y: 68 },
  zIndex = 1120,
  onFocus,
  baseUrl,
  authToken,
  discordId,
  dcsSavedGamesPath,
  dcsWorldRootPath,
  mapData,
  activePlan,
  onPlanChange,
  onMutatePlan,
  onFlightPlansListChange,
  onLoadoutPresetsChange,
  onSelectFlightPlan,
  unit,
  activeSequence,
  setActiveSequence,
  userCreatedSequences,
  onAddSequence,
  onDeleteSequence,
  sequenceColors,
  onSetSequenceColor,
  avionicsDrawTarget,
  onSetAvionicsDrawTarget,
  dirtyVersion,
  isPlanDirty,
  onMarkSaved,
  onAddPointFromCoords,
  onAddTargetPoint,
  onAddAdditionalAtCenter,
  onApplyProcedure,
  onPanToPoint,
  onCenterMap,
  onReorderWaypoints,
  onUpdatePoint,
  onDeletePoint,
  onSetWaypointSequence,
  onClearRoute,
  onNotify,
}) => {
  const { settings } = useApp();
  const resolvedDcsSavedGamesPath = dcsSavedGamesPath || settings?.dcsSavedGamesPath;
  const resolvedDcsWorldRootPath = dcsWorldRootPath || settings?.dcsWorldRootPath;

  const [activeTab, setActiveTab] = useState<PlannerTabId>('summary');
  const [searchQuery, setSearchQuery] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  // Auto-save & Save state
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>('idle');
  const [isManualSaving, setIsManualSaving] = useState(false);
  const autoSaveTimerRef = useRef<number | null>(null);
  const dirtyVersionRef = useRef(dirtyVersion);
  dirtyVersionRef.current = dirtyVersion;
  const activePlanRef = useRef(activePlan);
  activePlanRef.current = activePlan;

  // Modals
  const [pendingExitAction, setPendingExitAction] = useState<'back' | 'close' | null>(null);
  const [airframeRevertId, setAirframeRevertId] = useState<number | null>(null);
  const [showAirframeModal, setShowAirframeModal] = useState(false);
  const [isReloadingAirframe, setIsReloadingAirframe] = useState(false);
  const [showClearRouteModal, setShowClearRouteModal] = useState(false);
  const [showDeletePlanModal, setShowDeletePlanModal] = useState(false);

  // Import DTC modal
  const [showImportDtcModal, setShowImportDtcModal] = useState(false);
  const [importDtcAirframeId, setImportDtcAirframeId] = useState<string>('');
  const [importDtcFileName, setImportDtcFileName] = useState<string>('');
  const [importDtcJsonText, setImportDtcJsonText] = useState<string>('');
  const dtcFileInputRef = useRef<HTMLInputElement | null>(null);

  // Footer export / ATC states
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isSendingAtc, setIsSendingAtc] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);

  // Tab strip scrolling
  const tabScrollRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Warehouse state for departure airbase
  const [warehouse, setWarehouse] = useState<CampaignMapWarehouseInventory | null>(null);
  const [loadingWarehouse, setLoadingWarehouse] = useState(false);

  const selectedAirframe: CampaignMapAirframeCatalogItem | null = useMemo(() => {
    if (!activePlan) return null;
    return (
      mapData.airframesCatalog.find((a) => Number(a.id) === Number(activePlan.airframe_id)) ||
      (activePlan.airframe as CampaignMapAirframeCatalogItem | null) ||
      null
    );
  }, [activePlan, mapData.airframesCatalog]);

  const canEdit = useMemo(() => {
    if (!activePlan) return false;
    if (typeof activePlan.can_edit === 'boolean') return activePlan.can_edit;
    return Boolean(mapData.permissions?.canManageFlightPlans);
  }, [activePlan, mapData.permissions]);

  const canDelete = useMemo(() => {
    if (!activePlan) return false;
    if (typeof activePlan.can_delete === 'boolean') return activePlan.can_delete;
    return canEdit;
  }, [activePlan, canEdit]);

  const afKey = useMemo(
    () => getAirframeKey(selectedAirframe || activePlan?.airframe),
    [selectedAirframe, activePlan?.airframe]
  );

  const isF18 = isF18Airframe(activePlan, selectedAirframe);
  const isF16 = isF16Airframe(activePlan, selectedAirframe);
  const isF14 = isF14Airframe(activePlan, selectedAirframe);
  const isJf17 = isJf17Airframe(activePlan, selectedAirframe);
  const hasMids = hasMidsSupport(activePlan, selectedAirframe);
  const hasCmds = hasCmdsSupport(activePlan, selectedAirframe) && !isJf17;
  const isDtcCompat = isDtcCompatibleAirframe(activePlan, selectedAirframe);

  const hasStationLoadout = useMemo(() => {
    const stations = getStationsListFromConfig(selectedAirframe?.loadout_config);
    return stations.length > 0;
  }, [selectedAirframe]);

  const targetPointsCount = useMemo(
    () => (activePlan?.route_points || []).filter((p) => isTargetPoint(p)).length,
    [activePlan?.route_points]
  );

  const additionalPointsCount = useMemo(() => {
    if (!isF14 || !activePlan) return 0;
    return (activePlan.route_points || []).filter(
      (pt) =>
        !isTargetPoint(pt) &&
        Boolean(
          pt.is_lantirn ||
            pt.is_additional ||
            String(pt.type || '').toUpperCase() === 'LANTIRN' ||
            String(pt.type || '').toUpperCase() === 'ADDITIONAL' ||
            String(pt.name || '')
              .toUpperCase()
              .endsWith('XL') ||
            String(pt.name || '')
              .toUpperCase()
              .startsWith('AP')
        )
    ).length;
  }, [isF14, activePlan]);

  const outOfStockWarnings = useMemo(() => {
    if (!activePlan || !hasStationLoadout) return [];
    const raw =
      activePlan.station_loadout || (activePlan.metadata?.stations as Record<string, string>) || {};
    const sanitized = sanitizeF16Stations(afKey, raw);
    return getOutOfStockWarnings(
      sanitized,
      selectedAirframe?.loadout_config,
      warehouse,
      loadingWarehouse,
      activePlan.departure_airfield
    );
  }, [activePlan, hasStationLoadout, afKey, selectedAirframe, warehouse, loadingWarehouse]);

  // Idle view plans lists
  const allPlans = mapData.flightPlans?.allPlans || [];
  const myPlans = mapData.flightPlans?.myPlans || [];

  const searchResults = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return [];
    return allPlans.filter(
      (p) =>
        (p.identifier && p.identifier.toLowerCase().includes(q)) ||
        (p.callsign && p.callsign.toLowerCase().includes(q)) ||
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.creator_name && p.creator_name.toLowerCase().includes(q)) ||
        (p.airframe_name && p.airframe_name.toLowerCase().includes(q)) ||
        (p.mission_name && p.mission_name.toLowerCase().includes(q)) ||
        (p.flight_plan_id && String(p.flight_plan_id).toLowerCase().includes(q)) ||
        (p.id && String(p.id).toLowerCase().includes(q))
    );
  }, [allPlans, searchQuery]);

  // Tab availability guard when switching plans / airframes
  useEffect(() => {
    if (!activePlan) return;
    if (activeTab === 'loadouts' && !hasStationLoadout) setActiveTab('summary');
    if (activeTab === 'mids' && !hasMids) setActiveTab('summary');
    if (activeTab === 'sa' && !isF18) setActiveTab('summary');
    if ((activeTab === 'geolines' || activeTab === 'destpts') && !isF16) setActiveTab('summary');
    if ((activeTab === 'plotlines' || activeTab === 'additionalpts') && !isF14) {
      setActiveTab('summary');
    }
    if (activeTab === 'jf17airspace' && !isJf17) setActiveTab('summary');
    if (activeTab === 'cmds' && !hasCmds) setActiveTab('summary');
  }, [activePlan?.id, activePlan?.airframe_id, hasStationLoadout, hasMids, isF18, isF16, isF14, isJf17, hasCmds, activeTab]);

  // Close export menu on outside click
  useEffect(() => {
    if (!exportMenuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [exportMenuOpen]);

  // Tab scroll indicator calculation
  const checkTabScroll = useCallback(() => {
    const el = tabScrollRef.current;
    if (!el) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    if (!isOpen || !activePlan) return;
    const t = window.setTimeout(checkTabScroll, 60);
    window.addEventListener('resize', checkTabScroll);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('resize', checkTabScroll);
    };
  }, [isOpen, activePlan?.id, isF18, isF16, isF14, isJf17, hasMids, hasCmds, hasStationLoadout, activeTab, checkTabScroll]);

  const scrollTabs = (dir: -1 | 1) => {
    if (!tabScrollRef.current) return;
    tabScrollRef.current.scrollBy({ left: dir * 160, behavior: 'smooth' });
  };

  // Fetch departure airbase warehouse
  const loadWarehouse = useCallback(
    async (depAirfield?: string | null) => {
      const name = (depAirfield || '').trim();
      if (!name || !baseUrl) {
        setWarehouse(null);
        return;
      }
      setLoadingWarehouse(true);
      try {
        const res = await fetchAirbaseWarehouse(baseUrl, mapData.campaign.id, name, {
          discordId,
          token: authToken,
        });
        setWarehouse(res);
      } catch {
        setWarehouse({ is_unlimited: true, weapons: [] });
      } finally {
        setLoadingWarehouse(false);
      }
    },
    [baseUrl, mapData.campaign.id, discordId, authToken]
  );

  useEffect(() => {
    if (!activePlan) {
      setWarehouse(null);
      return;
    }
    void loadWarehouse(activePlan.departure_airfield);
  }, [activePlan?.id, activePlan?.departure_airfield, loadWarehouse]);

  // Save payload builder
  const buildSavePayload = useCallback(
    (plan: FlightPlanDetail): Record<string, unknown> => {
      const ladder =
        plan.comms_ladder_by_radio ||
        (plan.comms_ladder && !Array.isArray(plan.comms_ladder) ? plan.comms_ladder : {}) ||
        {};
      const comm1 = Array.isArray(plan.comm1)
        ? plan.comm1
        : Array.isArray((ladder as any).comm1)
          ? (ladder as any).comm1
          : [];
      const comm2 = Array.isArray(plan.comm2)
        ? plan.comm2
        : Array.isArray((ladder as any).comm2)
          ? (ladder as any).comm2
          : [];
      const stations = sanitizeF16Stations(
        getAirframeKey(
          mapData.airframesCatalog.find((a) => Number(a.id) === Number(plan.airframe_id)) ||
            plan.airframe
        ),
        plan.station_loadout || (plan.metadata?.stations as Record<string, string>) || {}
      );

      return {
        callsign: plan.callsign || plan.name || '',
        name: plan.name || plan.callsign || '',
        airframe_id: plan.airframe_id || null,
        is_opfor: Boolean(plan.is_opfor),
        mission_id: plan.mission_id || null,
        sortie_id: plan.sortie_id || null,
        tasking: plan.tasking || null,
        flight_rules: plan.flight_rules || 'AUTO',
        coordinate_format: plan.coordinate_format || 'LLDM',
        launch_time: plan.launch_time || null,
        fuel_amount: plan.fuel_amount ?? null,
        loadout: plan.loadout || null,
        stations,
        station_loadout: stations,
        gun: plan.gun_loadout || null,
        gun_loadout: plan.gun_loadout || null,
        countermeasures: plan.countermeasures_loadout || null,
        countermeasures_loadout: plan.countermeasures_loadout || null,
        departure_airfield: plan.departure_airfield || null,
        destination_airfield: plan.destination_airfield || null,
        overhead_pattern: plan.overhead_pattern || null,
        diverts: Array.isArray(plan.diverts) ? plan.diverts : [],
        route_points: plan.route_points || [],
        comm1,
        comm2,
        comms: { ...ladder, comm1, comm2 },
        comms_ladder: { ...ladder, comm1, comm2 },
        mids: plan.mids_settings || {},
        mids_settings: plan.mids_settings || {},
        cmds: plan.cmds_settings || null,
        cmds_settings: plan.cmds_settings || null,
        sa: plan.sa_settings || null,
        sa_settings: plan.sa_settings || null,
        geo_lines: plan.geo_lines_settings || null,
        geo_lines_settings: plan.geo_lines_settings || null,
        dest_pts: plan.dest_points_settings || null,
        dest_points_settings: plan.dest_points_settings || null,
        f14_plot_lines: plan.f14_plot_lines_settings || null,
        f14_plot_lines_settings: plan.f14_plot_lines_settings || null,
        jf17_airspace: plan.jf17_airspace_settings || null,
        jf17_airspace_settings: plan.jf17_airspace_settings || null,
        remarks: plan.remarks || null,
        description: plan.description || null,
        color: plan.color || '#3b82f6',
        sequence_colors: sequenceColors,
        last_updated_at: plan.updated_at || null,
      };
    },
    [mapData.airframesCatalog, sequenceColors]
  );

  // Core save function
  const savePlanInternal = useCallback(
    async (silent: boolean): Promise<boolean> => {
      const targetPlan = activePlanRef.current;
      if (!targetPlan || !canEdit) return false;
      const savedVersionSnapshot = dirtyVersionRef.current;

      if (!silent) setIsManualSaving(true);
      setAutoSaveStatus('saving');

      try {
        const res = await saveCampaignFlightPlan(
          baseUrl,
          targetPlan.id,
          buildSavePayload(targetPlan),
          { discordId, token: authToken }
        );

        const stillSamePlan = activePlanRef.current?.id === targetPlan.id;
        if (stillSamePlan) {
          if (dirtyVersionRef.current === savedVersionSnapshot) {
            const af =
              mapData.airframesCatalog.find((a) => Number(a.id) === Number(res.plan.airframe_id)) ||
              null;
            const normalized = normalizePlanForEditor(
              {
                ...targetPlan,
                ...res.plan,
                // Preserve local avionics/sequence state if server omits optional fields
                route_points:
                  Array.isArray(res.plan.route_points) && res.plan.route_points.length > 0
                    ? res.plan.route_points
                    : targetPlan.route_points,
              },
              mapData,
              af
            );
            onPlanChange(normalized);
            onMarkSaved();
            setAutoSaveStatus('saved');
          } else {
            // Newer edits happened while request was in flight; only sync timestamp
            onPlanChange({
              ...activePlanRef.current!,
              updated_at: res.plan.updated_at,
            });
            setAutoSaveStatus('pending');
          }
        }

        // Update summary item in allPlans / myPlans
        const updateSummaryList = (list: typeof allPlans) =>
          list.map((item) =>
            Number(item.id) === Number(targetPlan.id) ||
            Number(item.flight_plan_id) === Number(targetPlan.id)
              ? {
                  ...item,
                  callsign: targetPlan.callsign || targetPlan.name || item.callsign,
                  name: targetPlan.name || targetPlan.callsign || item.name,
                  is_opfor: Boolean(targetPlan.is_opfor),
                  color: targetPlan.color || item.color,
                  points_count: (targetPlan.route_points || []).length,
                  has_plan: (targetPlan.route_points || []).length > 0,
                  airframe_name: selectedAirframe?.name || item.airframe_name,
                  airframe_abbr: selectedAirframe?.abbreviation || item.airframe_abbr,
                }
              : item
          );

        onFlightPlansListChange({
          allPlans: updateSummaryList(mapData.flightPlans?.allPlans || []),
          myPlans: updateSummaryList(mapData.flightPlans?.myPlans || []),
        });

        if (!silent) {
          onNotify('success', `Flight Plan "${targetPlan.callsign || targetPlan.identifier}" saved.`);
        }
        return true;
      } catch (err: any) {
        setAutoSaveStatus('error');
        if (!silent) {
          onNotify('error', err?.message || 'Failed to save flight plan changes.');
        }
        return false;
      } finally {
        if (!silent) setIsManualSaving(false);
      }
    },
    [
      canEdit,
      baseUrl,
      buildSavePayload,
      discordId,
      authToken,
      mapData,
      onPlanChange,
      onMarkSaved,
      onFlightPlansListChange,
      selectedAirframe,
      onNotify,
    ]
  );

  // 1200ms Debounced Auto-Save matching Member Portal
  useEffect(() => {
    if (autoSaveTimerRef.current) {
      window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    if (!activePlan || !canEdit || !isPlanDirty || dirtyVersion === 0) {
      if (!isPlanDirty && autoSaveStatus === 'pending') {
        setAutoSaveStatus('idle');
      }
      return;
    }

    if (autoSaveStatus !== 'saving') {
      setAutoSaveStatus('pending');
    }

    autoSaveTimerRef.current = window.setTimeout(() => {
      void savePlanInternal(true);
    }, 1200);

    return () => {
      if (autoSaveTimerRef.current) {
        window.clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [dirtyVersion, isPlanDirty, activePlan?.id, canEdit]);

  // Exit handlers (Back / Close with Unsaved Changes check)
  const performExit = useCallback(
    (action: 'back' | 'close') => {
      if (autoSaveTimerRef.current) {
        window.clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      setPendingExitAction(null);
      setAutoSaveStatus('idle');
      onSetAvionicsDrawTarget(null);
      onMarkSaved();
      if (action === 'back') {
        onPlanChange(null);
      } else {
        onPlanChange(null);
        onClose();
      }
    },
    [onSetAvionicsDrawTarget, onMarkSaved, onPlanChange, onClose]
  );

  const requestBack = () => {
    if (activePlan && canEdit && isPlanDirty) {
      setPendingExitAction('back');
      return;
    }
    performExit('back');
  };

  const requestClose = () => {
    if (activePlan && canEdit && isPlanDirty) {
      setPendingExitAction('close');
      return;
    }
    if (activePlan) {
      performExit('close');
    } else {
      onSetAvionicsDrawTarget(null);
      onClose();
    }
  };

  // Airframe change handling with Reload Warning Modal
  const handleAirframeSelectChange = (newAfId: number | null) => {
    if (!activePlan || !canEdit) return;
    const prevAfId = activePlan.airframe_id ?? null;
    if (Number(prevAfId) === Number(newAfId)) return;

    const newAf = mapData.airframesCatalog.find((a) => Number(a.id) === Number(newAfId)) || null;
    const oldAf = mapData.airframesCatalog.find((a) => Number(a.id) === Number(prevAfId)) || null;

    setAirframeRevertId(prevAfId);
    onMutatePlan((p) => ({
      ...p,
      airframe_id: newAfId,
      airframe: newAf
        ? {
            id: newAf.id,
            name: newAf.name,
            abbreviation: newAf.abbreviation,
            dcs_entity: newAf.dcs_entity,
            is_dtc_compatible: newAf.is_dtc_compatible,
          }
        : null,
      is_dtc_compatible: Boolean(newAf?.is_dtc_compatible),
      is_f18: newAf?.is_f18,
      is_f16: newAf?.is_f16,
      is_f14: newAf?.is_f14,
      is_f14_bu: newAf?.is_f14_bu,
      is_jf17: newAf?.is_jf17,
      has_cmds: newAf?.has_cmds,
      has_mids: newAf?.has_mids,
    }));

    if (prevAfId && newAfId && (getAirframeKey(oldAf) !== getAirframeKey(newAf) || oldAf?.id !== newAf?.id)) {
      setShowAirframeModal(true);
    }
  };

  const handleRevertAirframe = () => {
    const revertId = airframeRevertId;
    const af = mapData.airframesCatalog.find((a) => Number(a.id) === Number(revertId)) || null;
    onMutatePlan((p) => ({
      ...p,
      airframe_id: revertId,
      airframe: af
        ? {
            id: af.id,
            name: af.name,
            abbreviation: af.abbreviation,
            dcs_entity: af.dcs_entity,
            is_dtc_compatible: af.is_dtc_compatible,
          }
        : null,
      is_dtc_compatible: Boolean(af?.is_dtc_compatible),
      is_f18: af?.is_f18,
      is_f16: af?.is_f16,
      is_f14: af?.is_f14,
      is_f14_bu: af?.is_f14_bu,
      is_jf17: af?.is_jf17,
      has_cmds: af?.has_cmds,
      has_mids: af?.has_mids,
    }));
    setShowAirframeModal(false);
  };

  const handleSaveAndReloadAirframe = async () => {
    if (!activePlan) return;
    setIsReloadingAirframe(true);
    try {
      const saved = await savePlanInternal(true);
      if (saved) {
        await onSelectFlightPlan(activePlan.id);
      }
      setShowAirframeModal(false);
    } finally {
      setIsReloadingAirframe(false);
    }
  };

  // Draft creation (BLUFOR / OPFOR)
  const handleCreateDraft = async (isOpfor: boolean) => {
    setIsBusy(true);
    try {
      const defaultAf = mapData.airframesCatalog[0];
      const res = await createCampaignFlightPlanDraft(
        baseUrl,
        mapData.campaign.id,
        {
          callsign: isOpfor ? 'RED DRAFT 1' : 'NEW FLIGHT 1',
          airframe_id: defaultAf?.id || null,
          is_opfor: isOpfor,
          color: isOpfor ? '#ef4444' : '#3b82f6',
          route_points: [],
        },
        { discordId, token: authToken }
      );
      const af =
        mapData.airframesCatalog.find((a) => Number(a.id) === Number(res.plan.airframe_id)) || null;
      const normalized = normalizePlanForEditor(res.plan, mapData, af);
      onFlightPlansListChange(res.flightPlans);
      onPlanChange(normalized);
      onMarkSaved();
      setActiveTab('summary');
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to create flight plan draft.');
    } finally {
      setIsBusy(false);
    }
  };

  // Import DTC JSON
  const handleDtcFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportDtcFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setImportDtcJsonText(String(reader.result || ''));
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmImportDtc = async () => {
    if (!importDtcJsonText.trim()) {
      onNotify('warning', 'Please choose a .dtc or .json cartridge file first.');
      return;
    }
    setIsBusy(true);
    try {
      try {
        JSON.parse(importDtcJsonText);
      } catch {
        throw new Error('Selected file is not valid JSON.');
      }
      const res = await importCampaignDtcFlightPlan(
        baseUrl,
        mapData.campaign.id,
        {
          dtc_json: importDtcJsonText,
          airframe_id: importDtcAirframeId ? Number(importDtcAirframeId) : null,
        },
        { discordId, token: authToken }
      );
      const af =
        mapData.airframesCatalog.find((a) => Number(a.id) === Number(res.plan.airframe_id)) || null;
      const normalized = normalizePlanForEditor(res.plan, mapData, af);
      onFlightPlansListChange(res.flightPlans);
      onPlanChange(normalized);
      onMarkSaved();
      setShowImportDtcModal(false);
      setImportDtcJsonText('');
      setImportDtcFileName('');
      setActiveTab('routes');
      onNotify('success', `Imported DTC cartridge into "${normalized.callsign || normalized.identifier}".`);
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to import DTC cartridge.');
    } finally {
      setIsBusy(false);
    }
  };

  // Clone plan
  const handleClonePlan = async () => {
    if (!activePlan) return;
    setIsBusy(true);
    try {
      const res = await cloneCampaignFlightPlan(baseUrl, mapData.campaign.id, activePlan.id, {
        discordId,
        token: authToken,
      });
      const af =
        mapData.airframesCatalog.find((a) => Number(a.id) === Number(res.plan.airframe_id)) || null;
      const normalized = normalizePlanForEditor(res.plan, mapData, af);
      onFlightPlansListChange(res.flightPlans);
      onPlanChange(normalized);
      onMarkSaved();
      onNotify('success', `Cloned into "${normalized.callsign || normalized.identifier}".`);
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to clone flight plan.');
    } finally {
      setIsBusy(false);
    }
  };

  // Delete plan
  const handleConfirmDeletePlan = async () => {
    if (!activePlan) return;
    setIsBusy(true);
    try {
      await deleteCampaignFlightPlan(baseUrl, activePlan.id, { discordId, token: authToken });
      const deletedId = activePlan.id;
      onFlightPlansListChange({
        allPlans: allPlans.filter((p) => Number(p.id) !== Number(deletedId) && Number(p.flight_plan_id) !== Number(deletedId)),
        myPlans: myPlans.filter((p) => Number(p.id) !== Number(deletedId) && Number(p.flight_plan_id) !== Number(deletedId)),
      });
      setShowDeletePlanModal(false);
      onSetAvionicsDrawTarget(null);
      onPlanChange(null);
      onMarkSaved();
      onNotify('success', 'Flight plan deleted.');
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to delete flight plan.');
    } finally {
      setIsBusy(false);
    }
  };

  // File / Refile with ATC
  const handleFileWithAtc = async () => {
    if (!activePlan) return;
    setIsSendingAtc(true);
    try {
      if (isPlanDirty && canEdit) {
        await savePlanInternal(true);
      }
      const res = await fileFlightPlanWithAtc(
        baseUrl,
        activePlan.identifier || activePlan.id,
        discordId || undefined,
        authToken || undefined
      );
      if (res.success) {
        onPlanChange({
          ...activePlan,
          filed_at: new Date().toISOString(),
        });
        onNotify('success', res.message || 'Flight plan filed with ATC.');
      } else {
        onNotify('error', res.message || 'Failed to file flight plan with ATC.');
      }
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to file flight plan with ATC.');
    } finally {
      setIsSendingAtc(false);
    }
  };

  // Export handler (PDF, DTC, DCS Route, JF-17 Custom Airspace)
  const handleExport = async (format: 'pdf' | 'dtc' | 'dcs_route' | 'jf17_airspace') => {
    if (!activePlan) return;
    setIsExporting(true);
    setExportMenuOpen(false);
    try {
      if (isPlanDirty && canEdit) {
        await savePlanInternal(true);
      }

      if (format === 'pdf') {
        const pdfUrl = getFlightPlanPdfUrl(baseUrl, activePlan.identifier || activePlan.id);
        const fileName = `${(activePlan.callsign || activePlan.identifier || 'flight_plan').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
        try {
          await openPdfExternalViewer(pdfUrl, fileName, authToken || undefined);
        } catch {
          window.open(pdfUrl, '_blank', 'noopener,noreferrer');
        }
        return;
      }

      if (format === 'dtc') {
        const res = await downloadFlightPlanDtc(
          baseUrl,
          activePlan.identifier || activePlan.id,
          authToken || undefined
        );
        const jsonContent =
          res.success && res.rawText
            ? res.rawText
            : JSON.stringify(buildDtcJsonPayload(activePlan), null, 2);
        const fileName = `${(activePlan.callsign || activePlan.identifier || 'flight_plan').replace(/[^a-zA-Z0-9_-]/g, '_')}.dtc`;
        try {
          const installedPath = await installDtcCartridgeDirect(
            fileName,
            jsonContent,
            'DTC',
            resolvedDcsSavedGamesPath
          );
          onNotify('success', `DTC Cartridge installed to ${installedPath}`);
        } catch {
          triggerBrowserFileDownload(fileName, jsonContent, 'application/json');
          onNotify('success', `Downloaded ${fileName}`);
        }
        return;
      }

      if (format === 'dcs_route') {
        const lua =
          (await downloadFlightPlanDcsRoute(
            baseUrl,
            activePlan.identifier || activePlan.id,
            activePlan,
            authToken || undefined
          )) || formatFlightPlanToLuaPreset(activePlan);
        const theatre = mapData.campaign.theatre || activePlan.campaign?.theatre || 'Syria';
        try {
          const installed = await installDcsRoutePresetCommand(
            theatre,
            lua,
            resolvedDcsSavedGamesPath
          );
          onNotify('success', `Route Tool preset updated: ${installed.filePath}`);
        } catch {
          const safeCallsign = (activePlan.callsign || activePlan.identifier || 'route').replace(
            /[^a-zA-Z0-9_-]/g,
            '_'
          );
          triggerBrowserFileDownload(`${safeCallsign}_route.lua`, lua, 'text/plain');
          onNotify('success', `Downloaded DCS Route Tool snippet`);
        }
        return;
      }

      if (format === 'jf17_airspace') {
        const res = await downloadFlightPlanJf17Airspace(
          baseUrl,
          activePlan.identifier || activePlan.id,
          activePlan,
          authToken || undefined
        );
        if (!res.success) {
          onNotify('error', res.error || 'Failed to export JF-17 Custom Airspace.');
          return;
        }
        try {
          const path = await installJf17AirspaceDirect(
            res.fileName,
            res.content,
            resolvedDcsWorldRootPath || resolvedDcsSavedGamesPath
          );
          onNotify('success', `JF-17 Custom Airspace installed to ${path}`);
        } catch {
          triggerBrowserFileDownload(res.fileName, res.content, 'text/plain');
          onNotify('success', `Downloaded ${res.fileName}`);
        }
      }
    } catch (err: any) {
      onNotify('error', err?.message || `Failed to export (${format}).`);
    } finally {
      setIsExporting(false);
    }
  };



  // Header Badge & Actions inside FloatingToolWindow titlebar
  const titlebarBadge = activePlan ? (
    <div className="flex items-center gap-1.5 mr-1 max-w-[200px]">
      <span className="text-xs font-bold text-white truncate">
        {activePlan.callsign || activePlan.name || 'Draft Plan'}
      </span>
      <span
        className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono uppercase shrink-0 border ${
          activePlan.is_opfor
            ? 'bg-red-950/80 text-red-400 border-red-700/60'
            : 'bg-sky-950/80 text-sky-400 border-sky-700/60'
        }`}
      >
        {activePlan.is_opfor ? 'OPFOR' : 'BLUFOR'}
      </span>
    </div>
  ) : undefined;

  const titlebarActions = activePlan ? (
    <div className="flex items-center gap-1.5">
      {/* Auto-save Status Pill */}
      {canEdit && (
        <div className="flex items-center">
          {autoSaveStatus === 'saving' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-[10px] text-amber-400 font-mono animate-pulse">
              <span className="size-1.5 rounded-full bg-amber-400 animate-ping" />
              Auto-saving...
            </span>
          )}
          {autoSaveStatus === 'saved' && !isPlanDirty && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] text-emerald-400 font-mono">
              <Check className="size-2.5" weight="bold" />
              Auto-saved
            </span>
          )}
          {(autoSaveStatus === 'pending' || (isPlanDirty && autoSaveStatus !== 'saving')) && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-stone-800 text-[10px] text-stone-400 font-mono">
              <span className="size-1.5 rounded-full bg-amber-400" />
              Unsaved
            </span>
          )}
          {autoSaveStatus === 'error' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/40 text-[10px] text-red-400 font-mono">
              Save failed
            </span>
          )}
        </div>
      )}

      {/* Save Plan Button */}
      {canEdit && (
        <button
          type="button"
          onClick={() => void savePlanInternal(false)}
          disabled={isManualSaving}
          title="Save Flight Plan (All Tabs & Route)"
          className={`px-2.5 py-1 rounded text-xs font-bold transition-all duration-300 flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer ${
            isPlanDirty
              ? 'bg-amber-500 hover:bg-amber-400 text-stone-950 ring-2 ring-amber-400/80 shadow-lg shadow-amber-500/30'
              : 'bg-amber-600/90 hover:bg-amber-500 text-white'
          }`}
        >
          <span className={`inline-flex items-center ${isManualSaving ? 'animate-spin' : ''}`}>
            <FloppyDisk className="size-3.5" weight="duotone" />
          </span>
          <span>{isManualSaving ? 'Saving...' : 'Save Plan'}</span>
          {isPlanDirty && !isManualSaving && (
            <span className="inline-block size-1.5 rounded-full bg-stone-950 shrink-0" />
          )}
        </button>
      )}

      {/* Back Button */}
      <button
        type="button"
        onClick={requestBack}
        title="Back to Flight List"
        className="p-1 rounded text-stone-400 hover:text-white hover:bg-stone-800 transition-colors cursor-pointer"
      >
        <ArrowLeft className="size-4" weight="bold" />
      </button>
    </div>
  ) : undefined;

  return (
    <FloatingToolWindow
      title="Flight Planner"
      icon={<AirplaneTilt className="size-4 text-amber-400" weight="duotone" />}
      badge={titlebarBadge}
      headerActions={titlebarActions}
      isOpen={isOpen}
      onClose={requestClose}
      initialPos={initialPos}
      widthClass="w-[720px] max-w-[95vw]"
      maxHeightClass="max-h-[85vh]"
      zIndex={zIndex}
      onFocus={onFocus}
    >
      <div className="relative flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* ==================== UNSAVED CHANGES MODAL ==================== */}
        {pendingExitAction && (
          <div className="absolute inset-0 z-50 bg-stone-950/85 backdrop-blur-sm flex items-center justify-center p-6">
            <div className="bg-stone-900 border border-amber-500/40 rounded-xl p-5 shadow-2xl max-w-md w-full text-center space-y-4">
              <div className="size-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
                <Warning className="size-6" weight="duotone" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                  Unsaved Changes
                </h4>
                <p className="text-xs text-stone-400 mt-1">
                  You have unsaved changes to this flight plan. If you exit now, your recent edits
                  will be lost.
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPendingExitAction(null)}
                  className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold border border-stone-700 transition-colors cursor-pointer"
                >
                  Keep Editing
                </button>
                <button
                  type="button"
                  onClick={() => performExit(pendingExitAction)}
                  className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-semibold border border-red-500/30 transition-colors cursor-pointer"
                >
                  Discard &amp; Exit
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const action = pendingExitAction;
                    const ok = await savePlanInternal(false);
                    if (ok && action) performExit(action);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <FloppyDisk className="size-3.5" weight="duotone" />
                  <span>Save &amp; Exit</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==================== AIRFRAME CHANGE WARNING MODAL ==================== */}
        {showAirframeModal && (
          <div className="absolute inset-0 z-50 bg-stone-950/85 backdrop-blur-sm flex items-center justify-center p-6">
            <div className="bg-stone-900 border border-sky-500/40 rounded-xl p-5 shadow-2xl max-w-md w-full text-center space-y-4">
              <div className="size-12 rounded-full bg-sky-500/10 border border-sky-500/30 flex items-center justify-center mx-auto text-sky-400">
                <ArrowsClockwise className="size-6" weight="duotone" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                  Airframe Type Changed
                </h4>
                <p className="text-xs text-stone-300 mt-1">
                  You have changed the type of airframe this plan is for. You must reload the
                  planner to account for airframe-specific variables, presets, and loadout
                  stations.
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 pt-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleRevertAirframe}
                  className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold border border-stone-700 transition-colors cursor-pointer"
                >
                  Revert Airframe
                </button>
                <button
                  type="button"
                  onClick={() => setShowAirframeModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold border border-stone-700 transition-colors cursor-pointer"
                >
                  Keep Editing
                </button>
                <button
                  type="button"
                  disabled={isReloadingAirframe}
                  onClick={() => void handleSaveAndReloadAirframe()}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <span className={`inline-flex items-center ${isReloadingAirframe ? 'animate-spin' : ''}`}>
                    <ArrowsClockwise className="size-3.5" weight="duotone" />
                  </span>
                  <span>{isReloadingAirframe ? 'Reloading...' : 'Save & Reload Planner'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==================== CLEAR ROUTE CONFIRM MODAL ==================== */}
        {showClearRouteModal && (
          <div className="absolute inset-0 z-50 bg-stone-950/85 backdrop-blur-sm flex items-center justify-center p-6">
            <div className="bg-stone-900 border border-red-500/40 rounded-xl p-5 shadow-2xl max-w-sm w-full text-center space-y-4">
              <div className="size-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto text-red-400">
                <Trash className="size-6" weight="duotone" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                  Clear Flight Path
                </h4>
                <p className="text-xs text-stone-400 mt-1">
                  Are you sure you wish to clear this flight path? All waypoints will be removed.
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowClearRouteModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold border border-stone-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClearRoute();
                    setShowClearRouteModal(false);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold cursor-pointer"
                >
                  Clear Route Points
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==================== DELETE FLIGHT PLAN MODAL ==================== */}
        {showDeletePlanModal && (
          <div className="absolute inset-0 z-50 bg-stone-950/85 backdrop-blur-sm flex items-center justify-center p-6">
            <div className="bg-stone-900 border border-red-500/40 rounded-xl p-5 shadow-2xl max-w-sm w-full text-center space-y-4">
              <div className="size-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto text-red-400">
                <Trash className="size-6" weight="duotone" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                  Delete Flight Plan
                </h4>
                <p className="text-xs text-stone-400 mt-1">
                  Permanently delete{' '}
                  <strong className="text-stone-200">
                    {activePlan?.callsign || activePlan?.identifier}
                  </strong>
                  ? This cannot be undone.
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeletePlanModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold border border-stone-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => void handleConfirmDeletePlan()}
                  className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
                >
                  Delete Plan
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==================== IMPORT DTC MODAL ==================== */}
        {showImportDtcModal && (
          <div className="absolute inset-0 z-50 bg-stone-950/85 backdrop-blur-sm flex items-center justify-center p-6">
            <div className="bg-stone-900 border border-amber-500/40 rounded-xl p-5 shadow-2xl max-w-md w-full space-y-4">
              <div className="flex items-center justify-between border-b border-stone-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <FileArrowUp className="size-5 text-amber-400" weight="duotone" />
                  <h4 className="text-sm font-bold text-white">Import DTC Cartridge</h4>
                </div>
                <button
                  type="button"
                  onClick={() => setShowImportDtcModal(false)}
                  className="text-stone-400 hover:text-stone-200 cursor-pointer"
                >
                  <X className="size-4" weight="bold" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-stone-400 font-semibold mb-1">
                    Target Airframe (Optional)
                  </label>
                  <select
                    value={importDtcAirframeId}
                    onChange={(e) => setImportDtcAirframeId(e.target.value)}
                    className="w-full rounded-md border border-stone-700 bg-stone-950 text-stone-200 text-xs py-1.5 px-2"
                  >
                    <option value="">Auto-detect from DTC file</option>
                    {mapData.airframesCatalog.map((af) => (
                      <option key={af.id} value={af.id}>
                        {af.abbreviation} — {af.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-stone-400 font-semibold mb-1">
                    DTC Cartridge File (.dtc / .json)
                  </label>
                  <input
                    ref={dtcFileInputRef}
                    type="file"
                    accept=".dtc,.json,application/json"
                    onChange={handleDtcFileChosen}
                    className="hidden"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => dtcFileInputRef.current?.click()}
                      className="px-3 py-1.5 rounded bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-200 font-semibold cursor-pointer"
                    >
                      Choose File...
                    </button>
                    <span className="text-stone-400 truncate flex-1">
                      {importDtcFileName || 'No file chosen'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setShowImportDtcModal(false)}
                  className="px-3 py-1.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isBusy || !importDtcJsonText}
                  onClick={() => void handleConfirmImportDtc()}
                  className="px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold disabled:opacity-50 cursor-pointer"
                >
                  {isBusy ? 'Importing...' : 'Import Flight Plan'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==================== NO FLIGHT ACTIVE: LIST / CREATE ==================== */}
        {!activePlan ? (
          <div className="p-3 text-xs text-stone-200 bg-stone-800/80 overflow-y-auto flex-1 max-h-[calc(85vh-56px)] space-y-3">
            {mapData.permissions?.canCreateFlightPlan && (
              <div className="space-y-2">
                {mapData.permissions?.canManageBothCoalitions ? (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleCreateDraft(false)}
                      className="w-full py-2 px-3 rounded-lg bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/50 text-sky-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <Plus className="size-3.5" weight="bold" />
                      <span>BLUFOR Draft</span>
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleCreateDraft(true)}
                      className="w-full py-2 px-3 rounded-lg bg-red-600/20 hover:bg-red-600/30 border border-red-500/50 text-red-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <Plus className="size-3.5" weight="bold" />
                      <span>OPFOR Draft</span>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void handleCreateDraft(false)}
                    className="w-full py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <Plus className="size-3.5" weight="bold" />
                    <span>Create New Draft</span>
                  </button>
                )}

                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => setShowImportDtcModal(true)}
                  className="w-full py-1.5 px-3 rounded-lg bg-stone-900 hover:bg-stone-700 border border-stone-700 text-stone-200 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <FileArrowUp className="size-4 text-stone-400" weight="duotone" />
                  <span>Import DTC</span>
                </button>
              </div>
            )}

            {/* Search Box */}
            <div className="relative">
              <MagnifyingGlass
                className="size-4 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                weight="bold"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search flight plans by ID (e.g. FP-7K9M2) or name..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-stone-900 border border-stone-700 text-xs text-stone-100 placeholder:text-stone-500 focus:border-amber-400 focus:outline-none"
              />
            </div>

            {/* Search Results View */}
            {searchQuery.trim().length > 0 ? (
              <div>
                <h4 className="text-[10px] font-bold text-stone-400 uppercase mb-2 flex items-center justify-between">
                  <span>Search Results</span>
                  <span className="text-stone-500 font-normal">{searchResults.length} found</span>
                </h4>

                {searchResults.length === 0 ? (
                  <div className="text-center p-4 text-stone-500 italic text-xs bg-stone-900/50 rounded border border-stone-800">
                    No flight plans match &apos;{searchQuery}&apos;.
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {searchResults.map((f) => {
                      const ptsCount =
                        f.points_count ??
                        (Array.isArray(f.route_points) ? f.route_points.length : 0);
                      const hasPlan = Boolean(f.has_plan || ptsCount > 0);
                      return (
                        <button
                          key={`sr_${f.flight_plan_id || f.id}`}
                          type="button"
                          onClick={() => void onSelectFlightPlan(Number(f.flight_plan_id || f.id))}
                          className="flex items-center justify-between p-2 rounded bg-stone-900/80 hover:bg-stone-700 border border-stone-700/80 transition-colors text-left group cursor-pointer"
                        >
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-stone-800 text-amber-400 font-mono border border-stone-700">
                                {f.identifier}
                              </span>
                              {f.is_opfor && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-950/80 text-red-400 font-mono border border-red-700/60 uppercase">
                                  OPFOR
                                </span>
                              )}
                              <span className="text-stone-100 group-hover:text-amber-300 font-bold text-xs truncate">
                                {f.callsign || f.name}
                              </span>
                            </div>
                            <span className="text-[11px] text-stone-400 truncate">
                              {[
                                f.creator_name ? `Created by ${f.creator_name}` : '',
                                f.airframe_name || f.airframe_abbr || '',
                                f.mission_name || '',
                              ]
                                .filter(Boolean)
                                .join(' • ')}
                            </span>
                          </div>
                          {hasPlan && (
                            <div className="flex items-center gap-1 text-green-400 shrink-0 ml-2">
                              <span className="text-[10px] font-mono font-semibold text-stone-400 bg-stone-950 px-1.5 py-0.5 rounded border border-stone-700">
                                {ptsCount} WP
                              </span>
                              <CheckCircle className="size-4 text-emerald-400" weight="duotone" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* My Flight Plans View */
              <div>
                <h4 className="text-[10px] font-bold text-stone-400 uppercase mb-2">
                  My Flight Plans
                </h4>
                {myPlans.length === 0 ? (
                  <div className="text-center p-4 text-stone-500 italic text-xs bg-stone-900/50 rounded border border-stone-800">
                    You haven&apos;t created any flight plans for this campaign yet.
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {myPlans.map((f) => {
                      const ptsCount =
                        f.points_count ??
                        (Array.isArray(f.route_points) ? f.route_points.length : 0);
                      const hasPlan = Boolean(f.has_plan || ptsCount > 0);
                      return (
                        <button
                          key={`mp_${f.flight_plan_id || f.id}`}
                          type="button"
                          onClick={() => void onSelectFlightPlan(Number(f.flight_plan_id || f.id))}
                          className="flex items-center justify-between p-2 rounded bg-stone-900/80 hover:bg-stone-700 border border-stone-700/80 transition-colors text-left group cursor-pointer"
                        >
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-stone-800 text-amber-400 font-mono border border-stone-700">
                                {f.identifier}
                              </span>
                              {f.is_opfor && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-950/80 text-red-400 font-mono border border-red-700/60 uppercase">
                                  OPFOR
                                </span>
                              )}
                              <span className="text-stone-100 group-hover:text-amber-300 font-bold text-xs truncate">
                                {f.callsign || f.name}
                              </span>
                            </div>
                            <span className="text-[11px] text-stone-400 truncate">
                              {[f.airframe_name || f.airframe_abbr || '', f.mission_name || '']
                                .filter(Boolean)
                                .join(' • ')}
                            </span>
                          </div>
                          {hasPlan && (
                            <div className="flex items-center gap-1 text-green-400 shrink-0 ml-2">
                              <span className="text-[10px] font-mono font-semibold text-stone-400 bg-stone-950 px-1.5 py-0.5 rounded border border-stone-700">
                                {ptsCount} WP
                              </span>
                              <CheckCircle className="size-4 text-emerald-400" weight="duotone" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* ==================== ACTIVE FLIGHT PLAN EDITOR ==================== */
          <>
            {/* Scrollable 14-Tab Strip with Left/Right Scroll Arrows */}
            <div className="relative border-b border-stone-800 bg-stone-900/90 shrink-0">
              {canScrollLeft && (
                <button
                  type="button"
                  onClick={() => scrollTabs(-1)}
                  className="absolute left-0 top-0 bottom-0 z-10 w-8 bg-gradient-to-r from-stone-950 via-stone-900/95 to-transparent flex items-center justify-start pl-1 text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
                  title="Scroll tabs left"
                >
                  <CaretLeft className="size-3.5 drop-shadow" weight="bold" />
                </button>
              )}

              <div
                ref={tabScrollRef}
                onScroll={checkTabScroll}
                className="flex items-center px-3 pt-1.5 gap-1 select-none overflow-x-auto scrollbar-none"
              >
                <button
                  type="button"
                  onClick={() => setActiveTab('summary')}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-t-md transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                    activeTab === 'summary'
                      ? 'bg-stone-800 text-amber-400 border-t-2 border-amber-400 shadow-inner'
                      : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/40'
                  }`}
                >
                  <Gauge className="size-3.5" weight="duotone" />
                  <span>Summary</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('routes')}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-t-md transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                    activeTab === 'routes'
                      ? 'bg-stone-800 text-amber-400 border-t-2 border-amber-400 shadow-inner'
                      : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/40'
                  }`}
                >
                  <Path className="size-3.5" weight="duotone" />
                  <span>Routes</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('targets')}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-t-md transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                    activeTab === 'targets'
                      ? 'bg-stone-800 text-red-400 border-t-2 border-red-500 shadow-inner'
                      : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/40'
                  }`}
                >
                  <Target className="size-3.5 text-red-400" weight="duotone" />
                  <span>Targets</span>
                  {targetPointsCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/30">
                      {targetPointsCount}
                    </span>
                  )}
                </button>

                {hasStationLoadout && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('loadouts')}
                    className={`px-2.5 py-1.5 text-xs font-semibold rounded-t-md transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                      activeTab === 'loadouts'
                        ? 'bg-stone-800 text-amber-400 border-t-2 border-amber-400 shadow-inner'
                        : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/40'
                    }`}
                  >
                    <Crosshair className="size-3.5" weight="duotone" />
                    <span>Loadout</span>
                    {outOfStockWarnings.length > 0 && (
                      <span className="size-2 rounded-full bg-amber-400 animate-ping" />
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setActiveTab('comms')}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-t-md transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                    activeTab === 'comms'
                      ? 'bg-stone-800 text-amber-400 border-t-2 border-amber-400 shadow-inner'
                      : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/40'
                  }`}
                >
                  <Radio className="size-3.5" weight="duotone" />
                  <span>COMMS</span>
                </button>

                {hasMids && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('mids')}
                    className={`px-2.5 py-1.5 text-xs font-semibold rounded-t-md transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                      activeTab === 'mids'
                        ? 'bg-stone-800 text-cyan-400 border-t-2 border-cyan-400 shadow-inner'
                        : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/40'
                    }`}
                  >
                    <Broadcast className="size-3.5" weight="duotone" />
                    <span>MIDS</span>
                    <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-mono">
                      L16
                    </span>
                  </button>
                )}

                {isF18 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('sa')}
                    className={`px-2.5 py-1.5 text-xs font-semibold rounded-t-md transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                      activeTab === 'sa'
                        ? 'bg-stone-800 text-emerald-400 border-t-2 border-emerald-400 shadow-inner'
                        : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/40'
                    }`}
                  >
                    <Compass className="size-3.5 text-emerald-400" weight="duotone" />
                    <span>SA</span>
                    <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                      DTC
                    </span>
                  </button>
                )}

                {isF16 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('geolines')}
                    className={`px-2.5 py-1.5 text-xs font-semibold rounded-t-md transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                      activeTab === 'geolines'
                        ? 'bg-stone-800 text-teal-400 border-t-2 border-teal-400 shadow-inner'
                        : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/40'
                    }`}
                  >
                    <Polygon className="size-3.5 text-teal-400" weight="duotone" />
                    <span>GEO LINES</span>
                    <span className="text-[9px] px-1 py-0.2 rounded bg-teal-500/20 text-teal-300 font-mono">
                      DTC
                    </span>
                  </button>
                )}

                {isF16 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('destpts')}
                    className={`px-2.5 py-1.5 text-xs font-semibold rounded-t-md transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                      activeTab === 'destpts'
                        ? 'bg-stone-800 text-indigo-400 border-t-2 border-indigo-400 shadow-inner'
                        : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/40'
                    }`}
                  >
                    <ShieldCheck className="size-3.5 text-indigo-400" weight="duotone" />
                    <span>DEST PTS</span>
                    <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-mono">
                      DTC
                    </span>
                  </button>
                )}

                {isF14 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('plotlines')}
                    className={`px-2.5 py-1.5 text-xs font-semibold rounded-t-md transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                      activeTab === 'plotlines'
                        ? 'bg-stone-800 text-teal-400 border-t-2 border-teal-400 shadow-inner'
                        : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/40'
                    }`}
                  >
                    <Polygon className="size-3.5 text-teal-400" weight="duotone" />
                    <span>PLOT LINES</span>
                    <span className="text-[9px] px-1 py-0.2 rounded bg-teal-500/20 text-teal-300 font-mono">
                      DTC
                    </span>
                  </button>
                )}

                {isF14 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('additionalpts')}
                    className={`px-2.5 py-1.5 text-xs font-semibold rounded-t-md transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                      activeTab === 'additionalpts'
                        ? 'bg-stone-800 text-purple-400 border-t-2 border-purple-400 shadow-inner'
                        : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/40'
                    }`}
                  >
                    <Crosshair className="size-3.5 text-purple-400" weight="duotone" />
                    <span>ADDITIONAL PTS</span>
                    <span className="text-[9px] px-1 py-0.2 rounded bg-purple-500/20 text-purple-300 font-mono">
                      {additionalPointsCount} / 40
                    </span>
                  </button>
                )}

                {isJf17 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('jf17airspace')}
                    className={`px-2.5 py-1.5 text-xs font-semibold rounded-t-md transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                      activeTab === 'jf17airspace'
                        ? 'bg-stone-800 text-cyan-400 border-t-2 border-cyan-400 shadow-inner'
                        : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/40'
                    }`}
                  >
                    <Polygon className="size-3.5 text-cyan-400" weight="duotone" />
                    <span>AIRSPACE</span>
                    <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-mono">
                      JF-17
                    </span>
                  </button>
                )}

                {hasCmds && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('cmds')}
                    className={`px-2.5 py-1.5 text-xs font-semibold rounded-t-md transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                      activeTab === 'cmds'
                        ? 'bg-stone-800 text-rose-400 border-t-2 border-rose-400 shadow-inner'
                        : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/40'
                    }`}
                  >
                    <ShieldCheck className="size-3.5" weight="duotone" />
                    <span>CMDS</span>
                    <span className="text-[9px] px-1 py-0.2 rounded bg-rose-500/20 text-rose-300 font-mono">
                      EW
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setActiveTab('notes')}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-t-md transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                    activeTab === 'notes'
                      ? 'bg-stone-800 text-amber-400 border-t-2 border-amber-400 shadow-inner'
                      : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/40'
                  }`}
                >
                  <Notepad className="size-3.5" weight="duotone" />
                  <span>Notes</span>
                </button>
              </div>

              {canScrollRight && (
                <button
                  type="button"
                  onClick={() => scrollTabs(1)}
                  className="absolute right-0 top-0 bottom-0 z-10 w-12 bg-gradient-to-l from-stone-950 via-stone-900/95 to-transparent flex items-center justify-end pr-1 text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
                  title="More tabs available — click or scroll right"
                >
                  <div className="flex items-center gap-0.5 animate-pulse">
                    <span className="text-[9px] font-bold text-amber-400/90 uppercase tracking-tighter hidden sm:inline">
                      More
                    </span>
                    <CaretRight className="size-3.5 drop-shadow" weight="bold" />
                  </div>
                </button>
              )}
            </div>

            {/* Active Tab Body */}
            <div className="p-3 text-xs text-stone-200 bg-stone-800/80 overflow-y-auto flex-1 max-h-[calc(85vh-120px)]">
              {activeTab === 'summary' && (
                <SummaryTab
                  plan={activePlan}
                  mapData={mapData}
                  selectedAirframe={selectedAirframe}
                  canEdit={canEdit}
                  onMutatePlan={onMutatePlan}
                  onSwitchTab={setActiveTab}
                  onAirframeSelectChange={handleAirframeSelectChange}
                  onColorChange={(c) => onSetSequenceColor(1, c)}
                />
              )}

              {activeTab === 'routes' && (
                <RoutesTab
                  plan={activePlan}
                  mapData={mapData}
                  selectedAirframe={selectedAirframe}
                  canEdit={canEdit}
                  unit={unit}
                  activeSequence={activeSequence}
                  setActiveSequence={setActiveSequence}
                  userCreatedSequences={userCreatedSequences}
                  onAddSequence={onAddSequence}
                  onDeleteSequence={onDeleteSequence}
                  sequenceColors={sequenceColors}
                  onSetSequenceColor={onSetSequenceColor}
                  onAddPointFromCoords={onAddPointFromCoords}
                  onApplyProcedure={onApplyProcedure}
                  onPanToPoint={(idx) => onPanToPoint(idx, true)}
                  onCenterMap={onCenterMap}
                  onReorderWaypoints={onReorderWaypoints}
                  onDeletePoint={onDeletePoint}
                  onSetWaypointSequence={onSetWaypointSequence}
                  onMutatePlan={onMutatePlan}
                  onNotify={onNotify}
                />
              )}

              {activeTab === 'targets' && (
                <TargetsTab
                  plan={activePlan}
                  mapData={mapData}
                  selectedAirframe={selectedAirframe}
                  canEdit={canEdit}
                  onAddTargetPoint={onAddTargetPoint}
                  onUpdateTarget={onUpdatePoint}
                  onDeleteTarget={onDeletePoint}
                  onPanToTarget={(idx) => onPanToPoint(idx, true)}
                  onNotify={onNotify}
                />
              )}

              {activeTab === 'loadouts' && hasStationLoadout && (
                <LoadoutTab
                  plan={activePlan}
                  mapData={mapData}
                  selectedAirframe={selectedAirframe}
                  canEdit={canEdit}
                  apiBaseUrl={baseUrl}
                  discordId={discordId}
                  token={authToken}
                  warehouse={warehouse}
                  loadingWarehouse={loadingWarehouse}
                  onRefreshWarehouse={() => void loadWarehouse(activePlan.departure_airfield)}
                  onLoadoutPresetsChange={onLoadoutPresetsChange}
                  onMutatePlan={onMutatePlan}
                  onNotify={onNotify}
                />
              )}

              {activeTab === 'comms' && (
                <CommsTab
                  plan={activePlan}
                  mapData={mapData}
                  selectedAirframe={selectedAirframe}
                  canEdit={canEdit}
                  apiBaseUrl={baseUrl}
                  discordId={discordId}
                  token={authToken}
                  onMutatePlan={onMutatePlan}
                  onNotify={onNotify}
                />
              )}

              {activeTab === 'mids' && hasMids && (
                <MidsTab
                  plan={activePlan}
                  mapData={mapData}
                  selectedAirframe={selectedAirframe}
                  canEdit={canEdit}
                  apiBaseUrl={baseUrl}
                  discordId={discordId}
                  token={authToken}
                  onMutatePlan={onMutatePlan}
                  onNotify={onNotify}
                />
              )}

              {activeTab === 'sa' && isF18 && (
                <F18SaTab
                  plan={activePlan}
                  mapData={mapData}
                  canEdit={canEdit}
                  activeDrawTarget={avionicsDrawTarget}
                  onSetDrawTarget={onSetAvionicsDrawTarget}
                  onMutatePlan={onMutatePlan}
                  onCenterMap={onCenterMap}
                  onNotify={onNotify}
                />
              )}

              {activeTab === 'geolines' && isF16 && (
                <F16GeoLinesTab
                  plan={activePlan}
                  mapData={mapData}
                  canEdit={canEdit}
                  activeDrawTarget={avionicsDrawTarget}
                  onSetDrawTarget={onSetAvionicsDrawTarget}
                  onMutatePlan={onMutatePlan}
                  onCenterMap={onCenterMap}
                  onNotify={onNotify}
                />
              )}

              {activeTab === 'destpts' && isF16 && (
                <F16DestPtsTab
                  plan={activePlan}
                  mapData={mapData}
                  canEdit={canEdit}
                  activeDrawTarget={avionicsDrawTarget}
                  onSetDrawTarget={onSetAvionicsDrawTarget}
                  onMutatePlan={onMutatePlan}
                  onCenterMap={onCenterMap}
                  onNotify={onNotify}
                />
              )}

              {activeTab === 'plotlines' && isF14 && (
                <F14PlotLinesTab
                  plan={activePlan}
                  mapData={mapData}
                  canEdit={canEdit}
                  activeDrawTarget={avionicsDrawTarget}
                  onSetDrawTarget={onSetAvionicsDrawTarget}
                  onMutatePlan={onMutatePlan}
                  onCenterMap={onCenterMap}
                  onNotify={onNotify}
                />
              )}

              {activeTab === 'additionalpts' && isF14 && (
                <F14AdditionalPtsTab
                  plan={activePlan}
                  canEdit={canEdit}
                  onAddAdditionalAtCenter={onAddAdditionalAtCenter}
                  onUpdatePoint={onUpdatePoint}
                  onDeletePoint={onDeletePoint}
                  onCenterMap={onCenterMap}
                />
              )}

              {activeTab === 'jf17airspace' && isJf17 && (
                <Jf17AirspaceTab
                  plan={activePlan}
                  mapData={mapData}
                  canEdit={canEdit}
                  activeDrawTarget={avionicsDrawTarget}
                  onSetDrawTarget={onSetAvionicsDrawTarget}
                  onMutatePlan={onMutatePlan}
                  onCenterMap={onCenterMap}
                  onExportJf17Lua={() => void handleExport('jf17_airspace')}
                  onNotify={onNotify}
                />
              )}

              {activeTab === 'cmds' && hasCmds && (
                <CmdsTab
                  plan={activePlan}
                  selectedAirframe={selectedAirframe}
                  canEdit={canEdit}
                  onMutatePlan={onMutatePlan}
                  onNotify={onNotify}
                />
              )}

              {activeTab === 'notes' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">
                      Remarks / Bingo / Joker
                    </label>
                    <textarea
                      rows={4}
                      disabled={!canEdit}
                      value={activePlan.remarks || ''}
                      onChange={(e) =>
                        onMutatePlan((p) => ({ ...p, remarks: e.target.value }))
                      }
                      placeholder="Enter mission remarks, joker/bingo fuel calls, frequencies, ROE..."
                      className="w-full rounded-md border border-stone-700 bg-stone-900 text-stone-200 text-xs p-2.5 focus:border-amber-400 focus:outline-none disabled:opacity-60"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">
                      Flight Plan Description &amp; Briefing Notes
                    </label>
                    <textarea
                      rows={6}
                      disabled={!canEdit}
                      value={activePlan.description || ''}
                      onChange={(e) =>
                        onMutatePlan((p) => ({ ...p, description: e.target.value }))
                      }
                      placeholder="Enter detailed flight plan briefing, package coordinator instructions, ingress/egress notes..."
                      className="w-full rounded-md border border-stone-700 bg-stone-900 text-stone-200 text-xs p-2.5 focus:border-amber-400 focus:outline-none disabled:opacity-60"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer Bar with Clear Route, Import DTC, Copy, Share, Delete, File/Refile ATC, Export */}
            <div className="px-3 py-2 bg-stone-950 border-t border-stone-800 flex justify-between items-center gap-2 shrink-0 flex-wrap">
              <div className="flex items-center gap-1.5">
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => setShowClearRouteModal(true)}
                    className="px-2.5 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold border border-red-500/30 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Trash className="size-3.5" weight="duotone" />
                    <span>Clear Route</span>
                  </button>
                )}

                {canDelete && (
                  <button
                    type="button"
                    onClick={() => setShowDeletePlanModal(true)}
                    title="Delete Flight Plan"
                    className="px-2 py-1 rounded bg-red-950/60 hover:bg-red-900/70 text-red-300 text-xs font-semibold border border-red-800/50 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Trash className="size-3.5" weight="bold" />
                    <span>Delete</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {mapData.permissions?.canCreateFlightPlan && (
                  <button
                    type="button"
                    onClick={() => setShowImportDtcModal(true)}
                    title="Import a new Flight Plan from DTC"
                    className="px-2.5 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold border border-stone-700 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <FileArrowUp className="size-3.5 text-stone-400" weight="duotone" />
                    <span>Import DTC</span>
                  </button>
                )}

                {mapData.permissions?.canCreateFlightPlan && (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void handleClonePlan()}
                    className="px-2.5 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold border border-stone-700 transition-colors flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                  >
                    <Copy className="size-3.5 text-stone-400" weight="bold" />
                    <span>Copy</span>
                  </button>
                )}



                <button
                  type="button"
                  disabled={isSendingAtc}
                  onClick={() => void handleFileWithAtc()}
                  title={activePlan.filed_at ? `Filed with ATC: ${activePlan.filed_at}` : 'File with ATC'}
                  className="px-3 py-1 rounded bg-sky-500 hover:bg-sky-400 text-stone-950 font-bold text-xs transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  <PaperPlaneTilt className="size-3.5" weight="bold" />
                  <span>
                    {isSendingAtc
                      ? 'Filing...'
                      : activePlan.filed_at
                        ? 'Refile with ATC'
                        : 'File with ATC'}
                  </span>
                </button>

                {/* Upward Export Dropdown */}
                <div ref={exportMenuRef} className="relative">
                  <button
                    type="button"
                    disabled={isExporting}
                    onClick={() => setExportMenuOpen((o) => !o)}
                    className="px-3 py-1 rounded bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
                  >
                    <ExportIcon className="size-3.5" weight="bold" />
                    <span>{isExporting ? 'Exporting...' : 'Export'}</span>
                    <CaretDown className="size-3" weight="bold" />
                  </button>

                  {exportMenuOpen && (
                    <div className="absolute bottom-full right-0 mb-2 min-w-max bg-stone-900 border border-stone-700 rounded-lg shadow-2xl z-50 overflow-hidden divide-y divide-stone-800">
                      <div className="p-1 flex flex-col gap-0.5">
                        <button
                          type="button"
                          onClick={() => void handleExport('pdf')}
                          className="text-left px-3 py-1.5 text-xs text-stone-300 hover:bg-stone-800 hover:text-white rounded transition-colors flex items-center justify-between gap-4 whitespace-nowrap cursor-pointer"
                        >
                          <span>PDF Document</span>
                          <FilePdf className="size-4 text-rose-400 shrink-0" weight="duotone" />
                        </button>

                        {isDtcCompat && (
                          <button
                            type="button"
                            onClick={() => void handleExport('dtc')}
                            className="text-left px-3 py-1.5 text-xs text-stone-300 hover:bg-stone-800 hover:text-white rounded transition-colors flex items-center justify-between gap-4 whitespace-nowrap cursor-pointer"
                          >
                            <span>DCS Data Transfer Cartridge</span>
                            <FloppyDiskBack
                              className="size-4 text-amber-400 shrink-0"
                              weight="duotone"
                            />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => void handleExport('dcs_route')}
                          className="text-left px-3 py-1.5 text-xs text-stone-300 hover:bg-stone-800 hover:text-white rounded transition-colors flex items-center justify-between gap-4 whitespace-nowrap cursor-pointer"
                        >
                          <span>DCS Route Tool</span>
                          <Path className="size-4 text-emerald-400 shrink-0" weight="duotone" />
                        </button>

                        {isJf17 && (
                          <button
                            type="button"
                            onClick={() => void handleExport('jf17_airspace')}
                            className="text-left px-3 py-1.5 text-xs text-stone-300 hover:bg-stone-800 hover:text-white rounded transition-colors flex items-center justify-between gap-4 whitespace-nowrap cursor-pointer"
                          >
                            <span>Custom Airspace File (.lua)</span>
                            <FileCode className="size-4 text-cyan-400 shrink-0" weight="duotone" />
                          </button>
                        )}

                        <div className="border-t border-stone-800 my-0.5" />

                        <button
                          type="button"
                          onClick={() => {
                            setExportMenuOpen(false);
                            void handleFileWithAtc();
                          }}
                          className="text-left px-3 py-1.5 text-xs text-sky-400 hover:bg-stone-800 hover:text-sky-300 rounded transition-colors flex items-center justify-between gap-4 font-medium whitespace-nowrap cursor-pointer"
                        >
                          <span>
                            {activePlan.filed_at
                              ? 'Refile with ATC (Discord)'
                              : 'File with ATC (Discord)'}
                          </span>
                          <PaperPlaneTilt
                            className="size-4 text-sky-400 shrink-0"
                            weight="duotone"
                          />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </FloatingToolWindow>
  );
};
