import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  ArrowsClockwise,
  CheckCircle,
  Compass,
  Copy,
  Crosshair,
  CrosshairSimple,
  MapPin,
  Path,
  Ruler,
  ShieldWarning,
  SlidersHorizontal,
  Target,
  WarningCircle,
  X,
} from '@phosphor-icons/react';
import { STATIC_CONFIG } from '../../../config/constants';
import { useApp } from '../../../context/AppContext';
import { applyDevOverridesToMapPayload } from '../../../utils/devPermissions';
import {
  fetchCampaignMapPayload,
  fetchTerrainElevation,
  saveCampaignTacticalMarking,
} from '../../../services/campaignMapService';
import { fetchFlightPlanDetail } from '../../../services/flightPlanService';
import {
  CampaignItem,
  CampaignMapAirbase,
  CampaignMapPayload,
  CampaignMapPolygonGroup,
  CampaignMapProcedure,
  CampaignMapTacticalMarking,
  FlightPlanDetail,
  FlightPlanRoutePoint,
} from '../../../types';
import {
  calculateBearingDegrees,
  calculateDistanceNm,
  formatCoordinateDdm,
  formatCoordinateDms,
  formatDurationSeconds,
  lookupTerrariumElevationFt,
  toMgrs,
} from './geodesy';
import {
  ActiveFlightPlanMapController,
} from './activeFlightPlanLayer';
import {
  SupportAssetsControllerStats,
  SupportAssetsMapController,
} from './activeSupportAssetsLayer';
import {
  TacticalDrawConfig,
  TacticalMarkingsControllerCallbacks,
  TacticalMarkingsMapController,
  TacticalShapeType,
} from './activeTacticalMarkingsLayer';
import {
  AvionicsDrawTarget,
  DoghouseConfig,
  TickConfig,
  appendPointToAvionicsDrawTarget,
  describeAvionicsDrawTarget,
  getAvailableSequences,
  getMaxSequences,
  isAdditionalPoint,
  isDivertPoint,
  isF14Airframe,
  isF16Airframe,
  isF18Airframe,
  isJf17Airframe,
  isSequenceTrackPoint,
  isTargetPoint,
  normalizePlanForEditor,
  recalculateTransitSpeeds,
} from './flightPlanner/helpers';
import {
  createDcsTileLayers,
  renderAirbaseProceduresLayer,
  renderAirbasesLayer,
  renderBullseyesLayer,
  renderClusteredFlightPlansLayer,
  renderFrontLineLayer,
  renderLogisticsLayer,
  renderMissionsLayer,
  renderNavaidsLayer,
  renderPolygonGroupsLayer,
  renderTheatreBounds,
  renderThreatsLayer,
} from './portalLayers';
import { CampaignMapToolbar, MapToolKey } from './CampaignMapToolbar';
import {
  CampaignMapLayerControls,
  DEFAULT_PORTAL_LAYER_STATES,
  PortalLayerStates,
} from './CampaignMapLayerControls';
import { CampaignMapHudFooter } from './CampaignMapHudFooter';
import { MapLegendModal } from './MapLegendModal';
import { FlightPlannerDrawer } from './FlightPlannerDrawer';
import { CoordinateConverterDrawer } from './CoordinateConverterDrawer';
import { MeasurePoint, MeasureToolDrawer } from './MeasureToolDrawer';
import { SupportAssetsDrawer } from './SupportAssetsDrawer';
import { TacticalMarkingsDrawer } from './TacticalMarkingsDrawer';
import { ThreatEditorDrawer } from './TacticalEditorsDrawers';

interface CampaignMapTabProps {
  campaign: CampaignItem;
  initialFlightPlanId?: number | null;
  initialMissionId?: number | null;
  onConsumedInitialTarget?: () => void;
}

type WindowKey = MapToolKey | 'legend';

const DEFAULT_OPEN_WINDOWS: Record<MapToolKey, boolean> = {
  flight: false,
  threats: false,
  support: false,
  markings: false,
  isr: false,
  measure: false,
  converter: false,
};

const AUTO_REFRESH_SECONDS = 10;

