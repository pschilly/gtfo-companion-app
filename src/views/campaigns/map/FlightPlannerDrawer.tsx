import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AirplaneTilt,
  ArrowDown,
  ArrowsClockwise,
  ArrowUp,
  Broadcast,
  Check,
  CloudArrowUp,
  Copy,
  Crosshair,
  DownloadSimple,
  FilePdf,
  FloppyDisk,
  MagnifyingGlass,
  MapPin,
  Note,
  PaperPlaneTilt,
  Plus,
  Radio,
  ShieldWarning,
  Target,
  Trash,
  Wrench,
  X,
} from '@phosphor-icons/react';
import { useApp } from '../../../context/AppContext';
import {
  cloneCampaignFlightPlan,
  createCampaignFlightPlanDraft,
  deleteCampaignFlightPlan,
  deleteLoadoutPreset,
  fetchAirbaseWarehouse,
  fetchTerrainElevation,
  importCampaignDtcFlightPlan,
  pullCampaignAirfieldComms,
  pullCampaignDefaultComms,
  pullCampaignDefaultMids,
  saveCampaignFlightPlan,
  saveLoadoutPreset,
} from '../../../services/campaignMapService';
import { AirframeAvionicsPanel, AvionicsPlotTarget } from './AirframeAvionicsPanel';
import {
  downloadFlightPlanDcsRoute,
  downloadFlightPlanDtc,
  downloadFlightPlanJf17Airspace,
  fileFlightPlanWithAtc,
  getFlightPlanPdfUrl,
} from '../../../services/flightPlanService';
import {
  CampaignMapAirframeCatalogItem,
  CampaignMapFlightPlanBrief,
  CampaignMapLoadoutPreset,
  CampaignMapPayload,
  CampaignMapWarehouseInventory,
  FlightPlanCommsEntry,
  FlightPlanDetail,
  FlightPlanRoutePoint,
} from '../../../types';
import { FloatingToolWindow } from './FloatingToolWindow';
import {
  calculateBearingDegrees,
  calculateDistanceKm,
  calculateDistanceNm,
  casToTas,
  formatCoordinateDdm,
  formatDurationSeconds,
  getMagneticDeclination,
  toMgrs,
  trueToMagnetic,
} from './geodesy';

type PlannerTabId =
  | 'summary'
  | 'routes'
  | 'targets'
  | 'loadouts'
  | 'comms'
  | 'mids'
  | 'cmds'
  | 'drawings'
  | 'notes';

export type PlannerPlotMode = 'none' | 'waypoint' | 'target' | 'drawing_point';

interface FlightPlannerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  zIndex?: number;
  onFocus?: () => void;
  mapData: CampaignMapPayload;
  activePlan: FlightPlanDetail | null;
  onPlanChange: (updated: FlightPlanDetail | null) => void;
  onFlightPlansListChange: (nextList: {
    allPlans: CampaignMapFlightPlanBrief[];
    myPlans: CampaignMapFlightPlanBrief[];
  }) => void;
  onLoadoutPresetsChange: (presets: CampaignMapLoadoutPreset[]) => void;
  onSelectFlightPlan: (idOrIdentifier: number | string) => Promise<void>;
  plotMode: PlannerPlotMode;
  onSetPlotMode: (mode: PlannerPlotMode) => void;
  avionicsPlotTarget: AvionicsPlotTarget | null;
  onSetAvionicsPlotTarget: (target: AvionicsPlotTarget | null) => void;
  onCenterMap: (lat: number, lng: number, zoom?: number) => void;
  unit: 'nm' | 'km';
  apiBaseUrl: string;
  discordId?: string | null;
  token?: string | null;
  onNotify: (level: 'info' | 'success' | 'warning' | 'error', msg: string) => void;
}

const WAYPOINT_ACTIONS = [
  'Turning Point',
  'Fly Over Point',
  'Takeoff',
  'Landing',
  'IP',
  'TGT',
];

