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
  WarningCircle,
  X,
} from '@phosphor-icons/react';
import { STATIC_CONFIG } from '../../../config/constants';
import { useApp } from '../../../context/AppContext';
import {
  fetchCampaignMapPayload,
  fetchTerrainElevation,
} from '../../../services/campaignMapService';
import { fetchFlightPlanDetail } from '../../../services/flightPlanService';
import { openExternalUrl } from '../../../services/tauriBridge';
import {
  CampaignItem,
  CampaignMapAirbase,
  CampaignMapIsrRequest,
  CampaignMapPayload,
  CampaignMapPolygonGroup,
  CampaignMapProcedure,
  FlightPlanDetail,
  FlightPlanRoutePoint,
} from '../../../types';
import {
  calculateBearingDegrees,
  calculateDistanceKm,
  calculateDistanceNm,
  formatCoordinateDdm,
  lookupTerrariumElevationFt,
  toMgrs,
  trueToMagnetic,
} from './geodesy';
import {
  AvionicsPlotTarget,
  appendPointToAvionicsTarget,
  describeAvionicsPlotTarget,
} from './AirframeAvionicsPanel';
import {
  createDcsTileLayers,
  IsrActiveOverlayState,
  renderAirbaseProceduresLayer,
  renderAirbasesLayer,
  renderAirframeTacticalLayers,
  renderBullseyesLayer,
  renderClusteredFlightPlansLayer,
  renderFrontLineLayer,
  renderIsrCapturesLayer,
  renderIsrPreviewLayer,
  renderLogisticsLayer,
  renderMissionsLayer,
  renderNavaidsLayer,
  renderPolygonGroupsLayer,
  renderSupportAssetsLayer,
  renderTacticalMarkingsLayer,
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
import { FlightPlannerDrawer, PlannerPlotMode } from './FlightPlannerDrawer';
import { CoordinateConverterDrawer } from './CoordinateConverterDrawer';
import { MeasurePoint, MeasureToolDrawer } from './MeasureToolDrawer';
import {
  IsrReconLightboxModal,
  IsrToolDrawer,
  SupportAssetsDrawer,
  TacticalMarkingsDrawer,
  ThreatEditorDrawer,
} from './TacticalEditorsDrawers';

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
  } = useApp();
  const baseUrl = settings.memberPortalApiUrl || STATIC_CONFIG.portalBaseUrl;
  const authToken = userSession?.accessToken;
  const discordId = memberProfile?.discordId || userSession?.id || null;

  const portalMapUrl = useMemo(() => {
    try {
      const origin = new URL(baseUrl).origin;
      return `${origin}/admin/campaigns/${campaign.id}/map`;
    } catch {
      return null;
    }
  }, [baseUrl, campaign.id]);

  // Core data & loading state
  const [mapData, setMapData] = useState<CampaignMapPayload | null>(null);
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
  const [activePlan, setActivePlan] = useState<FlightPlanDetail | null>(null);
  const [plotMode, setPlotMode] = useState<PlannerPlotMode>('none');
  const [avionicsPlotTarget, setAvionicsPlotTarget] = useState<AvionicsPlotTarget | null>(null);

  // Tool picking & tactical states
  const [measurePoints, setMeasurePoints] = useState<MeasurePoint[]>([]);
  const [isPickingMeasure, setIsPickingMeasure] = useState(false);

  const [converterPick, setConverterPick] = useState<{ lat: number; lng: number } | null>(null);
  const [isPickingConverter, setIsPickingConverter] = useState(false);

  const [threatPick, setThreatPick] = useState<{ lat: number; lng: number } | null>(null);
  const [isPickingThreat, setIsPickingThreat] = useState(false);
  const [focusThreatIndex, setFocusThreatIndex] = useState<number | null>(null);

  const [supportPick, setSupportPick] = useState<{ lat: number; lng: number } | null>(null);
  const [isPickingSupport, setIsPickingSupport] = useState(false);
  const [focusAssetIndex, setFocusAssetIndex] = useState<number | null>(null);

  const [markingDraftPoints, setMarkingDraftPoints] = useState<Array<{ lat: number; lng: number }>>([]);
  const [isDrawingMarking, setIsDrawingMarking] = useState(false);

  const [isrPick, setIsrPick] = useState<{ lat: number; lng: number } | null>(null);
  const [isPickingIsr, setIsPickingIsr] = useState(false);
  const [isrPreviewCenter, setIsrPreviewCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [isrPreviewKmSizes, setIsrPreviewKmSizes] = useState<number[]>([]);
  const [activeIsrOverlays, setActiveIsrOverlays] = useState<Record<number, IsrActiveOverlayState>>({});
  const [lightboxIsr, setLightboxIsr] = useState<CampaignMapIsrRequest | null>(null);

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
  const tileMapRef = useRef<Record<string, L.Layer>>({});
  const activeTileLayerRef = useRef<L.Layer | null>(null);
  const initialFitDoneRef = useRef(false);
  const consumedTargetRef = useRef(false);
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
    isr: L.LayerGroup;
    isrOverlays: L.LayerGroup;
    isrPreview: L.LayerGroup;
    logistics: L.LayerGroup;
    threats: L.LayerGroup;
    supportAssets: L.LayerGroup;
    tacticalMarkings: L.LayerGroup;
    activePlan: L.LayerGroup;
    measure: L.LayerGroup;
    tacticalDraft: L.LayerGroup;
  } | null>(null);

  const handleNotify = useCallback(
    (_level: 'info' | 'success' | 'warning' | 'error', msg: string) => {
      addNotification({
        title: 'Campaign Map',
        message: msg,
        category: 'flight_plan',
      });
    },
    [addNotification]
  );

  const handleCenterMap = useCallback((lat: number, lng: number, zoom?: number) => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo([lat, lng], zoom ?? Math.max(map.getZoom(), 11), { duration: 0.7 });
  }, []);

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
      setOpenWindows((prev) => ({ ...prev, [key]: true }));
      bringToFront(key);
    },
    [bringToFront]
  );

  const closeWindow = useCallback((key: MapToolKey) => {
    setOpenWindows((prev) => ({ ...prev, [key]: false }));
    if (key === 'flight') setPlotMode('none');
    if (key === 'measure') setIsPickingMeasure(false);
    if (key === 'converter') setIsPickingConverter(false);
    if (key === 'threats') setIsPickingThreat(false);
    if (key === 'support') setIsPickingSupport(false);
    if (key === 'isr') {
      setIsPickingIsr(false);
      setIsrPreviewCenter(null);
      setIsrPreviewKmSizes([]);
    }
    if (key === 'markings') {
      setIsDrawingMarking(false);
      setMarkingDraftPoints([]);
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
    setPlotMode('none');
    setAvionicsPlotTarget(null);
    setIsPickingMeasure(false);
    setIsPickingConverter(false);
    setIsPickingThreat(false);
    setIsPickingSupport(false);
    setIsPickingIsr(false);
    setIsDrawingMarking(false);
    setContextMenu(null);
  }, []);

  // Load campaign map payload
  const loadMapData = useCallback(
    async (refresh = false, silent = false) => {
      if (!silent) {
        if (mapData) setIsRefreshing(true);
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
        if (!silent || !mapData) {
          setError(err instanceof Error ? err.message : 'Failed to load campaign map data');
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [baseUrl, campaign.id, discordId, authToken, mapData]
  );

  useEffect(() => {
    initialFitDoneRef.current = false;
    consumedTargetRef.current = false;
    setMapData(null);
    setActivePlan(null);
    loadMapData(false, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.id]);

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
      isr: L.layerGroup(),
      isrOverlays: L.layerGroup().addTo(map),
      isrPreview: L.layerGroup().addTo(map),
      logistics: L.layerGroup(),
      threats: L.layerGroup(),
      supportAssets: L.layerGroup(),
      tacticalMarkings: L.layerGroup(),
      activePlan: L.layerGroup().addTo(map),
      measure: L.layerGroup().addTo(map),
      tacticalDraft: L.layerGroup().addTo(map),
    };

    layerGroupsRef.current = groups;
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      layerGroupsRef.current = null;
      activeTileLayerRef.current = null;
      tileMapRef.current = {};
    };
  }, []);

  // Re-build dynamic tile layers whenever campaign theatre changes
  useEffect(() => {
    const map = mapRef.current;
    const header = mapData?.campaign;
    if (!map || !header) return;

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

  // Open a specific flight plan into activePlan + open Flight Planner floating window
  const handleOpenFlightPlan = useCallback(
    async (planId: number) => {
      try {
        const detail = await fetchFlightPlanDetail(baseUrl, planId, authToken);
        setActivePlan(detail);
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
    [baseUrl, authToken, openWindow, addNotification]
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
  const handleApplyProcedure = useCallback(
    (proc: CampaignMapProcedure, mode: 'auto' | 'prepend' | 'append') => {
      const procWps: FlightPlanRoutePoint[] = (proc.waypoints || [])
        .filter((w) => Number.isFinite(Number(w.lat)) && Number.isFinite(Number(w.lng)))
        .map((w, idx) => ({
          index: idx + 1,
          name: w.name || `${proc.name} ${idx + 1}`,
          lat: Number(w.lat),
          lng: Number(w.lng),
          alt: w.alt !== undefined && w.alt !== null ? Number(w.alt) : 5000,
          speed: w.speed !== undefined && w.speed !== null ? Number(w.speed) : 300,
          type: 'waypoint',
        }));

      if (procWps.length === 0) {
        addNotification({
          title: 'Procedure Empty',
          message: `Procedure "${proc.name}" has no valid waypoints.`,
          category: 'flight_plan',
        });
        return;
      }

      if (!activePlan) {
        openWindow('flight');
        addNotification({
          title: 'Select or Create Flight Plan',
          message: `Open a flight plan first to insert "${proc.name}", then re-click the procedure action.`,
          category: 'flight_plan',
        });
        return;
      }

      const resolvedMode: 'prepend' | 'append' =
        mode === 'auto'
          ? proc.type === 'departure' || proc.type === 'sid'
            ? 'prepend'
            : 'append'
          : mode;

      setActivePlan((prev) => {
        if (!prev) return prev;
        const existing = [...(prev.route_points || [])];
        const merged =
          resolvedMode === 'prepend' ? [...procWps, ...existing] : [...existing, ...procWps];
        return {
          ...prev,
          route_points: merged.map((pt, i) => ({ ...pt, index: i + 1 })),
        };
      });
      openWindow('flight');
      addNotification({
        title: 'Procedure Applied',
        message: `${resolvedMode === 'prepend' ? 'Prepended' : 'Appended'} ${procWps.length} waypoints from ${proc.name}. Save flight plan to persist.`,
        category: 'flight_plan',
      });
    },
    [activePlan, openWindow, addNotification]
  );

  const handleSetAirbaseRole = useCallback(
    (airbase: CampaignMapAirbase, role: 'departure' | 'destination') => {
      if (!activePlan) {
        openWindow('flight');
        addNotification({
          title: 'No Active Flight Plan',
          message: `Create or select a flight plan in the Flight Planner window to set ${airbase.name} as ${role}.`,
          category: 'flight_plan',
        });
        return;
      }
      setActivePlan((prev) => {
        if (!prev) return prev;
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
      addNotification({
        title: `Set ${role === 'departure' ? 'Departure' : 'Destination'} Airbase`,
        message: `${airbase.name} assigned to active flight plan.`,
        category: 'flight_plan',
      });
    },
    [activePlan, openWindow, addNotification]
  );

  const handleToggleDivert = useCallback(
    (airbase: CampaignMapAirbase) => {
      if (!activePlan) {
        openWindow('flight');
        addNotification({
          title: 'No Active Flight Plan',
          message: `Create or select a flight plan to toggle ${airbase.name} as a divert airfield.`,
          category: 'flight_plan',
        });
        return;
      }
      const matchKey = airbase.name.trim().toLowerCase();
      const icaoKey = (airbase.icao || '').trim().toLowerCase();
      const exists = (activePlan.diverts || []).some((d) => {
        const dName = (typeof d === 'string' ? d : d?.name || d?.icao || '').trim().toLowerCase();
        return dName === matchKey || (icaoKey !== '' && dName === icaoKey);
      });
      setActivePlan((prev) => {
        if (!prev) return prev;
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
      addNotification({
        title: exists ? 'Removed Divert Airfield' : 'Added Divert Airfield',
        message: `${airbase.name} ${exists ? 'removed from' : 'added to'} active flight plan diverts.`,
        category: 'flight_plan',
      });
    },
    [activePlan, openWindow, addNotification]
  );

  const handleAddIsrTargetToFlightPlan = useCallback(
    (target: { label: string; notes?: string; lat: number; lon: number }) => {
      if (!activePlan || !activePlan.can_edit) {
        openWindow('flight');
        addNotification({
          title: 'Editable Flight Plan Required',
          message: 'Open or create an editable flight plan first to push ISR targets.',
          category: 'flight_plan',
        });
        return;
      }
      setActivePlan((prev) => {
        if (!prev) return prev;
        const nextIdx = (prev.route_points?.length || 0) + 1;
        const newPt: FlightPlanRoutePoint = {
          index: nextIdx,
          name: `TGT ${target.label.toUpperCase()}`.slice(0, 24),
          lat: Number(target.lat.toFixed(6)),
          lng: Number(target.lon.toFixed(6)),
          alt: 0,
          speed: 0,
          action: 'TGT',
          type: 'TGT',
          remarks: target.notes || undefined,
        };
        const nextPts = [...(prev.route_points || []), newPt].map((p, idx) => ({
          ...p,
          index: idx + 1,
        }));
        return { ...prev, route_points: nextPts };
      });
      openWindow('flight');
      addNotification({
        title: 'Target Pushed to Flight Plan',
        message: `Added DMPI (${target.label}) to ${activePlan.identifier}. Save flight plan to persist.`,
        category: 'flight_plan',
      });
    },
    [activePlan, openWindow, addNotification]
  );

  const handleToggleIsrOverlay = useCallback((req: CampaignMapIsrRequest, url: string) => {
    setActiveIsrOverlays((prev) => {
      const next = { ...prev };
      if (next[req.id]) {
        delete next[req.id];
      } else {
        next[req.id] = {
          requestId: req.id,
          url,
          opacity: 0.9,
          filter: 'eo',
        };
      }
      return next;
    });
  }, []);

  const handleUpdateIsrOverlayStyle = useCallback(
    (requestId: number, patch: Partial<Pick<IsrActiveOverlayState, 'opacity' | 'filter'>>) => {
      setActiveIsrOverlays((prev) => {
        const cur = prev[requestId];
        if (!cur) return prev;
        return { ...prev, [requestId]: { ...cur, ...patch } };
      });
    },
    []
  );

  const handleIsrPreviewChange = useCallback(
    (center: { lat: number; lng: number } | null, sizes: number[]) => {
      setIsrPreviewCenter((prev) => {
        if (!prev && !center) return prev;
        if (prev && center && prev.lat === center.lat && prev.lng === center.lng) return prev;
        return center;
      });
      setIsrPreviewKmSizes((prev) => {
        if (prev.length === sizes.length && prev.every((v, i) => v === sizes[i])) return prev;
        return sizes;
      });
    },
    []
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
      ['isr', g.isr],
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
      activePlan,
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
      activePlan?.id,
      selectedMissionId,
      selectedSortieId,
      unit,
      handleOpenFlightPlan
    );

    renderLogisticsLayer(map, g.logistics, mapData.logisticsRequests || []);

    renderIsrCapturesLayer(
      g.isr,
      g.isrOverlays,
      mapData.isrRequests || [],
      activeIsrOverlays,
      {
        onOpenLightbox: (req) => setLightboxIsr(req),
        onToggleOverlay: handleToggleIsrOverlay,
      }
    );

    renderThreatsLayer(
      g.threats,
      mapData.threats || [],
      mapData.threatTypes || [],
      mapData.samSystems || [],
      mapData.permissions.canManageThreats,
      (_threat, idx) => {
        setFocusThreatIndex(idx);
        openWindow('threats');
      }
    );

    renderSupportAssetsLayer(
      g.supportAssets,
      mapData.supportAssets || [],
      mapData.supportAssetTypes || [],
      mapData.samSystems || [],
      unit,
      mapData.permissions.canManageSupportAssets,
      (_asset, idx) => {
        setFocusAssetIndex(idx);
        openWindow('support');
      }
    );

    renderTacticalMarkingsLayer(
      g.tacticalMarkings,
      mapData.tacticalMarkings || [],
      selectedSortieId
    );
  }, [
    mapData,
    polygonGroupStates,
    layerStates.navaids,
    activePlan,
    unit,
    selectedMissionId,
    selectedSortieId,
    activeIsrOverlays,
    handleApplyProcedure,
    handleSetAirbaseRole,
    handleToggleDivert,
    handleOpenFlightPlan,
    handleToggleIsrOverlay,
    setSelectedCampaignMissionId,
    setSelectedCampaignMissionSection,
    openWindow,
  ]);

  useEffect(() => {
    renderAllLayers();
  }, [renderAllLayers]);

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
        activePlan?.id,
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
    activePlan?.id,
    selectedMissionId,
    selectedSortieId,
    unit,
    handleOpenFlightPlan,
  ]);

  // Render ISR request live multi-size preview
  useEffect(() => {
    const g = layerGroupsRef.current;
    if (!g) return;
    renderIsrPreviewLayer(g.isrPreview, isrPreviewCenter, isrPreviewKmSizes, (lat, lng) => {
      setIsrPreviewCenter({ lat, lng });
      setIsrPick({ lat, lng });
    });
  }, [isrPreviewCenter, isrPreviewKmSizes]);

  // Render active editable Flight Plan route + draggable waypoints + airframe avionics overlays
  useEffect(() => {
    const g = layerGroupsRef.current;
    if (!g) return;
    g.activePlan.clearLayers();

    if (!activePlan) return;

    const editable = Boolean(
      activePlan.can_edit && mapData?.permissions.canManageFlightPlans !== false
    );
    renderAirframeTacticalLayers(g.activePlan, activePlan, {
      editable,
      onMutatePlan: (updater) => setActivePlan((prev) => (prev ? updater(prev) : prev)),
    });

    const pts = (activePlan.route_points || []).filter(
      (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)
    );
    if (pts.length === 0) return;

    const color = activePlan.color || '#f59e0b';
    const magDeclination = mapData?.campaign.magneticDeclination || 0;

    if (pts.length >= 2) {
      L.polyline(
        pts.map((p) => [p.lat, p.lng] as [number, number]),
        {
          color,
          weight: 3.5,
          opacity: 0.95,
        }
      ).addTo(g.activePlan);

      for (let i = 0; i < pts.length - 1; i++) {
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const midLat = (p1.lat + p2.lat) / 2;
        const midLng = (p1.lng + p2.lng) / 2;
        const trueBrg = calculateBearingDegrees(p1.lat, p1.lng, p2.lat, p2.lng);
        const magBrg = trueToMagnetic(trueBrg, magDeclination);
        const distVal =
          unit === 'km'
            ? calculateDistanceKm(p1.lat, p1.lng, p2.lat, p2.lng)
            : calculateDistanceNm(p1.lat, p1.lng, p2.lat, p2.lng);
        if (distVal < 0.2) continue;

        L.marker([midLat, midLng], {
          interactive: false,
          zIndexOffset: 2250,
          icon: L.divIcon({
            className: 'bg-transparent border-0 pointer-events-none',
            iconSize: [78, 18],
            iconAnchor: [39, 9],
            html: `<div style="display:flex;align-items:center;justify-content:center;padding:1px 5px;border-radius:4px;background:rgba(12,10,9,0.88);border:1px solid ${color}80;color:#e7e5e4;font-family:monospace;font-size:9px;font-weight:700;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.7);">${String(
              magBrg
            ).padStart(3, '0')}°/${distVal.toFixed(1)}${unit === 'km' ? 'KM' : 'NM'}</div>`,
          }),
        }).addTo(g.activePlan);
      }
    }

    pts.forEach((pt, idx) => {
      const actionUp = String(pt.action || '').toUpperCase();
      const typeUp = String(pt.type || '').toUpperCase();
      const isTarget = actionUp === 'TGT' || typeUp === 'TGT';
      const isFix = Boolean((pt as any).is_fix) || ['FIX', 'IAF', 'FAF'].includes(typeUp);
      const isIpt = idx === 0;
      const numLabel = isTarget ? 'T' : isIpt ? '0' : String(idx);

      let markerHtml: string;
      if (isTarget) {
        markerHtml = `<div style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;"><div style="width:18px;height:18px;transform:rotate(45deg);background:#1c1917;border:2px solid #ef4444;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(239,68,68,0.55);"><span style="transform:rotate(-45deg);color:#fca5a5;font-size:9px;font-weight:800;">${idx}</span></div></div>`;
      } else if (isFix) {
        markerHtml = `<div style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;"><div style="width:18px;height:18px;transform:rotate(45deg);background:#0c0a09;border:2px solid #22d3ee;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(34,211,238,0.45);"><span style="transform:rotate(-45deg);color:#67e8f9;font-size:9px;font-weight:800;">${idx}</span></div></div>`;
      } else {
        markerHtml = `<div style="width:24px;height:24px;border-radius:9999px;background:#0c0a09;border:2px solid ${color};color:${color};font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.75);">${numLabel}</div>`;
      }

      const marker = L.marker([pt.lat, pt.lng], {
        draggable: editable,
        icon: L.divIcon({
          className: 'bg-transparent border-0',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
          html: markerHtml,
        }),
        zIndexOffset: 2400,
      }).addTo(g.activePlan);

      marker.bindTooltip(
        `<div style="font-weight:700;color:${isTarget ? '#fca5a5' : isFix ? '#67e8f9' : color}">${
          isTarget ? `TGT ${idx}` : idx === 0 ? 'STPT 0' : `STPT ${idx}`
        }: ${pt.name || 'WPT'}</div><div style="font-size:10px;color:#d6d3d1">${Math.round(
          pt.alt || 0
        )} ft | ${Math.round(pt.speed || 0)} kt</div>`,
        { direction: 'top', offset: [0, -10], className: 'gtfo-map-tooltip' }
      );

      marker.on('dragend', (ev) => {
        const pos = (ev.target as L.Marker).getLatLng();
        setActivePlan((prev) => {
          if (!prev) return prev;
          const nextPts = [...(prev.route_points || [])];
          if (!nextPts[idx]) return prev;
          nextPts[idx] = {
            ...nextPts[idx],
            lat: Number(pos.lat.toFixed(6)),
            lng: Number(pos.lng.toFixed(6)),
          };
          return { ...prev, route_points: nextPts };
        });
      });
    });
  }, [
    activePlan,
    mapData?.permissions.canManageFlightPlans,
    mapData?.campaign.magneticDeclination,
    unit,
  ]);

  // Render Measure polyline & markers
  useEffect(() => {
    const g = layerGroupsRef.current;
    if (!g) return;
    g.measure.clearLayers();
    if (measurePoints.length === 0) return;

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
        const brg = Math.round(calculateBearingDegrees(p1.lat, p1.lng, p2.lat, p2.lng));
        const label =
          unit === 'km'
            ? `${(distNm * 1.852).toFixed(1)} KM / ${brg}°`
            : `${distNm.toFixed(1)} NM / ${brg}°`;
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
  }, [measurePoints, unit]);

  // Render Tactical Marking draft vertices
  useEffect(() => {
    const g = layerGroupsRef.current;
    if (!g) return;
    g.tacticalDraft.clearLayers();
    if (markingDraftPoints.length === 0) return;

    const coords = markingDraftPoints.map((p) => [p.lat, p.lng] as [number, number]);
    if (coords.length >= 2) {
      L.polyline(coords, { color: '#f59e0b', weight: 2, dashArray: '4, 4' }).addTo(g.tacticalDraft);
    }
    markingDraftPoints.forEach((pt) => {
      L.circleMarker([pt.lat, pt.lng], {
        radius: 4.5,
        color: '#fbbf24',
        fillColor: '#451a03',
        fillOpacity: 1,
        weight: 2,
      }).addTo(g.tacticalDraft);
    });
  }, [markingDraftPoints]);

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
      setContextMenu(null);
      const lat = Number(e.latlng.lat.toFixed(6));
      const lng = Number(e.latlng.lng.toFixed(6));

      if (avionicsPlotTarget && activePlan) {
        setActivePlan((prev) =>
          prev ? appendPointToAvionicsTarget(prev, avionicsPlotTarget, lat, lng) : prev
        );
        return;
      }

      if (plotMode !== 'none' && activePlan) {
        const nextIdx = (activePlan.route_points?.length || 0) + 1;
        const isTargetPlot = plotMode === 'target';
        const newPt: FlightPlanRoutePoint = {
          index: nextIdx,
          name: isTargetPlot
            ? `TGT ${nextIdx}`
            : plotMode === 'drawing_point'
              ? `DRAW ${nextIdx}`
              : `WPT ${nextIdx}`,
          lat,
          lng,
          alt: isTargetPlot ? 0 : 20000,
          speed: isTargetPlot ? 0 : 350,
          action: isTargetPlot ? 'TGT' : nextIdx === 1 ? 'Takeoff' : 'Turning Point',
          type: isTargetPlot ? 'TGT' : 'WAYPOINT',
        };
        setActivePlan((prev) => {
          if (!prev) return prev;
          const nextPts = [...(prev.route_points || []), newPt].map((p, idx) => ({
            ...p,
            index: idx + 1,
          }));
          return { ...prev, route_points: nextPts };
        });
        return;
      }

      if (isPickingMeasure) {
        setMeasurePoints((prev) => [...prev, { lat, lng }]);
        return;
      }
      if (isPickingConverter) {
        setConverterPick({ lat, lng });
        setIsPickingConverter(false);
        return;
      }
      if (isPickingThreat) {
        setThreatPick({ lat, lng });
        setIsPickingThreat(false);
        return;
      }
      if (isPickingSupport) {
        setSupportPick({ lat, lng });
        setIsPickingSupport(false);
        return;
      }
      if (isPickingIsr) {
        setIsrPick({ lat, lng });
        setIsrPreviewCenter({ lat, lng });
        setIsPickingIsr(false);
        return;
      }
      if (isDrawingMarking) {
        setMarkingDraftPoints((prev) => [...prev, { lat, lng }]);
      }
    };

    const handleContextMenu = (e: L.LeafletMouseEvent) => {
      e.originalEvent.preventDefault();
      const container = mapContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const rawX = e.originalEvent.clientX - rect.left;
      const rawY = e.originalEvent.clientY - rect.top;
      setContextMenu({
        x: Math.min(Math.max(12, rawX), Math.max(12, rect.width - 230)),
        y: Math.min(Math.max(12, rawY), Math.max(12, rect.height - 290)),
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
    plotMode,
    avionicsPlotTarget,
    activePlan,
    isPickingMeasure,
    isPickingConverter,
    isPickingThreat,
    isPickingSupport,
    isPickingIsr,
    isDrawingMarking,
  ]);

  // Keyboard shortcuts matching Member Portal (Alt+F, Alt+C, Alt+M, Alt+U, Alt+Enter, Escape)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clearAllPickModes();
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
        setUnit((u) => (u === 'nm' ? 'km' : 'nm'));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        setIsFocusMode((f) => !f);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [clearAllPickModes, isFocusMode, toggleWindow]);

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
    if (avionicsPlotTarget) {
      return `${describeAvionicsPlotTarget(avionicsPlotTarget)} — Click map to add (Esc to stop)`;
    }
    if (plotMode !== 'none') {
      const label =
        plotMode === 'target'
          ? 'Target Point'
          : plotMode === 'drawing_point'
            ? 'Avionics Vertex'
            : 'Waypoint';
      return `Plotting ${label} — Click anywhere on the map (Esc to stop)`;
    }
    if (isPickingMeasure) return 'Measure Tool — Click points on the map to add legs (Esc to stop)';
    if (isPickingConverter) return 'Coordinate Converter — Click map to capture coordinates';
    if (isPickingThreat) return 'Threat Editor — Click map to set SAM/Threat position';
    if (isPickingSupport) return 'Support Assets — Click map to position support asset';
    if (isPickingIsr) return 'ISR Reconnaissance — Click map to position capture crosshair';
    if (isDrawingMarking) {
      return 'Tactical Markings — Click map to place vertices';
    }
    return null;
  }, [
    avionicsPlotTarget,
    plotMode,
    isPickingMeasure,
    isPickingConverter,
    isPickingThreat,
    isPickingSupport,
    isPickingIsr,
    isDrawingMarking,
  ]);

  const syncedLightboxIsr = useMemo(() => {
    if (!lightboxIsr) return null;
    return mapData?.isrRequests.find((r) => r.id === lightboxIsr.id) || lightboxIsr;
  }, [lightboxIsr, mapData?.isrRequests]);

  const copyCoordToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      addNotification({ title: 'Copied', message: `${label}: ${text}`, category: 'flight_plan' });
    } catch {
      addNotification({
        title: 'Copy Failed',
        message: 'Clipboard access denied.',
        category: 'flight_plan',
      });
    }
    setContextMenu(null);
  };

  // Auto-refresh radial SVG progress ring circumference (r=9 => 56.55)
  const ringCircumference = 2 * Math.PI * 9;
  const ringDashOffset = ringCircumference * (1 - refreshProgress);

  const wrapperClasses = isFocusMode
    ? 'fixed inset-0 !m-0 z-[1050] h-screen w-screen bg-stone-950 flex flex-col'
    : 'relative isolate z-0 w-full h-[calc(100vh-145px)] min-h-[600px] rounded-xl overflow-hidden border border-stone-800 bg-stone-950 flex flex-col shadow-2xl';

  return (
    <>
      <div className={wrapperClasses}>
      {/* Main Map Viewport */}
      <div className="relative flex-1 w-full overflow-hidden">
        <div
          ref={mapContainerRef}
          className={`w-full h-full bg-[#09090b] ${
            activePickPrompt ? 'cursor-crosshair' : ''
          }`}
        />

        {/* Top-Left Portal Toolbar */}
        {mapData && (
          <div className="absolute top-3 left-3 z-[1000] pointer-events-auto">
            <CampaignMapToolbar
              allPlans={mapData.flightPlans?.allPlans || []}
              permissions={mapData.permissions}
              threatsCount={(mapData.threats || []).length}
              supportAssetsCount={(mapData.supportAssets || []).length}
              isrCreditsBalance={mapData.campaign.isrCreditsBalance ?? 0}
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
              canViewIsr={Boolean(mapData.permissions.canViewIsr)}
              isTraining={Boolean(mapData.campaign.isTraining)}
              onManualRefresh={() => loadMapData(true, false)}
              isLoading={isRefreshing || isLoading}
              portalUrl={portalMapUrl}
              onOpenPortal={portalMapUrl ? () => openExternalUrl(portalMapUrl) : undefined}
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
              className="ml-1 px-2 py-0.5 rounded bg-stone-900/90 hover:bg-stone-800 text-[10px] font-bold text-stone-200 border border-stone-700 cursor-pointer"
            >
              Done
            </button>
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
            <div className="px-3 py-1 border-b border-stone-800 text-[10px] font-mono text-amber-400/90">
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

            {activePlan && mapData?.permissions.canManageFlightPlans && (
              <button
                type="button"
                onClick={() => {
                  setActivePlan((prev) => {
                    if (!prev) return prev;
                    const pts = [...(prev.route_points || [])];
                    pts.push({
                      index: pts.length + 1,
                      name: `WPT ${pts.length + 1}`,
                      lat: contextMenu.lat,
                      lng: contextMenu.lng,
                      alt: 20000,
                      speed: 350,
                      type: 'waypoint',
                    });
                    return { ...prev, route_points: pts };
                  });
                  openWindow('flight');
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-stone-800/80 flex items-center gap-2 border-t border-stone-800 mt-1 pt-1.5 text-amber-300 cursor-pointer"
              >
                <Path className="w-3.5 h-3.5" />
                <span>Add Waypoint to Flight Plan</span>
              </button>
            )}

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

            {mapData?.permissions.canRequestIsr && (
              <button
                type="button"
                onClick={() => {
                  setIsrPick({ lat: contextMenu.lat, lng: contextMenu.lng });
                  setIsrPreviewCenter({ lat: contextMenu.lat, lng: contextMenu.lng });
                  openWindow('isr');
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-stone-800/80 flex items-center gap-2 text-cyan-300 cursor-pointer"
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span>Target ISR Here</span>
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
            <span className="tracking-wide uppercase text-[10px]">
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
              mapData={mapData}
              activePlan={activePlan}
              onPlanChange={setActivePlan}
              onFlightPlansListChange={(nextList) =>
                setMapData((prev) => (prev ? { ...prev, flightPlans: nextList } : prev))
              }
              onLoadoutPresetsChange={(loadoutPresets) =>
                setMapData((prev) => (prev ? { ...prev, loadoutPresets } : prev))
              }
              onSelectFlightPlan={(id) => handleOpenFlightPlan(Number(id))}
              plotMode={plotMode}
              onSetPlotMode={(mode) => {
                clearAllPickModes();
                setPlotMode(mode);
              }}
              avionicsPlotTarget={avionicsPlotTarget}
              onSetAvionicsPlotTarget={(target) => {
                clearAllPickModes();
                setAvionicsPlotTarget(target);
              }}
              onCenterMap={handleCenterMap}
              unit={unit}
              apiBaseUrl={baseUrl}
              discordId={discordId}
              token={authToken}
              onNotify={handleNotify}
            />

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
              pickedCoords={supportPick}
              isPicking={isPickingSupport}
              onTogglePicking={() => {
                const next = !isPickingSupport;
                clearAllPickModes();
                setIsPickingSupport(next);
              }}
              onAssetsChange={(supportAssets) =>
                setMapData((prev) => (prev ? { ...prev, supportAssets } : prev))
              }
              focusAssetIndex={focusAssetIndex}
              onCenterMap={handleCenterMap}
              onNotify={handleNotify}
            />

            <TacticalMarkingsDrawer
              isOpen={openWindows.markings}
              onClose={() => closeWindow('markings')}
              zIndex={getZIndex('markings', 1150)}
              onFocus={() => bringToFront('markings')}
              apiBaseUrl={baseUrl}
              discordId={discordId}
              token={authToken}
              mapData={mapData}
              draftPoints={markingDraftPoints}
              onClearDraftPoints={() => setMarkingDraftPoints([])}
              onUndoDraftPoint={() => setMarkingDraftPoints((prev) => prev.slice(0, -1))}
              isDrawing={isDrawingMarking}
              onToggleDrawing={() => {
                const next = !isDrawingMarking;
                clearAllPickModes();
                setIsDrawingMarking(next);
              }}
              onMarkingsChange={(tacticalMarkings) =>
                setMapData((prev) => (prev ? { ...prev, tacticalMarkings } : prev))
              }
              onCenterMap={handleCenterMap}
              onNotify={handleNotify}
            />

            <IsrToolDrawer
              isOpen={openWindows.isr}
              onClose={() => closeWindow('isr')}
              zIndex={getZIndex('isr', 1160)}
              onFocus={() => bringToFront('isr')}
              apiBaseUrl={baseUrl}
              discordId={discordId}
              token={authToken}
              mapData={mapData}
              pickedCoords={isrPick}
              isPicking={isPickingIsr}
              onTogglePicking={() => {
                const next = !isPickingIsr;
                clearAllPickModes();
                setIsPickingIsr(next);
              }}
              onIsrUpdated={(isrRequests, balance) =>
                setMapData((prev) =>
                  prev
                    ? {
                        ...prev,
                        isrRequests,
                        campaign: { ...prev.campaign, isrCreditsBalance: balance },
                      }
                    : prev
                )
              }
              onOpenLightbox={(req) => setLightboxIsr(req)}
              onPreviewChange={handleIsrPreviewChange}
              activeOverlays={activeIsrOverlays}
              onToggleOverlay={handleToggleIsrOverlay}
              onUpdateOverlayStyle={handleUpdateIsrOverlayStyle}
              onCenterMap={handleCenterMap}
              onNotify={handleNotify}
            />

            <MeasureToolDrawer
              isOpen={openWindows.measure}
              onClose={() => closeWindow('measure')}
              zIndex={getZIndex('measure', 1170)}
              onFocus={() => bringToFront('measure')}
              points={measurePoints}
              unit={unit}
              onToggleUnit={setUnit}
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
              onCenterMap={handleCenterMap}
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
        onToggleUnit={() => setUnit((u) => (u === 'nm' ? 'km' : 'nm'))}
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

      {/* ISR Optical/Thermal Reconnaissance Lightbox */}
      <IsrReconLightboxModal
        isrRequest={syncedLightboxIsr}
        onClose={() => setLightboxIsr(null)}
        campaignIdOrSlug={mapData?.campaign.id || campaign.id}
        apiBaseUrl={baseUrl}
        discordId={discordId}
        token={authToken}
        canMarkup={Boolean(mapData?.permissions.canMarkupIsr)}
        isrTargetTypes={mapData?.isrTargetTypes}
        activePlan={activePlan}
        onIsrUpdated={(isrRequests) =>
          setMapData((prev) => (prev ? { ...prev, isrRequests } : prev))
        }
        onAddTargetToFlightPlan={handleAddIsrTargetToFlightPlan}
        onNotify={handleNotify}
      />
    </>
  );
};