export const CampaignMapTab: React.FC<CampaignMapTabProps> = ({
  campaign,
  initialFlightPlanId,
  initialMissionId,
  onConsumedInitialTarget,
}) => {
  const {
    settings,
    userSession,
    memberProfile,
    addNotification,
    setSelectedCampaignMissionId,
    setSelectedCampaignMissionSection,
    devPermissionOverrides,
    setLiveMapPermissions,
  } = useApp();
  const baseUrl = settings.memberPortalApiUrl || STATIC_CONFIG.portalBaseUrl;
  const authToken = userSession?.accessToken;
  const discordId = userSession?.id || memberProfile?.discordId || null;

  // Core data & loading state
  const [rawMapData, setRawMapData] = useState<CampaignMapPayload | null>(null);
  const setMapData = setRawMapData;
  const mapData = useMemo(() => {
    if (!rawMapData) return null;
    if (!import.meta.env.DEV || !devPermissionOverrides.enabled) return rawMapData;
    return applyDevOverridesToMapPayload(rawMapData, devPermissionOverrides);
  }, [rawMapData, devPermissionOverrides]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    setLiveMapPermissions(rawMapData?.permissions ?? null);
  }, [rawMapData?.permissions, setLiveMapPermissions]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    return () => {
      setLiveMapPermissions(null);
    };
  }, [setLiveMapPermissions]);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // View & HUD state
  const [unit, setUnit] = useState<'nm' | 'km'>('nm');
  const [coordMode, setCoordMode] = useState<'ddm' | 'dms'>('ddm');
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [cursorCoords, setCursorCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [cursorElevFt, setCursorElevFt] = useState<number | null>(null);
  const [activeBullseyeIndex, setActiveBullseyeIndex] = useState(0);

  // Mission / Sortie filter
  const [selectedMissionId, setSelectedMissionId] = useState<number | null>(null);
  const [selectedSortieId, setSelectedSortieId] = useState<number | null>(null);

  // Tile & Layer controls
  const [tileNames, setTileNames] = useState<string[]>(['Carto Dark', 'Carto Voyager']);
  const [activeTileName, setActiveTileName] = useState<string>('Carto Dark');
  const [layerStates, setLayerStates] = useState<PortalLayerStates>(DEFAULT_PORTAL_LAYER_STATES);
  const [polygonGroupStates, setPolygonGroupStates] = useState<Record<string, boolean>>({});

  // Floating window visibility & focus stacking
  const [openWindows, setOpenWindows] = useState<Record<MapToolKey, boolean>>(DEFAULT_OPEN_WINDOWS);
  const [legendOpen, setLegendOpen] = useState(false);
  const [windowOrder, setWindowOrder] = useState<WindowKey[]>([]);

  // Active flight plan & planner editing state
  const [rawActivePlan, setRawActivePlan] = useState<FlightPlanDetail | null>(null);
  const setActivePlan = setRawActivePlan;
  const activePlan = useMemo(() => {
    if (!rawActivePlan) return null;
    if (
      import.meta.env.DEV &&
      devPermissionOverrides.enabled &&
      devPermissionOverrides.forceRecordsReadOnly
    ) {
      return { ...rawActivePlan, can_edit: false };
    }
    return rawActivePlan;
  }, [rawActivePlan, devPermissionOverrides]);
  const [activeSequence, setActiveSequence] = useState<number>(1);
  const [userCreatedSequences, setUserCreatedSequences] = useState<number[]>([1]);
  const [sequenceColors, setSequenceColors] = useState<Record<number, string>>({});
  const [tickConfig, setTickConfig] = useState<TickConfig>(() => {
    try {
      const saved = localStorage.getItem('gtfo_tick_config');
      if (saved) return JSON.parse(saved) as TickConfig;
    } catch {
      // ignore storage errors
    }
    return { type: 'off', interval: 5 };
  });
  const [doghouseConfig, setDoghouseConfig] = useState<DoghouseConfig>(() => {
    try {
      const saved = localStorage.getItem('gtfo_doghouse_config');
      if (saved === 'off' || saved === 'on') return saved;
    } catch {
      // ignore storage errors
    }
    return 'on';
  });
  const [avionicsDrawTarget, setAvionicsDrawTarget] = useState<AvionicsDrawTarget | null>(null);
  const [dirtyVersion, setDirtyVersion] = useState<number>(0);
  const [isPlanDirty, setIsPlanDirty] = useState<boolean>(false);
  const [fpSettingsOpen, setFpSettingsOpen] = useState<boolean>(false);

  // Tool picking & tactical states
  const [measurePoints, setMeasurePoints] = useState<MeasurePoint[]>([]);
  const [measureSpeedInput, setMeasureSpeedInput] = useState<string>('350');
  const [isPickingMeasure, setIsPickingMeasure] = useState(false);

  const handleChangeUnit = useCallback(
    (nextUnit: 'nm' | 'km') => {
      if (nextUnit === unit) return;
      setUnit(nextUnit);
      setMeasureSpeedInput((prev) => {
        const n = Number(prev);
        if (!Number.isFinite(n) || n <= 0) return prev;
        return nextUnit === 'km' ? String(Math.round(n * 1.852)) : String(Math.round(n / 1.852));
      });
    },
    [unit]
  );

  const [converterPick, setConverterPick] = useState<{ lat: number; lng: number } | null>(null);
  const [converterPin, setConverterPin] = useState<{ lat: number; lng: number; seq: number } | null>(
    null
  );
  const [isPickingConverter, setIsPickingConverter] = useState(false);

  const [threatPick, setThreatPick] = useState<{ lat: number; lng: number } | null>(null);
  const [isPickingThreat, setIsPickingThreat] = useState(false);
  const [focusThreatIndex, setFocusThreatIndex] = useState<number | null>(null);

  const [selectedSupportAssetType, setSelectedSupportAssetType] = useState<string>('tanker');
  const [supportAssetStats, setSupportAssetStats] = useState<SupportAssetsControllerStats>({
    confirmedCount: 0,
    pendingCount: 0,
    removedCount: 0,
    undoCount: 0,
    isDirty: false,
  });
  const [focusAssetIndex, setFocusAssetIndex] = useState<number | null>(null);

  const [tmIsDrawing, setTmIsDrawing] = useState(false);
  const [tmDrawShape, setTmDrawShape] = useState<TacticalShapeType | null>(null);
  const [editingMarking, setEditingMarking] = useState<CampaignMapTacticalMarking | null>(null);
  const editingMarkingIdRef = useRef<number | null>(null);
  editingMarkingIdRef.current = editingMarking?.id ?? null;
  const tmScopeRef = useRef<{
    visibility: 'personal' | 'campaign' | 'mission' | 'sortie';
    missionId: number | null;
    sortieId: number | null;
  }>({ visibility: 'personal', missionId: null, sortieId: null });

  // Context menu & Auto-refresh
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    lat: number;
    lng: number;
  } | null>(null);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState(0);

  // Map refs
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const mapDataRef = useRef<CampaignMapPayload | null>(null);
  mapDataRef.current = mapData;
  const activePlanRef = useRef<FlightPlanDetail | null>(null);
  activePlanRef.current = activePlan;
  const activePlanControllerRef = useRef<ActiveFlightPlanMapController | null>(null);
  const supportAssetsControllerRef = useRef<SupportAssetsMapController | null>(null);
  const tacticalMarkingsControllerRef = useRef<TacticalMarkingsMapController | null>(null);
  const openWindowsFlightRef = useRef(false);
  openWindowsFlightRef.current = openWindows.flight;
  const activeSequenceRef = useRef(1);
  activeSequenceRef.current = activeSequence;
  const handleInsertOrAppendWaypointRef = useRef<(latlng: L.LatLng, seq?: number) => void>(() => {});
  const tileMapRef = useRef<Record<string, L.Layer>>({});
  const activeTileLayerRef = useRef<L.Layer | null>(null);
  const tileSignatureRef = useRef<string | null>(null);
  const initialFitDoneRef = useRef(false);
  const consumedTargetRef = useRef(false);
  const prevCampaignIdRef = useRef<number | null>(null);
  const elevTimerRef = useRef<number | null>(null);
  const elevReqSeqRef = useRef(0);

  const layerGroupsRef = useRef<{
    theatreBounds: L.LayerGroup;
    polygonGroups: L.LayerGroup;
    frontline: L.LayerGroup;
    bullseye: L.LayerGroup;
    navaids: L.LayerGroup;
    airbasesBlue: L.LayerGroup;
    airbasesRed: L.LayerGroup;
    airbasesNeutral: L.LayerGroup;
    airbaseProceduresDeparture: L.LayerGroup;
    airbaseProceduresArrival: L.LayerGroup;
    airbaseProceduresApproach: L.LayerGroup;
    airbaseProceduresPattern: L.LayerGroup;
    missions: L.LayerGroup;
    flightPlans: L.LayerGroup;
    logistics: L.LayerGroup;
    threats: L.LayerGroup;
    supportAssets: L.LayerGroup;
    tacticalMarkings: L.LayerGroup;
    activePlan: L.LayerGroup;
    measure: L.LayerGroup;
    tacticalDraft: L.LayerGroup;
    converterPin: L.LayerGroup;
  } | null>(null);

  const [mapToast, setMapToast] = useState<{
    level: 'info' | 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);
  const mapToastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (mapToastTimerRef.current) {
        window.clearTimeout(mapToastTimerRef.current);
      }
    };
  }, []);

  const handleNotify = useCallback(
    (level: 'info' | 'success' | 'warning' | 'error', msg: string) => {
      setMapToast({ level, message: msg });
      if (mapToastTimerRef.current) {
        window.clearTimeout(mapToastTimerRef.current);
      }
      mapToastTimerRef.current = window.setTimeout(() => {
        setMapToast(null);
      }, 3500);

      if (level === 'success' || level === 'error') {
        addNotification({
          title: 'Campaign Map',
          message: msg,
          category: 'flight_plan',
        });
      }
    },
    [addNotification]
  );

  const handleCenterMap = useCallback((lat: number, lng: number, zoom?: number) => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo([lat, lng], zoom ?? Math.max(map.getZoom(), 11), { duration: 0.7 });
  }, []);

  const handlePingConverterLocation = useCallback(
    (lat: number, lng: number) => {
      setConverterPin({ lat, lng, seq: Date.now() });
      handleCenterMap(lat, lng);
    },
    [handleCenterMap]
  );

  const bringToFront = useCallback((key: WindowKey) => {
    setWindowOrder((prev) => [...prev.filter((k) => k !== key), key]);
  }, []);

  const getZIndex = useCallback(
    (key: WindowKey, fallback = 1120) => {
      const idx = windowOrder.indexOf(key);
      return idx >= 0 ? 1120 + idx * 10 : fallback;
    },
    [windowOrder]
  );

  const openWindow = useCallback(
    (key: MapToolKey) => {
      if (key === 'threats' && !mapDataRef.current?.permissions.canManageThreats) {
        return;
      }
      if (key === 'support' && !mapDataRef.current?.permissions.canManageSupportAssets) {
        return;
      }
      if (key === 'support') {
        tacticalMarkingsControllerRef.current?.cancelDrawing();
        setAvionicsDrawTarget(null);
        setIsPickingMeasure(false);
        setIsPickingConverter(false);
        setIsPickingThreat(false);
        setLayerStates((s) => (s.supportAssets ? s : { ...s, supportAssets: true }));
      }
      if (key === 'markings') {
        setLayerStates((s) => (s.tacticalMarkings ? s : { ...s, tacticalMarkings: true }));
      }
      setOpenWindows((prev) => ({ ...prev, [key]: true }));
      bringToFront(key);
    },
    [bringToFront]
  );

  useEffect(() => {
    if (!mapData) return;
    if (!mapData.permissions.canManageThreats) {
      setIsPickingThreat(false);
      setFocusThreatIndex(null);
      setOpenWindows((prev) => (prev.threats ? { ...prev, threats: false } : prev));
    }
    if (!mapData.permissions.canManageSupportAssets) {
      setFocusAssetIndex(null);
      setOpenWindows((prev) => (prev.support ? { ...prev, support: false } : prev));
    }
  }, [mapData]);

  const closeWindow = useCallback((key: MapToolKey) => {
    setOpenWindows((prev) => ({ ...prev, [key]: false }));
    if (key === 'flight') {
      setAvionicsDrawTarget(null);
    }
    if (key === 'measure') setIsPickingMeasure(false);
    if (key === 'converter') {
      setIsPickingConverter(false);
      setConverterPin(null);
    }
    if (key === 'threats') setIsPickingThreat(false);
    if (key === 'markings') {
      tacticalMarkingsControllerRef.current?.cancelDrawing();
      setEditingMarking(null);
    }
  }, []);

  const toggleWindow = useCallback(
    (key: MapToolKey) => {
      if (openWindows[key]) {
        closeWindow(key);
      } else {
        openWindow(key);
      }
    },
    [openWindows, openWindow, closeWindow]
  );

  const clearAllPickModes = useCallback(() => {
    setAvionicsDrawTarget(null);
    setIsPickingMeasure(false);
    setIsPickingConverter(false);
    setIsPickingThreat(false);
    tacticalMarkingsControllerRef.current?.cancelDrawing();
    setContextMenu(null);
  }, []);

  // Load campaign map payload
  const loadMapData = useCallback(
    async (refresh = false, silent = false) => {
      if (!silent) {
        if (rawMapData) setIsRefreshing(true);
        else setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setError(null);
      try {
        const data = await fetchCampaignMapPayload(baseUrl, campaign.id, {
          discordId,
          token: authToken,
          refresh,
        });
        setMapData(data);

        if (data.polygonGroups?.length) {
          setPolygonGroupStates((prev) => {
            const next = { ...prev };
            data.polygonGroups.forEach((pg: CampaignMapPolygonGroup, idx: number) => {
              const id = pg.group_name || pg.name || `ao_${idx}`;
              if (next[id] === undefined) next[id] = true;
            });
            return next;
          });
        }
      } catch (err) {
        if (!silent || !rawMapData) {
          setError(err instanceof Error ? err.message : 'Failed to load campaign map data');
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [baseUrl, campaign.id, discordId, authToken, rawMapData]
  );

  useEffect(() => {
    const campaignChanged = prevCampaignIdRef.current !== campaign.id;
    prevCampaignIdRef.current = campaign.id;
    if (campaignChanged) {
      initialFitDoneRef.current = false;
      consumedTargetRef.current = false;
      setMapData(null);
      setActivePlan(null);
      setConverterPin(null);
    }
    loadMapData(false, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.id, discordId, baseUrl]);

  // 10-second Auto-Refresh ring timer
  useEffect(() => {
    if (!autoRefreshEnabled) {
      setRefreshProgress(0);
      return;
    }
    const tickMs = 200;
    const totalTicks = (AUTO_REFRESH_SECONDS * 1000) / tickMs;
    let tick = 0;

    const timer = window.setInterval(() => {
      tick += 1;
      setRefreshProgress(Math.min(1, tick / totalTicks));
      if (tick >= totalTicks) {
        tick = 0;
        setRefreshProgress(0);
        loadMapData(true, true);
      }
    }, tickMs);

    return () => window.clearInterval(timer);
  }, [autoRefreshEnabled, loadMapData]);

  // Initialize Leaflet Map once container mounts
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [36.0, 38.0],
      zoom: 7,
      minZoom: 3,
      maxZoom: 18,
      zoomControl: false,
      attributionControl: false,
    });

    const groups = {
      theatreBounds: L.layerGroup().addTo(map),
      polygonGroups: L.layerGroup().addTo(map),
      frontline: L.layerGroup(),
      bullseye: L.layerGroup(),
      navaids: L.layerGroup(),
      airbasesBlue: L.layerGroup(),
      airbasesRed: L.layerGroup(),
      airbasesNeutral: L.layerGroup(),
      airbaseProceduresDeparture: L.layerGroup(),
      airbaseProceduresArrival: L.layerGroup(),
      airbaseProceduresApproach: L.layerGroup(),
      airbaseProceduresPattern: L.layerGroup(),
      missions: L.layerGroup(),
      flightPlans: L.layerGroup(),
      logistics: L.layerGroup(),
      threats: L.layerGroup(),
      supportAssets: L.layerGroup(),
      tacticalMarkings: L.layerGroup(),
      activePlan: L.layerGroup().addTo(map),
      measure: L.layerGroup().addTo(map),
      tacticalDraft: L.layerGroup().addTo(map),
      converterPin: L.layerGroup().addTo(map),
    };

    layerGroupsRef.current = groups;
    mapRef.current = map;

    const handleLayerAdd = (ev: L.LayerEvent) => {
      const layer = ev.layer as any;
      if (!layer || typeof layer.on !== 'function' || layer._ctrlClickAttached) return;
      if (layer instanceof L.TileLayer) return;
      if (
        layer._isFlightRouteLine ||
        layer._isFlightPlanWaypoint ||
        layer._isMeasureLine ||
        layer._isSpine
      ) {
        return;
      }

      layer._ctrlClickAttached = true;
      layer.on('click', (clickEv: L.LeafletMouseEvent) => {
        const isCtrlPressed = Boolean(
          clickEv.originalEvent && (clickEv.originalEvent.ctrlKey || clickEv.originalEvent.metaKey)
        );
        if (!isCtrlPressed || !openWindowsFlightRef.current) return;
        const plan = activePlanRef.current;
        if (!plan || plan.can_edit === false) return;

        if (clickEv.originalEvent && typeof clickEv.originalEvent.stopPropagation === 'function') {
          clickEv.originalEvent.stopPropagation();
        }
        if (typeof layer.closePopup === 'function') {
          layer.closePopup();
        }
        const clickLatLng =
          clickEv.latlng || (typeof layer.getLatLng === 'function' ? layer.getLatLng() : null);
        if (clickLatLng) {
          handleInsertOrAppendWaypointRef.current(clickLatLng, activeSequenceRef.current || 1);
        }
      });
    };

    map.on('layeradd', handleLayerAdd);

    return () => {
      map.off('layeradd', handleLayerAdd);
      if (activePlanControllerRef.current) {
        activePlanControllerRef.current.clear();
        activePlanControllerRef.current = null;
      }
      if (supportAssetsControllerRef.current) {
        supportAssetsControllerRef.current.clear();
        supportAssetsControllerRef.current = null;
      }
      if (tacticalMarkingsControllerRef.current) {
        tacticalMarkingsControllerRef.current.clear();
        tacticalMarkingsControllerRef.current = null;
      }
      map.remove();
      mapRef.current = null;
      layerGroupsRef.current = null;
      activeTileLayerRef.current = null;
      tileSignatureRef.current = null;
      tileMapRef.current = {};
    };
  }, []);

  // Re-build dynamic tile layers whenever campaign theatre changes
  useEffect(() => {
    const map = mapRef.current;
    const header = mapData?.campaign;
    if (!map || !header) return;

    const theatreSig = JSON.stringify([
      header.id,
      header.theatre,
      header.theatreDcsName,
      header.bounds ?? null,
    ]);
    if (tileSignatureRef.current === theatreSig && activeTileLayerRef.current) {
      return;
    }
    tileSignatureRef.current = theatreSig;

    const built = createDcsTileLayers(header.theatre, header.theatreDcsName, header.bounds);
    tileMapRef.current = built.layers;
    setTileNames(built.names);

    const chosen = built.layers[activeTileName] ? activeTileName : built.defaultName;
    setActiveTileName(chosen);

    if (activeTileLayerRef.current && map.hasLayer(activeTileLayerRef.current)) {
      map.removeLayer(activeTileLayerRef.current);
    }
    const nextLayer = built.layers[chosen];
    if (nextLayer) {
      nextLayer.addTo(map);
      activeTileLayerRef.current = nextLayer;
    }

    if (!initialFitDoneRef.current) {
      initialFitDoneRef.current = true;
      if (Array.isArray(header.bounds) && header.bounds.length > 0) {
        try {
          const b = L.latLngBounds(header.bounds as any);
          if (b.isValid()) {
            map.fitBounds(b, { padding: [30, 30] });
            return;
          }
        } catch {
          // fallback below
        }
      }
      if (
        header.center &&
        Number.isFinite(header.center.lat) &&
        Number.isFinite(header.center.lng)
      ) {
        map.setView([header.center.lat, header.center.lng], header.center.zoom || 7);
      }
    }
  }, [mapData?.campaign]);

  const handleSelectTile = useCallback((name: string) => {
    const map = mapRef.current;
    const layer = tileMapRef.current[name];
    if (!map || !layer) return;
    if (activeTileLayerRef.current && map.hasLayer(activeTileLayerRef.current)) {
      map.removeLayer(activeTileLayerRef.current);
    }
    layer.addTo(map);
    activeTileLayerRef.current = layer;
    setActiveTileName(name);
  }, []);

  // Sync Focus Mode resize
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const t = window.setTimeout(() => map.invalidateSize(), 120);
    return () => window.clearTimeout(t);
  }, [isFocusMode]);

  // Keep Leaflet viewport synced cleanly on ultrawide / sidebar / monitor resizes
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    let rafId: number | null = null;
    const observer = new ResizeObserver(() => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(() => {
        mapRef.current?.invalidateSize({ animate: false });
      });
    });
    observer.observe(container);
    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, []);

  // Open a specific flight plan into activePlan + open Flight Planner floating window
  const mutatePlan = useCallback(
    (updater: (prev: FlightPlanDetail) => FlightPlanDetail) => {
      setActivePlan((prev) => {
        if (!prev) return prev;
        return updater(prev);
      });
      setIsPlanDirty(true);
      setDirtyVersion((v) => v + 1);
    },
    []
  );

  const handleMarkSaved = useCallback(() => {
    setIsPlanDirty(false);
  }, []);

  const handlePlanChange = useCallback(
    (nextPlan: FlightPlanDetail | null) => {
      if (!nextPlan) {
        setActivePlan(null);
        setActiveSequence(1);
        setUserCreatedSequences([1]);
        setSequenceColors({});
        setAvionicsDrawTarget(null);
        return;
      }
      setActivePlan(nextPlan);
    },
    []
  );

  const autoFetchPointElevation = useCallback(
    async (pointIndex: number, lat: number, lng: number, isTarget: boolean) => {
      let elevFt: number | null = null;
      try {
        elevFt = await fetchTerrainElevation(baseUrl, lat, lng, authToken);
      } catch {
        elevFt = null;
      }

      if (elevFt === null) {
        await new Promise<void>((resolve) => {
          lookupTerrariumElevationFt(lat, lng, (resFt) => {
            if (resFt !== null && Number.isFinite(resFt)) {
              elevFt = Math.round(resFt);
            }
            resolve();
          });
        });
      }

      if (elevFt === null || !Number.isFinite(elevFt)) return;
      const finalElev = Math.round(elevFt);

      setActivePlan((prev) => {
        if (!prev || !Array.isArray(prev.route_points) || !prev.route_points[pointIndex]) {
          return prev;
        }
        const pts = [...prev.route_points];
        const pt = { ...pts[pointIndex] };
        pt.elev = finalElev;
        if (isTarget) {
          pt.alt = finalElev;
        }
        pts[pointIndex] = pt;
        return { ...prev, route_points: pts };
      });
      setIsPlanDirty(true);
      setDirtyVersion((v) => v + 1);
    },
    [baseUrl, discordId, authToken]
  );

  const handleOpenFlightPlan = useCallback(
    async (planId: number) => {
      try {
        const detail = await fetchFlightPlanDetail(baseUrl, planId, authToken, discordId);
        const af =
          mapData?.airframesCatalog?.find((a) => Number(a.id) === Number(detail.airframe_id)) ||
          null;
        const normalized = mapData ? normalizePlanForEditor(detail, mapData, af) : detail;
        setActivePlan(normalized);
        setActiveSequence(1);
        const seqs = getAvailableSequences(normalized.route_points || [], [1]);
        setUserCreatedSequences(seqs);
        setSequenceColors((normalized as any).sequence_colors || {});
        setIsPlanDirty(false);
        setDirtyVersion(0);
        setAvionicsDrawTarget(null);
        openWindow('flight');

        const firstPt = detail.route_points?.[0];
        if (firstPt && Number.isFinite(firstPt.lat) && Number.isFinite(firstPt.lng) && mapRef.current) {
          mapRef.current.flyTo([firstPt.lat, firstPt.lng], Math.max(mapRef.current.getZoom(), 9), {
            duration: 0.7,
          });
        }
      } catch (err) {
        addNotification({
          title: 'Flight Plan Load Failed',
          message: err instanceof Error ? err.message : 'Unable to fetch flight plan details.',
          category: 'flight_plan',
        });
      }
    },
    [baseUrl, authToken, discordId, openWindow, addNotification]
  );

  // Consume deep links (`initialMissionId` / `initialFlightPlanId`) once data is loaded
  useEffect(() => {
    if (!mapData || consumedTargetRef.current) return;

    if (initialFlightPlanId) {
      consumedTargetRef.current = true;
      handleOpenFlightPlan(initialFlightPlanId);
      onConsumedInitialTarget?.();
      return;
    }

    if (initialMissionId) {
      const target = mapData.missions.find((m) => m.id === initialMissionId);
      consumedTargetRef.current = true;
      if (target) {
        setSelectedMissionId(target.id);
        setSelectedSortieId(null);
        if (typeof target.lat === 'number' && typeof target.lng === 'number' && mapRef.current) {
          mapRef.current.flyTo([target.lat, target.lng], 10, { duration: 0.8 });
        }
      }
      onConsumedInitialTarget?.();
    }
  }, [mapData, initialMissionId, initialFlightPlanId, handleOpenFlightPlan, onConsumedInitialTarget]);

  // Apply airbase SID/STAR/IAP/Overhead procedure to active flight plan
  // Route & Waypoint Callbacks (1-for-1 Portal Parity)
  const handleAddSequence = useCallback(() => {
    const isF14 = isF14Airframe(activePlanRef.current, null);
    const maxSeq = getMaxSequences(isF14);
    const avail = getAvailableSequences(activePlanRef.current?.route_points || [], userCreatedSequences);
    let nextSeq = 2;
    while (avail.includes(nextSeq) && nextSeq <= maxSeq) nextSeq++;
    if (nextSeq > maxSeq) {
      handleNotify('warning', `Maximum ${maxSeq} sequences reached for this airframe.`);
      return;
    }
    setUserCreatedSequences((prev) => Array.from(new Set([...prev, nextSeq])).sort((a, b) => a - b));
    setActiveSequence(nextSeq);
  }, [userCreatedSequences, handleNotify]);

  const handleDeleteSequence = useCallback(
    (seq: number) => {
      if (seq <= 1) return;
      mutatePlan((prev) => {
        const nextPts = (prev.route_points || []).filter((p) => !isSequenceTrackPoint(p, seq));
        return { ...prev, route_points: recalculateTransitSpeeds(nextPts) };
      });
      setUserCreatedSequences((prev) => prev.filter((s) => s !== seq));
      setActiveSequence((prev) => (prev === seq ? 1 : prev));
    },
    [mutatePlan]
  );

  const handleSetSequenceColor = useCallback(
    (seq: number, color: string) => {
      setSequenceColors((prev) => ({ ...prev, [seq]: color }));
      if (seq === 1) {
        mutatePlan((p) => ({ ...p, color }));
      } else {
        setIsPlanDirty(true);
        setDirtyVersion((v) => v + 1);
      }
    },
    [mutatePlan]
  );

  const handleInsertOrAppendWaypoint = useCallback(
    (latlng: L.LatLng, targetSeq = activeSequence) => {
      const plan = activePlanRef.current;
      const map = mapRef.current;
      if (!plan || !map || !mapData?.permissions.canManageFlightPlans) return;

      const af =
        mapData.airframesCatalog.find((a) => Number(a.id) === Number(plan.airframe_id)) || null;
      const isF14 = isF14Airframe(plan, af);
      const pts = [...(plan.route_points || [])];

      if (isF14) {
        const trackPts = pts.filter(
          (p) => !isTargetPoint(p) && !isAdditionalPoint(p) && !isDivertPoint(p)
        );
        if (trackPts.length >= 12) {
          handleNotify('warning', 'F-14 Navigation Route limited to 12 waypoints.');
          return;
        }
      }

      const seqIndices = pts
        .map((pt, globalIdx) => ({ pt, globalIdx }))
        .filter(({ pt }) => isSequenceTrackPoint(pt, targetSeq));

      let spliceAfterGlobalIdx: number | null = null;
      let bestDistPx = 40;
      const clickPt = map.latLngToLayerPoint(latlng);

      for (let i = 0; i < seqIndices.length - 1; i++) {
        const a = seqIndices[i].pt;
        const b = seqIndices[i + 1].pt;
        const p1 = map.latLngToLayerPoint([a.lat, a.lng]);
        const p2 = map.latLngToLayerPoint([b.lat, b.lng]);
        const dist = L.LineUtil.pointToSegmentDistance(clickPt, p1, p2);
        if (dist < bestDistPx) {
          bestDistPx = dist;
          spliceAfterGlobalIdx = seqIndices[i].globalIdx;
        }
      }

      const cleanLat = Number(latlng.lat.toFixed(6));
      const cleanLng = Number(latlng.lng.toFixed(6));

      let alt = 20000;
      let speed = 350;
      let insertAt = pts.length;

      if (spliceAfterGlobalIdx !== null) {
        insertAt = spliceAfterGlobalIdx + 1;
        const prevWp = pts[spliceAfterGlobalIdx];
        const nextWp = pts[spliceAfterGlobalIdx + 1];
        if (prevWp && nextWp) {
          alt = Math.round(((Number(prevWp.alt) || 20000) + (Number(nextWp.alt) || 20000)) / 2);
          speed = Math.round(((Number(prevWp.speed) || 350) + (Number(nextWp.speed) || 350)) / 2);
        }
      } else if (seqIndices.length > 0) {
        const lastSeq = seqIndices[seqIndices.length - 1];
        insertAt = lastSeq.globalIdx + 1;
        alt = Number(lastSeq.pt.alt) || 20000;
        speed = Number(lastSeq.pt.speed) || 350;
      } else {
        // Place before trailing Targets / Additional / Diverts
        const firstNonTrack = pts.findIndex(
          (p) => isTargetPoint(p) || isAdditionalPoint(p) || isDivertPoint(p)
        );
        insertAt = firstNonTrack === -1 ? pts.length : firstNonTrack;
      }

      const newWp: FlightPlanRoutePoint = {
        index: insertAt,
        name: spliceAfterGlobalIdx !== null ? 'SPLICE PT' : `WP ${seqIndices.length + 1}`,
        lat: cleanLat,
        lng: cleanLng,
        alt,
        speed,
        elev: 0,
        action: 'Turning Point',
        type: 'Turning Point',
        sequence: targetSeq,
        mgrs: toMgrs(cleanLat, cleanLng),
        lldm: formatCoordinateDdm(cleanLat, cleanLng),
        dms: formatCoordinateDms(cleanLat, cleanLng),
      };

      pts.splice(insertAt, 0, newWp);
      const indexed = recalculateTransitSpeeds(
        pts.map((p, idx) => ({ ...p, index: idx }))
      );

      setActivePlan((prev) => (prev ? { ...prev, route_points: indexed } : prev));
      setIsPlanDirty(true);
      setDirtyVersion((v) => v + 1);
      void autoFetchPointElevation(insertAt, cleanLat, cleanLng, false);
    },
    [activeSequence, mapData, autoFetchPointElevation, handleNotify]
  );

  handleInsertOrAppendWaypointRef.current = handleInsertOrAppendWaypoint;

  const handleAddPointFromCoords = useCallback(
    (lat: number, lng: number, name?: string) => {
      const plan = activePlanRef.current;
      if (!plan || !mapData?.permissions.canManageFlightPlans) return;
      const cleanLat = Number(lat.toFixed(6));
      const cleanLng = Number(lng.toFixed(6));
      const pts = [...(plan.route_points || [])];
      const seqPts = pts.filter((p) => isSequenceTrackPoint(p, activeSequence));
      const firstNonTrack = pts.findIndex(
        (p) => isTargetPoint(p) || isAdditionalPoint(p) || isDivertPoint(p)
      );
      let lastSeqIdx = -1;
      for (let i = pts.length - 1; i >= 0; i--) {
        if (isSequenceTrackPoint(pts[i], activeSequence)) {
          lastSeqIdx = i;
          break;
        }
      }
      const insertAt =
        seqPts.length > 0 && lastSeqIdx >= 0
          ? lastSeqIdx + 1
          : firstNonTrack === -1
            ? pts.length
            : firstNonTrack;

      const lastPt = seqPts[seqPts.length - 1];
      const newWp: FlightPlanRoutePoint = {
        index: insertAt,
        name: name || `WP ${seqPts.length + 1}`,
        lat: cleanLat,
        lng: cleanLng,
        alt: lastPt ? Number(lastPt.alt) || 20000 : 20000,
        speed: lastPt ? Number(lastPt.speed) || 350 : 350,
        elev: 0,
        action: 'Turning Point',
        type: 'Turning Point',
        sequence: activeSequence,
        mgrs: toMgrs(cleanLat, cleanLng),
        lldm: formatCoordinateDdm(cleanLat, cleanLng),
        dms: formatCoordinateDms(cleanLat, cleanLng),
      };
      pts.splice(insertAt, 0, newWp);
      const indexed = recalculateTransitSpeeds(pts.map((p, i) => ({ ...p, index: i })));
      setActivePlan((prev) => (prev ? { ...prev, route_points: indexed } : prev));
      setIsPlanDirty(true);
      setDirtyVersion((v) => v + 1);
      mapRef.current?.panTo([cleanLat, cleanLng]);
      void autoFetchPointElevation(insertAt, cleanLat, cleanLng, false);
    },
    [activeSequence, mapData, autoFetchPointElevation]
  );

  const handleAddTargetPoint = useCallback(
    (coords: { lat: number; lng: number }, customData?: Partial<FlightPlanRoutePoint>) => {
      const plan = activePlanRef.current;
      if (!plan || !mapData?.permissions.canManageFlightPlans) return;
      const cleanLat = Number(coords.lat.toFixed(6));
      const cleanLng = Number(coords.lng.toFixed(6));
      const pts = [...(plan.route_points || [])];
      const existingTgts = pts.filter((p) => isTargetPoint(p));
      const insertAt = pts.length;
      const newTgt: FlightPlanRoutePoint = {
        index: insertAt,
        name: customData?.name || `TGT ${existingTgts.length + 1}`,
        lat: cleanLat,
        lng: cleanLng,
        alt: Number(customData?.elev ?? customData?.alt ?? 0),
        elev: Number(customData?.elev ?? 0),
        drop_alt: customData?.drop_alt ?? 30000,
        drop_spd: customData?.drop_spd ?? 450,
        attack_heading: customData?.attack_heading ?? 0,
        speed: Number(customData?.speed ?? 450),
        action: 'TGT',
        type: 'TARGET',
        is_target: true,
        sequence: 1,
        weapon: customData?.weapon || '',
        remarks: customData?.remarks || '',
        notes: customData?.notes || '',
        mgrs: toMgrs(cleanLat, cleanLng),
        lldm: formatCoordinateDdm(cleanLat, cleanLng),
        dms: formatCoordinateDms(cleanLat, cleanLng),
        ...customData,
      };
      pts.push(newTgt);
      const indexed = pts.map((p, i) => ({ ...p, index: i }));
      setActivePlan((prev) => (prev ? { ...prev, route_points: indexed } : prev));
      setIsPlanDirty(true);
      setDirtyVersion((v) => v + 1);
      void autoFetchPointElevation(insertAt, cleanLat, cleanLng, true);
    },
    [mapData, autoFetchPointElevation]
  );

  const handleAddAdditionalPoint = useCallback(
    (coords: { lat: number; lng: number }, customData?: Partial<FlightPlanRoutePoint>) => {
      const plan = activePlanRef.current;
      if (!plan || !mapData?.permissions.canManageFlightPlans) return;
      const pts = [...(plan.route_points || [])];
      const existingAdd = pts.filter((p) => isAdditionalPoint(p));
      if (existingAdd.length >= 40) {
        handleNotify('warning', 'Maximum 40 Additional Points reached for F-14 plan.');
        return;
      }
      const cleanLat = Number(coords.lat.toFixed(6));
      const cleanLng = Number(coords.lng.toFixed(6));
      const insertAt = pts.length;
      const newPt: FlightPlanRoutePoint = {
        index: insertAt,
        name: customData?.name || `AP ${existingAdd.length + 1}`,
        lat: cleanLat,
        lng: cleanLng,
        alt: 0,
        elev: 0,
        speed: 0,
        type: 'LANTIRN',
        action: 'Additional',
        is_additional: true,
        is_lantirn: true,
        sequence: 1,
        mgrs: toMgrs(cleanLat, cleanLng),
        lldm: formatCoordinateDdm(cleanLat, cleanLng),
        dms: formatCoordinateDms(cleanLat, cleanLng),
        ...customData,
      };
      pts.push(newPt);
      const indexed = pts.map((p, i) => ({ ...p, index: i }));
      setActivePlan((prev) => (prev ? { ...prev, route_points: indexed } : prev));
      setIsPlanDirty(true);
      setDirtyVersion((v) => v + 1);
      void autoFetchPointElevation(insertAt, cleanLat, cleanLng, false);
    },
    [mapData, autoFetchPointElevation, handleNotify]
  );

  const handleAddAdditionalAtCenter = useCallback(() => {
    const center = mapRef.current?.getCenter();
    if (!center) return;
    handleAddAdditionalPoint({ lat: center.lat, lng: center.lng });
  }, [handleAddAdditionalPoint]);

  const handleReorderWaypoints = useCallback(
    (seq: number, fromSeqIdx: number, toSeqIdx: number) => {
      mutatePlan((prev) => {
        const pts = [...(prev.route_points || [])];
        const seqGlobalIndices = pts
          .map((p, i) => ({ p, i }))
          .filter(({ p }) => isSequenceTrackPoint(p, seq))
          .map(({ i }) => i);
        if (
          fromSeqIdx < 0 ||
          toSeqIdx < 0 ||
          fromSeqIdx >= seqGlobalIndices.length ||
          toSeqIdx >= seqGlobalIndices.length
        ) {
          return prev;
        }
        const reorderedItems = seqGlobalIndices.map((idx) => pts[idx]);
        const [moved] = reorderedItems.splice(fromSeqIdx, 1);
        reorderedItems.splice(toSeqIdx, 0, moved);
        seqGlobalIndices.forEach((globalIdx, slot) => {
          pts[globalIdx] = reorderedItems[slot];
        });
        return {
          ...prev,
          route_points: recalculateTransitSpeeds(pts.map((p, i) => ({ ...p, index: i }))),
        };
      });
    },
    [mutatePlan]
  );

  const handleUpdatePoint = useCallback(
    (globalIdx: number, patch: Partial<FlightPlanRoutePoint>) => {
      mutatePlan((prev) => {
        const pts = [...(prev.route_points || [])];
        if (!pts[globalIdx]) return prev;
        pts[globalIdx] = { ...pts[globalIdx], ...patch };
        return {
          ...prev,
          route_points: recalculateTransitSpeeds(pts.map((p, i) => ({ ...p, index: i }))),
        };
      });
    },
    [mutatePlan]
  );

  const handleDeletePoint = useCallback(
    (globalIdx: number) => {
      mutatePlan((prev) => {
        const pts = (prev.route_points || []).filter((_, i) => i !== globalIdx);
        return {
          ...prev,
          route_points: recalculateTransitSpeeds(pts.map((p, i) => ({ ...p, index: i }))),
        };
      });
    },
    [mutatePlan]
  );

  const handleSetWaypointSequence = useCallback(
    (globalIdx: number, seq: number) => {
      mutatePlan((prev) => {
        const pts = [...(prev.route_points || [])];
        if (!pts[globalIdx]) return prev;
        pts[globalIdx] = { ...pts[globalIdx], sequence: seq };
        return {
          ...prev,
          route_points: recalculateTransitSpeeds(pts.map((p, i) => ({ ...p, index: i }))),
        };
      });
    },
    [mutatePlan]
  );

  const handlePanToPoint = useCallback((globalIdx: number, openPopup = false) => {
    if (openPopup && activePlanControllerRef.current) {
      activePlanControllerRef.current.panAndOpenPopup(globalIdx);
      return;
    }
    const pt = activePlanRef.current?.route_points?.[globalIdx];
    if (pt && mapRef.current) {
      mapRef.current.panTo([pt.lat, pt.lng]);
    }
  }, []);

  const handleClearRoute = useCallback(() => {
    mutatePlan((prev) => ({ ...prev, route_points: [] }));
  }, [mutatePlan]);

  const handleUpdateTickConfig = useCallback((next: TickConfig) => {
    setTickConfig(next);
    try {
      localStorage.setItem('gtfo_tick_config', JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  }, []);

  const handleUpdateDoghouseConfig = useCallback((next: DoghouseConfig) => {
    setDoghouseConfig(next);
    try {
      localStorage.setItem('gtfo_doghouse_config', next);
    } catch {
      // ignore storage errors
    }
  }, []);

  const handleApplyProcedure = useCallback(
    (
      proc: CampaignMapProcedure,
      mode: 'auto' | 'prepend' | 'append',
      targetSeq = activeSequenceRef.current || 1
    ) => {
      if (!proc || !Array.isArray(proc.waypoints) || proc.waypoints.length === 0) {
        handleNotify('warning', `Procedure "${proc?.name || 'Procedure'}" has no valid waypoints.`);
        return;
      }

      const plan = activePlanRef.current;
      if (!plan) {
        openWindow('flight');
        handleNotify(
          'warning',
          `Open a flight plan first to insert "${proc.name}", then re-click the procedure action.`
        );
        return;
      }

      const seq = targetSeq || 1;
      const procType = (proc.type || '').toLowerCase();
      const resolvedMode: 'prepend' | 'append' =
        mode === 'auto'
          ? procType === 'departure' || procType === 'sid'
            ? 'prepend'
            : 'append'
          : mode;

      let relevantRaw: Array<Record<string, any>> = (proc.waypoints || []) as Array<
        Record<string, any>
      >;
      if (procType === 'overhead_pattern') {
        setLayerStates((prev) => ({ ...prev, airbaseProceduresPattern: true }));
        const initialPt =
          relevantRaw.find((pt) => String(pt.name || '').toUpperCase() === 'INITIAL') ||
          relevantRaw[0];
        relevantRaw = initialPt
          ? [{ ...initialPt, name: 'INITIAL', is_fix: true, type: 'FIX' }]
          : [];
      } else {
        relevantRaw = relevantRaw.filter((pt) => {
          if (pt.type === 'CURVE' || pt.is_curve === true) return false;
          const uName = String(pt.name || '')
            .trim()
            .toUpperCase();
          if (uName.startsWith('PT ') && pt.is_fix === false) return false;
          return true;
        });
      }

      const procWps: FlightPlanRoutePoint[] = relevantRaw
        .filter((w) => Number.isFinite(Number(w.lat)) && Number.isFinite(Number(w.lng)))
        .map((w, idx) => {
          const cleanLat = Number(Number(w.lat).toFixed(6));
          const cleanLng = Number(Number(w.lng).toFixed(6));
          const wpName = String(
            w.name || (procType === 'overhead_pattern' ? 'INITIAL' : `FIX ${idx + 1}`)
          );
          const type =
            wpName === 'FINAL' || wpName === 'ARR'
              ? 'ARR'
              : wpName === 'INITIAL' || wpName === 'DEP'
                ? 'FIX'
                : String(w.type || 'FIX');
          return {
            index: idx,
            name: wpName,
            lat: cleanLat,
            lng: cleanLng,
            alt:
              w.alt !== undefined && w.alt !== null && String(w.alt) !== ''
                ? Number(w.alt)
                : proc.initial_altitude
                  ? Number(proc.initial_altitude)
                  : 5000,
            speed:
              w.speed !== undefined && w.speed !== null && String(w.speed) !== ''
                ? Number(w.speed)
                : 300,
            elev: 0,
            action: type,
            type,
            is_fix: true,
            remarks: String(w.remarks || w.notes || proc.name || 'Procedure'),
            sequence: seq,
            mgrs: toMgrs(cleanLat, cleanLng),
            lldm: formatCoordinateDdm(cleanLat, cleanLng),
            dms: formatCoordinateDms(cleanLat, cleanLng),
          };
        });

      if (procWps.length === 0) {
        handleNotify('warning', `Procedure "${proc.name}" has no valid fix waypoints.`);
        return;
      }

      mutatePlan((prev) => {
        // Strip previous procedure curve clutter for this sequence
        const cleaned = (prev.route_points || []).filter((fd) => {
          const uName = (fd.name || '').trim().toUpperCase();
          const isCurveClutter =
            /^PT\s*\d+$/i.test(uName) &&
            (fd.type === 'CURVE' ||
              String(fd.remarks || '').includes('Overhead') ||
              String(fd.remarks || '').includes('Turn'));
          const sameSeq = Number(fd.sequence || 1) === seq;
          return !(isCurveClutter && sameSeq);
        });

        const seqIndices = cleaned
          .map((pt, globalIdx) => ({ pt, globalIdx }))
          .filter(({ pt }) => isSequenceTrackPoint(pt, seq));

        let insertAt = cleaned.length;
        if (resolvedMode === 'prepend') {
          const depItem = seqIndices.find(
            ({ pt }) => String(pt.type || '').toUpperCase() === 'DEP'
          );
          if (depItem) {
            insertAt = depItem.globalIdx + 1;
          } else if (seqIndices.length > 0) {
            insertAt = seqIndices[0].globalIdx;
          } else {
            const firstNonTrack = cleaned.findIndex(
              (p) => isTargetPoint(p) || isAdditionalPoint(p) || isDivertPoint(p)
            );
            insertAt = firstNonTrack === -1 ? cleaned.length : firstNonTrack;
          }
        } else {
          const arrItem = seqIndices.find(
            ({ pt }) => String(pt.type || '').toUpperCase() === 'ARR'
          );
          if (arrItem) {
            insertAt = arrItem.globalIdx;
          } else if (seqIndices.length > 0) {
            insertAt = seqIndices[seqIndices.length - 1].globalIdx + 1;
          } else {
            const firstNonTrack = cleaned.findIndex(
              (p) => isTargetPoint(p) || isAdditionalPoint(p) || isDivertPoint(p)
            );
            insertAt = firstNonTrack === -1 ? cleaned.length : firstNonTrack;
          }
        }

        const merged = [...cleaned];
        merged.splice(insertAt, 0, ...procWps);
        const recalculated = recalculateTransitSpeeds(
          merged.map((pt, i) => ({ ...pt, index: i }))
        );

        return {
          ...prev,
          ...(procType === 'overhead_pattern' ? { overhead_pattern: proc } : {}),
          route_points: recalculated,
        };
      });

      openWindow('flight');
    },
    [mutatePlan, openWindow, handleNotify]
  );

  const handleSetAirbaseRole = useCallback(
    (airbase: CampaignMapAirbase, role: 'departure' | 'destination') => {
      const plan = activePlanRef.current;
      if (!plan) {
        openWindow('flight');
        handleNotify(
          'warning',
          `Create or select a flight plan in the Flight Planner window to set ${airbase.name} as ${role}.`
        );
        return;
      }
      mutatePlan((prev) => {
        if (role === 'departure') {
          return {
            ...prev,
            departure_airfield: airbase.name,
          };
        }
        return {
          ...prev,
          destination_airfield: airbase.name,
        };
      });
      openWindow('flight');
    },
    [mutatePlan, openWindow, handleNotify]
  );

  const handleToggleDivert = useCallback(
    (airbase: CampaignMapAirbase) => {
      const plan = activePlanRef.current;
      if (!plan) {
        openWindow('flight');
        handleNotify(
          'warning',
          `Create or select a flight plan to toggle ${airbase.name} as a divert airfield.`
        );
        return;
      }
      const matchKey = airbase.name.trim().toLowerCase();
      const icaoKey = (airbase.icao || '').trim().toLowerCase();
      const exists = (plan.diverts || []).some((d) => {
        const dName = (typeof d === 'string' ? d : d?.name || d?.icao || '').trim().toLowerCase();
        return dName === matchKey || (icaoKey !== '' && dName === icaoKey);
      });
      mutatePlan((prev) => {
        const current = Array.isArray(prev.diverts) ? [...prev.diverts] : [];
        const nextDiverts = exists
          ? current.filter((d) => {
              const dName = (typeof d === 'string' ? d : d?.name || d?.icao || '')
                .trim()
                .toLowerCase();
              return dName !== matchKey && (!icaoKey || dName !== icaoKey);
            })
          : [...current, { name: airbase.name, icao: airbase.icao || undefined }];
        return { ...prev, diverts: nextDiverts };
      });
      openWindow('flight');
    },
    [mutatePlan, openWindow, handleNotify]
  );

  // Sync Leaflet LayerGroup mount state to layerStates
  useEffect(() => {
    const map = mapRef.current;
    const g = layerGroupsRef.current;
    if (!map || !g) return;

    const pairs: Array<[keyof PortalLayerStates, L.LayerGroup]> = [
      ['airbasesBlue', g.airbasesBlue],
      ['airbasesRed', g.airbasesRed],
      ['airbasesNeutral', g.airbasesNeutral],
      ['airbaseProceduresDeparture', g.airbaseProceduresDeparture],
      ['airbaseProceduresArrival', g.airbaseProceduresArrival],
      ['airbaseProceduresApproach', g.airbaseProceduresApproach],
      ['airbaseProceduresPattern', g.airbaseProceduresPattern],
      ['tacticalMarkings', g.tacticalMarkings],
      ['navaids', g.navaids],
      ['bullseye', g.bullseye],
      ['frontline', g.frontline],
      ['supportAssets', g.supportAssets],
      ['threats', g.threats],
      ['missions', g.missions],
      ['flightPlans', g.flightPlans],
      ['logistics', g.logistics],
    ];

    pairs.forEach(([key, grp]) => {
      const enabled = layerStates[key];
      if (enabled && !map.hasLayer(grp)) grp.addTo(map);
      if (!enabled && map.hasLayer(grp)) map.removeLayer(grp);
    });
  }, [layerStates]);

  // Re-render all portal Leaflet layers when mapData, filters, overlays, or activePlan update
  const renderAllLayers = useCallback(() => {
    const map = mapRef.current;
    const g = layerGroupsRef.current;
    if (!map || !g || !mapData) return;

    renderTheatreBounds(g.theatreBounds, mapData.campaign.bounds, mapData.campaign.theatre);
    renderPolygonGroupsLayer(g.polygonGroups, mapData.polygonGroups || [], polygonGroupStates);
    renderFrontLineLayer(g.frontline, mapData.frontLine || []);
    renderBullseyesLayer(g.bullseye, mapData.bullseyes || []);
    renderNavaidsLayer(map, g.navaids, mapData.navaids || [], layerStates.navaids);

    renderAirbasesLayer(
      { blue: g.airbasesBlue, red: g.airbasesRed, neutral: g.airbasesNeutral },
      mapData.airbases || [],
      activePlanRef.current,
      {
        onApplyProcedure: handleApplyProcedure,
        onSetAirbaseRole: handleSetAirbaseRole,
        onToggleDivert: handleToggleDivert,
      }
    );

    renderAirbaseProceduresLayer(
      {
        departure: g.airbaseProceduresDeparture,
        arrival: g.airbaseProceduresArrival,
        approach: g.airbaseProceduresApproach,
        overhead_pattern: g.airbaseProceduresPattern,
      },
      mapData.airbases || [],
      handleApplyProcedure
    );

    renderMissionsLayer(map, g.missions, mapData.missions || [], unit, (missionId, tab) => {
      setSelectedCampaignMissionSection(tab === 'objectives' ? 'objectives' : 'overview');
      setSelectedCampaignMissionId(missionId);
    });

    renderClusteredFlightPlansLayer(
      map,
      g.flightPlans,
      mapData.flightPlans?.allPlans || [],
      activePlanRef.current?.id,
      selectedMissionId,
      selectedSortieId,
      unit,
      handleOpenFlightPlan
    );

    renderLogisticsLayer(map, g.logistics, mapData.logisticsRequests || []);

    renderThreatsLayer(
      g.threats,
      mapData.threats || [],
      mapData.threatTypes || [],
      mapData.samSystems || [],
      mapData.permissions.canManageThreats,
      (_threat, idx) => {
        if (!mapData.permissions.canManageThreats) return;
        setFocusThreatIndex(idx);
        openWindow('threats');
      }
    );
  }, [
    mapData,
    polygonGroupStates,
    layerStates.navaids,
    selectedMissionId,
    selectedSortieId,
    handleApplyProcedure,
    handleSetAirbaseRole,
    handleToggleDivert,
    handleOpenFlightPlan,
    setSelectedCampaignMissionId,
    setSelectedCampaignMissionSection,
    openWindow,
  ]);

  useEffect(() => {
    renderAllLayers();
  }, [renderAllLayers]);

  // Focused refresh for airbase indicators when flight plan departure/destination/diverts change
  useEffect(() => {
    const g = layerGroupsRef.current;
    if (!g || !mapData) return;
    renderAirbasesLayer(
      { blue: g.airbasesBlue, red: g.airbasesRed, neutral: g.airbasesNeutral },
      mapData.airbases || [],
      activePlanRef.current,
      {
        onApplyProcedure: handleApplyProcedure,
        onSetAirbaseRole: handleSetAirbaseRole,
        onToggleDivert: handleToggleDivert,
      }
    );
  }, [
    activePlan?.departure_airfield,
    activePlan?.destination_airfield,
    activePlan?.diverts,
    mapData,
    handleApplyProcedure,
    handleSetAirbaseRole,
    handleToggleDivert,
  ]);

  // Focused refresh for inactive clustered flight plans when active plan ID switches
  useEffect(() => {
    const g = layerGroupsRef.current;
    const map = mapRef.current;
    if (!g || !map || !mapData) return;
    renderClusteredFlightPlansLayer(
      map,
      g.flightPlans,
      mapData.flightPlans?.allPlans || [],
      activePlanRef.current?.id,
      selectedMissionId,
      selectedSortieId,
      unit,
      handleOpenFlightPlan
    );
  }, [activePlan?.id, mapData, selectedMissionId, selectedSortieId, unit, handleOpenFlightPlan]);

  // Zoom-dependent layer re-renders (NAVAIDs zoom >= 7, Logistics Bezier scaling, Flight Plan clustering)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapData) return;

    const handleZoom = () => {
      const g = layerGroupsRef.current;
      if (!g) return;
      renderNavaidsLayer(map, g.navaids, mapData.navaids || [], layerStates.navaids);
      renderLogisticsLayer(map, g.logistics, mapData.logisticsRequests || []);
      renderClusteredFlightPlansLayer(
        map,
        g.flightPlans,
        mapData.flightPlans?.allPlans || [],
        activePlanRef.current?.id,
        selectedMissionId,
        selectedSortieId,
        unit,
        handleOpenFlightPlan
      );
    };

    map.on('zoomend', handleZoom);
    return () => {
      map.off('zoomend', handleZoom);
    };
  }, [
    mapData,
    layerStates.navaids,
    selectedMissionId,
    selectedSortieId,
    unit,
    handleOpenFlightPlan,
  ]);

  // Mount & sync ActiveFlightPlanMapController (persistent smooth drag + avionics overlays)
  useEffect(() => {
    const map = mapRef.current;
    const g = layerGroupsRef.current;
    if (!map || !g) return;

    const callbacks = {
      onInsertOrAppendWaypoint: (latlng: L.LatLng, seq: number) =>
        handleInsertOrAppendWaypoint(latlng, seq),
      onCommitPoints: (nextPoints: FlightPlanRoutePoint[]) => {
        mutatePlan((prev) => ({ ...prev, route_points: nextPoints }));
      },
      onUpdatePoint: handleUpdatePoint,
      onDeletePoint: handleDeletePoint,
      onAutoFetchPointElevation: (idx: number, lat: number, lng: number, isTgt: boolean) => {
        void autoFetchPointElevation(idx, lat, lng, isTgt);
      },
      onMutatePlan: mutatePlan,
      onAvionicsDrawClick: (latlng: L.LatLng) => {
        if (!avionicsDrawTarget || !activePlanRef.current) return;
        const res = appendPointToAvionicsDrawTarget(
          activePlanRef.current,
          avionicsDrawTarget,
          latlng.lat,
          latlng.lng,
          handleNotify
        );
        setActivePlan(res.plan);
        setIsPlanDirty(true);
        setDirtyVersion((v) => v + 1);
        if (res.stopDraw) {
          setAvionicsDrawTarget(null);
        }
      },
    };

    if (!activePlanControllerRef.current) {
      activePlanControllerRef.current = new ActiveFlightPlanMapController(map, g.activePlan, callbacks);
    } else {
      activePlanControllerRef.current.setCallbacks(callbacks);
    }

    const af =
      mapData?.airframesCatalog?.find((a) => Number(a.id) === Number(activePlan?.airframe_id)) ||
      null;
    const isF14 = isF14Airframe(activePlan, af);
    const isF16 = isF16Airframe(activePlan, af);
    const isF18 = isF18Airframe(activePlan, af);
    const isJf17 = isJf17Airframe(activePlan, af);

    activePlanControllerRef.current.sync({
      plan: activePlan,
      airframe: af,
      mapData,
      editable: Boolean(
        activePlan && activePlan.can_edit !== false && mapData?.permissions.canManageFlightPlans
      ),
      isOpen: openWindows.flight,
      unit,
      activeSequence,
      userCreatedSequences,
      sequenceColors,
      tickConfig,
      doghouseConfig,
      activeDrawTarget: avionicsDrawTarget,
      isF14,
      isF16,
      isF18,
      isJf17,
    });
  }, [
    activePlan,
    mapData,
    openWindows.flight,
    unit,
    activeSequence,
    userCreatedSequences,
    sequenceColors,
    tickConfig,
    doghouseConfig,
    avionicsDrawTarget,
    handleInsertOrAppendWaypoint,
    mutatePlan,
    handleUpdatePoint,
    handleDeletePoint,
    autoFetchPointElevation,
    handleNotify,
  ]);

  // Mount & sync SupportAssetsMapController (direct map click, smooth drag, inline popups)
  useEffect(() => {
    const map = mapRef.current;
    const g = layerGroupsRef.current;
    if (!map || !g) return;

    if (!supportAssetsControllerRef.current) {
      supportAssetsControllerRef.current = new SupportAssetsMapController(
        map,
        g.supportAssets,
        setSupportAssetStats
      );
    } else {
      supportAssetsControllerRef.current.setOnStatsChange(setSupportAssetStats);
    }

    supportAssetsControllerRef.current.setSelectedAssetType(selectedSupportAssetType);

    if (mapData) {
      supportAssetsControllerRef.current.sync({
        campaignId: mapData.campaign.id,
        assets: mapData.supportAssets || [],
        supportAssetTypes: mapData.supportAssetTypes || [],
        samSystems: mapData.samSystems || [],
        unit,
        editMode: Boolean(openWindows.support && mapData.permissions.canManageSupportAssets),
        focusAssetIndex,
      });
    }
  }, [mapData, unit, openWindows.support, selectedSupportAssetType, focusAssetIndex]);

  // Mount & sync TacticalMarkingsMapController (pure-Leaflet interactive drawing & vertex handles)
  useEffect(() => {
    const map = mapRef.current;
    const g = layerGroupsRef.current;
    if (!map || !g) return;

    const callbacks: TacticalMarkingsControllerCallbacks = {
      onSelectMarking: (marking) => {
        setEditingMarking(marking);
        openWindow('markings');
      },
      onDeselectMarking: () => {
        setEditingMarking(null);
      },
      onDrawStateChange: (isDrawing, shape) => {
        setTmIsDrawing(isDrawing);
        setTmDrawShape(shape);
      },
      onCompleteDraw: async (result) => {
        const currentData = mapDataRef.current;
        if (!currentData) return;
        const prevIds = new Set((currentData.tacticalMarkings || []).map((m) => Number(m.id)));
        const scope = tmScopeRef.current;
        try {
          const fresh = await saveCampaignTacticalMarking(
            baseUrl,
            currentData.campaign.id,
            {
              marking_type: result.marking_type,
              geometry: result.geometry,
              properties: result.properties,
              visibility: scope.visibility,
              mission_id: scope.visibility === 'mission' ? scope.missionId : null,
              sortie_id: scope.visibility === 'sortie' ? scope.sortieId : null,
            },
            { discordId, token: authToken }
          );
          setMapData((prev) => (prev ? { ...prev, tacticalMarkings: fresh } : prev));
          const created =
            fresh.find((m) => !prevIds.has(Number(m.id)) && m.can_edit !== false) ||
            null;
          if (created) {
            setEditingMarking(created);
          }
          handleNotify('success', 'Tactical marking saved.');
        } catch (err: any) {
          handleNotify('error', err?.message || 'Failed to save tactical marking.');
        }
      },
      onCommitGeometry: async (markingId, geometry, propertyPatch) => {
        const currentData = mapDataRef.current;
        if (!currentData) return;
        const existing = (currentData.tacticalMarkings || []).find(
          (m) => Number(m.id) === Number(markingId)
        );
        if (!existing) return;

        const mergedProperties = propertyPatch
          ? { ...(existing.properties || {}), ...propertyPatch }
          : { ...(existing.properties || {}) };
        const optimistic: CampaignMapTacticalMarking = {
          ...existing,
          geometry,
          properties: mergedProperties,
        };

        setMapData((prev) =>
          prev
            ? {
                ...prev,
                tacticalMarkings: (prev.tacticalMarkings || []).map((m) =>
                  Number(m.id) === Number(markingId) ? optimistic : m
                ),
              }
            : prev
        );
        if (editingMarkingIdRef.current === markingId) {
          setEditingMarking(optimistic);
        }

        try {
          const fresh = await saveCampaignTacticalMarking(
            baseUrl,
            currentData.campaign.id,
            {
              id: markingId,
              marking_type: existing.marking_type,
              geometry,
              properties: mergedProperties,
              visibility: existing.visibility,
              mission_id: existing.mission_id ?? null,
              sortie_id: existing.sortie_id ?? null,
            },
            { discordId, token: authToken }
          );
          setMapData((prev) => (prev ? { ...prev, tacticalMarkings: fresh } : prev));
          const synced = fresh.find((m) => Number(m.id) === Number(markingId)) || null;
          if (synced && editingMarkingIdRef.current === markingId) {
            setEditingMarking(synced);
          }
        } catch (err: any) {
          handleNotify('error', err?.message || 'Failed to update tactical marking geometry.');
        }
      },
    };

    if (!tacticalMarkingsControllerRef.current) {
      tacticalMarkingsControllerRef.current = new TacticalMarkingsMapController(
        map,
        g.tacticalMarkings,
        g.tacticalDraft,
        callbacks
      );
    } else {
      tacticalMarkingsControllerRef.current.setCallbacks(callbacks);
    }

    if (mapData) {
      tacticalMarkingsControllerRef.current.sync({
        markings: mapData.tacticalMarkings || [],
        icons: mapData.tacticalIcons || {},
        selectedMissionId,
        selectedSortieId,
        editingMarkingId: editingMarking?.id ?? null,
        isModeActive: openWindows.markings,
      });
    }
  }, [
    mapData,
    selectedMissionId,
    selectedSortieId,
    editingMarking,
    openWindows.markings,
    baseUrl,
    discordId,
    authToken,
    openWindow,
    handleNotify,
  ]);

  // Render Measure polyline & markers
  useEffect(() => {
    const g = layerGroupsRef.current;
    if (!g) return;
    g.measure.clearLayers();
    if (measurePoints.length === 0) return;

    const parsedSpeed = Number(measureSpeedInput);
    const validSpeed = Number.isFinite(parsedSpeed) && parsedSpeed > 0 ? parsedSpeed : 0;

    const coords = measurePoints.map((p) => [p.lat, p.lng] as [number, number]);
    if (coords.length >= 2) {
      L.polyline(coords, {
        color: '#22d3ee',
        weight: 2.5,
        dashArray: '6, 6',
      }).addTo(g.measure);

      for (let i = 0; i < coords.length - 1; i++) {
        const p1 = measurePoints[i];
        const p2 = measurePoints[i + 1];
        const distNm = calculateDistanceNm(p1.lat, p1.lng, p2.lat, p2.lng);
        const legDist = unit === 'km' ? distNm * 1.852 : distNm;
        const distLabel = unit === 'km' ? `${legDist.toFixed(1)} KM` : `${legDist.toFixed(1)} NM`;
        const brg = ((Math.round(calculateBearingDegrees(p1.lat, p1.lng, p2.lat, p2.lng)) % 360) + 360) % 360;
        const brgStr = String(brg === 0 ? 360 : brg).padStart(3, '0');
        const legEteHtml =
          validSpeed > 0
            ? `<span style="color:#34d399;margin-left:6px;">${formatDurationSeconds((legDist / validSpeed) * 3600)}</span>`
            : '';
        const label = `${distLabel} / ${brgStr}°${legEteHtml}`;
        const midLat = (p1.lat + p2.lat) / 2;
        const midLng = (p1.lng + p2.lng) / 2;
        L.marker([midLat, midLng], {
          interactive: false,
          icon: L.divIcon({
            className: 'bg-transparent border-0',
            html: `<div style="background:rgba(12,10,9,0.92);border:1px solid rgba(34,211,238,0.65);color:#67e8f9;font-size:10px;font-weight:700;padding:1px 6px;border-radius:4px;white-space:nowrap;transform:translate(-50%,-50%);display:inline-block;">${label}</div>`,
          }),
        }).addTo(g.measure);
      }
    }

    measurePoints.forEach((pt, idx) => {
      L.circleMarker([pt.lat, pt.lng], {
        radius: 5,
        color: '#22d3ee',
        fillColor: '#083344',
        fillOpacity: 1,
        weight: 2,
      })
        .bindTooltip(`M${idx + 1}`, { direction: 'top', className: 'gtfo-map-tooltip' })
        .addTo(g.measure);
    });
  }, [measurePoints, unit, measureSpeedInput]);

  // Render Coordinate Converter Ping / Pin marker
  useEffect(() => {
    const g = layerGroupsRef.current;
    if (!g) return;
    g.converterPin.clearLayers();
    if (!converterPin) return;

    const icon = L.divIcon({
      className: 'bg-transparent border-0',
      iconSize: [40, 40],
      iconAnchor: [20, 20],
      html: `
        <div class="relative w-10 h-10 flex items-center justify-center pointer-events-none">
          <span class="absolute w-9 h-9 rounded-full border-2 border-sky-400 bg-sky-500/25 animate-ping"></span>
          <span class="absolute w-7 h-7 rounded-full border border-sky-400/70 bg-sky-500/15"></span>
          <span class="relative w-3 h-3 rounded-full bg-sky-500 border-2 border-white shadow-[0_0_12px_rgba(56,189,248,0.95)]"></span>
        </div>
      `,
    });

    const marker = L.marker([converterPin.lat, converterPin.lng], {
      icon,
      zIndexOffset: 1500,
    });
    marker.on('click', (ev) => {
      L.DomEvent.stopPropagation(ev);
    });
    marker.bindTooltip(
      `${formatCoordinateDdm(converterPin.lat, converterPin.lng)} • ${toMgrs(converterPin.lat, converterPin.lng, 5)}`,
      { direction: 'top', offset: [0, -14], className: 'gtfo-map-tooltip' }
    );
    marker.addTo(g.converterPin);
  }, [converterPin]);

  // Interactive Map Pointer, Click, and Context Menu bindings
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleMouseMove = (e: L.LeafletMouseEvent) => {
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;
      setCursorCoords({ lat, lng });

      const seq = ++elevReqSeqRef.current;
      if (elevTimerRef.current) window.clearTimeout(elevTimerRef.current);

      lookupTerrariumElevationFt(lat, lng, (elevFt, failed) => {
        if (elevReqSeqRef.current !== seq) return;
        if (!failed) {
          setCursorElevFt(elevFt);
          return;
        }
        elevTimerRef.current = window.setTimeout(async () => {
          if (elevReqSeqRef.current !== seq) return;
          try {
            const fallbackElev = await fetchTerrainElevation(baseUrl, lat, lng, authToken);
            if (elevReqSeqRef.current === seq) {
              setCursorElevFt(fallbackElev);
            }
          } catch {
            if (elevReqSeqRef.current === seq) {
              setCursorElevFt(null);
            }
          }
        }, 280);
      });
    };

    const handleClick = (e: L.LeafletMouseEvent) => {
      const origTarget = e.originalEvent?.target as HTMLElement | null;
      if (origTarget?.closest('.leaflet-popup')) {
        return;
      }
      setContextMenu(null);
      setFpSettingsOpen(false);
      if (activePlanControllerRef.current?.wasPolylineClickedRecently()) {
        return;
      }
      if (
        tacticalMarkingsControllerRef.current?.wasLayerClickedRecently() ||
        tacticalMarkingsControllerRef.current?.isDrawing()
      ) {
        return;
      }

      const lat = Number(e.latlng.lat.toFixed(6));
      const lng = Number(e.latlng.lng.toFixed(6));
      const canEditPlan = Boolean(
        activePlan && activePlan.can_edit !== false && mapData?.permissions.canManageFlightPlans
      );

      if (avionicsDrawTarget && activePlan && canEditPlan) {
        const res = appendPointToAvionicsDrawTarget(
          activePlan,
          avionicsDrawTarget,
          lat,
          lng,
          handleNotify
        );
        setActivePlan(res.plan);
        setIsPlanDirty(true);
        setDirtyVersion((v) => v + 1);
        if (res.stopDraw) {
          setAvionicsDrawTarget(null);
        }
        return;
      }

      const isCtrlPressed = Boolean(
        e.originalEvent && (e.originalEvent.ctrlKey || e.originalEvent.metaKey)
      );

      if (isCtrlPressed && openWindows.flight && canEditPlan) {
        handleInsertOrAppendWaypoint(e.latlng, activeSequence);
        return;
      }

      if (isPickingMeasure) {
        setMeasurePoints((prev) => [...prev, { lat, lng }]);
        return;
      }
      if (isPickingConverter) {
        setConverterPick({ lat, lng });
        setConverterPin({ lat, lng, seq: Date.now() });
        setIsPickingConverter(false);
        return;
      }
      if (isPickingThreat) {
        setThreatPick({ lat, lng });
        setIsPickingThreat(false);
        return;
      }
      if (openWindows.support && mapData?.permissions.canManageSupportAssets) {
        supportAssetsControllerRef.current?.addPendingAt(lat, lng, true);
        return;
      }
      if (openWindows.markings && editingMarkingIdRef.current !== null && !openWindows.flight) {
        setEditingMarking(null);
        return;
      }
    };

    const handleContextMenu = (e: L.LeafletMouseEvent) => {
      e.originalEvent.preventDefault();
      const container = mapContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const rawX = e.originalEvent.clientX - rect.left;
      const rawY = e.originalEvent.clientY - rect.top;
      setFpSettingsOpen(false);
      setContextMenu({
        x: Math.min(Math.max(12, rawX), Math.max(12, rect.width - 230)),
        y: Math.min(Math.max(12, rawY), Math.max(12, rect.height - 340)),
        lat: Number(e.latlng.lat.toFixed(6)),
        lng: Number(e.latlng.lng.toFixed(6)),
      });
    };

    map.on('mousemove', handleMouseMove);
    map.on('click', handleClick);
    map.on('contextmenu', handleContextMenu);

    return () => {
      map.off('mousemove', handleMouseMove);
      map.off('click', handleClick);
      map.off('contextmenu', handleContextMenu);
      if (elevTimerRef.current) window.clearTimeout(elevTimerRef.current);
    };
  }, [
    baseUrl,
    authToken,
    avionicsDrawTarget,
    activePlan,
    openWindows.flight,
    openWindows.support,
    openWindows.markings,
    activeSequence,
    mapData?.permissions.canManageFlightPlans,
    mapData?.permissions.canManageSupportAssets,
    handleInsertOrAppendWaypoint,
    handleNotify,
    isPickingMeasure,
    isPickingConverter,
    isPickingThreat,
  ]);

  // Keyboard shortcuts matching Member Portal (Alt+F, Alt+C, Alt+M, Alt+U, Alt+Enter, Escape)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clearAllPickModes();
        setEditingMarking(null);
        if (isFocusMode) setIsFocusMode(false);
        return;
      }
      if (!e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'f') {
        e.preventDefault();
        toggleWindow('flight');
      } else if (k === 'c') {
        e.preventDefault();
        toggleWindow('converter');
      } else if (k === 'm') {
        e.preventDefault();
        toggleWindow('measure');
      } else if (k === 'u') {
        e.preventDefault();
        handleChangeUnit(unit === 'nm' ? 'km' : 'nm');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        setIsFocusMode((f) => !f);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [clearAllPickModes, handleChangeUnit, isFocusMode, toggleWindow, unit]);

  // Bullseye HUD formatting
  const braaFormatted = useMemo(() => {
    const bullseyes = mapData?.bullseyes || [];
    if (!cursorCoords || bullseyes.length === 0) return null;
    const be = bullseyes[activeBullseyeIndex] || bullseyes[0];
    if (!be) return null;
    const brg = Math.round(calculateBearingDegrees(be.lat, be.lng, cursorCoords.lat, cursorCoords.lng));
    const nm = calculateDistanceNm(be.lat, be.lng, cursorCoords.lat, cursorCoords.lng);
    const brgStr = String(brg === 0 ? 360 : brg).padStart(3, '0');
    const distStr = unit === 'km' ? `${(nm * 1.852).toFixed(1)} km` : `${Math.round(nm)} nm`;
    return `${brgStr}° / ${distStr}`;
  }, [mapData?.bullseyes, activeBullseyeIndex, cursorCoords, unit]);

  const handleResetPosition = useCallback(() => {
    const map = mapRef.current;
    const header = mapData?.campaign;
    if (!map || !header) return;
    if (Array.isArray(header.bounds) && header.bounds.length > 0) {
      try {
        const b = L.latLngBounds(header.bounds as any);
        if (b.isValid()) {
          map.fitBounds(b, { padding: [30, 30] });
          return;
        }
      } catch {
        // fallback below
      }
    }
    if (header.center && Number.isFinite(header.center.lat) && Number.isFinite(header.center.lng)) {
      map.setView([header.center.lat, header.center.lng], header.center.zoom || 7);
    }
  }, [mapData?.campaign]);

  const handleToggleLayer = useCallback((key: keyof PortalLayerStates) => {
    setLayerStates((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleToggleAllProcedures = useCallback((enabled: boolean) => {
    setLayerStates((prev) => ({
      ...prev,
      airbaseProceduresDeparture: enabled,
      airbaseProceduresArrival: enabled,
      airbaseProceduresApproach: enabled,
      airbaseProceduresPattern: enabled,
    }));
  }, []);

  const activePickPrompt = useMemo(() => {
    if (avionicsDrawTarget) {
      return `${describeAvionicsDrawTarget(avionicsDrawTarget)} — Click map to add (Esc to stop)`;
    }
    if (isPickingMeasure) return 'Measure Tool — Click points on the map to add legs (Esc to stop)';
    if (isPickingConverter) return 'Coordinate Converter — Click map to capture coordinates';
    if (isPickingThreat) return 'Threat Editor — Click map to set SAM/Threat position';
    if (tmIsDrawing) {
      return `Tactical Markings (${(tmDrawShape || 'shape').toUpperCase()}) — Click map to draw (Esc to cancel)`;
    }
    if (openWindows.support && mapData?.permissions.canManageSupportAssets) {
      return 'Support Assets — Click map to place selected asset';
    }
    return null;
  }, [
    avionicsDrawTarget,
    isPickingMeasure,
    isPickingConverter,
    isPickingThreat,
    tmIsDrawing,
    tmDrawShape,
    openWindows.support,
    mapData?.permissions.canManageSupportAssets,
  ]);

  const copyCoordToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      handleNotify('info', `Copied ${label}: ${text}`);
    } catch {
      handleNotify('warning', 'Clipboard access denied.');
    }
    setContextMenu(null);
  };

  // Auto-refresh radial SVG progress ring circumference (r=9 => 56.55)
  const ringCircumference = 2 * Math.PI * 9;
  const ringDashOffset = ringCircumference * (1 - refreshProgress);

  const wrapperClasses = isFocusMode
    ? 'fixed inset-0 !m-0 z-[1050] h-screen w-screen bg-stone-950 flex flex-col'
    : 'relative isolate z-0 w-full flex-1 min-h-[480px] rounded-xl overflow-hidden border border-stone-800 bg-stone-950 flex flex-col shadow-2xl';

  return (
    <>
      <div className={wrapperClasses}>
      {/* Main Map Viewport */}
      <div
        className={`campaign-map-canvas relative flex-1 w-full overflow-hidden ${
          activePickPrompt ? 'gtfo-map-picking' : ''
        }`}
      >
        <div
          ref={mapContainerRef}
          className="w-full h-full bg-[#09090b]"
        />

        {/* Top-Left Portal Toolbar */}
        {mapData && (
          <div className="absolute top-3 left-3 z-[1000] pointer-events-auto">
            <CampaignMapToolbar
              allPlans={mapData.flightPlans?.allPlans || []}
              permissions={mapData.permissions}
              openWindows={openWindows}
              onToggleWindow={toggleWindow}
              onSelectSearchPlan={handleOpenFlightPlan}
            />
          </div>
        )}

        {/* Top-Right Sorties / Tiles / Layers / Refresh */}
        {mapData && (
          <div className="absolute top-3 right-3 z-[1000] pointer-events-auto">
            <CampaignMapLayerControls
              missions={mapData.missions || []}
              polygonGroups={mapData.polygonGroups || []}
              polygonGroupStates={polygonGroupStates}
              onToggleSinglePolygonGroup={(id) =>
                setPolygonGroupStates((prev) => ({ ...prev, [id]: prev[id] === false }))
              }
              onToggleAllPolygonGroups={(enabled) =>
                setPolygonGroupStates((prev) => {
                  const next = { ...prev };
                  (mapData.polygonGroups || []).forEach((pg, idx) => {
                    next[pg.group_name || pg.name || `ao_${idx}`] = enabled;
                  });
                  return next;
                })
              }
              selectedMissionId={selectedMissionId}
              selectedSortieId={selectedSortieId}
              onSelectSortie={(sortieId, missionId) => {
                setSelectedSortieId(sortieId);
                setSelectedMissionId(missionId);
              }}
              tileNames={tileNames}
              activeTileName={activeTileName}
              onSelectTile={handleSelectTile}
              layerStates={layerStates}
              onToggleLayer={handleToggleLayer}
              onToggleAllProcedures={handleToggleAllProcedures}
              isTraining={Boolean(mapData.campaign.isTraining)}
              onManualRefresh={() => loadMapData(true, false)}
              isLoading={isRefreshing || isLoading}
            />
          </div>
        )}

        {/* Active Pick Prompt Banner */}
        {activePickPrompt && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 z-[1050] flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-amber-950/90 border border-amber-500/60 text-amber-200 text-xs font-semibold shadow-2xl backdrop-blur-md">
            <CrosshairSimple className="w-4 h-4 text-amber-400 animate-pulse" />
            <span>{activePickPrompt}</span>
            <button
              type="button"
              onClick={clearAllPickModes}
              className="ml-1 px-2 py-0.5 rounded bg-stone-900/90 hover:bg-stone-800 text-[11px] font-bold text-stone-200 border border-stone-700 cursor-pointer"
            >
              Done
            </button>
          </div>
        )}

        {/* Transient In-Map Feedback Toast (non-blocking) */}
        {mapToast && (
          <div
            className={`absolute bottom-12 left-1/2 -translate-x-1/2 z-[1060] pointer-events-none px-3.5 py-1.5 rounded-full border text-xs font-semibold shadow-2xl backdrop-blur-md transition-all ${
              mapToast.level === 'error'
                ? 'bg-red-950/90 border-red-500/60 text-red-200'
                : mapToast.level === 'warning'
                  ? 'bg-amber-950/90 border-amber-500/60 text-amber-200'
                  : mapToast.level === 'success'
                    ? 'bg-emerald-950/90 border-emerald-500/60 text-emerald-200'
                    : 'bg-stone-900/90 border-stone-700/80 text-stone-200'
            }`}
          >
            {mapToast.message}
          </div>
        )}

        {/* Loading Overlay (initial fetch only) */}
        {isLoading && !mapData && (
          <div className="absolute inset-0 z-[1200] bg-stone-950/85 backdrop-blur-sm flex flex-col items-center justify-center gap-3 text-stone-300">
            <ArrowsClockwise className="w-8 h-8 text-amber-400 animate-spin" />
            <div className="text-sm font-semibold">Loading Campaign Tactical Map...</div>
          </div>
        )}

        {/* Error Overlay */}
        {error && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[1200] flex items-center gap-2.5 px-4 py-2 rounded-lg bg-red-950/95 border border-red-500/60 text-red-200 text-xs shadow-2xl">
            <WarningCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
            <button
              type="button"
              onClick={() => loadMapData(true, false)}
              className="ml-2 px-2 py-0.5 rounded bg-red-800 hover:bg-red-700 text-white font-semibold cursor-pointer"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-red-300 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Right-Click Tactical Context Menu */}
        {contextMenu && (
          <div
            style={{ left: contextMenu.x, top: contextMenu.y }}
            className="absolute z-[1300] w-56 rounded-xl bg-stone-950/95 border border-stone-700/90 shadow-2xl backdrop-blur-md py-1.5 text-xs text-stone-200"
          >
            <div className="px-3 py-1 border-b border-stone-800 text-[11px] font-mono text-amber-400/90">
              {formatCoordinateDdm(contextMenu.lat, contextMenu.lng)}
            </div>
            <button
              type="button"
              onClick={() =>
                copyCoordToClipboard(formatCoordinateDdm(contextMenu.lat, contextMenu.lng), 'LLDM')
              }
              className="w-full px-3 py-1.5 text-left hover:bg-stone-800/80 flex items-center gap-2 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5 text-stone-400" />
              <span>Copy LLDM Coordinates</span>
            </button>
            <button
              type="button"
              onClick={() =>
                copyCoordToClipboard(toMgrs(contextMenu.lat, contextMenu.lng), 'MGRS')
              }
              className="w-full px-3 py-1.5 text-left hover:bg-stone-800/80 flex items-center gap-2 cursor-pointer"
            >
              <Compass className="w-3.5 h-3.5 text-sky-400" />
              <span>Copy MGRS Grid</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setConverterPick({ lat: contextMenu.lat, lng: contextMenu.lng });
                openWindow('converter');
                setContextMenu(null);
              }}
              className="w-full px-3 py-1.5 text-left hover:bg-stone-800/80 flex items-center gap-2 cursor-pointer"
            >
              <MapPin className="w-3.5 h-3.5 text-amber-400" />
              <span>Open in Converter</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMeasurePoints((prev) => [
                  ...prev,
                  { lat: contextMenu.lat, lng: contextMenu.lng },
                ]);
                openWindow('measure');
                setContextMenu(null);
              }}
              className="w-full px-3 py-1.5 text-left hover:bg-stone-800/80 flex items-center gap-2 cursor-pointer"
            >
              <Ruler className="w-3.5 h-3.5 text-cyan-400" />
              <span>Add Measure Point Here</span>
            </button>

            {activePlan &&
              activePlan.can_edit !== false &&
              mapData?.permissions.canManageFlightPlans && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      handleInsertOrAppendWaypoint(
                        L.latLng(contextMenu.lat, contextMenu.lng),
                        activeSequence
                      );
                      openWindow('flight');
                      setContextMenu(null);
                    }}
                    className="w-full px-3 py-1.5 text-left hover:bg-stone-800/80 flex items-center gap-2 border-t border-stone-800 mt-1 pt-1.5 text-amber-300 cursor-pointer"
                  >
                    <Path className="w-3.5 h-3.5" />
                    <span>Add Waypoint to Flight Plan</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleAddTargetPoint({ lat: contextMenu.lat, lng: contextMenu.lng });
                      openWindow('flight');
                      setContextMenu(null);
                    }}
                    className="w-full px-3 py-1.5 text-left hover:bg-stone-800/80 flex items-center gap-2 text-red-400 cursor-pointer"
                  >
                    <Target className="w-3.5 h-3.5" />
                    <span>Add Target</span>
                  </button>

                  {isF14Airframe(
                    activePlan,
                    mapData?.airframesCatalog?.find(
                      (a) => Number(a.id) === Number(activePlan.airframe_id)
                    ) || null
                  ) && (
                    <button
                      type="button"
                      onClick={() => {
                        handleAddAdditionalPoint({ lat: contextMenu.lat, lng: contextMenu.lng });
                        openWindow('flight');
                        setContextMenu(null);
                      }}
                      className="w-full px-3 py-1.5 text-left hover:bg-stone-800/80 flex items-center gap-2 text-purple-300 cursor-pointer"
                    >
                      <Crosshair className="w-3.5 h-3.5" />
                      <span>Add Additional Point (F-14)</span>
                    </button>
                  )}
                </>
              )}

            {/* Flight Path Settings (Ticks & Doghouses) */}
            <div className="border-t border-stone-800 mt-1 pt-1">
              <button
                type="button"
                onClick={() => setFpSettingsOpen((o) => !o)}
                className="w-full px-3 py-1.5 text-left hover:bg-stone-800/80 flex items-center justify-between text-stone-200 cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                  <span>Flight Path Settings</span>
                </span>
                <span className="text-[11px] text-stone-400">{fpSettingsOpen ? '▼' : '▶'}</span>
              </button>

              {fpSettingsOpen && (
                <div className="px-3 py-2 bg-stone-900/95 border-t border-stone-800 space-y-2">
                  <div>
                    <div className="text-[11px] font-bold uppercase text-stone-400 mb-1">
                      Doghouses
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      {(['on', 'off'] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => {
                            handleUpdateDoghouseConfig(mode);
                            setContextMenu(null);
                          }}
                          className={`px-2 py-1 rounded text-[11px] font-semibold border cursor-pointer ${
                            doghouseConfig === mode
                              ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                              : 'bg-stone-950 border-stone-800 text-stone-400 hover:text-stone-200'
                          }`}
                        >
                          {mode === 'on' ? 'On' : 'Off'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] font-bold uppercase text-stone-400 mb-1">
                      Route Ticks (
                      {tickConfig.type === 'off'
                        ? 'Off'
                        : tickConfig.type === 'time'
                          ? `${tickConfig.interval}m`
                          : `${tickConfig.interval}nm`}
                      )
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          handleUpdateTickConfig({ type: 'off', interval: 0 });
                          setContextMenu(null);
                        }}
                        className={`px-1.5 py-0.5 rounded text-[11px] border cursor-pointer ${
                          tickConfig.type === 'off'
                            ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                            : 'bg-stone-950 border-stone-800 text-stone-400 hover:text-stone-200'
                        }`}
                      >
                        Off
                      </button>
                      {[1, 5, 10, 15, 20, 30].map((m) => (
                        <button
                          key={`t_${m}`}
                          type="button"
                          onClick={() => {
                            handleUpdateTickConfig({ type: 'time', interval: m });
                            setContextMenu(null);
                          }}
                          className={`px-1.5 py-0.5 rounded text-[11px] border cursor-pointer ${
                            tickConfig.type === 'time' && tickConfig.interval === m
                              ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                              : 'bg-stone-950 border-stone-800 text-stone-400 hover:text-stone-200'
                          }`}
                        >
                          {m}m
                        </button>
                      ))}
                      {[1, 5, 10, 15, 25, 50].map((nm) => (
                        <button
                          key={`r_${nm}`}
                          type="button"
                          onClick={() => {
                            handleUpdateTickConfig({ type: 'range', interval: nm });
                            setContextMenu(null);
                          }}
                          className={`px-1.5 py-0.5 rounded text-[11px] border cursor-pointer ${
                            tickConfig.type === 'range' && tickConfig.interval === nm
                              ? 'bg-sky-500/20 border-sky-500 text-sky-300'
                              : 'bg-stone-950 border-stone-800 text-stone-400 hover:text-stone-200'
                          }`}
                        >
                          {nm}nm
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {mapData?.permissions.canManageThreats && (
              <button
                type="button"
                onClick={() => {
                  setThreatPick({ lat: contextMenu.lat, lng: contextMenu.lng });
                  openWindow('threats');
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-stone-800/80 flex items-center gap-2 text-red-300 cursor-pointer"
              >
                <ShieldWarning className="w-3.5 h-3.5" />
                <span>Place Threat Here</span>
              </button>
            )}
          </div>
        )}

        {/* Bottom-Right Auto-Refresh Control & Radial Countdown Ring */}
        <div className="absolute bottom-6 right-6 z-[1000] pointer-events-auto">
          <button
            type="button"
            onClick={() => setAutoRefreshEnabled((v) => !v)}
            title={
              autoRefreshEnabled
                ? 'Auto-Refresh active (10s) — click to pause'
                : 'Auto-Refresh paused — click to resume'
            }
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-stone-900/90 hover:bg-stone-800 border border-stone-700/80 text-[11px] font-semibold text-stone-200 shadow-2xl backdrop-blur-md cursor-pointer"
          >
            <svg className="w-5 h-5 -rotate-90" viewBox="0 0 24 24">
              <circle
                cx="12"
                cy="12"
                r="9"
                stroke="currentColor"
                strokeWidth="2.5"
                fill="none"
                className="text-stone-700"
              />
              {autoRefreshEnabled && (
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  fill="none"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringDashOffset}
                  strokeLinecap="round"
                  className={isRefreshing ? 'text-amber-400' : 'text-emerald-400'}
                />
              )}
            </svg>
            <span className="tracking-wide uppercase text-[11px]">
              {autoRefreshEnabled ? (
                <span className="flex items-center gap-1 text-emerald-300">
                  <CheckCircle className="w-3 h-3" weight="fill" />
                  Live 10s
                </span>
              ) : (
                <span className="text-stone-400">Paused</span>
              )}
            </span>
          </button>
        </div>

        {/* Floating Draggable Tool Windows */}
        {mapData && (
          <>
            <FlightPlannerDrawer
              isOpen={openWindows.flight}
              onClose={() => closeWindow('flight')}
              zIndex={getZIndex('flight', 1120)}
              onFocus={() => bringToFront('flight')}
              baseUrl={baseUrl}
              authToken={authToken}
              discordId={discordId}
              mapData={mapData}
              activePlan={activePlan}
              onPlanChange={handlePlanChange}
              onMutatePlan={mutatePlan}
              onFlightPlansListChange={(nextList) =>
                setMapData((prev) => (prev ? { ...prev, flightPlans: nextList } : prev))
              }
              onLoadoutPresetsChange={(loadoutPresets) =>
                setMapData((prev) => (prev ? { ...prev, loadoutPresets } : prev))
              }
              onSelectFlightPlan={(id) => handleOpenFlightPlan(Number(id))}
              unit={unit}
              activeSequence={activeSequence}
              setActiveSequence={setActiveSequence}
              userCreatedSequences={userCreatedSequences}
              onAddSequence={handleAddSequence}
              onDeleteSequence={handleDeleteSequence}
              sequenceColors={sequenceColors}
              onSetSequenceColor={handleSetSequenceColor}
              avionicsDrawTarget={avionicsDrawTarget}
              onSetAvionicsDrawTarget={(target) => {
                clearAllPickModes();
                setAvionicsDrawTarget(target);
              }}
              dirtyVersion={dirtyVersion}
              isPlanDirty={isPlanDirty}
              onMarkSaved={handleMarkSaved}
              onAddPointFromCoords={handleAddPointFromCoords}
              onAddTargetPoint={handleAddTargetPoint}
              onAddAdditionalAtCenter={handleAddAdditionalAtCenter}
              onApplyProcedure={handleApplyProcedure}
              onPanToPoint={handlePanToPoint}
              onCenterMap={handleCenterMap}
              onReorderWaypoints={handleReorderWaypoints}
              onUpdatePoint={handleUpdatePoint}
              onDeletePoint={handleDeletePoint}
              onSetWaypointSequence={handleSetWaypointSequence}
              onClearRoute={handleClearRoute}
              onNotify={handleNotify}
            />

            {mapData.permissions.canManageThreats && (
              <ThreatEditorDrawer
                isOpen={openWindows.threats}
                onClose={() => {
                  closeWindow('threats');
                  setFocusThreatIndex(null);
                }}
                zIndex={getZIndex('threats', 1130)}
                onFocus={() => bringToFront('threats')}
                apiBaseUrl={baseUrl}
                discordId={discordId}
                token={authToken}
                mapData={mapData}
                pickedCoords={threatPick}
                isPicking={isPickingThreat}
                onTogglePicking={() => {
                  const next = !isPickingThreat;
                  clearAllPickModes();
                  setIsPickingThreat(next);
                }}
                onThreatsChange={(threats) =>
                  setMapData((prev) => (prev ? { ...prev, threats } : prev))
                }
                focusThreatIndex={focusThreatIndex}
                onCenterMap={handleCenterMap}
                onNotify={handleNotify}
              />
            )}

            {mapData.permissions.canManageSupportAssets && (
              <SupportAssetsDrawer
                isOpen={openWindows.support}
                onClose={() => {
                  closeWindow('support');
                  setFocusAssetIndex(null);
                }}
                zIndex={getZIndex('support', 1140)}
                onFocus={() => bringToFront('support')}
                apiBaseUrl={baseUrl}
                discordId={discordId}
                token={authToken}
                mapData={mapData}
                selectedAssetType={selectedSupportAssetType}
                onSelectAssetType={(type) => {
                  setSelectedSupportAssetType(type);
                  supportAssetsControllerRef.current?.setSelectedAssetType(type);
                }}
                stats={supportAssetStats}
                onGetSavePayload={() =>
                  supportAssetsControllerRef.current?.getSavePayload() || {
                    supportAssets: [],
                    removedIds: [],
                  }
                }
                onAppliedSavedAssets={(fresh) => {
                  supportAssetsControllerRef.current?.applySavedAssets(fresh);
                  setMapData((prev) => (prev ? { ...prev, supportAssets: fresh } : prev));
                }}
                onQuickAddAt={(lat, lng) =>
                  supportAssetsControllerRef.current?.addPendingAt(lat, lng, true)
                }
                onUndoRemoval={() => supportAssetsControllerRef.current?.undoRemoval()}
                onDiscardPending={() => supportAssetsControllerRef.current?.discardPending()}
                onCenterMap={handleCenterMap}
                onNotify={handleNotify}
              />
            )}

            <TacticalMarkingsDrawer
              isOpen={openWindows.markings}
              onClose={() => closeWindow('markings')}
              zIndex={getZIndex('markings', 1150)}
              onFocus={() => bringToFront('markings')}
              apiBaseUrl={baseUrl}
              discordId={discordId}
              token={authToken}
              mapData={mapData}
              unit={unit}
              selectedMissionId={selectedMissionId}
              selectedSortieId={selectedSortieId}
              isDrawingActive={tmIsDrawing}
              activeDrawingType={tmDrawShape}
              editingMarking={
                editingMarking &&
                import.meta.env.DEV &&
                devPermissionOverrides.enabled &&
                devPermissionOverrides.forceRecordsReadOnly
                  ? { ...editingMarking, can_edit: false }
                  : editingMarking
              }
              onSelectEditingMarking={(m) => {
                setEditingMarking(m);
                tacticalMarkingsControllerRef.current?.setEditingMarkingId(m ? m.id : null);
              }}
              onStartDraw={(config) => tacticalMarkingsControllerRef.current?.startDrawing(config)}
              onUpdateDrawOptions={(partial) =>
                tacticalMarkingsControllerRef.current?.updateDrawingOptions(partial)
              }
              onFinishDraw={() => tacticalMarkingsControllerRef.current?.finishDrawing()}
              onCancelDraw={() => tacticalMarkingsControllerRef.current?.cancelDrawing()}
              onUpdateEditingStyle={(markingId, style) =>
                tacticalMarkingsControllerRef.current?.updateEditingStyle(markingId, style)
              }
              onFlyToMarking={(markingId) =>
                tacticalMarkingsControllerRef.current?.flyToMarking(markingId)
              }
              onMarkingsChange={(tacticalMarkings) =>
                setMapData((prev) => (prev ? { ...prev, tacticalMarkings } : prev))
              }
              onScopeChange={(scope) => {
                tmScopeRef.current = scope;
              }}
              onAorAssigned={({ missions, tacticalMarkings, aorPresets }) => {
                setEditingMarking(null);
                setMapData((prev) =>
                  prev ? { ...prev, missions, tacticalMarkings, aorPresets } : prev
                );
              }}
              onNotify={handleNotify}
            />

            <MeasureToolDrawer
              isOpen={openWindows.measure}
              onClose={() => closeWindow('measure')}
              zIndex={getZIndex('measure', 1170)}
              onFocus={() => bringToFront('measure')}
              points={measurePoints}
              unit={unit}
              onToggleUnit={handleChangeUnit}
              speedInput={measureSpeedInput}
              onSpeedChange={setMeasureSpeedInput}
              onUndoLast={() => setMeasurePoints((prev) => prev.slice(0, -1))}
              onClear={() => setMeasurePoints([])}
              campaignDate={mapData.campaign.campaignDate}
              theatreDeclination={mapData.campaign.magneticDeclination}
              isPicking={isPickingMeasure}
              onTogglePicking={() => {
                const next = !isPickingMeasure;
                clearAllPickModes();
                setIsPickingMeasure(next);
              }}
            />

            <CoordinateConverterDrawer
              isOpen={openWindows.converter}
              onClose={() => closeWindow('converter')}
              zIndex={getZIndex('converter', 1180)}
              onFocus={() => bringToFront('converter')}
              apiBaseUrl={baseUrl}
              token={authToken}
              pickedCoords={converterPick}
              activeBullseye={
                mapData.bullseyes?.[activeBullseyeIndex] || mapData.bullseyes?.[0] || null
              }
              campaignDate={mapData.campaign.campaignDate}
              theatreDeclination={mapData.campaign.magneticDeclination}
              unit={unit}
              onCenterMap={handlePingConverterLocation}
              hasActivePin={Boolean(converterPin)}
              onClearPin={() => setConverterPin(null)}
              isPicking={isPickingConverter}
              onTogglePicking={() => {
                const next = !isPickingConverter;
                clearAllPickModes();
                setIsPickingConverter(next);
              }}
            />

            <MapLegendModal
              isOpen={legendOpen}
              onClose={() => setLegendOpen(false)}
              mapData={mapData}
              zIndex={getZIndex('legend', 1200)}
              onFocus={() => bringToFront('legend')}
            />
          </>
        )}
      </div>

      {/* Bottom Portal Telemetry HUD Footer */}
      <CampaignMapHudFooter
        cursorCoords={cursorCoords}
        coordMode={coordMode}
        onToggleCoordMode={() => setCoordMode((m) => (m === 'ddm' ? 'dms' : 'ddm'))}
        bullseyes={mapData?.bullseyes || []}
        activeBullseyeIndex={activeBullseyeIndex}
        onCycleBullseye={() => {
          const count = mapData?.bullseyes?.length || 0;
          if (count > 0) setActiveBullseyeIndex((i) => (i + 1) % count);
        }}
        braaFormatted={braaFormatted}
        cursorElevFt={cursorElevFt}
        unit={unit}
        onToggleUnit={() => handleChangeUnit(unit === 'nm' ? 'km' : 'nm')}
        onResetPosition={handleResetPosition}
        isFocusMode={isFocusMode}
        onToggleFocusMode={() => setIsFocusMode((f) => !f)}
        navaidsEnabled={layerStates.navaids}
        onToggleNavaids={() => handleToggleLayer('navaids')}
        legendOpen={legendOpen}
        onToggleLegend={() => {
          setLegendOpen((prev) => {
            const next = !prev;
            if (next) bringToFront('legend');
            return next;
          });
        }}
      />
      </div>
    </>
  );
};