export const FlightPlannerDrawer: React.FC<FlightPlannerDrawerProps> = ({
  isOpen,
  onClose,
  zIndex = 1110,
  onFocus,
  mapData,
  activePlan,
  onPlanChange,
  onFlightPlansListChange,
  onLoadoutPresetsChange,
  onSelectFlightPlan,
  plotMode,
  onSetPlotMode,
  avionicsPlotTarget,
  onSetAvionicsPlotTarget,
  onCenterMap,
  unit,
  apiBaseUrl,
  discordId,
  token,
  onNotify,
}) => {
  const {
    settings,
    saveRouteToDcs,
    saveDtcCartridgeDirect,
    saveJf17AirspaceDirect,
    openPdfKneeboardViewer,
    syncFlightPlans,
  } = useApp();

  const [activeTab, setActiveTab] = useState<PlannerTabId>('summary');
  const [planFilter, setPlanFilter] = useState<'all' | 'mine' | 'blue' | 'red'>('all');
  const [planSearch, setPlanSearch] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Warehouse state for departure airbase
  const [warehouse, setWarehouse] = useState<CampaignMapWarehouseInventory | null>(null);
  const [loadingWarehouse, setLoadingWarehouse] = useState(false);

  // Preset modal inline state
  const [newPresetName, setNewPresetName] = useState('');
  const [showPresetForm, setShowPresetForm] = useState(false);
  const [selectedShipIdx, setSelectedShipIdx] = useState(0);
  const dtcFileInputRef = useRef<HTMLInputElement | null>(null);

  // Track plan identity changes so dirty resets on switch
  useEffect(() => {
    setIsDirty(false);
    setConfirmDelete(false);
  }, [activePlan?.id]);

  const handleImportDtcFile = async (file: File) => {
    setIsBusy(true);
    try {
      const dtcJson = await file.text();
      const res = await importCampaignDtcFlightPlan(
        apiBaseUrl,
        mapData.campaign.id,
        {
          dtc_json: dtcJson,
          airframe_id: activePlan?.airframe_id ?? null,
        },
        { discordId, token }
      );
      onFlightPlansListChange(res.flightPlans);
      onPlanChange(res.plan);
      setIsDirty(false);
      onNotify('success', `Imported DTC plan "${res.plan.callsign || res.plan.name || res.plan.identifier}".`);
      void syncFlightPlans();
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to parse or import DTC file.');
    } finally {
      setIsBusy(false);
      if (dtcFileInputRef.current) dtcFileInputRef.current.value = '';
    }
  };

  const handlePullDefaultComms = async () => {
    if (!activePlan) return;
    setIsBusy(true);
    try {
      const comms = await pullCampaignDefaultComms(
        apiBaseUrl,
        mapData.campaign.id,
        {
          airframe_id: activePlan.airframe_id,
          mission_id: activePlan.mission_id,
          departure_airfield: activePlan.departure_airfield,
          destination_airfield: activePlan.destination_airfield,
          diverts: activePlan.diverts,
        },
        { discordId, token }
      );
      onPlanChange({
        ...activePlan,
        comm1: Array.isArray(comms.comm1) ? comms.comm1 : activePlan.comm1,
        comm2: Array.isArray(comms.comm2) ? comms.comm2 : activePlan.comm2,
      });
      setIsDirty(true);
      onNotify('success', 'Loaded default airframe/mission COMM presets.');
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to pull default comms.');
    } finally {
      setIsBusy(false);
    }
  };

  const handlePullAirfieldComms = async (radioKey: 'comm1' | 'comm2') => {
    if (!activePlan) return;
    setIsBusy(true);
    try {
      const depAb = (mapData.airbases || []).find(
        (ab) =>
          ab.name.trim().toLowerCase() === (activePlan.departure_airfield || '').trim().toLowerCase()
      );
      const channels = await pullCampaignAirfieldComms(
        apiBaseUrl,
        mapData.campaign.id,
        {
          radio_key: radioKey,
          airframe_id: activePlan.airframe_id,
          airbase_id: depAb?.id ?? null,
          departure_airfield: activePlan.departure_airfield,
          destination_airfield: activePlan.destination_airfield,
          diverts: activePlan.diverts,
          include_dcs: false,
        },
        { discordId, token }
      );
      onPlanChange({
        ...activePlan,
        [radioKey]: channels,
      });
      setIsDirty(true);
      onNotify('success', `Updated ${radioKey.toUpperCase()} with campaign airfield frequencies.`);
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to pull airfield frequencies.');
    } finally {
      setIsBusy(false);
    }
  };

  const handlePullDefaultMids = async () => {
    if (!activePlan) return;
    setIsBusy(true);
    try {
      const mids = await pullCampaignDefaultMids(
        apiBaseUrl,
        mapData.campaign.id,
        activePlan.airframe_id,
        { discordId, token }
      );
      onPlanChange({
        ...activePlan,
        mids_settings: {
          ...(activePlan.mids_settings || {}),
          ...mids,
        },
      });
      setIsDirty(true);
      onNotify('success', 'Loaded default MIDS / Link-16 configuration.');
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to pull default MIDS settings.');
    } finally {
      setIsBusy(false);
    }
  };

  // Load departure airbase warehouse stock when departure airbase changes
  useEffect(() => {
    let active = true;
    const dep = activePlan?.departure_airfield;
    if (!isOpen || !dep) {
      setWarehouse(null);
      return;
    }
    setLoadingWarehouse(true);
    fetchAirbaseWarehouse(apiBaseUrl, mapData.campaign.id, dep, { discordId, token })
      .then((res) => {
        if (active) setWarehouse(res);
      })
      .catch(() => {
        if (active) setWarehouse(null);
      })
      .finally(() => {
        if (active) setLoadingWarehouse(false);
      });
    return () => {
      active = false;
    };
  }, [isOpen, activePlan?.departure_airfield, mapData.campaign.id, apiBaseUrl, discordId, token]);

  const selectedAirframe: CampaignMapAirframeCatalogItem | null = useMemo(() => {
    if (!activePlan) return null;
    return (
      mapData.airframesCatalog.find((af) => af.id === activePlan.airframe_id) ||
      mapData.airframesCatalog[0] ||
      null
    );
  }, [activePlan, mapData.airframesCatalog]);

  const filteredPlans = useMemo(() => {
    const source =
      planFilter === 'mine' ? mapData.flightPlans.myPlans : mapData.flightPlans.allPlans;
    return source.filter((fp) => {
      if (planFilter === 'blue' && fp.is_opfor) return false;
      if (planFilter === 'red' && !fp.is_opfor) return false;
      if (!planSearch.trim()) return true;
      const q = planSearch.toLowerCase();
      return (
        (fp.callsign || '').toLowerCase().includes(q) ||
        (fp.name || '').toLowerCase().includes(q) ||
        fp.identifier.toLowerCase().includes(q) ||
        (fp.airframe_abbr || fp.airframe_name || '').toLowerCase().includes(q) ||
        (fp.creator_name || '').toLowerCase().includes(q)
      );
    });
  }, [mapData.flightPlans, planFilter, planSearch]);

  const selectedMission = useMemo(() => {
    if (!activePlan?.mission_id) return null;
    return mapData.missions.find((m) => m.id === activePlan.mission_id) || null;
  }, [activePlan?.mission_id, mapData.missions]);

  const mutatePlan = (updater: (prev: FlightPlanDetail) => FlightPlanDetail) => {
    if (!activePlan) return;
    onPlanChange(updater(activePlan));
    setIsDirty(true);
  };

  if (!isOpen) return null;

  const canEdit = Boolean(activePlan?.can_edit ?? mapData.permissions.canManageFlightPlans);
  const canDelete = Boolean(activePlan?.can_delete);

  const handleCreateDraft = async () => {
    if (!mapData.permissions.canCreateFlightPlan) {
      onNotify('warning', 'You do not have permission to create flight plans.');
      return;
    }
    setIsBusy(true);
    try {
      const res = await createCampaignFlightPlanDraft(
        apiBaseUrl,
        mapData.campaign.id,
        {},
        { discordId, token }
      );
      onFlightPlansListChange(res.flightPlans);
      onPlanChange(res.plan);
      setIsDirty(false);
      onNotify('success', `Created new draft ${res.plan.identifier}`);
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to create draft flight plan.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleClone = async () => {
    if (!activePlan) return;
    setIsBusy(true);
    try {
      const res = await cloneCampaignFlightPlan(
        apiBaseUrl,
        mapData.campaign.id,
        activePlan.id,
        { discordId, token }
      );
      onFlightPlansListChange(res.flightPlans);
      onPlanChange(res.plan);
      setIsDirty(false);
      onNotify('success', `Cloned into ${res.plan.identifier}`);
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to clone flight plan.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!activePlan || !canDelete) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setIsBusy(true);
    try {
      await deleteCampaignFlightPlan(apiBaseUrl, activePlan.id, { discordId, token });
      const remainingAll = mapData.flightPlans.allPlans.filter((p) => p.id !== activePlan.id);
      const remainingMine = mapData.flightPlans.myPlans.filter((p) => p.id !== activePlan.id);
      onFlightPlansListChange({ allPlans: remainingAll, myPlans: remainingMine });
      onPlanChange(null);
      setIsDirty(false);
      setConfirmDelete(false);
      onNotify('info', `Deleted ${activePlan.identifier}`);
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to delete flight plan.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleSave = async (): Promise<FlightPlanDetail | null> => {
    if (!activePlan) return null;
    setIsBusy(true);
    try {
      const stations = activePlan.station_loadout || (activePlan.metadata?.stations as any) || {};
      const payload: Record<string, unknown> = {
        name: activePlan.name || activePlan.callsign,
        callsign: activePlan.callsign || activePlan.name,
        color: activePlan.color,
        airframe_id: activePlan.airframe_id,
        tasking_id: activePlan.tasking_id,
        mission_id: activePlan.mission_id,
        sortie_id: activePlan.sortie_id,
        is_opfor: activePlan.is_opfor,
        flight_rules: activePlan.flight_rules,
        coordinate_format: activePlan.coordinate_format,
        launch_time: activePlan.launch_time,
        departure_airfield: activePlan.departure_airfield,
        destination_airfield: activePlan.destination_airfield,
        diverts: activePlan.diverts,
        fuel_amount: activePlan.fuel_amount,
        remarks: activePlan.remarks,
        description: activePlan.description,
        route_points: activePlan.route_points || [],
        stations,
        gun: activePlan.gun_loadout,
        countermeasures: activePlan.countermeasures_loadout,
        comm1: activePlan.comm1 || [],
        comm2: activePlan.comm2 || [],
        mids: activePlan.mids_settings || {},
        cmds: activePlan.cmds_settings || {},
        sa: activePlan.sa_settings || {},
        geo_lines: activePlan.geo_lines_settings || {},
        dest_pts: activePlan.dest_points_settings ?? [],
        f14_plot_lines: activePlan.f14_plot_lines_settings || {},
        jf17_airspace: activePlan.jf17_airspace_settings || {},
        overhead_pattern: activePlan.overhead_pattern || null,
      };
      const res = await saveCampaignFlightPlan(apiBaseUrl, activePlan.id, payload, {
        discordId,
        token,
      });
      onPlanChange(res.plan);
      setIsDirty(false);
      // Reflect updated brief in list
      const patchBrief = (list: CampaignMapFlightPlanBrief[]) =>
        list.map((b) =>
          b.id === res.plan.id
            ? {
                ...b,
                name: res.plan.name,
                callsign: res.plan.callsign,
                airframe_id: res.plan.airframe_id,
                airframe_name: res.plan.airframe?.name ?? b.airframe_name,
                airframe_abbr: res.plan.airframe?.abbreviation ?? b.airframe_abbr,
                mission_id: res.plan.mission_id,
                sortie_id: res.plan.sortie_id,
                is_opfor: res.plan.is_opfor,
                is_filed: res.plan.is_filed,
                color: res.plan.color,
                route_points: res.plan.route_points || [],
                points_count: (res.plan.route_points || []).length,
                has_plan: (res.plan.route_points || []).length > 0,
              }
            : b
        );
      onFlightPlansListChange({
        allPlans: patchBrief(mapData.flightPlans.allPlans),
        myPlans: patchBrief(mapData.flightPlans.myPlans),
      });
      onNotify('success', `Saved ${res.plan.identifier}`);
      void syncFlightPlans();
      return res.plan;
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to save flight plan.');
      return null;
    } finally {
      setIsBusy(false);
    }
  };

  const handleFileAtc = async () => {
    if (!activePlan) return;
    if (isDirty) {
      const saved = await handleSave();
      if (!saved) return;
    }
    setIsBusy(true);
    try {
      const res = await fileFlightPlanWithAtc(
        apiBaseUrl,
        activePlan.id,
        discordId || undefined,
        token || undefined
      );
      if (res.plan) {
        onPlanChange({ ...activePlan, ...(res.plan as any), is_filed: true });
      } else {
        onPlanChange({ ...activePlan, is_filed: true });
      }
      onNotify('success', res.message || `Filed ${activePlan.identifier} with ATC`);
      void syncFlightPlans();
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to file flight plan with ATC.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleDeployDtc = async () => {
    if (!activePlan) return;
    if (isDirty) {
      const saved = await handleSave();
      if (!saved) return;
    }
    setIsBusy(true);
    try {
      const res = await downloadFlightPlanDtc(
        apiBaseUrl,
        activePlan.id,
        token || undefined
      );
      if (!res.success || !res.rawText) {
        throw new Error(res.error || 'DTC export failed.');
      }
      const cleanName = (activePlan.callsign || activePlan.identifier).replace(/[^a-zA-Z0-9_-]/g, '_');
      const path = await saveDtcCartridgeDirect(`${cleanName}_${activePlan.identifier}.dtc`, res.rawText);
      onNotify('success', `DTC Cartridge installed to ${path}`);
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to install DTC cartridge.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleDeployRouteLua = async () => {
    if (!activePlan) return;
    if (isDirty) {
      const saved = await handleSave();
      if (!saved) return;
    }
    setIsBusy(true);
    try {
      const lua = await downloadFlightPlanDcsRoute(
        apiBaseUrl,
        activePlan.id,
        activePlan,
        token || undefined
      );
      const theatre = mapData.campaign.theatre || activePlan.campaign?.theatre || 'Syria';
      const result = await saveRouteToDcs(theatre, lua);
      onNotify('success', `DCS Route installed (${result.action}) to ${result.filePath}`);
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to install DCS Route preset.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleDeployJf17 = async () => {
    if (!activePlan) return;
    if (isDirty) {
      const saved = await handleSave();
      if (!saved) return;
    }
    setIsBusy(true);
    try {
      const res = await downloadFlightPlanJf17Airspace(
        apiBaseUrl,
        activePlan.id,
        activePlan,
        token || undefined
      );
      if (!res.success || !res.content) {
        throw new Error(res.error || 'Failed to build JF-17 Custom Airspace.');
      }
      const path = await saveJf17AirspaceDirect(res.fileName, res.content);
      onNotify('success', `JF-17 Custom Airspace installed to ${path}`);
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to install JF-17 Custom Airspace.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleOpenKneeboard = async () => {
    if (!activePlan) return;
    const url = getFlightPlanPdfUrl(apiBaseUrl, activePlan.id);
    try {
      await openPdfKneeboardViewer(url, `${activePlan.identifier}_Kneeboard.pdf`);
    } catch (err: any) {
      onNotify('error', err?.message || 'Unable to open PDF Kneeboard.');
    }
  };

  // --- Computed legs & ETE for Routes Tab ---
  const routePoints = activePlan?.route_points || [];
  let totalDistNm = 0;
  let totalDistKm = 0;
  let totalSeconds = 0;

  const computedLegs = routePoints.map((wp, idx) => {
    if (idx === 0) {
      return { headingMag: '---', headingTrue: '---', legNm: 0, legKm: 0, cumNm: 0, cumKm: 0, ete: '00:00' };
    }
    const prev = routePoints[idx - 1];
    const distNm = calculateDistanceNm(prev.lat, prev.lng, wp.lat, wp.lng);
    const distKm = calculateDistanceKm(prev.lat, prev.lng, wp.lat, wp.lng);
    totalDistNm += distNm;
    totalDistKm += distKm;
    const hdgT = Math.round(calculateBearingDegrees(prev.lat, prev.lng, wp.lat, wp.lng)) % 360;
    const decl = getMagneticDeclination(
      prev.lat,
      prev.lng,
      mapData.campaign.campaignDate,
      mapData.campaign.magneticDeclination
    );
    const hdgM = trueToMagnetic(hdgT, decl);
    const tas = casToTas(wp.speed || 350, wp.alt || 20000);
    const legSecs = tas > 0 ? (distNm / tas) * 3600 : 0;
    totalSeconds += legSecs;
    return {
      headingMag: `${String(hdgM === 0 ? 360 : hdgM).padStart(3, '0')}°M`,
      headingTrue: `${String(hdgT === 0 ? 360 : hdgT).padStart(3, '0')}°T`,
      legNm: distNm,
      legKm: distKm,
      cumNm: totalDistNm,
      cumKm: totalDistKm,
      ete: formatDurationSeconds(legSecs),
    };
  });

  const targetWaypoints = routePoints
    .map((wp, idx) => ({ wp, idx }))
    .filter(({ wp }) => (wp.action || '').toUpperCase() === 'TGT' || (wp.type || '').toUpperCase() === 'TGT');

  const moveWaypoint = (idx: number, dir: -1 | 1) => {
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= routePoints.length) return;
    mutatePlan((prev) => {
      const next = [...(prev.route_points || [])];
      const [moved] = next.splice(idx, 1);
      next.splice(nextIdx, 0, moved);
      return {
        ...prev,
        route_points: next.map((p, i) => ({ ...p, index: i })),
      };
    });
  };

  const updateWaypoint = (idx: number, patch: Partial<FlightPlanRoutePoint>) => {
    mutatePlan((prev) => ({
      ...prev,
      route_points: (prev.route_points || []).map((p, i) => (i === idx ? { ...p, ...patch } : p)),
    }));
  };

  const deleteWaypoint = (idx: number) => {
    mutatePlan((prev) => ({
      ...prev,
      route_points: (prev.route_points || [])
        .filter((_, i) => i !== idx)
        .map((p, i) => ({ ...p, index: i })),
    }));
  };

  const addQuickWaypointAtCenter = async () => {
    if (!activePlan) return;
    const lat = mapData.campaign.center.lat;
    const lng = mapData.campaign.center.lng;
    const elev = await fetchTerrainElevation(apiBaseUrl, lat, lng, token || undefined);
    mutatePlan((prev) => {
      const existing = prev.route_points || [];
      const nextWp: FlightPlanRoutePoint = {
        index: existing.length,
        name: `WP${String(existing.length + 1).padStart(2, '0')}`,
        lat,
        lng,
        alt: elev ? Math.max(15000, elev + 5000) : 20000,
        speed: 350,
        action: existing.length === 0 ? 'Takeoff' : 'Turning Point',
        mgrs: toMgrs(lat, lng, 5),
      };
      return { ...prev, route_points: [...existing, nextWp] };
    });
  };

  // Loadout stations helper
  const stationConfigEntries = (() => {
    const raw = selectedAirframe?.loadout_config?.stations;
    if (!raw || typeof raw !== 'object') return [];
    return Object.entries(raw);
  })();

  const currentStationLoadout: Record<string, string> =
    (activePlan?.station_loadout as Record<string, string>) || {};

  const getWarehouseStockLabel = (munitionName: string): { text: string; tone: string } | null => {
    if (!warehouse) return null;
    if (warehouse.is_unlimited) {
      return { text: 'UNLIMITED', tone: 'text-emerald-400' };
    }
    const weapons = warehouse.weapons;
    if (Array.isArray(weapons)) {
      const found = weapons.find(
        (w: any) =>
          (w.name || w.item || '').toLowerCase() === munitionName.toLowerCase()
      );
      if (found) {
        const qty = Number(found.amount ?? found.quantity ?? 0);
        return qty > 0
          ? { text: `${qty} AVAIL`, tone: 'text-emerald-400' }
          : { text: 'OUT OF STOCK', tone: 'text-red-400' };
      }
      return null;
    }
    const key = Object.keys(weapons).find((k) => k.toLowerCase() === munitionName.toLowerCase());
    if (!key) return null;
    const qty = Number((weapons as Record<string, number>)[key] ?? 0);
    return qty > 0
      ? { text: `${qty} AVAIL`, tone: 'text-emerald-400' }
      : { text: 'OUT OF STOCK', tone: 'text-red-400' };
  };

  const applyLoadoutPreset = (preset: CampaignMapLoadoutPreset) => {
    mutatePlan((prev) => ({
      ...prev,
      station_loadout: { ...((preset.stations as Record<string, string>) || {}) },
      gun_loadout: preset.gun ?? prev.gun_loadout,
      countermeasures_loadout: preset.countermeasures ?? prev.countermeasures_loadout,
    }));
    onNotify('info', `Applied loadout preset "${preset.name}"`);
  };

  const handleSavePreset = async () => {
    if (!newPresetName.trim() || !activePlan) return;
    setIsBusy(true);
    try {
      const next = await saveLoadoutPreset(
        apiBaseUrl,
        {
          name: newPresetName.trim(),
          airframe_id: activePlan.airframe_id,
          stations: activePlan.station_loadout || {},
          gun: activePlan.gun_loadout,
          countermeasures: activePlan.countermeasures_loadout,
        },
        { discordId, token }
      );
      onLoadoutPresetsChange(next);
      setNewPresetName('');
      setShowPresetForm(false);
      onNotify('success', 'Saved personal loadout preset.');
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to save loadout preset.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleDeletePreset = async (presetId: number) => {
    setIsBusy(true);
    try {
      const next = await deleteLoadoutPreset(apiBaseUrl, presetId, { discordId, token });
      onLoadoutPresetsChange(next);
      onNotify('info', 'Removed loadout preset.');
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to delete preset.');
    } finally {
      setIsBusy(false);
    }
  };

  // Comms helpers
  const comm1List: FlightPlanCommsEntry[] = Array.isArray(activePlan?.comm1) ? activePlan.comm1 : [];
  const comm2List: FlightPlanCommsEntry[] = Array.isArray(activePlan?.comm2) ? activePlan.comm2 : [];

  const updateCommList = (radio: 'comm1' | 'comm2', next: FlightPlanCommsEntry[]) => {
    mutatePlan((prev) => ({
      ...prev,
      [radio]: next,
    }));
  };

  return (
    <FloatingToolWindow
      title={`Flight Planner ${activePlan ? `— ${activePlan.identifier}` : ''}`}
      subtitle={
        activePlan
          ? `${activePlan.callsign || activePlan.name || 'Unnamed Flight'} · ${
              activePlan.airframe?.abbreviation || activePlan.airframe?.name || 'Airframe Unset'
            }`
          : `${mapData.flightPlans.allPlans.length} Visible Plans in Campaign`
      }
      icon={<AirplaneTilt className="w-4 h-4 text-amber-400 shrink-0" weight="duotone" />}
      badge={
        isDirty ? (
          <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold">
            UNSAVED
          </span>
        ) : undefined
      }
      isOpen={isOpen}
      onClose={onClose}
      initialPos={{ x: 40, y: 74 }}
      widthClass="w-[465px] max-w-[95vw]"
      zIndex={zIndex}
      onFocus={onFocus}
    >
      {/* Flight Selector + CRUD Action Strip */}
      <div className="p-3 border-b border-stone-800/70 bg-stone-900/40 space-y-2.5">
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <MagnifyingGlass className="w-3.5 h-3.5 text-stone-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={planSearch}
              onChange={(e) => setPlanSearch(e.target.value)}
              placeholder="Search callsign, FP-ID, pilot..."
              className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-stone-950 border border-stone-800 text-xs text-stone-100 placeholder:text-stone-600 focus:outline-none focus:border-amber-500/60"
            />
          </div>
          <div className="flex items-center bg-stone-950 border border-stone-800 rounded-lg p-0.5 text-[10px] font-semibold">
            {(['all', 'mine', 'blue', 'red'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setPlanFilter(f)}
                className={`px-2 py-1 rounded uppercase ${
                  planFilter === f
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                {f === 'blue' ? 'BLU' : f === 'red' ? 'RED' : f}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <select
            value={activePlan?.id ?? ''}
            onChange={(e) => {
              if (e.target.value) void onSelectFlightPlan(Number(e.target.value));
            }}
            className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-stone-950 border border-stone-800 text-xs text-stone-100 focus:outline-none focus:border-amber-500/60"
          >
            <option value="">-- Select Flight Plan ({filteredPlans.length}) --</option>
            {filteredPlans.map((fp) => (
              <option key={fp.id} value={fp.id}>
                [{fp.is_opfor ? 'RED' : 'BLU'}] {fp.callsign || fp.name || fp.identifier} (
                {fp.airframe_abbr || 'N/A'}) {fp.is_filed ? '✓ ATC' : ''} ·{' '}
                {fp.creator_name || 'Member'}
              </option>
            ))}
          </select>

          {mapData.permissions.canCreateFlightPlan && (
            <>
              <input
                ref={dtcFileInputRef}
                type="file"
                accept=".dtc,.json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleImportDtcFile(file);
                }}
              />
              <button
                type="button"
                onClick={() => dtcFileInputRef.current?.click()}
                disabled={isBusy}
                className="px-2 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/50 text-indigo-300 text-xs font-semibold flex items-center gap-1 shrink-0 disabled:opacity-50 cursor-pointer"
                title="Import Flight Plan from DTC (.dtc / .json)"
              >
                <CloudArrowUp className="w-3.5 h-3.5" />
                DTC
              </button>
              <button
                onClick={handleCreateDraft}
                disabled={isBusy}
                className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 text-xs font-semibold flex items-center gap-1 shrink-0 disabled:opacity-50"
                title="Create New Flight Plan Draft"
              >
                <Plus className="w-3.5 h-3.5" />
                New
              </button>
            </>
          )}
        </div>

        {activePlan && (
          <div className="flex flex-wrap items-center gap-1.5">
            {canEdit && (
              <button
                onClick={handleSave}
                disabled={isBusy}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 border transition ${
                  isDirty
                    ? 'bg-emerald-500/25 border-emerald-500/60 text-emerald-300 hover:bg-emerald-500/35'
                    : 'bg-stone-900 border-stone-700 text-stone-200 hover:border-stone-500'
                }`}
              >
                <FloppyDisk className="w-3.5 h-3.5" />
                Save
              </button>
            )}

            <button
              onClick={handleFileAtc}
              disabled={isBusy || (!canEdit && activePlan.is_filed)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 border transition ${
                activePlan.is_filed
                  ? 'bg-sky-500/20 border-sky-500/50 text-sky-300'
                  : 'bg-stone-900 border-stone-700 text-stone-200 hover:border-sky-500/50 hover:text-sky-300'
              }`}
            >
              <PaperPlaneTilt className="w-3.5 h-3.5" />
              {activePlan.is_filed ? 'Re-File ATC' : 'File ATC'}
            </button>

            {mapData.permissions.canCreateFlightPlan && (
              <button
                onClick={handleClone}
                disabled={isBusy}
                className="px-2 py-1 rounded-lg bg-stone-900 border border-stone-700 text-stone-300 hover:text-stone-100 text-[11px] font-semibold flex items-center gap-1"
                title="Clone as My Draft"
              >
                <Copy className="w-3.5 h-3.5" />
                Clone
              </button>
            )}

            {canDelete && (
              <button
                onClick={handleDelete}
                disabled={isBusy}
                className={`px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 border ${
                  confirmDelete
                    ? 'bg-red-500/30 border-red-500 text-red-200'
                    : 'bg-stone-900 border-stone-700 text-stone-400 hover:text-red-400 hover:border-red-500/50'
                }`}
              >
                <Trash className="w-3.5 h-3.5" />
                {confirmDelete ? 'Confirm?' : 'Delete'}
              </button>
            )}

            <div className="flex-1" />

            {/* 1-Click Deploy Buttons */}
            {(activePlan.is_dtc_compatible || selectedAirframe?.is_dtc_compatible) && (
              <button
                onClick={handleDeployDtc}
                disabled={isBusy}
                className="px-2 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/50 text-indigo-300 text-[10px] font-bold flex items-center gap-1"
                title="1-Click Install DTC Cartridge to Saved Games"
              >
                <CloudArrowUp className="w-3 h-3" />
                DTC
              </button>
            )}
            <button
              onClick={handleDeployRouteLua}
              disabled={isBusy}
              className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 text-[10px] font-bold flex items-center gap-1"
              title="1-Click Install DCS RouteToolPreset Lua"
            >
              <DownloadSimple className="w-3 h-3" />
              Route
            </button>
            {(activePlan.is_jf17 || selectedAirframe?.is_jf17) && (
              <button
                onClick={handleDeployJf17}
                disabled={isBusy}
                className="px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-emerald-300 text-[10px] font-bold flex items-center gap-1"
                title="1-Click Install JF-17 Custom Airspace Lua"
              >
                <DownloadSimple className="w-3 h-3" />
                JF-17
              </button>
            )}
            <button
              onClick={handleOpenKneeboard}
              className="px-2 py-1 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-200 text-[10px] font-bold flex items-center gap-1"
              title="Open PDF Kneeboard Packet"
            >
              <FilePdf className="w-3 h-3 text-red-400" />
              PDF
            </button>
          </div>
        )}

        {activePlan && canEdit && (
          <div className="flex items-center gap-1.5 pt-1 border-t border-stone-800/60">
            <button
              onClick={() => onSetPlotMode(plotMode === 'waypoint' ? 'none' : 'waypoint')}
              className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-semibold border flex items-center justify-center gap-1 transition ${
                plotMode === 'waypoint'
                  ? 'bg-amber-500/25 border-amber-500 text-amber-200'
                  : 'bg-stone-950 border-stone-800 text-stone-300 hover:border-stone-600'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              {plotMode === 'waypoint' ? 'Click Map to Add WP' : 'Plot Steerpoint'}
            </button>

            <button
              onClick={() => onSetPlotMode(plotMode === 'target' ? 'none' : 'target')}
              className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-semibold border flex items-center justify-center gap-1 transition ${
                plotMode === 'target'
                  ? 'bg-red-500/25 border-red-500 text-red-200'
                  : 'bg-stone-950 border-stone-800 text-stone-300 hover:border-stone-600'
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              {plotMode === 'target' ? 'Click Map for TGT' : 'Plot Target DMPI'}
            </button>
          </div>
        )}
      </div>

      {/* Main Content */}
      {!activePlan ? (
        <div className="p-6 text-center space-y-3 text-xs text-stone-400">
          <AirplaneTilt className="w-10 h-10 text-stone-600 mx-auto" />
          <p className="leading-relaxed">
            Select an existing campaign flight plan from the dropdown above, or click{' '}
            <span className="text-amber-400 font-semibold">New</span> to create a draft flight plan
            directly on the tactical map.
          </p>
        </div>
      ) : (
        <>
          {/* Section Tabs */}
          <div className="px-2 pt-2 border-b border-stone-800 flex items-center gap-1 overflow-x-auto bg-stone-950/40 shrink-0">
            {(
              [
                { id: 'summary', label: 'Summary' },
                { id: 'routes', label: `Route (${routePoints.length})` },
                { id: 'targets', label: `Targets (${targetWaypoints.length})` },
                { id: 'loadouts', label: 'Loadout' },
                { id: 'comms', label: 'Comms' },
                { id: 'mids', label: 'MIDS' },
                { id: 'cmds', label: 'CMDS' },
                { id: 'drawings', label: 'Avionics' },
                { id: 'notes', label: 'Notes' },
              ] as Array<{ id: PlannerTabId; label: string }>
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-t-lg whitespace-nowrap border-b-2 transition ${
                  activeTab === tab.id
                    ? 'text-amber-300 border-amber-400 bg-stone-900/80'
                    : 'text-stone-400 border-transparent hover:text-stone-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-3.5 overflow-y-auto flex-1 space-y-3 text-xs">
            {/* SUMMARY TAB */}
            {activeTab === 'summary' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-stone-400 font-semibold mb-1">
                      Callsign / Flight Name
                    </label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={activePlan.callsign || activePlan.name || ''}
                      onChange={(e) =>
                        mutatePlan((p) => ({
                          ...p,
                          callsign: e.target.value,
                          name: e.target.value,
                        }))
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-stone-950 border border-stone-800 text-stone-100 disabled:opacity-60"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-stone-400 font-semibold mb-1">
                      Airframe
                    </label>
                    <select
                      disabled={!canEdit}
                      value={activePlan.airframe_id ?? ''}
                      onChange={(e) => {
                        const afId = e.target.value ? Number(e.target.value) : null;
                        const af = mapData.airframesCatalog.find((a) => a.id === afId);
                        mutatePlan((p) => ({
                          ...p,
                          airframe_id: afId,
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
                          is_jf17: af?.is_jf17,
                          has_cmds: af?.has_cmds,
                          has_mids: af?.has_mids,
                        }));
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-stone-950 border border-stone-800 text-stone-100 disabled:opacity-60"
                    >
                      <option value="">-- Select Airframe --</option>
                      {mapData.airframesCatalog.map((af) => (
                        <option key={af.id} value={af.id}>
                          {af.abbreviation} — {af.name} {af.is_qualified ? '★' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-stone-400 font-semibold mb-1">
                      Mission Assignment
                    </label>
                    <select
                      disabled={!canEdit}
                      value={activePlan.mission_id ?? ''}
                      onChange={(e) => {
                        const mId = e.target.value ? Number(e.target.value) : null;
                        mutatePlan((p) => ({ ...p, mission_id: mId, sortie_id: null }));
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-stone-950 border border-stone-800 text-stone-100 disabled:opacity-60"
                    >
                      <option value="">Standalone / Unassigned</option>
                      {mapData.missions.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-stone-400 font-semibold mb-1">
                      Sortie
                    </label>
                    <select
                      disabled={!canEdit || !selectedMission}
                      value={activePlan.sortie_id ?? ''}
                      onChange={(e) =>
                        mutatePlan((p) => ({
                          ...p,
                          sortie_id: e.target.value ? Number(e.target.value) : null,
                        }))
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-stone-950 border border-stone-800 text-stone-100 disabled:opacity-60"
                    >
                      <option value="">-- Any Sortie --</option>
                      {(selectedMission?.sorties || []).map((s) => (
                        <option key={s.id} value={s.id}>
                          Sortie {s.sortie_number}: {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-stone-400 font-semibold mb-1">
                      Tasking Role
                    </label>
                    <select
                      disabled={!canEdit}
                      value={activePlan.tasking_id ?? ''}
                      onChange={(e) =>
                        mutatePlan((p) => ({
                          ...p,
                          tasking_id: e.target.value ? Number(e.target.value) : null,
                        }))
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-stone-950 border border-stone-800 text-stone-100 disabled:opacity-60"
                    >
                      <option value="">General</option>
                      {mapData.taskings.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-stone-400 font-semibold mb-1">
                      Coalition &amp; Route Color
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        disabled={!canEdit || !mapData.permissions.canManageBothCoalitions}
                        value={activePlan.is_opfor ? 'red' : 'blue'}
                        onChange={(e) =>
                          mutatePlan((p) => ({
                            ...p,
                            is_opfor: e.target.value === 'red',
                            color: e.target.value === 'red' ? '#ef4444' : '#3b82f6',
                          }))
                        }
                        className="flex-1 px-2.5 py-1.5 rounded-lg bg-stone-950 border border-stone-800 text-stone-100 disabled:opacity-60"
                      >
                        <option value="blue">BLUFOR</option>
                        <option value="red">OPFOR (RED)</option>
                      </select>
                      <input
                        type="color"
                        disabled={!canEdit}
                        value={activePlan.color || '#3b82f6'}
                        onChange={(e) => mutatePlan((p) => ({ ...p, color: e.target.value }))}
                        className="w-9 h-8 rounded bg-stone-950 border border-stone-800 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-stone-400 font-semibold mb-1">
                      Departure Airbase
                    </label>
                    <select
                      disabled={!canEdit}
                      value={activePlan.departure_airfield || ''}
                      onChange={(e) =>
                        mutatePlan((p) => ({ ...p, departure_airfield: e.target.value || null }))
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-stone-950 border border-stone-800 text-stone-100 disabled:opacity-60"
                    >
                      <option value="">-- Select Airbase --</option>
                      {mapData.airbases.map((ab) => (
                        <option key={`${ab.name}-${ab.lat}`} value={ab.name}>
                          {ab.name} ({ab.coalition.toUpperCase()})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-stone-400 font-semibold mb-1">
                      Recovery / Destination
                    </label>
                    <select
                      disabled={!canEdit}
                      value={activePlan.destination_airfield || ''}
                      onChange={(e) =>
                        mutatePlan((p) => ({ ...p, destination_airfield: e.target.value || null }))
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-stone-950 border border-stone-800 text-stone-100 disabled:opacity-60"
                    >
                      <option value="">-- Same / Unset --</option>
                      {mapData.airbases.map((ab) => (
                        <option key={`${ab.name}-${ab.lat}`} value={ab.name}>
                          {ab.name} ({ab.coalition.toUpperCase()})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-stone-400 font-semibold mb-1">
                      Flight Rules
                    </label>
                    <select
                      disabled={!canEdit}
                      value={activePlan.flight_rules || 'IFR'}
                      onChange={(e) =>
                        mutatePlan((p) => ({ ...p, flight_rules: e.target.value }))
                      }
                      className="w-full px-2 py-1.5 rounded-lg bg-stone-950 border border-stone-800 text-stone-100 disabled:opacity-60"
                    >
                      <option value="IFR">IFR</option>
                      <option value="VFR">VFR</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-stone-400 font-semibold mb-1">
                      Launch Time
                    </label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      placeholder="14:00Z"
                      value={activePlan.launch_time || ''}
                      onChange={(e) =>
                        mutatePlan((p) => ({ ...p, launch_time: e.target.value || null }))
                      }
                      className="w-full px-2 py-1.5 rounded-lg bg-stone-950 border border-stone-800 text-stone-100 disabled:opacity-60"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-stone-400 font-semibold mb-1">
                      Fuel % / Bingo
                    </label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      placeholder="100% / 3.5k"
                      value={activePlan.fuel_amount || ''}
                      onChange={(e) =>
                        mutatePlan((p) => ({ ...p, fuel_amount: e.target.value || null }))
                      }
                      className="w-full px-2 py-1.5 rounded-lg bg-stone-950 border border-stone-800 text-stone-100 disabled:opacity-60"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ROUTES TAB */}
            {activeTab === 'routes' && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2 bg-stone-950/70 border border-stone-800 rounded-lg p-2.5 text-center">
                  <div>
                    <div className="text-[10px] text-stone-500 uppercase font-semibold">Waypoints</div>
                    <div className="text-sm font-mono font-bold text-stone-100">
                      {routePoints.length}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-stone-500 uppercase font-semibold">Total Dist</div>
                    <div className="text-sm font-mono font-bold text-amber-400">
                      {unit === 'km'
                        ? `${totalDistKm.toFixed(1)} km`
                        : `${totalDistNm.toFixed(1)} NM`}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-stone-500 uppercase font-semibold">Est ETE</div>
                    <div className="text-sm font-mono font-bold text-emerald-400">
                      {formatDurationSeconds(totalSeconds)}
                    </div>
                  </div>
                </div>

                {canEdit && (
                  <button
                    onClick={addQuickWaypointAtCenter}
                    className="w-full py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-200 font-semibold flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5 text-amber-400" />
                    Add Steerpoint at Campaign Center
                  </button>
                )}

                {routePoints.length === 0 ? (
                  <div className="p-4 text-center text-stone-400 bg-stone-900/40 rounded-lg border border-stone-800">
                    No steerpoints yet. Click <span className="text-amber-300">Plot Steerpoint</span>{' '}
                    above and click locations along your planned route on the map.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {routePoints.map((wp, idx) => {
                      const leg = computedLegs[idx];
                      const tas = casToTas(wp.speed || 350, wp.alt || 20000);
                      return (
                        <div
                          key={`wp-${idx}`}
                          className="bg-stone-900/70 border border-stone-800 rounded-lg p-2.5 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold">
                                #{idx + 1}
                              </span>
                              <input
                                type="text"
                                disabled={!canEdit}
                                value={wp.name || `WP${idx + 1}`}
                                onChange={(e) => updateWaypoint(idx, { name: e.target.value })}
                                className="flex-1 min-w-0 px-2 py-0.5 rounded bg-stone-950 border border-stone-800 text-stone-100 font-semibold text-xs"
                              />
                              <select
                                disabled={!canEdit}
                                value={wp.action || 'Turning Point'}
                                onChange={(e) => updateWaypoint(idx, { action: e.target.value })}
                                className="px-2 py-0.5 rounded bg-stone-950 border border-stone-800 text-[11px] text-stone-200"
                              >
                                {WAYPOINT_ACTIONS.map((a) => (
                                  <option key={a} value={a}>
                                    {a}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => onCenterMap(wp.lat, wp.lng, 11)}
                                className="p-1 rounded hover:bg-stone-800 text-stone-400 hover:text-amber-300"
                                title="Center Map on Waypoint"
                              >
                                <Crosshair className="w-3.5 h-3.5" />
                              </button>
                              {canEdit && (
                                <>
                                  <button
                                    onClick={() => moveWaypoint(idx, -1)}
                                    disabled={idx === 0}
                                    className="p-1 rounded hover:bg-stone-800 text-stone-400 disabled:opacity-30"
                                    title="Move Up"
                                  >
                                    <ArrowUp className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => moveWaypoint(idx, 1)}
                                    disabled={idx === routePoints.length - 1}
                                    className="p-1 rounded hover:bg-stone-800 text-stone-400 disabled:opacity-30"
                                    title="Move Down"
                                  >
                                    <ArrowDown className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => deleteWaypoint(idx)}
                                    className="p-1 rounded hover:bg-stone-800 text-stone-400 hover:text-red-400"
                                    title="Delete Waypoint"
                                  >
                                    <Trash className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="block text-[9px] text-stone-500 uppercase">
                                Alt (ft MSL)
                              </label>
                              <input
                                type="number"
                                disabled={!canEdit}
                                value={wp.alt ?? 20000}
                                onChange={(e) =>
                                  updateWaypoint(idx, { alt: Number(e.target.value) || 0 })
                                }
                                className="w-full px-2 py-1 rounded bg-stone-950 border border-stone-800 font-mono text-[11px] text-stone-100"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] text-stone-500 uppercase">
                                CAS kts ({tas} TAS)
                              </label>
                              <input
                                type="number"
                                disabled={!canEdit}
                                value={wp.speed ?? 350}
                                onChange={(e) =>
                                  updateWaypoint(idx, { speed: Number(e.target.value) || 0 })
                                }
                                className="w-full px-2 py-1 rounded bg-stone-950 border border-stone-800 font-mono text-[11px] text-stone-100"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] text-stone-500 uppercase">TOT</label>
                              <input
                                type="text"
                                disabled={!canEdit}
                                placeholder="14:22Z"
                                value={wp.tot || ''}
                                onChange={(e) => updateWaypoint(idx, { tot: e.target.value || null })}
                                className="w-full px-2 py-1 rounded bg-stone-950 border border-stone-800 font-mono text-[11px] text-stone-100"
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[10px] font-mono text-stone-400 pt-1 border-t border-stone-800/60">
                            <span>{formatCoordinateDdm(wp.lat, wp.lng)}</span>
                            {idx > 0 && (
                              <span className="text-sky-300">
                                {leg.headingMag} ({leg.headingTrue}) ·{' '}
                                {unit === 'km'
                                  ? `${leg.legKm.toFixed(1)}km`
                                  : `${leg.legNm.toFixed(1)}nm`}{' '}
                                · {leg.ete}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TARGETS TAB */}
            {activeTab === 'targets' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-stone-400">
                    DMPI waypoints tagged with action <strong className="text-red-400">TGT</strong>
                  </span>
                  {canEdit && (
                    <button
                      onClick={() => onSetPlotMode(plotMode === 'target' ? 'none' : 'target')}
                      className="px-2.5 py-1 rounded-lg bg-red-500/20 border border-red-500/50 text-red-300 text-[11px] font-semibold flex items-center gap-1"
                    >
                      <Target className="w-3.5 h-3.5" />
                      {plotMode === 'target' ? 'Plotting TGT...' : 'Add Target on Map'}
                    </button>
                  )}
                </div>

                {targetWaypoints.length === 0 ? (
                  <div className="p-4 text-center text-stone-400 bg-stone-900/40 rounded-lg border border-stone-800">
                    No targets plotted yet. Use <span className="text-red-300">Plot Target DMPI</span>{' '}
                    to click targets on the map or set any route waypoint action to{' '}
                    <code>TGT</code>.
                  </div>
                ) : (
                  targetWaypoints.map(({ wp, idx }) => {
                    const mgrs = wp.mgrs || toMgrs(wp.lat, wp.lng, 5);
                    const ddm = formatCoordinateDdm(wp.lat, wp.lng);
                    return (
                      <div
                        key={`tgt-${idx}`}
                        className="bg-stone-900/70 border border-red-900/40 rounded-lg p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-1">
                            <Target className="w-4 h-4 text-red-400 shrink-0" />
                            <input
                              type="text"
                              disabled={!canEdit}
                              value={wp.name || `TGT ${idx + 1}`}
                              onChange={(e) => updateWaypoint(idx, { name: e.target.value })}
                              className="flex-1 px-2 py-0.5 rounded bg-stone-950 border border-stone-800 text-stone-100 font-semibold"
                            />
                          </div>
                          <button
                            onClick={() => onCenterMap(wp.lat, wp.lng, 13)}
                            className="p-1 rounded hover:bg-stone-800 text-stone-400 hover:text-amber-300"
                            title="Zoom to Target"
                          >
                            <Crosshair className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                          <button
                            onClick={() => {
                              navigator.clipboard?.writeText(mgrs);
                              onNotify('info', `Copied MGRS: ${mgrs}`);
                            }}
                            className="text-left bg-stone-950/70 border border-stone-800 rounded px-2 py-1 text-stone-300 hover:border-amber-500/50 truncate"
                            title="Click to copy MGRS"
                          >
                            MGRS: {mgrs}
                          </button>
                          <button
                            onClick={() => {
                              navigator.clipboard?.writeText(ddm);
                              onNotify('info', `Copied DDM: ${ddm}`);
                            }}
                            className="text-left bg-stone-950/70 border border-stone-800 rounded px-2 py-1 text-stone-300 hover:border-amber-500/50 truncate"
                            title="Click to copy DDM"
                          >
                            {ddm}
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            disabled={!canEdit}
                            value={wp.alt ?? 0}
                            onChange={(e) =>
                              updateWaypoint(idx, { alt: Number(e.target.value) || 0 })
                            }
                            placeholder="Elev ft"
                            className="w-24 px-2 py-1 rounded bg-stone-950 border border-stone-800 font-mono text-[11px] text-emerald-300"
                          />
                          <input
                            type="text"
                            disabled={!canEdit}
                            value={wp.remarks || wp.notes || ''}
                            onChange={(e) =>
                              updateWaypoint(idx, { remarks: e.target.value, notes: e.target.value })
                            }
                            placeholder="Weapon / DMPI notes (e.g. GBU-31 Fuze Delay)"
                            className="flex-1 px-2 py-1 rounded bg-stone-950 border border-stone-800 text-[11px] text-stone-200"
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* LOADOUTS TAB */}
            {activeTab === 'loadouts' && (
              <div className="space-y-3">
                {/* Departure Warehouse Banner */}
                <div className="bg-stone-950/80 border border-stone-800 rounded-lg px-3 py-2 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-stone-500 font-semibold">
                      Departure Warehouse ({activePlan.departure_airfield || 'Unset'})
                    </div>
                    <div className="text-[11px] text-stone-300">
                      {loadingWarehouse
                        ? 'Checking airbase inventory...'
                        : warehouse?.is_unlimited
                          ? 'Unlimited Munitions Available'
                          : warehouse
                            ? 'Live Munition Stock Active'
                            : 'Select departure airbase to check stock'}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4].map((ship) => (
                      <button
                        key={ship}
                        onClick={() => setSelectedShipIdx(ship - 1)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          selectedShipIdx === ship - 1
                            ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                            : 'bg-stone-900 border-stone-800 text-stone-400'
                        }`}
                      >
                        #{ship}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Personal Loadout Presets */}
                <div className="bg-stone-900/60 border border-stone-800 rounded-lg p-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider text-stone-400 font-bold">
                      Saved Loadout Presets ({mapData.loadoutPresets.length})
                    </span>
                    <button
                      onClick={() => setShowPresetForm((v) => !v)}
                      className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Save Current
                    </button>
                  </div>

                  {showPresetForm && (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={newPresetName}
                        onChange={(e) => setNewPresetName(e.target.value)}
                        placeholder="Preset name (e.g. DEAD HARM + TGP)"
                        className="flex-1 px-2 py-1 rounded bg-stone-950 border border-stone-800 text-[11px] text-stone-100"
                      />
                      <button
                        onClick={handleSavePreset}
                        disabled={isBusy || !newPresetName.trim()}
                        className="px-2.5 py-1 rounded bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-[11px] font-bold"
                      >
                        Save
                      </button>
                    </div>
                  )}

                  {mapData.loadoutPresets.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {mapData.loadoutPresets.map((preset) => (
                        <div
                          key={preset.id}
                          className="inline-flex items-center gap-1 bg-stone-950 border border-stone-800 rounded-lg px-2 py-1 text-[11px]"
                        >
                          <button
                            onClick={() => applyLoadoutPreset(preset)}
                            className="text-stone-200 hover:text-amber-300 font-medium"
                          >
                            {preset.name}
                          </button>
                          <button
                            onClick={() => handleDeletePreset(preset.id)}
                            className="text-stone-500 hover:text-red-400"
                            title="Delete Preset"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Gun & Countermeasures */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] uppercase text-stone-400 font-semibold mb-1">
                      Gun Loadout
                    </label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={activePlan.gun_loadout || ''}
                      onChange={(e) =>
                        mutatePlan((p) => ({ ...p, gun_loadout: e.target.value }))
                      }
                      placeholder="100% HEI-T / Combat Mix"
                      className="w-full px-2 py-1.5 rounded bg-stone-950 border border-stone-800 text-stone-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase text-stone-400 font-semibold mb-1">
                      Chaff / Flare Notes
                    </label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={activePlan.countermeasures_loadout || ''}
                      onChange={(e) =>
                        mutatePlan((p) => ({ ...p, countermeasures_loadout: e.target.value }))
                      }
                      placeholder="60 Chaff / 60 Flare"
                      className="w-full px-2 py-1.5 rounded bg-stone-950 border border-stone-800 text-stone-100"
                    />
                  </div>
                </div>

                {/* Pylon Stations */}
                {stationConfigEntries.length === 0 ? (
                  <div className="bg-stone-900/50 border border-stone-800 rounded-lg p-3 space-y-1.5">
                    <div className="text-[11px] font-semibold text-stone-300">
                      Loadout Summary (Ship #{selectedShipIdx + 1})
                    </div>
                    <textarea
                      rows={4}
                      disabled={!canEdit}
                      value={
                        (typeof activePlan.loadout === 'string'
                          ? activePlan.loadout
                          : activePlan.formatted_loadout) || ''
                      }
                      onChange={(e) => mutatePlan((p) => ({ ...p, loadout: e.target.value as any }))}
                      placeholder="Specify stores per pylon or select a supported airframe in Summary..."
                      className="w-full px-2.5 py-2 rounded bg-stone-950 border border-stone-800 text-stone-100 text-xs"
                    />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {stationConfigEntries.map(([stationKey, stationCfg]: [string, any]) => {
                      const options: string[] = Array.isArray(stationCfg?.options)
                        ? stationCfg.options
                        : Array.isArray(stationCfg?.weapons)
                          ? stationCfg.weapons
                          : [];
                      const selectedStore = currentStationLoadout[stationKey] || '';
                      const stockInfo = selectedStore ? getWarehouseStockLabel(selectedStore) : null;
                      return (
                        <div
                          key={stationKey}
                          className="flex items-center justify-between gap-2 bg-stone-900/60 border border-stone-800/80 rounded-lg px-2.5 py-1.5"
                        >
                          <div className="min-w-[80px]">
                            <div className="text-[11px] font-bold text-amber-300">
                              STA {stationCfg?.label || stationKey}
                            </div>
                            {stockInfo && (
                              <div className={`text-[9px] font-mono ${stockInfo.tone}`}>
                                {stockInfo.text}
                              </div>
                            )}
                          </div>
                          {options.length > 0 ? (
                            <select
                              disabled={!canEdit}
                              value={selectedStore}
                              onChange={(e) =>
                                mutatePlan((p) => ({
                                  ...p,
                                  station_loadout: {
                                    ...(p.station_loadout || {}),
                                    [stationKey]: e.target.value,
                                  },
                                }))
                              }
                              className="flex-1 min-w-0 px-2 py-1 rounded bg-stone-950 border border-stone-800 text-[11px] text-stone-100"
                            >
                              <option value="">-- Empty --</option>
                              {options.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              disabled={!canEdit}
                              value={selectedStore}
                              onChange={(e) =>
                                mutatePlan((p) => ({
                                  ...p,
                                  station_loadout: {
                                    ...(p.station_loadout || {}),
                                    [stationKey]: e.target.value,
                                  },
                                }))
                              }
                              placeholder="Empty"
                              className="flex-1 min-w-0 px-2 py-1 rounded bg-stone-950 border border-stone-800 text-[11px] text-stone-100"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* COMMS TAB */}
            {activeTab === 'comms' && (
              <div className="space-y-4">
                {canEdit && (
                  <div className="flex items-center justify-between gap-2 bg-stone-900/70 border border-stone-800 rounded-lg px-3 py-2">
                    <span className="text-[11px] text-stone-300">
                      Auto-populate radio presets from airframe, mission &amp; assigned airfields
                    </span>
                    <button
                      type="button"
                      onClick={handlePullDefaultComms}
                      disabled={isBusy}
                      className="px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/50 text-sky-300 text-[11px] font-bold flex items-center gap-1 shrink-0 disabled:opacity-50 cursor-pointer"
                    >
                      <ArrowsClockwise className="w-3.5 h-3.5" />
                      Pull Default Comms
                    </button>
                  </div>
                )}

                {(['comm1', 'comm2'] as const).map((radioKey) => {
                  const list = radioKey === 'comm1' ? comm1List : comm2List;
                  return (
                    <div
                      key={radioKey}
                      className="bg-stone-900/60 border border-stone-800 rounded-lg p-2.5 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold uppercase tracking-wider text-[11px] text-sky-400 flex items-center gap-1.5">
                          <Radio className="w-3.5 h-3.5" />
                          {radioKey === 'comm1' ? 'COMM 1 (UHF / Primary)' : 'COMM 2 (VHF / Aux)'}
                        </span>
                        {canEdit && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handlePullAirfieldComms(radioKey)}
                              disabled={isBusy}
                              className="text-[10px] font-semibold text-sky-300 hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <DownloadSimple className="w-3 h-3" /> Pull Airfield Freqs
                            </button>
                            <button
                              onClick={() =>
                                updateCommList(radioKey, [
                                  ...list,
                                  {
                                    channel: list.length + 1,
                                    label: `CH ${list.length + 1}`,
                                    frequency: radioKey === 'comm1' ? '251.000' : '124.000',
                                    modulation: 'AM',
                                  },
                                ])
                              }
                              className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" /> Add Channel
                            </button>
                          </div>
                        )}
                      </div>

                      {list.length === 0 ? (
                        <div className="text-[11px] text-stone-500 py-1">No custom channels configured.</div>
                      ) : (
                        <div className="space-y-1.5">
                          {list.map((ch, idx) => (
                            <div key={idx} className="grid grid-cols-12 gap-1.5 items-center">
                              <input
                                type="text"
                                disabled={!canEdit}
                                value={String(ch.channel ?? idx + 1)}
                                onChange={(e) => {
                                  const next = [...list];
                                  next[idx] = { ...ch, channel: e.target.value };
                                  updateCommList(radioKey, next);
                                }}
                                className="col-span-2 px-1.5 py-1 rounded bg-stone-950 border border-stone-800 font-mono text-[11px] text-center text-stone-200"
                              />
                              <input
                                type="text"
                                disabled={!canEdit}
                                value={ch.label || ch.name || ''}
                                onChange={(e) => {
                                  const next = [...list];
                                  next[idx] = { ...ch, label: e.target.value, name: e.target.value };
                                  updateCommList(radioKey, next);
                                }}
                                placeholder="Agency"
                                className="col-span-5 px-2 py-1 rounded bg-stone-950 border border-stone-800 text-[11px] text-stone-100"
                              />
                              <input
                                type="text"
                                disabled={!canEdit}
                                value={ch.frequency || ''}
                                onChange={(e) => {
                                  const next = [...list];
                                  next[idx] = { ...ch, frequency: e.target.value };
                                  updateCommList(radioKey, next);
                                }}
                                placeholder="251.000"
                                className="col-span-4 px-2 py-1 rounded bg-stone-950 border border-stone-800 font-mono text-[11px] text-emerald-300"
                              />
                              {canEdit && (
                                <button
                                  onClick={() =>
                                    updateCommList(
                                      radioKey,
                                      list.filter((_, i) => i !== idx)
                                    )
                                  }
                                  className="col-span-1 text-stone-500 hover:text-red-400 flex justify-center"
                                >
                                  <Trash className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* MIDS TAB */}
            {activeTab === 'mids' && (
              <div className="space-y-3 bg-stone-900/60 border border-stone-800 rounded-lg p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sky-400 font-bold text-[11px] uppercase">
                    <Broadcast className="w-4 h-4" />
                    Link-16 / MIDS-LVT Configuration
                  </div>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={handlePullDefaultMids}
                      disabled={isBusy}
                      className="px-2 py-1 rounded bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/50 text-sky-300 text-[10px] font-bold flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                    >
                      <ArrowsClockwise className="w-3 h-3" />
                      Pull Default MIDS
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] uppercase text-stone-400 font-semibold mb-1">
                      MIDS A Channel (Fighter)
                    </label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={String(activePlan.mids_settings?.mids_a_channel ?? '')}
                      onChange={(e) =>
                        mutatePlan((p) => ({
                          ...p,
                          mids_settings: { ...(p.mids_settings || {}), mids_a_channel: e.target.value },
                        }))
                      }
                      placeholder="127"
                      className="w-full px-2.5 py-1.5 rounded bg-stone-950 border border-stone-800 font-mono text-stone-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase text-stone-400 font-semibold mb-1">
                      MIDS A Agency Name
                    </label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={String(activePlan.mids_settings?.mids_a_name ?? '')}
                      onChange={(e) =>
                        mutatePlan((p) => ({
                          ...p,
                          mids_settings: { ...(p.mids_settings || {}), mids_a_name: e.target.value },
                        }))
                      }
                      placeholder="FIGHTER"
                      className="w-full px-2.5 py-1.5 rounded bg-stone-950 border border-stone-800 font-mono text-stone-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase text-stone-400 font-semibold mb-1">
                      MIDS B Channel (VOC)
                    </label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={String(activePlan.mids_settings?.mids_b_channel ?? '')}
                      onChange={(e) =>
                        mutatePlan((p) => ({
                          ...p,
                          mids_settings: { ...(p.mids_settings || {}), mids_b_channel: e.target.value },
                        }))
                      }
                      placeholder="41"
                      className="w-full px-2.5 py-1.5 rounded bg-stone-950 border border-stone-800 font-mono text-stone-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase text-stone-400 font-semibold mb-1">
                      MIDS B Agency Name
                    </label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={String(activePlan.mids_settings?.mids_b_name ?? '')}
                      onChange={(e) =>
                        mutatePlan((p) => ({
                          ...p,
                          mids_settings: { ...(p.mids_settings || {}), mids_b_name: e.target.value },
                        }))
                      }
                      placeholder="AWACS / VOC"
                      className="w-full px-2.5 py-1.5 rounded bg-stone-950 border border-stone-800 font-mono text-stone-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase text-stone-400 font-semibold mb-1">
                      Net / Voice Label
                    </label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={String(activePlan.mids_settings?.net_label ?? '')}
                      onChange={(e) =>
                        mutatePlan((p) => ({
                          ...p,
                          mids_settings: { ...(p.mids_settings || {}), net_label: e.target.value },
                        }))
                      }
                      placeholder="VD1"
                      className="w-full px-2.5 py-1.5 rounded bg-stone-950 border border-stone-800 font-mono text-stone-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase text-stone-400 font-semibold mb-1">
                      Lead STN / JU
                    </label>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={String(activePlan.mids_settings?.lead_stn ?? '')}
                      onChange={(e) =>
                        mutatePlan((p) => ({
                          ...p,
                          mids_settings: { ...(p.mids_settings || {}), lead_stn: e.target.value },
                        }))
                      }
                      placeholder="02101"
                      className="w-full px-2.5 py-1.5 rounded bg-stone-950 border border-stone-800 font-mono text-stone-100"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* CMDS TAB */}
            {activeTab === 'cmds' && (
              <div className="space-y-3 bg-stone-900/60 border border-stone-800 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold uppercase tracking-wider text-[11px] text-amber-400 flex items-center gap-1.5">
                    <ShieldWarning className="w-4 h-4" />
                    Countermeasures Dispenser Programs
                  </span>
                  {selectedAirframe?.default_cmds && canEdit && (
                    <button
                      onClick={() =>
                        mutatePlan((p) => ({
                          ...p,
                          cmds_settings: { ...selectedAirframe.default_cmds },
                        }))
                      }
                      className="text-[11px] text-amber-300 hover:underline font-semibold"
                    >
                      Load Defaults
                    </button>
                  )}
                </div>

                {[1, 2, 3, 4].map((progNum) => {
                  const key = `program_${progNum}`;
                  const prog: Record<string, any> =
                    (activePlan.cmds_settings &&
                      !Array.isArray(activePlan.cmds_settings) &&
                      activePlan.cmds_settings[key]) ||
                    {};
                  const setProgField = (field: string, val: number) =>
                    mutatePlan((p) => ({
                      ...p,
                      cmds_settings: {
                        ...(Array.isArray(p.cmds_settings) ? {} : p.cmds_settings || {}),
                        [key]: { ...prog, [field]: val },
                      },
                    }));

                  return (
                    <div
                      key={key}
                      className="bg-stone-950/70 border border-stone-800 rounded-lg p-2.5 space-y-1.5"
                    >
                      <div className="text-[11px] font-bold text-stone-200">Program {progNum}</div>
                      <div className="grid grid-cols-4 gap-1.5 text-[10px]">
                        <div>
                          <span className="text-stone-500 block">Chaff Burst</span>
                          <input
                            type="number"
                            disabled={!canEdit}
                            value={prog.chaff_burst_qty ?? 1}
                            onChange={(e) => setProgField('chaff_burst_qty', Number(e.target.value))}
                            className="w-full px-1.5 py-1 rounded bg-stone-900 border border-stone-800 font-mono text-stone-100"
                          />
                        </div>
                        <div>
                          <span className="text-stone-500 block">Chaff Salvo</span>
                          <input
                            type="number"
                            disabled={!canEdit}
                            value={prog.chaff_salvo_qty ?? 4}
                            onChange={(e) => setProgField('chaff_salvo_qty', Number(e.target.value))}
                            className="w-full px-1.5 py-1 rounded bg-stone-900 border border-stone-800 font-mono text-stone-100"
                          />
                        </div>
                        <div>
                          <span className="text-stone-500 block">Flare Burst</span>
                          <input
                            type="number"
                            disabled={!canEdit}
                            value={prog.flare_burst_qty ?? 1}
                            onChange={(e) => setProgField('flare_burst_qty', Number(e.target.value))}
                            className="w-full px-1.5 py-1 rounded bg-stone-900 border border-stone-800 font-mono text-stone-100"
                          />
                        </div>
                        <div>
                          <span className="text-stone-500 block">Flare Salvo</span>
                          <input
                            type="number"
                            disabled={!canEdit}
                            value={prog.flare_salvo_qty ?? 4}
                            onChange={(e) => setProgField('flare_salvo_qty', Number(e.target.value))}
                            className="w-full px-1.5 py-1 rounded bg-stone-900 border border-stone-800 font-mono text-stone-100"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* AVIONICS / TACTICAL DRAWINGS TAB */}
            {activeTab === 'drawings' && (
              <AirframeAvionicsPanel
                activePlan={activePlan}
                selectedAirframe={selectedAirframe}
                mapData={mapData}
                canEdit={canEdit}
                onMutatePlan={mutatePlan}
                activePlotTarget={avionicsPlotTarget}
                onSetPlotTarget={onSetAvionicsPlotTarget}
                onCenterMap={onCenterMap}
                onNotify={onNotify}
              />
            )}

            {/* NOTES TAB */}
            {activeTab === 'notes' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-stone-400 font-semibold mb-1">
                    Briefing Summary / Flight Description
                  </label>
                  <textarea
                    rows={3}
                    disabled={!canEdit}
                    value={activePlan.description || ''}
                    onChange={(e) =>
                      mutatePlan((p) => ({ ...p, description: e.target.value }))
                    }
                    placeholder="Flight tasking overview, timeline coordination..."
                    className="w-full px-3 py-2 rounded-lg bg-stone-950 border border-stone-800 text-stone-100 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-stone-400 font-semibold mb-1">
                    Pilot Remarks &amp; Special Instructions
                  </label>
                  <textarea
                    rows={6}
                    disabled={!canEdit}
                    value={activePlan.remarks || ''}
                    onChange={(e) => mutatePlan((p) => ({ ...p, remarks: e.target.value }))}
                    placeholder="ROE notes, laser codes (1688), Marshall/Buster coordination, emergency divert notes..."
                    className="w-full px-3 py-2 rounded-lg bg-stone-950 border border-stone-800 text-stone-100 text-xs"
                  />
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </FloatingToolWindow>
  );
};
