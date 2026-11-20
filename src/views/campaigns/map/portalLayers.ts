import L from 'leaflet';
import { STATIC_CONFIG } from '../../../config/constants';
import {
  CampaignMapAirbase,
  CampaignMapBullseye,
  CampaignMapFlightPlanBrief,
  CampaignMapFrontLine,
  CampaignMapIsrImageVariant,
  CampaignMapIsrRequest,
  CampaignMapLogisticsRequest,
  CampaignMapMission,
  CampaignMapNavaid,
  CampaignMapPolygonGroup,
  CampaignMapProcedure,
  CampaignMapSamSystem,
  CampaignMapSupportAsset,
  CampaignMapSupportAssetTypeOption,
  CampaignMapTacticalMarking,
  CampaignMapThreat,
  CampaignMapThreatTypeOption,
  FlightPlanDetail,
} from '../../../types';
import {
  calculateBearingDegrees,
  calculateDistanceNm,
  casToTas,
  computeDestinationPoint,
  formatCoordinateDms,
  toMgrs,
} from './geodesy';

/* ============================================================================
 * SVG Icon Fragments (Inline Phosphor / C-130 replicas of Member Portal SVGs)
 * ========================================================================== */
const SVG_ATC_TOWER =
  '<svg class="w-6 h-6 fill-current" viewBox="0 0 256 256"><path d="M236.22,55.34a16,16,0,0,0-13.71-7.82H152V32h16a8,8,0,0,0,0-16H88a8,8,0,0,0,0,16h16V47.52H33.49a16,16,0,0,0-13.71,7.82,15.81,15.81,0,0,0-.58,15.49l26.64,53.28A15.86,15.86,0,0,0,60.15,133H83.5l-11,83H56a8,8,0,0,0,0,16H200a8,8,0,0,0,0-16H183.48l-11-83h23.35a15.86,15.86,0,0,0,14.31-8.89l26.64-53.28A15.81,15.81,0,0,0,236.22,55.34ZM156.71,63.52l-7.55,53.48H106.84L99.29,63.52ZM60.15,117,33.49,63.52H83.14l7.55,53.48Zm107.17,99H88.68l10.95-83h56.74Zm28.53-99H165.31l7.55-53.48h49.65Z"/></svg>';

const SVG_TAKEOFF = (cls = 'w-7 h-7 fill-current') =>
  `<svg class="${cls}" viewBox="0 0 256 256"><path d="M248,216a8,8,0,0,1-8,8H24a8,8,0,0,1,0-16H240A8,8,0,0,1,248,216ZM16.82,135.42l21.37,33.63a16,16,0,0,0,19.16,6.32l179-70.11a16,16,0,0,0,9.56-19.65l-.38-1.08a24,24,0,0,0-30.75-14.16L164.45,90.1l-47-34.56a16,16,0,0,0-15.13-2L85.94,60a8,8,0,0,0-3,13.09l27.71,27.14-43.2,16.92L42.81,105.7a16,16,0,0,0-13.68-.61l-10.9,4.27a8,8,0,0,0-4.78,10.22A8.49,8.49,0,0,0,16.82,135.42Z"/></svg>`;

const SVG_LANDING = (cls = 'w-7 h-7 fill-current') =>
  `<svg class="${cls}" viewBox="0 0 256 256"><path d="M248,216a8,8,0,0,1-8,8H24a8,8,0,0,1,0-16H240A8,8,0,0,1,248,216ZM40.76,133.24l175.46,45.67a16,16,0,0,0,19.6-11.27l.31-1.15a24,24,0,0,0-17.1-29.36l-52.06-13.55L133.54,75.47a16,16,0,0,0-13.71-7l-17.48-.65a8,8,0,0,0-7.79,10.65l12.4,35.67-44.7-11.63-7.77-24.7A16,16,0,0,0,43.25,67L32,64.08a8,8,0,0,0-10,7.74V111A24,24,0,0,0,40.76,133.24Z"/></svg>`;

const SVG_BULLSEYE =
  '<svg class="w-10 h-10" viewBox="0 0 256 256" fill="currentColor"><path d="M228,116H211.31A84.13,84.13,0,0,0,140,44.69V28a12,12,0,0,0-24,0V44.69A84.13,84.13,0,0,0,44.69,116H28a12,12,0,0,0,0,24H44.69A84.13,84.13,0,0,0,116,211.31V228a12,12,0,0,0,24,0V211.31A84.13,84.13,0,0,0,211.31,140H228a12,12,0,0,0,0-24Zm-88,71.09V176a12,12,0,0,0-24,0v11.09A60.11,60.11,0,0,1,68.91,140H80a12,12,0,0,0,0-24H68.91A60.11,60.11,0,0,1,116,68.91V80a12,12,0,0,0,24,0V68.91A60.11,60.11,0,0,1,187.09,116H176a12,12,0,0,0,0,24h11.09A60.11,60.11,0,0,1,140,187.09Z"/></svg>';

const SVG_C130 =
  '<svg class="w-full h-full drop-shadow-md" viewBox="0 0 581.21 428.88" fill="currentColor"><path d="M573.64,170l-128.9-4.76s.41-21.16-2.21-34.17h17.49v-2.81h-18.14c-1.14-4.27-2.72-7.14-4.93-7.14s-3.85,2.88-4.99,7.14h-19.52v2.81h18.86c-2.54,12.59-2.13,32.66-2.13,32.66h-22.06s-.43-22.49-7.79-22.49-7.57,22.49-7.57,22.49h-19.68s-.41-20.07-2.9-32.66h18.4v-2.81h-19.03c-1.07-4.25-2.46-7.14-4.25-7.14s-3.33,2.9-4.53,7.14h-19.77v2.81h19.06c-2.73,12.04-3.63,30.71-3.63,30.71h-27.68c0-18.38-6.06-27.9-6.06-27.9v-63.15c0-11.46-4.33-22.71-12.98-45.42-8.65-22.71-18.1-25.3-18.1-25.3,0,0-9.44,2.6-18.1,25.3-8.65,22.71-12.98,33.96-12.98,45.42v63.15s-6.06,9.52-6.06,27.9h-27.68s-.9-18.67-3.63-30.71h18.98v-2.81h-19.7c-1.2-4.24-2.68-7.14-4.53-7.14s-3.18,2.88-4.25,7.14h-19.1v2.81h18.47c-2.49,12.59-2.9,32.66-2.9,32.66h-19.68s-.22-22.49-7.57-22.49-7.79,22.49-7.79,22.49h-22.06s.41-20.07-2.13-32.66h18.36v-2.81h-19.02c-1.14-4.25-2.75-7.14-4.99-7.14s-3.79,2.87-4.93,7.14h-18.65v2.81h18c-2.62,13.01-2.21,34.17-2.21,34.17l-128.9,4.76s-7.57,2.6-7.57,12.54,8,26.17,8,26.17l168.05,19.68s2.16,24.66,5.84,24.66,5.41-24.01,5.41-24.01c0,0,19.9,4.54,23.57,4.54s46.5-.22,46.5-.22v62.72s1.51,28.33,6.06,51.91c0,0-83.92,20.55-85.65,24.87-1.73,4.33,0,20.76,0,20.76l90.84,14.27s6.27-.22,7.79,3.03c1.51,3.24,6.34,17.95,14.2,17.95s12.69-14.71,14.2-17.95c1.51-3.24,7.79-3.03,7.79-3.03l90.84-14.27s1.73-16.44,0-20.76c-1.73-4.33-85.65-24.87-85.65-24.87,4.54-23.57,6.06-51.91,6.06-51.91v-62.72s42.82.22,46.5.22,23.57-4.54,23.57-4.54c0,0,1.73,24.01,5.41,24.01s5.84-24.66,5.84-24.66l168.05-19.68s8-16.22,8-26.17-7.57-12.54-7.57-12.54Z"/></svg>';

const SVG_SATELLITE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width:18px; height:18px;"><path d="M15.44,0.59l-3.18,3.18c-0.78,0.78-0.78,2.05,0,2.83l1.24,1.24l-0.71,0.71L11.55,7.3c-0.78-0.78-2.05-0.78-2.83,0 L7.3,8.72c-0.78,0.78-0.78,2.05,0,2.83l1.24,1.24l-0.71,0.71L6.6,12.25c-0.78-0.78-2.05-0.78-2.83,0l-3.18,3.18 c-0.78,0.78-0.78,2.05,0,2.83l3.54,3.54c0.78,0.78,2.05,0.78,2.83,0l3.18-3.18c0.78-0.78,0.78-2.05,0-2.83l-1.24-1.24l0.71-0.71 l1.24,1.24c0.78,0.78,2.05,0.78,2.83,0l1.41-1.41c0.78-0.78,0.78-2.05,0-2.83L13.84,9.6l0.71-0.71l1.24,1.24 c0.78,0.78,2.05,0.78,2.83,0l3.18-3.18c0.78-0.78,0.78-2.05,0-2.83l-3.54-3.54C17.48-0.2,16.22-0.2,15.44,0.59z M21,14l2,0c0,4.97-4.03,9-9,9l0-2C17.87,21,21,17.87,21,14z M17,14l2,0c0,2.76-2.24,5-5,5l0-2 C15.66,17,17,15.66,17,14z"/></svg>';

function escapeHtml(str: unknown): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function normalizeLineDashArray(lineStyle?: string | null): string | undefined {
  if (lineStyle === 'dashed') return '12, 12';
  if (lineStyle === 'dotted') return '3, 8';
  if (lineStyle === 'dashdot') return '16, 6, 3, 6';
  return undefined;
}

export function getIsr16x9Bounds(lat: number, lng: number, kmSize: number): L.LatLngBounds {
  const heightKm = Number(kmSize) || 2.5;
  const widthKm = heightKm * (16.0 / 9.0);
  const latRad = (lat * Math.PI) / 180.0;
  const a = 6378137.0;
  const e2 = 0.00669437999014;
  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const denom = Math.sqrt(1 - e2 * sinLat * sinLat);
  const kmPerLat = ((Math.PI / 180) * ((a * (1 - e2)) / (denom * denom * denom))) / 1000.0;
  const kmPerLon = ((Math.PI / 180) * ((a * cosLat) / denom)) / 1000.0;
  const halfHeightLat = heightKm / 2 / kmPerLat;
  const halfWidthLng = widthKm / 2 / kmPerLon;
  return L.latLngBounds([lat - halfHeightLat, lng - halfWidthLng], [lat + halfHeightLat, lng + halfWidthLng]);
}

export function resolveIsrVariants(req: CampaignMapIsrRequest): Array<{ url: string; label: string }> {
  const variants: Array<{ url: string; label: string }> = [];
  if (Array.isArray(req.image_urls) && req.image_urls.length > 0) {
    req.image_urls.forEach((item, idx) => {
      if (typeof item === 'string') {
        variants.push({ url: item, label: idx === 0 ? 'Raw Capture' : `Variant ${idx + 1}` });
      } else if (item && typeof item === 'object' && (item as CampaignMapIsrImageVariant).url) {
        variants.push({
          url: item.url,
          label: item.label || `Variant ${idx + 1}`,
        });
      }
    });
  } else if (req.image_url) {
    variants.push({ url: req.image_url, label: 'Raw Capture' });
  }
  return variants;
}

/* ============================================================================
 * 1. DCS Tile Layers (`DCS Tiles v2`, `DCS Terrain Map`, `Carto Dark`, `Carto Voyager`)
 * ========================================================================== */
const DCS_TERRAIN_SLUGS: Record<string, string> = {
  Syria: 'alt-syria',
  Caucasus: 'alt-caucasus',
  Nevada: 'alt-nevada',
  'Persian Gulf': 'alt-persiangulf',
  'Mariana Islands': 'alt-marianasislands',
  Normandy: 'alt-Normandy',
  GermanyCW: 'alt-GermanyCW',
  'Mariana Islands WWII': 'alt-MarianaIslandsWWII',
  Sinai: 'alt-sinai',
  Falklands: 'alt-falklands',
  'South Atlantic': 'alt-falklands',
  'The Channel': 'alt-thechannel',
  Kola: 'alt-kola',
};

const DCS_V2_CONFIGS: Record<string, { slug: string; detailZoom: number }> = {
  Nevada: { slug: 'nevada-v3', detailZoom: 17 },
  'Nevada Test & Training Range': { slug: 'nevada-v3', detailZoom: 17 },
  'Nevada Test': { slug: 'nevada-v3', detailZoom: 17 },
  Syria: { slug: 'syria', detailZoom: 16 },
  Kola: { slug: 'kola', detailZoom: 16 },
  Marianas: { slug: 'marianas', detailZoom: 16 },
  'Mariana Islands': { slug: 'marianas', detailZoom: 16 },
  Caucasus: { slug: 'caucasus', detailZoom: 16 },
  'CW Germany': { slug: 'cw-germany', detailZoom: 16 },
  GermanyCW: { slug: 'cw-germany', detailZoom: 16 },
  'Germany CW': { slug: 'cw-germany', detailZoom: 16 },
};

function resolveDcsSlug(theatreName?: string | null): string | null {
  if (!theatreName) return null;
  if (DCS_TERRAIN_SLUGS[theatreName]) return DCS_TERRAIN_SLUGS[theatreName];
  const clean = theatreName.trim().toLowerCase();
  if (clean.includes('syria')) return 'alt-syria';
  if (clean.includes('caucasus')) return 'alt-caucasus';
  if (clean.includes('nevada')) return 'alt-nevada';
  if (clean.includes('persian') || clean.includes('gulf')) return 'alt-persiangulf';
  if (clean.includes('mariana')) return 'alt-marianasislands';
  if (clean.includes('normandy')) return 'alt-Normandy';
  if (clean.includes('germany')) return 'alt-GermanyCW';
  if (clean.includes('sinai')) return 'alt-sinai';
  if (clean.includes('falkland') || clean.includes('atlantic')) return 'alt-falklands';
  if (clean.includes('channel')) return 'alt-thechannel';
  if (clean.includes('kola')) return 'alt-kola';
  return null;
}

function resolveDcsV2Config(theatreName?: string | null): { slug: string; detailZoom: number } | null {
  if (!theatreName) return null;
  if (DCS_V2_CONFIGS[theatreName]) return DCS_V2_CONFIGS[theatreName];
  const clean = theatreName.trim().toLowerCase();
  if (clean.includes('nevada')) return { slug: 'nevada-v3', detailZoom: 17 };
  if (clean.includes('syria')) return { slug: 'syria', detailZoom: 16 };
  if (clean.includes('kola')) return { slug: 'kola', detailZoom: 16 };
  if (clean.includes('mariana')) return { slug: 'marianas', detailZoom: 16 };
  if (clean.includes('caucasus')) return { slug: 'caucasus', detailZoom: 16 };
  if (clean.includes('germany')) return { slug: 'cw-germany', detailZoom: 16 };
  return null;
}

export interface BaseTileDescriptor {
  name: string;
  layer: L.Layer;
}

export function createDcsTileLayers(
  theatreName?: string | null,
  theatreDcsName?: string | null,
  boundsJson?: unknown
): { layers: Record<string, L.Layer>; names: string[]; defaultName: string } {
  const cartoKey = STATIC_CONFIG.cartoKey;
  const cartoKeyParam = cartoKey ? `?key=${encodeURIComponent(cartoKey)}` : '';

  const createCartoDark = () =>
    L.tileLayer(`https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png${cartoKeyParam}`, {
      minZoom: 3,
      maxZoom: 18,
      maxNativeZoom: 18,
      subdomains: 'abcd',
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      crossOrigin: 'anonymous',
    });

  const cartoDarkLayer = createCartoDark();
  const cartoVoyagerLayer = L.tileLayer(
    `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png${cartoKeyParam}`,
    {
      minZoom: 3,
      maxZoom: 18,
      maxNativeZoom: 18,
      subdomains: 'abcd',
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      crossOrigin: 'anonymous',
    }
  );

  let tileBounds: L.LatLngBounds | undefined;
  if (Array.isArray(boundsJson) && boundsJson.length > 0) {
    try {
      tileBounds = L.latLngBounds(boundsJson as any);
    } catch {
      tileBounds = undefined;
    }
  }

  const DcsTileLayer = L.TileLayer.extend({
    _isValidTile: function (coords: L.Coords) {
      if (!this.options.bounds) return true;
      const tb = this._tileCoordsToBounds(coords);
      const paddedBounds = L.latLngBounds(this.options.bounds).pad(0.05);
      return paddedBounds.contains(tb.getCenter());
    },
  }) as any;

  const layers: Record<string, L.Layer> = {
    'Carto Dark': cartoDarkLayer,
    'Carto Voyager': cartoVoyagerLayer,
  };

  const dcsSlug = resolveDcsSlug(theatreName) || resolveDcsSlug(theatreDcsName);
  if (dcsSlug) {
    const dcsTiles = new DcsTileLayer(
      `https://maps.dcsolympus.com/maps/${dcsSlug}/{z}/{x}/{y}.png`,
      {
        minZoom: 8,
        maxZoom: 18,
        maxNativeZoom: 13,
        attribution: 'DCS Olympus',
        crossOrigin: 'anonymous',
        bounds: tileBounds,
      }
    );
    layers['DCS Terrain Map'] = L.layerGroup([createCartoDark(), dcsTiles]);
  }

  const dcsV2Config = resolveDcsV2Config(theatreName) || resolveDcsV2Config(theatreDcsName);
  if (dcsV2Config) {
    const dcsV2Tiles = new DcsTileLayer(
      `https://maps.bigbeautifulboards.com/v2/${dcsV2Config.slug}/{z}/{x}/{y}.webp`,
      {
        minZoom: 6,
        maxZoom: 18,
        maxNativeZoom: dcsV2Config.detailZoom || 16,
        attribution: '&copy; Big Beautiful Boards',
        crossOrigin: 'anonymous',
        bounds: tileBounds,
      }
    );
    dcsV2Tiles.on('tileerror', (err: any) => {
      if (err?.tile) err.tile.style.visibility = 'hidden';
    });
    layers['DCS Tiles v2'] = L.layerGroup([createCartoDark(), dcsV2Tiles]);
  }

  const defaultName = layers['DCS Tiles v2']
    ? 'DCS Tiles v2'
    : layers['DCS Terrain Map']
      ? 'DCS Terrain Map'
      : 'Carto Dark';

  const orderedNames = [
    ...(layers['DCS Tiles v2'] ? ['DCS Tiles v2'] : []),
    ...(layers['DCS Terrain Map'] ? ['DCS Terrain Map'] : []),
    'Carto Dark',
    'Carto Voyager',
  ];

  return { layers, names: orderedNames, defaultName };
}

/* ============================================================================
 * 2. Theatre Bounds + Watermark Label
 * ========================================================================== */
export function renderTheatreBounds(
  group: L.LayerGroup,
  boundsJson: unknown,
  theatreName?: string | null
): void {
  group.clearLayers();
  if (!boundsJson) return;

  try {
    const style: L.PathOptions = {
      color: '#e7e5e4',
      weight: 4,
      opacity: 0.5,
      fill: false,
      dashArray: '1, 10',
      interactive: false,
    };

    let boundsLayer: L.Polygon | L.GeoJSON | null = null;
    if (
      Array.isArray(boundsJson) &&
      boundsJson.length > 0 &&
      Array.isArray(boundsJson[0]) &&
      typeof boundsJson[0][0] === 'number'
    ) {
      boundsLayer = L.polygon(boundsJson as any, style).addTo(group);
    } else if (typeof boundsJson === 'object') {
      boundsLayer = L.geoJSON(boundsJson as any, { style }).addTo(group);
    }

    if (boundsLayer && theatreName) {
      const ne = boundsLayer.getBounds().getNorthEast();
      const labelIcon = L.divIcon({
        className: 'theatre-label bg-transparent border-0',
        html: `<div class="text-stone-100 font-bold text-2xl uppercase tracking-widest opacity-90 whitespace-nowrap text-right pr-4 pt-4 pointer-events-none">${escapeHtml(
          theatreName
        )}</div>`,
        iconSize: [400, 50],
        iconAnchor: [400, 0],
      });
      L.marker(ne, { icon: labelIcon, interactive: false }).addTo(group);
    }
  } catch {
    // ignore malformed theatre bounds
  }
}

/* ============================================================================
 * 3. Airbases Layer (Blue / Red / Neutral + Active Flight Plan Role Badges)
 * ========================================================================== */
function matchAirbaseRole(airbase: CampaignMapAirbase, activePlan: FlightPlanDetail | null) {
  if (!activePlan) {
    return { isDeparture: false, isDestination: false, isDivert: false };
  }
  const abName = (airbase.name || '').toLowerCase().trim();
  const abIcao = (airbase.code || airbase.icao || '').toLowerCase().trim();
  const matches = (target?: string | null) => {
    const t = (target || '').toLowerCase().trim();
    if (!t) return false;
    return (
      abName === t ||
      (abIcao && abIcao === t) ||
      (t.length > 2 && (t.includes(abName) || (abIcao && t.includes(abIcao))))
    );
  };
  const isDeparture = Boolean(matches(activePlan.departure_airfield));
  const isDestination = Boolean(matches(activePlan.destination_airfield));
  const diverts = Array.isArray(activePlan.diverts) ? activePlan.diverts : [];
  const isDivert = diverts.some((d: any) => {
    if (!d) return false;
    if (typeof d === 'string') return matches(d);
    if (airbase.id && d.id && d.id === airbase.id) return true;
    if (d.name && String(d.name).toLowerCase().trim() === abName) return true;
    if (abIcao && (d.icao || d.code) && String(d.icao || d.code).toLowerCase().trim() === abIcao) {
      return true;
    }
    return false;
  });
  return { isDeparture, isDestination, isDivert };
}

export function getAirbaseMarkerIcon(
  airbase: CampaignMapAirbase,
  activePlan: FlightPlanDetail | null
): L.DivIcon {
  const coalitionStr = String(airbase.coalition ?? '').toLowerCase();
  const colorClass =
    coalitionStr === '2' || coalitionStr === 'blue'
      ? 'text-sky-400'
      : coalitionStr === '1' || coalitionStr === 'red'
        ? 'text-red-500'
        : 'text-stone-100';

  const { isDeparture, isDestination, isDivert } = matchAirbaseRole(airbase, activePlan);
  const icaoBadge = airbase.icao
    ? `<span class="text-stone-200 font-bold text-[10px] bg-stone-950/90 border border-stone-700 px-1 rounded shadow mt-0.5 whitespace-nowrap pointer-events-none">${escapeHtml(
        airbase.icao
      )}</span>`
    : '';

  if (isDeparture && isDestination) {
    return L.divIcon({
      className: 'airbase-icon group airbase-dep-dest-marker',
      html: `<div class="flex flex-col items-center justify-center relative">
        <div class="absolute -top-3.5 left-1/2 -translate-x-1/2 flex items-center gap-0.5 bg-sky-500 text-stone-950 px-1.5 py-0.5 rounded font-black text-[9px] uppercase tracking-wider shadow-md border border-sky-300 pointer-events-none animate-pulse whitespace-nowrap">${SVG_TAKEOFF(
          'w-3 h-3 inline fill-current'
        )} HOME &amp; DEST</div>
        ${icaoBadge}
        <div class="text-sky-400 scale-110">${SVG_TAKEOFF()}</div>
        <span class="text-sky-300 font-extrabold text-xs bg-stone-900/90 border border-sky-500/70 px-1.5 py-0.5 rounded mt-0.5 whitespace-nowrap pointer-events-none shadow-lg">${escapeHtml(
          airbase.name
        )}</span>
      </div>`,
      iconSize: [48, 56],
      iconAnchor: [24, 24],
    });
  }

  if (isDeparture) {
    return L.divIcon({
      className: 'airbase-icon group airbase-departure-marker',
      html: `<div class="flex flex-col items-center justify-center relative">
        <div class="absolute -top-3.5 left-1/2 -translate-x-1/2 flex items-center gap-0.5 bg-sky-500 text-stone-950 px-1.5 py-0.5 rounded font-black text-[9px] uppercase tracking-wider shadow-md border border-sky-300 pointer-events-none animate-pulse whitespace-nowrap">${SVG_TAKEOFF(
          'w-3 h-3 inline fill-current'
        )} DEPARTURE</div>
        ${icaoBadge}
        <div class="text-sky-400 scale-110">${SVG_TAKEOFF()}</div>
        <span class="text-sky-300 font-extrabold text-xs bg-stone-900/90 border border-sky-500/70 px-1.5 py-0.5 rounded mt-0.5 whitespace-nowrap pointer-events-none shadow-lg">${escapeHtml(
          airbase.name
        )}</span>
      </div>`,
      iconSize: [48, 56],
      iconAnchor: [24, 24],
    });
  }

  if (isDestination) {
    return L.divIcon({
      className: 'airbase-icon group airbase-destination-marker',
      html: `<div class="flex flex-col items-center justify-center relative">
        <div class="absolute -top-3.5 left-1/2 -translate-x-1/2 flex items-center gap-0.5 bg-indigo-500 text-white px-1.5 py-0.5 rounded font-black text-[9px] uppercase tracking-wider shadow-md border border-indigo-300 pointer-events-none animate-pulse whitespace-nowrap">${SVG_LANDING(
          'w-3 h-3 inline fill-current'
        )} DESTINATION</div>
        ${icaoBadge}
        <div class="text-indigo-400 scale-110">${SVG_LANDING()}</div>
        <span class="text-indigo-300 font-extrabold text-xs bg-stone-900/90 border border-indigo-500/70 px-1.5 py-0.5 rounded mt-0.5 whitespace-nowrap pointer-events-none shadow-lg">${escapeHtml(
          airbase.name
        )}</span>
      </div>`,
      iconSize: [48, 56],
      iconAnchor: [24, 24],
    });
  }

  if (isDivert) {
    return L.divIcon({
      className: 'airbase-icon group airbase-divert-marker',
      html: `<div class="flex flex-col items-center justify-center relative">
        <div class="absolute -top-3.5 left-1/2 -translate-x-1/2 flex items-center gap-0.5 bg-amber-500 text-stone-950 px-1.5 py-0.5 rounded font-black text-[9px] uppercase tracking-wider shadow-md border border-amber-300 pointer-events-none animate-pulse whitespace-nowrap">${SVG_LANDING(
          'w-3 h-3 inline fill-current'
        )} DIVERT</div>
        ${icaoBadge}
        <div class="text-amber-400 scale-110">${SVG_LANDING()}</div>
        <span class="text-amber-300 font-extrabold text-xs bg-stone-900/90 border border-amber-500/70 px-1.5 py-0.5 rounded mt-0.5 whitespace-nowrap pointer-events-none shadow-lg">${escapeHtml(
          airbase.name
        )}</span>
      </div>`,
      iconSize: [48, 56],
      iconAnchor: [24, 24],
    });
  }

  return L.divIcon({
    className: 'airbase-icon group',
    html: `<div class="flex flex-col items-center justify-center">
      ${icaoBadge}
      <div class="${colorClass} transition-transform duration-200 hover:scale-110">${SVG_ATC_TOWER}</div>
      <span class="text-stone-100 font-bold text-xs bg-stone-900/90 border border-stone-700/90 px-1.5 py-0.5 rounded shadow-md mt-0.5 whitespace-nowrap pointer-events-none">${escapeHtml(
        airbase.name
      )}</span>
    </div>`,
    iconSize: [44, 52],
    iconAnchor: [22, 22],
  });
}

function buildAirbasePopupHtml(airbase: CampaignMapAirbase, activePlan: FlightPlanDetail | null): string {
  const { isDeparture, isDestination, isDivert } = matchAirbaseRole(airbase, activePlan);
  let html = `<div class="p-1 w-[285px] text-stone-200 font-sans">`;

  if (isDeparture && isDestination) {
    html += `<div class="mb-2 px-2 py-1 rounded bg-sky-950/80 border border-sky-500/60 text-sky-300 text-xs font-bold flex items-center justify-between">${SVG_TAKEOFF(
      'w-4 h-4 text-sky-400 inline fill-current'
    )} <span>Launch &amp; Recovery</span><span class="text-[9px] font-mono px-1 rounded bg-sky-500/20">HOME &amp; DEST</span></div>`;
  } else if (isDeparture) {
    html += `<div class="mb-2 px-2 py-1 rounded bg-sky-950/80 border border-sky-500/60 text-sky-300 text-xs font-bold flex items-center justify-between"><span>Designated Departure</span><span class="text-[9px] font-mono px-1 rounded bg-sky-500/20">HOME PLATE</span></div>`;
  } else if (isDestination) {
    html += `<div class="mb-2 px-2 py-1 rounded bg-indigo-950/80 border border-indigo-500/60 text-indigo-300 text-xs font-bold flex items-center justify-between"><span>Designated Recovery</span><span class="text-[9px] font-mono px-1 rounded bg-indigo-500/20">DESTINATION</span></div>`;
  } else if (isDivert) {
    html += `<div class="mb-2 px-2 py-1 rounded bg-amber-950/80 border border-amber-500/60 text-amber-300 text-xs font-bold flex items-center justify-between"><span>Designated Divert</span><span class="text-[9px] font-mono px-1 rounded bg-amber-500/20">ALTERNATE</span></div>`;
  }

  html += `<h3 class="font-extrabold text-base border-b border-stone-700/80 mb-2 pb-1 text-white">${escapeHtml(
    airbase.name
  )} <span class="text-xs font-normal text-stone-400">(${escapeHtml(
    airbase.icao || '---'
  )})</span></h3>`;

  if (airbase.tacan || airbase.elevation) {
    html += `<div class="flex items-center gap-3 mb-2 text-xs text-stone-300">`;
    if (airbase.tacan) {
      html += `<span>TACAN: <b class="font-mono text-amber-400">${escapeHtml(airbase.tacan)}</b></span>`;
    }
    if (airbase.elevation !== null && airbase.elevation !== undefined) {
      html += `<span>ELEV: <b class="font-mono text-stone-100">${airbase.elevation} ft</b></span>`;
    }
    html += `</div>`;
  }

  if (airbase.runways && airbase.runways.length > 0) {
    html += `<div class="mb-2.5"><span class="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Runways</span><div class="flex flex-wrap gap-1.5">${airbase.runways
      .map(
        (r: any) =>
          `<span class="px-2 py-0.5 rounded bg-stone-800 border border-stone-700 text-xs font-mono font-semibold text-stone-200">${escapeHtml(
            typeof r === 'object' ? r.name || r.heading : r
          )}</span>`
      )
      .join('')}</div></div>`;
  }

  const allFreqs = [...(airbase.custom_frequencies || []), ...(airbase.frequencies || [])];
  const customFreqs = allFreqs.filter((f: any) => {
    if (Array.isArray(f)) return false;
    if (f && typeof f === 'object') {
      if (f.source === 'dcs') return false;
      const nm = String(f.name || f.label || '').toLowerCase();
      if (nm.startsWith('dcs tow') || nm.startsWith('dcs atc')) return false;
    }
    return true;
  });
  const dcsFreqs = [
    ...(airbase.dcs_frequencies || []),
    ...(airbase.frequencies || []).filter((f: any) => {
      if (Array.isArray(f)) return true;
      if (f && typeof f === 'object') {
        const nm = String(f.name || f.label || '').toLowerCase();
        return f.source === 'dcs' || nm.startsWith('dcs tow') || nm.startsWith('dcs atc');
      }
      return false;
    }),
  ];

  const renderFreqRow = (f: any) => {
    const hz = Array.isArray(f) ? f[0] : typeof f === 'object' ? f.freq || f.frequency : f;
    const mhz = typeof hz === 'number' && hz > 10000 ? (hz / 1000000).toFixed(3) : String(hz);
    const mod = typeof f === 'object' && (f.modulation || f.type) ? f.modulation || f.type : 'AM';
    const lbl = typeof f === 'object' && (f.name || f.label) ? f.name || f.label : 'ATC';
    return `<div class="flex items-center justify-between text-[11px] gap-1 py-0.5">
      <span class="text-stone-300 truncate max-w-[90px]" title="${escapeHtml(lbl)}">${escapeHtml(
      lbl
    )}</span>
      <span class="flex items-center gap-1"><b class="font-mono text-amber-400">${escapeHtml(
        mhz
      )}</b><span class="text-[9px] text-stone-400 uppercase px-1 rounded bg-stone-900 border border-stone-800">${escapeHtml(
      mod
    )}</span></span>
    </div>`;
  };

  if (customFreqs.length > 0 || dcsFreqs.length > 0) {
    html += `<div class="mb-2"><span class="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Frequencies</span>`;
    if (customFreqs.length > 0) {
      html += `<div class="grid grid-cols-2 gap-x-3 gap-y-0.5">${customFreqs
        .map(renderFreqRow)
        .join('')}</div>`;
    }
    if (dcsFreqs.length > 0) {
      html += `<details class="mt-1 pt-1 border-t border-stone-800 text-[10px]"><summary class="cursor-pointer text-stone-400 hover:text-stone-200 select-none">Show DCS Synced (${dcsFreqs.length})</summary><div class="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-1">${dcsFreqs
        .map(renderFreqRow)
        .join('')}</div></details>`;
    }
    html += `</div>`;
  }

  if (airbase.procedures && airbase.procedures.length > 0) {
    html += `<div class="mt-2 pt-1.5 border-t border-stone-800">
      <div class="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-cyan-400 mb-1">
        <span>Procedures &amp; Patterns</span>
        <span class="text-stone-400 font-mono text-[9px]">${airbase.procedures.length} available</span>
      </div>
      <div class="space-y-1 max-h-36 overflow-y-auto pr-0.5">
        ${airbase.procedures
          .map((proc, pIdx) => {
            const procColor =
              proc.color || (proc.type === 'overhead_pattern' ? '#a855f7' : '#38bdf8');
            const typeLabel = proc.type_label || String(proc.type || 'PROC').toUpperCase();
            return `<div class="p-1.5 rounded bg-stone-900/90 border border-stone-800 flex items-center justify-between gap-1.5">
              <div class="min-w-0 flex-1">
                <div class="font-bold text-[11px] text-white truncate">${escapeHtml(proc.name)}</div>
                <div class="text-[9px] text-stone-400 font-mono flex items-center gap-1">
                  <span class="inline-block w-1.5 h-1.5 rounded-full" style="background-color:${procColor}"></span>
                  <span>${escapeHtml(typeLabel)}${
              proc.runway ? ` • RWY ${escapeHtml(proc.runway)}` : ''
            } • ${(proc.waypoints || []).length} fixes</span>
                </div>
              </div>
              <button type="button" data-proc-apply="${pIdx}" class="px-2 py-0.5 rounded bg-sky-700 hover:bg-sky-600 text-white font-bold text-[10px] uppercase cursor-pointer">+ Plan</button>
            </div>`;
          })
          .join('')}
      </div>
    </div>`;
  }

  if (activePlan && activePlan.can_edit) {
    html += `<div class="mt-2.5 pt-2 border-t border-stone-800 grid grid-cols-2 gap-1.5">
      <button type="button" data-ab-set-dep="1" class="px-2 py-1 rounded bg-sky-950 hover:bg-sky-900 text-sky-300 border border-sky-700/60 text-[10px] font-bold cursor-pointer">Set Departure</button>
      <button type="button" data-ab-set-dest="1" class="px-2 py-1 rounded bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/60 text-[10px] font-bold cursor-pointer">Set Destination</button>
      <button type="button" data-ab-toggle-divert="1" class="col-span-2 px-2 py-1 rounded ${
        isDivert
          ? 'bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-700/60'
          : 'bg-amber-950/70 hover:bg-amber-900 text-amber-300 border border-amber-700/60'
      } text-[10px] font-bold cursor-pointer">${
      isDivert ? 'Remove Divert Airfield' : '+ Add Divert Airfield'
    }</button>
    </div>`;
  }

  html += `</div>`;
  return html;
}

export function renderAirbasesLayer(
  groups: { blue: L.LayerGroup; red: L.LayerGroup; neutral: L.LayerGroup },
  airbases: CampaignMapAirbase[],
  activePlan: FlightPlanDetail | null,
  callbacks: {
    onApplyProcedure: (proc: CampaignMapProcedure, mode: 'auto' | 'prepend' | 'append') => void;
    onSetAirbaseRole?: (airbase: CampaignMapAirbase, role: 'departure' | 'destination') => void;
    onToggleDivert?: (airbase: CampaignMapAirbase) => void;
  }
): void {
  groups.blue.clearLayers();
  groups.red.clearLayers();
  groups.neutral.clearLayers();

  airbases.forEach((ab) => {
    if (!Number.isFinite(ab.lat) || !Number.isFinite(ab.lng)) return;
    const coalitionStr = String(ab.coalition ?? '').toLowerCase();
    const target =
      coalitionStr === '2' || coalitionStr === 'blue'
        ? groups.blue
        : coalitionStr === '1' || coalitionStr === 'red'
          ? groups.red
          : groups.neutral;

    const marker = L.marker([ab.lat, ab.lng], {
      icon: getAirbaseMarkerIcon(ab, activePlan),
    });

    marker.bindPopup(() => buildAirbasePopupHtml(ab, activePlan), { maxWidth: 320 });
    marker.on('popupopen', (ev) => {
      const root = ev.popup.getElement();
      if (!root) return;
      root.querySelectorAll<HTMLButtonElement>('[data-proc-apply]').forEach((btn) => {
        btn.onclick = () => {
          const idx = Number(btn.dataset.procApply);
          const proc = ab.procedures?.[idx];
          if (proc) callbacks.onApplyProcedure(proc, 'auto');
        };
      });
      const depBtn = root.querySelector<HTMLButtonElement>('[data-ab-set-dep]');
      if (depBtn && callbacks.onSetAirbaseRole) {
        depBtn.onclick = () => {
          callbacks.onSetAirbaseRole?.(ab, 'departure');
          marker.closePopup();
        };
      }
      const destBtn = root.querySelector<HTMLButtonElement>('[data-ab-set-dest]');
      if (destBtn && callbacks.onSetAirbaseRole) {
        destBtn.onclick = () => {
          callbacks.onSetAirbaseRole?.(ab, 'destination');
          marker.closePopup();
        };
      }
      const divertBtn = root.querySelector<HTMLButtonElement>('[data-ab-toggle-divert]');
      if (divertBtn && callbacks.onToggleDivert) {
        divertBtn.onclick = () => {
          callbacks.onToggleDivert?.(ab);
          marker.closePopup();
        };
      }
    });

    marker.addTo(target);
  });
}

/* ============================================================================
 * 4. Airfield Procedures Layer (SID / STAR / IAP / Overhead Pattern)
 * ========================================================================== */
function formatProcedureNameplate(proc: CampaignMapProcedure): string {
  const typeCodeMap: Record<string, string> = {
    departure: 'DEP',
    sid: 'DEP',
    arrival: 'ARR',
    star: 'ARR',
    approach: 'APP',
    iap: 'APP',
    overhead_pattern: 'PAT',
    overhead: 'PAT',
  };
  const typeCode = typeCodeMap[proc.type] || String(proc.type || 'PROC').toUpperCase();
  const name = (proc.name || '').trim();
  const rwy = (proc.runway || '').trim();
  if (!name || name.toLowerCase() === 'procedure') {
    return rwy ? `${rwy} ${typeCode}` : typeCode;
  }
  let clean = name
    .replace(/\b(departure|arrival|approach|overhead\s+pattern|overhead|pattern)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) clean = rwy || name;
  if (rwy && !clean.toUpperCase().includes(rwy.toUpperCase())) clean = `${clean} ${rwy}`;
  if (!clean.toUpperCase().split(/\s+/).includes(typeCode)) clean = `${clean} ${typeCode}`;
  return clean.toUpperCase();
}

export function renderAirbaseProceduresLayer(
  typeGroups: {
    departure: L.LayerGroup;
    arrival: L.LayerGroup;
    approach: L.LayerGroup;
    overhead_pattern: L.LayerGroup;
  },
  airbases: CampaignMapAirbase[],
  onApplyProcedure: (proc: CampaignMapProcedure, mode: 'auto' | 'prepend' | 'append') => void
): void {
  Object.values(typeGroups).forEach((g) => g.clearLayers());

  airbases.forEach((ab) => {
    (ab.procedures || []).forEach((proc) => {
      const rawPoints = proc.waypoints || [];
      if (rawPoints.length < 2) return;

      const latlngs: L.LatLng[] = [];
      const fixMarkers: L.Marker[] = [];

      rawPoints.forEach((pt: any, idx) => {
        const lat = Number(pt.lat);
        const lng = Number(pt.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        const ll = L.latLng(lat, lng);
        latlngs.push(ll);

        const fixName = pt.name || `FIX ${idx + 1}`;
        const isOverhead = proc.type === 'overhead_pattern' || proc.type === 'overhead';
        let shouldRender = true;
        if (isOverhead) {
          const validStages = ['INITIAL', 'BREAK', 'DOWNWIND', 'BASE', 'FINAL'];
          const upperName = String(pt.name || '')
            .trim()
            .toUpperCase();
          shouldRender = validStages.includes(upperName) || pt.is_fix === true;
          if (pt.type === 'CURVE' || pt.is_curve === true || upperName.startsWith('PT ')) {
            shouldRender = false;
          }
        }
        if (
          shouldRender &&
          fixMarkers.some(
            (m) => Math.abs(m.getLatLng().lat - lat) < 0.0001 && Math.abs(m.getLatLng().lng - lng) < 0.0001
          )
        ) {
          shouldRender = false;
        }

        if (shouldRender) {
          const badgeAlt = pt.alt
            ? `${pt.alt}ft`
            : proc.initial_altitude
              ? `${proc.initial_altitude}ft`
              : '';
          const fixIcon = L.divIcon({
            html: `<div class="procedure-fix-node relative flex items-center select-none cursor-pointer group" style="width: 14px; height: 14px;">
              <div class="fix-diamond w-3 h-3 rotate-45 rounded-[1.5px] border-2 border-stone-900 shadow-md transition-transform duration-150 group-hover:scale-125" style="width:12px;height:12px;margin:1px;background-color:${
                proc.color || '#38bdf8'
              }"></div>
              <div class="fix-label absolute left-4.5 top-1/2 -translate-y-1/2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-stone-950/95 border border-stone-700/80 shadow-lg text-[10px] font-mono whitespace-nowrap leading-tight z-50">
                <span class="font-bold text-white tracking-wider">${escapeHtml(fixName)}</span>
                ${
                  badgeAlt
                    ? `<span class="text-sky-400 font-semibold border-l border-stone-700/80 pl-1">${escapeHtml(
                        badgeAlt
                      )}</span>`
                    : ''
                }
              </div>
            </div>`,
            className: 'procedure-fix-marker',
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          });

          const fm = L.marker(ll, { icon: fixIcon, zIndexOffset: 700 + idx });
          fm.bindTooltip(
            `<div class="p-1.5 text-xs font-mono min-w-[150px]"><div class="font-bold text-white flex justify-between gap-2"><span>${escapeHtml(
              fixName
            )}</span><span class="text-[10px] text-stone-400 font-normal">${escapeHtml(
              proc.name
            )}</span></div><div class="text-[10px] text-stone-400 font-sans">${escapeHtml(
              ab.name
            )}</div></div>`,
            { direction: 'top', offset: [0, -12], className: 'procedure-tooltip' }
          );
          fixMarkers.push(fm);
        }
      });

      if (latlngs.length < 2) return;

      // Overhead pattern direction arrows
      if (proc.type === 'overhead_pattern' || proc.type === 'overhead') {
        const initPt =
          rawPoints.find((p) => String(p.name || '').toUpperCase() === 'INITIAL') || rawPoints[0];
        const brkPt =
          rawPoints.find((p) => String(p.name || '').toUpperCase() === 'BREAK') || rawPoints[1];
        const dwPt = rawPoints.find((p) => String(p.name || '').toUpperCase() === 'DOWNWIND');
        const bsPt = rawPoints.find((p) => String(p.name || '').toUpperCase() === 'BASE');

        const makeArrow = (lat: number, lng: number, hdg: number, label: string) => {
          const arrowIcon = L.divIcon({
            className: 'procedure-track-arrow bg-transparent border-0',
            html: `<div style="transform: rotate(${hdg}deg); width: 20px; height: 20px;" class="flex items-center justify-center"><svg viewBox="0 0 24 24" class="w-full h-full" style="color:${
              proc.color || '#a855f7'
            }" fill="currentColor"><path d="M12 2L4 18h6v4h4v-4h6L12 2z"/></svg></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10],
          });
          return L.marker([lat, lng], { icon: arrowIcon, zIndexOffset: 750 }).bindTooltip(label, {
            direction: 'top',
            offset: [0, -8],
            className: 'procedure-tooltip',
          });
        };

        let rwyHdg: number | null = null;
        if (initPt && brkPt) {
          rwyHdg = Math.round(
            calculateBearingDegrees(Number(initPt.lat), Number(initPt.lng), Number(brkPt.lat), Number(brkPt.lng))
          );
          fixMarkers.push(
            makeArrow(
              Number(initPt.lat) + (Number(brkPt.lat) - Number(initPt.lat)) * 0.7,
              Number(initPt.lng) + (Number(brkPt.lng) - Number(initPt.lng)) * 0.7,
              rwyHdg,
              `<b>Initial / Run-in Leg</b><br><span class="text-[10px] text-purple-300">Track ${rwyHdg}°</span>`
            )
          );
        }
        if (dwPt && bsPt) {
          const dwHdg =
            rwyHdg !== null
              ? (rwyHdg + 180) % 360
              : Math.round(
                  calculateBearingDegrees(Number(dwPt.lat), Number(dwPt.lng), Number(bsPt.lat), Number(bsPt.lng))
                );
          fixMarkers.push(
            makeArrow(
              (Number(dwPt.lat) + Number(bsPt.lat)) / 2,
              (Number(dwPt.lng) + Number(bsPt.lng)) / 2,
              dwHdg,
              `<b>Downwind Leg</b><br><span class="text-[10px] text-purple-300">Track ${dwHdg}°</span>`
            )
          );
        }
      }

      const normType =
        proc.type === 'sid'
          ? 'departure'
          : proc.type === 'star'
            ? 'arrival'
            : proc.type === 'iap'
              ? 'approach'
              : proc.type === 'overhead'
                ? 'overhead_pattern'
                : proc.type;

      const dashPattern =
        normType === 'departure'
          ? '8, 6'
          : normType === 'arrival'
            ? '12, 6'
            : normType === 'approach'
              ? '4, 6'
              : normType === 'overhead_pattern'
                ? '2, 6'
                : '8, 6';

      const polyline = L.polyline(latlngs, {
        color: proc.color || '#38bdf8',
        weight: 3.5,
        opacity: 0.85,
        dashArray: dashPattern,
        lineCap: 'round',
        lineJoin: 'round',
        className: 'procedure-track-line',
      });

      const segIdx = Math.max(0, Math.floor((latlngs.length - 1) / 2));
      const nameplatePos = L.latLng(
        (latlngs[segIdx].lat + latlngs[segIdx + 1].lat) / 2,
        (latlngs[segIdx].lng + latlngs[segIdx + 1].lng) / 2
      );
      const nameplateText = formatProcedureNameplate(proc);
      const nameplateIcon = L.divIcon({
        html: `<div class="procedure-nameplate inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border shadow-2xl select-none cursor-pointer" style="background-color:#0c0a09;border-color:${
          proc.color || '#38bdf8'
        }"><span class="w-2 h-2 rotate-45 rounded-[1px] shrink-0" style="background-color:${
          proc.color || '#38bdf8'
        }"></span><span class="font-mono font-bold text-[11px] text-white tracking-wider">${escapeHtml(
          nameplateText
        )}</span>${
          proc.initial_altitude
            ? `<span class="font-mono text-[9px] font-semibold text-sky-400 border-l border-stone-800 pl-1.5">${escapeHtml(
                proc.initial_altitude
              )}ft</span>`
            : ''
        }</div>`,
        className: 'procedure-nameplate-marker',
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
      const nameplateMarker = L.marker(nameplatePos, { icon: nameplateIcon, zIndexOffset: 850 });

      const popupHtml = `<div class="p-2 text-xs text-stone-200 min-w-[250px] max-w-[300px]">
        <div class="flex items-center justify-between gap-2 mb-1">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase" style="color:${
            proc.color || '#38bdf8'
          };border:1px solid ${proc.color || '#38bdf8'}66">${escapeHtml(
        proc.type_label || proc.type
      )}</span>
          ${proc.runway ? `<span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-stone-800 border border-stone-700">RWY ${escapeHtml(proc.runway)}</span>` : ''}
        </div>
        <div class="font-bold text-sm text-white">${escapeHtml(proc.name)}</div>
        <div class="text-[11px] text-stone-400 mb-2">${escapeHtml(ab.name)}</div>
        <div class="border-t border-stone-800 pt-1.5 max-h-28 overflow-y-auto space-y-0.5 font-mono text-[11px]">
          ${rawPoints
            .slice(0, 12)
            .map(
              (pt, i) =>
                `<div class="flex justify-between"><span>${i + 1}. ${escapeHtml(
                  pt.name || `FIX ${i + 1}`
                )}</span><span class="text-stone-400">${pt.alt ? `${pt.alt}ft` : ''}</span></div>`
            )
            .join('')}
        </div>
        <div class="mt-2.5 pt-2 border-t border-stone-800 grid grid-cols-2 gap-1.5">
          <button type="button" data-proc-mode="prepend" class="px-2 py-1 rounded bg-stone-800 hover:bg-stone-700 text-[10px] font-bold uppercase text-stone-200 cursor-pointer">Insert Start</button>
          <button type="button" data-proc-mode="append" class="px-2 py-1 rounded bg-sky-600 hover:bg-sky-500 text-[10px] font-bold uppercase text-white cursor-pointer">Append End</button>
        </div>
      </div>`;

      const bindApplyHandlers = (layer: L.Layer) => {
        layer.on('popupopen', (ev: any) => {
          const el = ev.popup?.getElement();
          if (!el) return;
          (el.querySelectorAll('[data-proc-mode]') as NodeListOf<HTMLButtonElement>).forEach((btn: HTMLButtonElement) => {
            btn.onclick = () => {
              const mode = btn.dataset.procMode as 'prepend' | 'append' | 'auto';
              onApplyProcedure(proc, mode || 'auto');
            };
          });
        });
      };

      polyline.bindPopup(popupHtml);
      nameplateMarker.bindPopup(popupHtml);
      bindApplyHandlers(polyline);
      bindApplyHandlers(nameplateMarker);

      const setHovered = (on: boolean) => {
        polyline.setStyle({ weight: on ? 5 : 3.5, opacity: on ? 1 : 0.85 });
        const npEl = nameplateMarker.getElement();
        if (npEl) npEl.classList.toggle('proc-hovered', on);
        fixMarkers.forEach((fm) => fm.getElement()?.classList.toggle('proc-hovered', on));
      };
      polyline.on('mouseover', () => setHovered(true));
      polyline.on('mouseout', () => setHovered(false));
      nameplateMarker.on('mouseover', () => setHovered(true));
      nameplateMarker.on('mouseout', () => setHovered(false));

      const targetGroup =
        typeGroups[normType as keyof typeof typeGroups] || typeGroups.departure;
      const fg = L.featureGroup([polyline, nameplateMarker, ...fixMarkers]);
      targetGroup.addLayer(fg);
    });
  });
}

/* ============================================================================
 * 5. Bullseyes Layer
 * ========================================================================== */
export function renderBullseyesLayer(
  group: L.LayerGroup,
  bullseyes: CampaignMapBullseye[]
): void {
  group.clearLayers();
  bullseyes.forEach((b) => {
    const lat = Number(b.lat);
    const lng = Number(b.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const bName = (b.name || 'B/E').toUpperCase();
    const isBlue = bName === 'BLUE' || b.coalition === 2;
    const colorClass = isBlue ? 'text-sky-400' : 'text-red-600';
    const ringColor = isBlue ? '#38bdf8' : '#ef4444';

    const icon = L.divIcon({
      className: 'bullseye-icon',
      html: `<div class="flex flex-col items-center justify-center">
        <div class="${colorClass}">${SVG_BULLSEYE}</div>
        <div class="text-[9px] font-mono font-bold text-stone-200 bg-stone-900/90 px-1 rounded border border-stone-700 -mt-1">${escapeHtml(
          bName
        )}</div>
      </div>`,
      iconSize: [40, 55],
      iconAnchor: [20, 20],
    });
    L.marker([lat, lng], { icon, interactive: false, zIndexOffset: 2000 }).addTo(group);

    [10, 20, 30, 40, 50].forEach((ringNm) => {
      L.circle([lat, lng], {
        radius: ringNm * 1852,
        color: ringColor,
        weight: ringNm % 20 === 0 ? 1.3 : 0.7,
        dashArray: ringNm % 20 === 0 ? undefined : '4, 8',
        opacity: 0.45,
        fill: false,
        interactive: false,
      }).addTo(group);
    });
  });
}

/* ============================================================================
 * 6. Missions & Objective AORs Layer (Geodesic Area + Portal Tooltips)
 * ========================================================================== */
function computeGeodesicArea(coords: Array<[number, number]>): { sqKm: number; sqNm: number } {
  if (coords.length < 3) return { sqKm: 0, sqNm: 0 };
  const pts = [...coords];
  if (
    pts.length > 3 &&
    Math.abs(pts[0][0] - pts[pts.length - 1][0]) < 1e-7 &&
    Math.abs(pts[0][1] - pts[pts.length - 1][1]) < 1e-7
  ) {
    pts.pop();
  }
  const n = pts.length;
  const radiusKm = 6371.0088;
  const toRad = Math.PI / 180;
  let total = 0;
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const curr = pts[i];
    const next = pts[(i + 1) % n];
    total += (next[1] - prev[1]) * toRad * Math.sin(curr[0] * toRad);
  }
  const sqKm = Math.abs((total * radiusKm * radiusKm) / 2);
  return { sqKm: Math.round(sqKm * 10) / 10, sqNm: Math.round((sqKm / 3.429904) * 10) / 10 };
}

function normalizePolygonCoords(aor: any): Array<[number, number]> {
  if (Array.isArray(aor.coordinates)) {
    return aor.coordinates
      .map((pt: any) =>
        Array.isArray(pt)
          ? ([Number(pt[0]), Number(pt[1])] as [number, number])
          : ([Number(pt.lat), Number(pt.lng)] as [number, number])
      )
      .filter(([a, b]: [number, number]) => Number.isFinite(a) && Number.isFinite(b));
  }
  if (aor.geometry?.coordinates) {
    const ring = Array.isArray(aor.geometry.coordinates[0])
      ? aor.geometry.coordinates[0]
      : aor.geometry.coordinates;
    return ring
      .map((pt: any) => [Number(pt[1]), Number(pt[0])] as [number, number])
      .filter(([a, b]: [number, number]) => Number.isFinite(a) && Number.isFinite(b));
  }
  return [];
}

export function renderMissionsLayer(
  map: L.Map,
  group: L.LayerGroup,
  missions: CampaignMapMission[],
  unit: 'nm' | 'km',
  onOpenMission: (missionId: number, tab?: 'overview' | 'objectives') => void
): void {
  group.clearLayers();
  if (!map.getPane('primaryAorPane')) {
    map.createPane('primaryAorPane').style.zIndex = '380';
  }
  if (!map.getPane('objectiveAorPane')) {
    map.createPane('objectiveAorPane').style.zIndex = '420';
  }

  const formatAorArea = (aor: any): string => {
    const isKm = unit === 'km';
    if (aor.type === 'circle') {
      const rNm = Number(aor.radius_nm || 5);
      return isKm
        ? `~${(Math.PI * Math.pow(rNm * 1.852, 2)).toFixed(1)} SQ KM (${(rNm * 1.852).toFixed(1)} KM)`
        : `~${(Math.PI * rNm * rNm).toFixed(1)} SQ NM (${rNm} NM)`;
    }
    if (aor.type === 'box' && aor.north !== undefined) {
      const coords: Array<[number, number]> = [
        [Number(aor.north), Number(aor.west)],
        [Number(aor.north), Number(aor.east)],
        [Number(aor.south), Number(aor.east)],
        [Number(aor.south), Number(aor.west)],
      ];
      const area = computeGeodesicArea(coords);
      return `~${isKm ? area.sqKm : area.sqNm} ${isKm ? 'SQ KM' : 'SQ NM'}`;
    }
    if (aor.type === 'polygon') {
      const area = computeGeodesicArea(normalizePolygonCoords(aor));
      return `~${isKm ? area.sqKm : area.sqNm} ${isKm ? 'SQ KM' : 'SQ NM'}`;
    }
    return '';
  };

  missions.forEach((m) => {
    const missionColor = m.color_hex || m.color || '#ef4444';
    const totalObjs = m.total_objectives ?? m.objectives?.length ?? 0;
    const completedObjs =
      m.completed_objectives ??
      (m.objectives || []).filter((o) =>
        ['completed', 'destroyed', 'success', 'done'].includes((o.status || '').toLowerCase())
      ).length;
    const pct =
      m.progress_percent ?? (totalObjs > 0 ? Math.round((completedObjs / totalObjs) * 100) : 0);

    // 1. Primary Mission AOR
    if (m.aor && typeof m.aor === 'object' && m.aor.type) {
      let aorLayer: L.Layer | null = null;
      if (
        m.aor.type === 'box' &&
        m.aor.north !== undefined &&
        m.aor.south !== undefined &&
        m.aor.east !== undefined &&
        m.aor.west !== undefined
      ) {
        aorLayer = L.rectangle(
          [
            [Number(m.aor.south), Number(m.aor.west)],
            [Number(m.aor.north), Number(m.aor.east)],
          ],
          {
            color: missionColor,
            weight: 2,
            dashArray: '6, 6',
            fillColor: missionColor,
            fillOpacity: 0.12,
            pane: 'primaryAorPane',
          }
        );
      } else if (m.aor.type === 'circle' && m.aor.center_lat && m.aor.center_lng) {
        aorLayer = L.circle([Number(m.aor.center_lat), Number(m.aor.center_lng)], {
          radius: (Number(m.aor.radius_nm) || 5) * 1852,
          color: missionColor,
          weight: 2,
          dashArray: '6, 6',
          fillColor: missionColor,
          fillOpacity: 0.12,
          pane: 'primaryAorPane',
        });
      } else if (m.aor.type === 'polygon') {
        const coords = normalizePolygonCoords(m.aor);
        if (coords.length >= 3) {
          aorLayer = L.polygon(coords, {
            color: missionColor,
            weight: 2,
            dashArray: '6, 6',
            fillColor: missionColor,
            fillOpacity: 0.12,
            pane: 'primaryAorPane',
          });
        }
      }

      if (aorLayer) {
        const areaStr = formatAorArea(m.aor);
        aorLayer.bindTooltip(
          `<div class="p-3 text-xs text-stone-200 min-w-[260px] max-w-[340px] space-y-1.5 font-sans">
            <div class="flex items-center justify-between gap-2 border-b border-stone-800 pb-1">
              <div class="font-extrabold text-sm text-white">${escapeHtml(m.name)}</div>
              <span class="px-1.5 py-0.5 rounded text-[9px] font-mono uppercase font-bold" style="background:${missionColor}20;color:${missionColor};border:1px solid ${missionColor}60">${escapeHtml(
            m.status_label || m.status
          )}</span>
            </div>
            <div class="flex justify-between text-[10px] font-mono text-sky-300 bg-sky-950/40 px-2 py-1 rounded border border-sky-800/60">
              <span class="font-bold">PRIMARY MISSION AOR</span>
              <span>${escapeHtml(areaStr)}</span>
            </div>
          </div>`,
          { direction: 'center', className: 'mission-map-tooltip' }
        );
        aorLayer.on('click', () => onOpenMission(m.id, 'overview'));
        aorLayer.addTo(group);
      }
    }

    // 2. Objective AORs & Objective Target Pins
    (m.objectives || []).forEach((obj, idx) => {
      const st = (obj.status || 'pending').toLowerCase();
      const isDone = ['completed', 'destroyed', 'success', 'done'].includes(st);
      const isAct = ['active', 'in_progress'].includes(st);
      const isFail = ['failed', 'destroyed_failed'].includes(st);
      const objColor = isDone ? '#10b981' : isAct ? '#f59e0b' : isFail ? '#ef4444' : '#38bdf8';

      if (obj.aor && typeof obj.aor === 'object' && obj.aor.type) {
        let objLayer: L.Layer | null = null;
        if (obj.aor.type === 'box' && obj.aor.north !== undefined) {
          objLayer = L.rectangle(
            [
              [Number(obj.aor.south), Number(obj.aor.west)],
              [Number(obj.aor.north), Number(obj.aor.east)],
            ],
            {
              color: objColor,
              weight: 2,
              dashArray: '5, 5',
              fillColor: objColor,
              fillOpacity: 0.14,
              pane: 'objectiveAorPane',
            }
          );
        } else if (obj.aor.type === 'circle' && obj.aor.center_lat && obj.aor.center_lng) {
          objLayer = L.circle([Number(obj.aor.center_lat), Number(obj.aor.center_lng)], {
            radius: (Number(obj.aor.radius_nm) || 5) * 1852,
            color: objColor,
            weight: 2,
            dashArray: '5, 5',
            fillColor: objColor,
            fillOpacity: 0.14,
            pane: 'objectiveAorPane',
          });
        } else if (obj.aor.type === 'polygon') {
          const coords = normalizePolygonCoords(obj.aor);
          if (coords.length >= 3) {
            objLayer = L.polygon(coords, {
              color: objColor,
              weight: 2,
              dashArray: '5, 5',
              fillColor: objColor,
              fillOpacity: 0.14,
              pane: 'objectiveAorPane',
            });
          }
        }
        if (objLayer) {
          objLayer.bindTooltip(
            `<div class="p-2.5 text-xs text-stone-200 min-w-[240px] space-y-1 font-sans">
              <div class="font-bold text-white">OBJ #${idx + 1}: ${escapeHtml(obj.objective)}</div>
              <div class="text-[10px] font-mono text-amber-300">Objective AOR ${escapeHtml(
                formatAorArea(obj.aor)
              )}</div>
            </div>`,
            { direction: 'center', className: 'mission-map-tooltip' }
          );
          objLayer.on('click', () => onOpenMission(m.id, 'objectives'));
          objLayer.addTo(group);
        }
      }

      if (obj.lat === null || obj.lat === undefined || obj.lng === null || obj.lng === undefined)
        return;

      const prioRaw = String(obj.priority || 'medium').toLowerCase();
      const prioSymbol =
        prioRaw.includes('high') || prioRaw.includes('pri') || prioRaw === '1'
          ? '★'
          : prioRaw.includes('low') || prioRaw.includes('ter') || prioRaw === '3'
            ? '●'
            : '◆';
      const prioColor =
        prioSymbol === '★' ? '#ef4444' : prioSymbol === '●' ? '#94a3b8' : '#38bdf8';
      const glyph = isDone ? '✓' : isFail ? '✕' : String(idx + 1);

      const objIcon = L.divIcon({
        className: 'objective-target-icon',
        html: `<div class="relative group cursor-pointer transition-transform hover:scale-125">
          <div class="w-8 h-8 rounded-full flex items-center justify-center font-mono font-black text-xs text-white shadow-lg bg-stone-900/95" style="border:2px solid ${missionColor}">
            <span style="color:${objColor}">${glyph}</span>
          </div>
          <div class="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-black bg-stone-950 border" style="color:${prioColor};border-color:${prioColor}">${prioSymbol}</div>
          <div class="absolute -inset-2 rounded-full animate-ping -z-10 pointer-events-none" style="background-color:${objColor}1a"></div>
        </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const objMarker = L.marker([Number(obj.lat), Number(obj.lng)], {
        icon: objIcon,
        zIndexOffset: 2100,
      });
      objMarker.bindTooltip(
        `<div class="p-2.5 text-xs text-stone-200 min-w-[250px] max-w-[320px] space-y-1.5 font-sans">
          <div class="flex items-start justify-between gap-2 border-b border-stone-800 pb-1">
            <div class="font-extrabold text-sm text-white">OBJ #${idx + 1}: ${escapeHtml(
          obj.objective
        )}</div>
            <span class="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase font-mono shrink-0" style="background:${objColor}20;color:${objColor};border:1px solid ${objColor}60">${escapeHtml(
          st
        )}</span>
          </div>
          <div class="text-[11px] font-mono text-stone-400">Mission: <b class="text-white">${escapeHtml(
            m.name
          )}</b></div>
          ${
            obj.mgrs
              ? `<div class="text-[11px] font-mono text-amber-300 font-bold">Grid: ${escapeHtml(
                  obj.mgrs
                )}</div>`
              : ''
          }
          <div class="flex justify-between text-[11px] font-mono pt-1 border-t border-stone-800">
            <span>Priority: <b style="color:${prioColor}">${prioSymbol}</b></span>
            ${
              obj.points && obj.points > 0
                ? `<span class="text-emerald-400 font-semibold">+${obj.points} ${escapeHtml(
                    (obj.resource_type || 'CP').replace('_', ' ').toUpperCase()
                  )}</span>`
                : ''
            }
          </div>
        </div>`,
        { direction: 'top', offset: [0, -10], opacity: 1, className: 'mission-map-tooltip' }
      );
      objMarker.on('click', () => onOpenMission(m.id, 'objectives'));
      objMarker.addTo(group);
    });

    // 3. Primary Mission Pin
    if (m.lat === null || m.lat === undefined || m.lng === null || m.lng === undefined) return;
    const badgeHtml =
      totalObjs > 0
        ? `<div class="absolute -top-1.5 -right-2 min-w-[19px] h-[19px] px-1 rounded-full flex items-center justify-center text-[9px] font-mono font-black border shadow z-10 ${
            completedObjs === totalObjs
              ? 'bg-emerald-600 text-white border-emerald-400'
              : completedObjs > 0
                ? 'bg-amber-600 text-white border-amber-400'
                : 'bg-stone-900 text-amber-300 border-stone-600'
          }">${completedObjs > 0 && completedObjs < totalObjs ? `${completedObjs}/${totalObjs}` : `${totalObjs}`}</div>`
        : '';

    const iconInner =
      m.icon_html && m.icon_html.trim() !== ''
        ? m.icon_html
        : `<svg class="w-5 h-5" style="color:${missionColor}" fill="currentColor" viewBox="0 0 256 256"><path d="M208,32H160a8,8,0,0,0-5.66,2.34L112,76.69,69.66,34.34A8,8,0,0,0,64,32H40A16,16,0,0,0,24,48V72a8,8,0,0,0,2.34,5.66L68.69,120,34.34,154.34A8,8,0,0,0,32,160v24a16,16,0,0,0,16,16H72a8,8,0,0,0,5.66-2.34L112,163.31l42.34,42.35A8,8,0,0,0,160,208h24a16,16,0,0,0,16-16V168a8,8,0,0,0-2.34-5.66L155.31,120l42.35-42.34A8,8,0,0,0,200,72V48A16,16,0,0,0,208,32Z"/></svg>`;

    const icon = L.divIcon({
      className: 'mission-icon',
      html: `<div class="relative bg-stone-900/90 rounded-full w-8 h-8 flex items-center justify-center border-2 shadow-lg hover:scale-110 transition-transform cursor-pointer" style="border-color:${missionColor}">${iconInner}${badgeHtml}<div class="absolute -inset-3 rounded-full animate-ping -z-10 pointer-events-none" style="background-color:${missionColor}1a"></div></div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    const marker = L.marker([Number(m.lat), Number(m.lng)], { icon, zIndexOffset: 2000 });
    const barColor =
      completedObjs >= totalObjs && totalObjs > 0
        ? 'bg-emerald-400'
        : completedObjs > 0
          ? 'bg-amber-400'
          : 'bg-stone-700';

    marker.bindTooltip(
      `<div class="p-2.5 text-xs text-stone-200 min-w-[260px] max-w-[320px] space-y-1.5 font-sans">
        <div class="flex items-start justify-between gap-2 border-b border-stone-800 pb-1.5">
          <div class="font-extrabold text-sm text-white">${escapeHtml(m.name)}</div>
          <span class="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase font-mono shrink-0" style="background:${missionColor}20;color:${missionColor};border:1px solid ${missionColor}60">${escapeHtml(
        m.tasking_label || 'Mission'
      )}</span>
        </div>
        ${
          m.squadron_name
            ? `<div class="text-[11px] font-mono text-amber-300">${escapeHtml(m.squadron_name)}</div>`
            : ''
        }
        ${
          m.scheduled_date
            ? `<div class="text-[11px] font-mono text-cyan-300">${escapeHtml(m.scheduled_date)}</div>`
            : ''
        }
        ${
          m.rewards_summary && m.rewards_summary !== 'None'
            ? `<div class="text-[11px] font-mono text-emerald-300">Earnings: <b>${escapeHtml(
                m.rewards_summary
              )}</b></div>`
            : ''
        }
        ${
          totalObjs > 0
            ? `<div class="pt-1 border-t border-stone-800 space-y-1">
                <div class="flex justify-between text-[10px] font-mono"><span class="text-stone-400">Objective Progress:</span><b>${completedObjs}/${totalObjs} (${pct}%)</b></div>
                <div class="w-full bg-stone-950 rounded-full h-1.5 overflow-hidden border border-stone-800"><div class="${barColor} h-1.5 rounded-full" style="width:${pct}%"></div></div>
              </div>`
            : ''
        }
      </div>`,
      { direction: 'top', offset: [0, -10], opacity: 1, className: 'mission-map-tooltip' }
    );
    marker.on('click', () => onOpenMission(m.id, 'overview'));
    marker.addTo(group);
  });
}

/* ============================================================================
 * 7. Stepped Patriot Engagement Layer + Threats Layer
 * ========================================================================== */
export function createPatriotEngagementLayer(
  latlng: [number, number],
  heading: number,
  rangeNm: number,
  options: {
    strokeColor?: string;
    fillColor?: string;
    fillOpacity?: number;
    weight?: number;
    minRangeNm?: number;
  } = {}
): L.LayerGroup {
  const group = L.layerGroup();
  const R = Number(rangeNm) || 55;
  const [centerLat, centerLng] = latlng;
  const hdg = Number.isFinite(heading) ? heading : 0;
  const strokeColor = options.strokeColor || '#ef4444';
  const fillColor = options.fillColor || strokeColor;
  const fillOpacity = options.fillOpacity ?? 0.12;
  const weight = options.weight ?? 1.5;
  const minRangeNm = options.minRangeNm ?? 1.5;

  const polygonPts: Array<[number, number]> = [];
  const pushArc = (fromDeg: number, toDeg: number, radiusNm: number, stepDeg = 2) => {
    if (fromDeg <= toDeg) {
      for (let deg = fromDeg; deg <= toDeg; deg += stepDeg) {
        const dest = computeDestinationPoint(centerLat, centerLng, (hdg + deg + 3600) % 360, radiusNm);
        polygonPts.push([dest.lat, dest.lng]);
      }
    } else {
      for (let deg = fromDeg; deg >= toDeg; deg -= stepDeg) {
        const dest = computeDestinationPoint(centerLat, centerLng, (hdg + deg + 3600) % 360, radiusNm);
        polygonPts.push([dest.lat, dest.lng]);
      }
    }
  };

  const pStart = computeDestinationPoint(centerLat, centerLng, (hdg - 130 + 3600) % 360, minRangeNm);
  polygonPts.push([pStart.lat, pStart.lng]);
  pushArc(-130, -95, 0.62 * R);
  pushArc(-95, -65, 0.8 * R);
  pushArc(-65, 65, 1.0 * R);
  pushArc(65, 95, 0.8 * R);
  pushArc(95, 130, 0.62 * R);
  const pEnd = computeDestinationPoint(centerLat, centerLng, (hdg + 130 + 3600) % 360, minRangeNm);
  polygonPts.push([pEnd.lat, pEnd.lng]);

  L.polygon(polygonPts, {
    color: strokeColor,
    weight,
    opacity: 0.9,
    fill: true,
    fillColor,
    fillOpacity,
    interactive: false,
  }).addTo(group);

  [
    { deg: -130, dist: 0.62 * R },
    { deg: -95, dist: 0.8 * R },
    { deg: -65, dist: 1.0 * R },
    { deg: 65, dist: 1.0 * R },
    { deg: 95, dist: 0.8 * R },
    { deg: 130, dist: 0.62 * R },
  ].forEach((ra) => {
    const d = computeDestinationPoint(centerLat, centerLng, (hdg + ra.deg + 3600) % 360, ra.dist);
    L.polyline([[centerLat, centerLng], [d.lat, d.lng]], {
      color: strokeColor,
      weight: 1,
      opacity: 0.75,
      interactive: false,
    }).addTo(group);
  });

  const bore = computeDestinationPoint(centerLat, centerLng, hdg, R);
  L.polyline([[centerLat, centerLng], [bore.lat, bore.lng]], {
    color: strokeColor,
    weight: 1,
    dashArray: '4, 4',
    opacity: 0.6,
    interactive: false,
  }).addTo(group);

  L.circle([centerLat, centerLng], {
    radius: minRangeNm * 1852,
    color: strokeColor,
    weight: 1,
    fill: false,
    opacity: 0.8,
    interactive: false,
  }).addTo(group);

  L.circle([centerLat, centerLng], {
    radius: R * 1852,
    color: strokeColor,
    weight: 1,
    dashArray: '6, 6',
    opacity: 0.35,
    fill: false,
    interactive: false,
  }).addTo(group);

  return group;
}

export function renderThreatsLayer(
  group: L.LayerGroup,
  threats: CampaignMapThreat[],
  threatTypes: CampaignMapThreatTypeOption[],
  samSystems: CampaignMapSamSystem[],
  editable = false,
  onThreatClick?: (threat: CampaignMapThreat, index: number) => void
): void {
  group.clearLayers();
  threats.forEach((t, idx) => {
    if (t.is_visible === false || !Number.isFinite(t.lat) || !Number.isFinite(t.lng)) return;

    let rangeM = Number(t.range_m || 0);
    let samName = t.sam_name || '';
    if (t.sam_system_id) {
      const sys = samSystems.find((s) => s.id === t.sam_system_id);
      if (sys) {
        if (!rangeM && sys.max_range) rangeM = sys.max_range * 1852;
        if (!samName) samName = sys.name;
      }
    }
    const rangeNm = rangeM > 0 ? rangeM / 1852 : Number(t.range || 0);
    const titleLower = `${t.title || ''} ${samName}`.toLowerCase();
    const isPatriot =
      titleLower.includes('patriot') ||
      titleLower.includes('mpq-53') ||
      titleLower.includes('mpq-65') ||
      titleLower.includes('mim-104');

    if (rangeM > 0 && (t.type === 'sam' || !t.type)) {
      if (isPatriot && t.heading !== null && t.heading !== undefined) {
        createPatriotEngagementLayer([t.lat, t.lng], Number(t.heading), rangeNm, {
          strokeColor: t.color || '#ef4444',
          fillColor: t.color || '#ef4444',
          fillOpacity: 0.12,
        }).addTo(group);
      } else {
        L.circle([t.lat, t.lng], {
          radius: rangeM,
          color: t.color || '#ef4444',
          fillColor: t.color || '#ef4444',
          fillOpacity: 0.1,
          weight: 1.2,
          dashArray: '5, 5',
          interactive: false,
        }).addTo(group);
      }
    }

    const typeCfg = threatTypes.find((tt) => tt.value === t.type) || threatTypes[0];
    const iconHtml =
      typeCfg?.icon ||
      '<div class="w-5 h-5 rounded-full bg-red-600/80 border border-white flex items-center justify-center text-[9px] font-bold text-white">▲</div>';

    const icon = L.divIcon({
      className: 'threat-icon',
      html: `<div class="w-7 h-7 flex items-center justify-center cursor-pointer">${iconHtml}</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

    const marker = L.marker([t.lat, t.lng], { icon, zIndexOffset: 1000 });
    marker.bindPopup(
      `<div class="p-2 min-w-[220px] font-sans">
        <h3 class="font-bold text-base text-red-400 mb-0.5">${escapeHtml(
          t.title || samName || 'Threat'
        )}</h3>
        <p class="text-[10px] text-stone-400 uppercase font-mono font-bold">${escapeHtml(
          typeCfg?.label || t.type
        )}${rangeNm > 0 ? ` · ${rangeNm.toFixed(1)} NM` : ''}</p>
        ${t.description ? `<p class="mt-2 text-xs text-stone-300">${escapeHtml(t.description)}</p>` : ''}
        ${
          editable
            ? `<button type="button" data-threat-edit="1" class="mt-2.5 w-full px-2.5 py-1 rounded bg-red-950 hover:bg-red-900 border border-red-700 text-red-200 text-xs font-bold cursor-pointer">Edit in Threat Manager</button>`
            : ''
        }
      </div>`
    );
    marker.on('popupopen', (ev) => {
      const btn = ev.popup.getElement()?.querySelector<HTMLButtonElement>('[data-threat-edit]');
      if (btn && onThreatClick) btn.onclick = () => onThreatClick(t, idx);
    });
    marker.addTo(group);
  });
}

/* ============================================================================
 * 8. Support Assets Layer (Racetrack Orbits + SAM Fans + Live C-130 Telemetry)
 * ========================================================================== */
export function renderSupportAssetsLayer(
  group: L.LayerGroup,
  assets: CampaignMapSupportAsset[],
  assetTypes: CampaignMapSupportAssetTypeOption[],
  samSystems: CampaignMapSamSystem[],
  unit: 'nm' | 'km',
  editable = false,
  onAssetClick?: (asset: CampaignMapSupportAsset, index: number) => void
): void {
  group.clearLayers();
  const isKm = unit === 'km';

  assets.forEach((sa, idx) => {
    if (!Number.isFinite(sa.lat) || !Number.isFinite(sa.lng)) return;

    if (sa.type === 'sam') {
      let maxRangeNm = Number(sa.range || 0);
      let samSysName = sa.sam_name || '';
      if (sa.sam_system_id) {
        const sys = samSystems.find((s) => s.id === sa.sam_system_id);
        if (sys) {
          maxRangeNm = Number(sys.max_range || sys.range || maxRangeNm);
          samSysName = sys.name || samSysName;
        }
      }
      if (maxRangeNm > 0) {
        const titleLower = `${sa.title || ''} ${samSysName}`.toLowerCase();
        const isPatriot =
          titleLower.includes('patriot') ||
          titleLower.includes('mpq-53') ||
          titleLower.includes('mpq-65') ||
          titleLower.includes('mim-104');
        if (isPatriot) {
          createPatriotEngagementLayer([sa.lat, sa.lng], Number(sa.heading || 0), maxRangeNm, {
            strokeColor: '#0284c7',
            fillColor: '#38bdf8',
            fillOpacity: 0.15,
          }).addTo(group);
        } else {
          L.circle([sa.lat, sa.lng], {
            radius: maxRangeNm * 1852,
            color: '#0284c7',
            fillColor: '#38bdf8',
            fillOpacity: 0.12,
            weight: 1.5,
            dashArray: '5, 5',
            interactive: false,
          }).addTo(group);
        }
      }
    } else if (sa.type === 'tanker' || sa.type === 'awacs') {
      let heading = Number(sa.heading) || 0;
      let legNm = sa.leg_length !== undefined && sa.leg_length !== null ? Number(sa.leg_length) : 20;
      if (Array.isArray(sa.waypoints) && sa.waypoints.length >= 2 && !sa.heading) {
        const w1 = sa.waypoints[0];
        const w2 = sa.waypoints[1];
        heading = calculateBearingDegrees(Number(w1.lat), Number(w1.lng), Number(w2.lat), Number(w2.lng));
        legNm = calculateDistanceNm(Number(w1.lat), Number(w1.lng), Number(w2.lat), Number(w2.lng));
      }
      if (legNm > 0) {
        const endPt = computeDestinationPoint(sa.lat, sa.lng, heading, legNm);
        const radiusNm = 5;
        const pts: Array<[number, number]> = [];
        const p0 = computeDestinationPoint(sa.lat, sa.lng, heading + 90, radiusNm);
        pts.push([p0.lat, p0.lng]);
        for (let i = 0; i <= 180; i += 10) {
          const p = computeDestinationPoint(endPt.lat, endPt.lng, heading + 90 - i, radiusNm);
          pts.push([p.lat, p.lng]);
        }
        for (let i = 0; i <= 180; i += 10) {
          const p = computeDestinationPoint(sa.lat, sa.lng, heading - 90 - i, radiusNm);
          pts.push([p.lat, p.lng]);
        }
        L.polygon(pts, {
          color: '#0284c7',
          weight: 2.5,
          opacity: 0.95,
          fill: true,
          fillColor: '#38bdf8',
          fillOpacity: 0.15,
          dashArray: '6, 6',
          className: 'support-asset-orbit-track',
          interactive: false,
        }).addTo(group);
      }

      if (sa.is_dcs_tracked && sa.dcs_lat != null && sa.dcs_lng != null) {
        const liveHdg = sa.dcs_heading ?? heading;
        const liveIcon = L.divIcon({
          className: 'support-asset-icon-live-plane bg-transparent border-0',
          html: `<div style="transform: rotate(${liveHdg}deg); width:32px; height:32px;" class="text-sky-400 cursor-pointer">${SVG_C130}</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });
        L.marker([Number(sa.dcs_lat), Number(sa.dcs_lng)], {
          icon: liveIcon,
          zIndexOffset: 1200,
        })
          .bindTooltip(
            `<div class="text-xs font-semibold text-sky-400">${escapeHtml(
              sa.title || sa.dcs_group_name || 'LIVE ASSET'
            )}</div>`,
            { direction: 'top', offset: [0, -10] }
          )
          .addTo(group);
      }
    }

    const typeCfg = assetTypes.find((at) => at.value === sa.type) || assetTypes[0];
    const iconHtml =
      typeCfg?.icon ||
      `<span class="text-[10px] font-bold text-sky-400">${escapeHtml(
        String(sa.type || 'SA').slice(0, 2).toUpperCase()
      )}</span>`;
    const isSam = sa.type === 'sam';
    const marker = L.marker([sa.lat, sa.lng], {
      icon: L.divIcon({
        className: 'sa-icon group',
        html: isSam
          ? `<div class="w-7 h-7 flex items-center justify-center hover:scale-110 transition-transform cursor-pointer">${iconHtml}</div>`
          : `<div class="w-7 h-7 rounded-full bg-stone-900/90 border border-sky-400/90 shadow-md flex items-center justify-center p-1 text-sky-400 hover:scale-110 transition-transform cursor-pointer">${iconHtml}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      }),
      zIndexOffset: 1100,
    });

    const displayAlt =
      sa.altitude != null && sa.altitude !== ''
        ? `${isKm ? Math.round(Number(sa.altitude) * 0.3048) : sa.altitude} ${isKm ? 'm MSL' : 'ft MSL'}`
        : null;
    const displayLeg =
      sa.leg_length != null
        ? `${isKm ? (Number(sa.leg_length) * 1.852).toFixed(1) : sa.leg_length} ${isKm ? 'KM' : 'NM'}`
        : null;

    marker.bindPopup(
      `<div class="p-1 w-[275px] text-stone-200 font-sans">
        <div class="border-b border-stone-700/80 pb-2 mb-2">
          <h3 class="font-extrabold text-base text-white truncate">${escapeHtml(
            sa.title || sa.sam_name || 'Support Asset'
          )}</h3>
          <div class="flex items-center gap-1.5 flex-wrap mt-1">
            <span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-sky-950/90 text-sky-400 border border-sky-800/60">${escapeHtml(
              sa.type
            )}</span>
            ${
              sa.aircraft_type
                ? `<span class="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-amber-950/90 text-amber-300 border border-amber-800/60">${escapeHtml(
                    sa.aircraft_type
                  )}</span>`
                : ''
            }
          </div>
        </div>
        <div class="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-stone-300">
          ${displayAlt ? `<div><span class="text-stone-400">ALT:</span> <b>${displayAlt}</b></div>` : ''}
          ${sa.speed ? `<div><span class="text-stone-400">SPD:</span> <b>${sa.speed} kts</b></div>` : ''}
          ${displayLeg ? `<div><span class="text-stone-400">LEG:</span> <b>${displayLeg}</b></div>` : ''}
          ${sa.heading != null ? `<div><span class="text-stone-400">HDG:</span> <b>${sa.heading}°</b></div>` : ''}
          ${sa.tacan_channel ? `<div><span class="text-stone-400">TACAN:</span> <b class="text-emerald-400 font-mono">${escapeHtml(sa.tacan_channel)}</b></div>` : ''}
          ${sa.radio_freq ? `<div><span class="text-stone-400">FREQ:</span> <b class="text-amber-400 font-mono">${escapeHtml(sa.radio_freq)}</b></div>` : ''}
        </div>
        ${sa.description ? `<p class="mt-2 pt-2 border-t border-stone-800 text-xs text-stone-400">${escapeHtml(sa.description)}</p>` : ''}
        ${
          editable
            ? `<button type="button" data-sa-edit="1" class="mt-2.5 w-full px-2.5 py-1 rounded bg-sky-950 hover:bg-sky-900 border border-sky-700 text-sky-200 text-xs font-bold cursor-pointer">Edit in Support Assets</button>`
            : ''
        }
      </div>`
    );
    marker.on('popupopen', (ev) => {
      const btn = ev.popup.getElement()?.querySelector<HTMLButtonElement>('[data-sa-edit]');
      if (btn && onAssetClick) btn.onclick = () => onAssetClick(sa, idx);
    });
    marker.addTo(group);
  });
}

/* ============================================================================
 * 9. NAVAIDs Layer (handles item.coordinates.{lat, lon} AND item.{lat, lng})
 * ========================================================================== */
export function renderNavaidsLayer(
  map: L.Map,
  group: L.LayerGroup,
  navaids: CampaignMapNavaid[],
  enabled: boolean
): void {
  group.clearLayers();
  if (!enabled || map.getZoom() < 7) return;

  navaids.forEach((item) => {
    const lat = Number(item.coordinates?.lat ?? item.lat);
    const lon = Number(item.coordinates?.lon ?? item.coordinates?.lng ?? item.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

    const ident = item.ident || item.name || 'NAV';
    const mgrsVal = item.mgrs || toMgrs(lat, lon);
    const dmsVal = formatCoordinateDms(lat, lon);

    const icon = L.divIcon({
      className: 'navaid-marker-icon',
      html: `<div class="flex items-center gap-1.5 cursor-pointer select-none">
        <svg class="w-3.5 h-3.5 text-amber-400 fill-amber-400/80 stroke-amber-200 stroke-[1.5]" viewBox="0 0 24 24"><polygon points="12,2 22,20 2,20" /></svg>
        <span class="text-[10px] font-mono font-bold text-amber-300 bg-stone-950/80 px-1 rounded border border-amber-500/30 whitespace-nowrap">${escapeHtml(
          ident
        )}</span>
      </div>`,
      iconSize: [80, 20],
      iconAnchor: [6, 8],
    });

    const marker = L.marker([lat, lon], { icon, title: `NAVAID: ${ident}` });
    marker.bindPopup(
      `<div class="p-1 min-w-[220px] space-y-2 font-sans">
        <div class="flex items-center gap-2 border-b border-zinc-800 pb-1.5">
          <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30">NAVAID</span>
          <h3 class="text-sm font-bold text-zinc-100 font-mono">${escapeHtml(ident)}</h3>
        </div>
        <div class="bg-zinc-800/60 border border-zinc-800 rounded-md p-2 space-y-1 font-mono text-[11px]">
          <div class="flex justify-between"><span class="text-zinc-400">MGRS:</span><b class="text-amber-400 select-all">${escapeHtml(mgrsVal)}</b></div>
          <div class="flex justify-between border-t border-zinc-800/80 pt-1"><span class="text-zinc-400">LAT:</span><span class="select-all">${lat.toFixed(6)}°</span></div>
          <div class="flex justify-between border-t border-zinc-800/80 pt-1"><span class="text-zinc-400">LON:</span><span class="select-all">${lon.toFixed(6)}°</span></div>
          <div class="flex justify-between border-t border-zinc-800/80 pt-1 text-[10px] text-zinc-400"><span>DMS:</span><span class="select-all font-sans">${escapeHtml(dmsVal)}</span></div>
        </div>
      </div>`
    );
    marker.addTo(group);
  });
}

/* ============================================================================
 * 10. Clustered Background Flight Plans Layer
 * ========================================================================== */
export function renderClusteredFlightPlansLayer(
  map: L.Map,
  group: L.LayerGroup,
  allPlans: CampaignMapFlightPlanBrief[],
  activePlanId: number | null | undefined,
  selectedMissionId: number | null,
  selectedSortieId: number | null,
  unit: 'nm' | 'km',
  onOpenFlightPlan: (planId: number) => void
): void {
  group.clearLayers();
  if (!map.getPane('flightPlanPane')) {
    map.createPane('flightPlanPane').style.zIndex = '450';
  }

  const isKm = unit === 'km';
  const polylinesById: Record<number, L.Polyline> = {};
  const enriched: Array<
    CampaignMapFlightPlanBrief & { _calcDist: string; _calcTime: string; _pts: Array<[number, number]> }
  > = [];

  allPlans.forEach((fp) => {
    if (activePlanId && fp.id === activePlanId) return;
    if (selectedSortieId && fp.sortie_id !== selectedSortieId) return;
    if (!selectedSortieId && selectedMissionId && fp.mission_id !== selectedMissionId) return;

    const rawPts = (fp.route_points || []).filter(
      (p: any) => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng))
    );
    if (rawPts.length < 2) return;

    const pts = rawPts.map((p: any) => [Number(p.lat), Number(p.lng)] as [number, number]);
    let distNm = 0;
    let timeSec = 0;
    const defSpd = Number(rawPts.find((p: any) => Number(p.speed) > 0)?.speed || 300);

    for (let i = 0; i < pts.length - 1; i++) {
      const legNm = calculateDistanceNm(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
      distNm += legNm;
      const cas = Number(rawPts[i].speed) > 0 ? Number(rawPts[i].speed) : defSpd;
      const alt = Number(rawPts[i + 1]?.alt ?? rawPts[i]?.alt ?? 0);
      const tas = casToTas(cas, alt);
      timeSec += (legNm / (tas > 0 ? tas : 300)) * 3600;
    }

    const h = Math.floor(timeSec / 3600)
      .toString()
      .padStart(2, '0');
    const m = Math.floor((timeSec % 3600) / 60)
      .toString()
      .padStart(2, '0');
    const s = Math.floor(timeSec % 60)
      .toString()
      .padStart(2, '0');

    const line = L.polyline(pts, {
      color: fp.color || (fp.is_opfor ? '#ef4444' : '#3b82f6'),
      weight: 2.5,
      opacity: 0.9,
      pane: 'flightPlanPane',
    }).addTo(group);
    polylinesById[fp.id] = line;

    enriched.push({
      ...fp,
      _calcDist: `${Math.round(isKm ? distNm * 1.852 : distNm)}${isKm ? 'KM' : 'NM'}`,
      _calcTime: timeSec > 0 ? `${h}:${m}:${s}` : 'N/A',
      _pts: pts,
    });
  });

  // Spatial clustering by start waypoint (~1.5 km)
  const clusters: Array<{ lat: number; lon: number; flights: typeof enriched }> = [];
  enriched.forEach((f) => {
    const [fLat, fLon] = f._pts[0];
    const match = clusters.find(
      (c) => Math.abs(c.lat - fLat) < 0.015 && Math.abs(c.lon - fLon) < 0.018
    );
    if (match) match.flights.push(f);
    else clusters.push({ lat: fLat, lon: fLon, flights: [f] });
  });

  clusters.forEach((cluster) => {
    if (cluster.flights.length === 1) {
      const f = cluster.flights[0];
      const logoHtml = f.squadron_logo
        ? `<img src="${escapeHtml(
            f.squadron_logo
          )}" style="height:22px;width:auto;border-radius:3px;object-fit:contain;" />`
        : `<svg style="width:16px;height:16px;color:#f59e0b;" viewBox="0 0 24 24" fill="currentColor"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>`;
      const csIcon = L.divIcon({
        className: 'bg-transparent border-0',
        html: `<div class="flex items-center gap-2 px-2.5 py-1.5 bg-stone-900/95 hover:bg-stone-800 border border-amber-500/70 rounded-lg shadow-xl backdrop-blur-md cursor-pointer">
          ${logoHtml}
          <div class="flex flex-col text-left leading-tight">
            <div class="flex items-center gap-1.5">
              <span class="text-xs font-bold text-amber-300 font-mono whitespace-nowrap">${escapeHtml(
                f.callsign || f.name || f.identifier
              )}</span>
              ${f.is_opfor ? `<span class="text-[9px] font-mono font-bold px-1 rounded bg-red-950/80 text-red-400 border border-red-700/80">OPFOR</span>` : ''}
              ${
                f.airframe_abbr || f.airframe_name
                  ? `<span class="text-[9px] font-mono font-semibold px-1 rounded bg-sky-950/80 text-sky-300 border border-sky-800/80 whitespace-nowrap">${escapeHtml(
                      f.airframe_abbr || f.airframe_name
                    )}</span>`
                  : ''
              }
            </div>
            <span class="text-[9.5px] text-stone-400 font-mono mt-0.5">${f._calcDist} • ${
          f._calcTime
        }</span>
          </div>
        </div>`,
        iconSize: [200, 48],
        iconAnchor: [100, 24],
      });

      const marker = L.marker([cluster.lat, cluster.lon], {
        icon: csIcon,
        zIndexOffset: 3000,
      }).addTo(group);

      marker.on('mouseover', () => polylinesById[f.id]?.setStyle({ weight: 5, opacity: 1 }));
      marker.on('mouseout', () => polylinesById[f.id]?.setStyle({ weight: 2.5, opacity: 0.9 }));
      marker.bindPopup(
        `<div class="p-2 min-w-[270px] space-y-2.5 font-sans">
          <div class="flex items-center justify-between border-b border-stone-700 pb-1.5">
            <span class="text-xs font-mono font-bold uppercase text-amber-400">FLIGHT PLAN</span>
            <span class="text-[10px] font-mono text-stone-400">${cluster.lat.toFixed(
              3
            )}, ${cluster.lon.toFixed(3)}</span>
          </div>
          <div class="text-xs font-mono space-y-1">
            <div class="text-sm font-bold text-white">${escapeHtml(
              f.callsign || f.name || f.identifier
            )}</div>
            <div class="flex justify-between"><span class="text-stone-400 font-sans">Tasking:</span><b class="text-amber-400">${escapeHtml(
              f.tasking_label || 'N/A'
            )}</b></div>
            <div class="flex justify-between"><span class="text-stone-400 font-sans">Distance:</span><b>${
              f._calcDist
            }</b></div>
            <div class="flex justify-between"><span class="text-stone-400 font-sans">Est. Time:</span><b>${
              f._calcTime
            }</b></div>
          </div>
          <button type="button" data-fp-open="${f.id}" class="w-full px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 rounded-lg text-amber-300 text-xs font-bold cursor-pointer">Open Flight Plan</button>
        </div>`
      );
      marker.on('popupopen', (ev) => {
        const btn = ev.popup.getElement()?.querySelector<HTMLButtonElement>('[data-fp-open]');
        if (btn) btn.onclick = () => onOpenFlightPlan(f.id);
      });
    } else {
      const count = cluster.flights.length;
      const first = cluster.flights[0];
      const clusterIcon = L.divIcon({
        className: 'bg-transparent border-0',
        html: `<div class="flex items-center gap-2 px-2.5 py-1.5 bg-stone-900/95 hover:bg-stone-800 border border-amber-500/70 rounded-lg shadow-xl backdrop-blur-md cursor-pointer">
          ${
            first.squadron_logo
              ? `<img src="${escapeHtml(
                  first.squadron_logo
                )}" style="height:22px;width:auto;border-radius:3px;" />`
              : ''
          }
          <div class="flex flex-col text-left leading-tight">
            <span class="text-xs font-bold text-amber-300 font-mono">${count} Flight Plans</span>
            <span class="text-[9.5px] text-stone-400 font-mono truncate max-w-[140px]">${escapeHtml(
              cluster.flights
                .slice(0, 2)
                .map((fl) => fl.callsign || fl.identifier)
                .join(', ')
            )}${count > 2 ? ` +${count - 2}` : ''}</span>
          </div>
          <span class="text-[9.5px] font-bold font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">${count}x</span>
        </div>`,
        iconSize: [200, 48],
        iconAnchor: [100, 24],
      });

      const marker = L.marker([cluster.lat, cluster.lon], {
        icon: clusterIcon,
        zIndexOffset: 3000,
      }).addTo(group);

      marker.bindPopup(
        `<div class="p-2 min-w-[330px] max-w-[380px] space-y-2 font-sans">
          <div class="flex items-center justify-between border-b border-stone-700 pb-1.5">
            <span class="text-xs font-mono font-bold uppercase text-amber-400">FLIGHT PLANS (${count})</span>
            <span class="text-[10px] font-mono text-stone-400">${cluster.lat.toFixed(
              3
            )}, ${cluster.lon.toFixed(3)}</span>
          </div>
          <div class="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
            ${cluster.flights
              .map(
                (fl) => `<div data-fp-row="${fl.id}" class="p-2 bg-stone-900/95 hover:bg-stone-800 rounded-lg border border-stone-700/80 flex items-center justify-between gap-2">
                  <div class="min-w-0 flex-1">
                    <div class="font-bold text-xs text-stone-100 font-mono truncate">${escapeHtml(
                      fl.callsign || fl.name || fl.identifier
                    )}</div>
                    <div class="text-[10px] font-mono text-stone-400">${fl._calcDist} • ${
                  fl._calcTime
                }${fl.airframe_abbr ? ` • ${escapeHtml(fl.airframe_abbr)}` : ''}</div>
                  </div>
                  <button type="button" data-fp-open="${fl.id}" class="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 rounded text-amber-300 text-xs font-bold cursor-pointer">Open</button>
                </div>`
              )
              .join('')}
          </div>
        </div>`,
        { maxWidth: 400 }
      );
      marker.on('popupopen', (ev) => {
        const root = ev.popup.getElement();
        if (!root) return;
        root.querySelectorAll<HTMLElement>('[data-fp-row]').forEach((row) => {
          const fid = Number(row.dataset.fpRow);
          row.onmouseenter = () => polylinesById[fid]?.setStyle({ weight: 5, opacity: 1 });
          row.onmouseleave = () => polylinesById[fid]?.setStyle({ weight: 2.5, opacity: 0.9 });
        });
        root.querySelectorAll<HTMLButtonElement>('[data-fp-open]').forEach((btn) => {
          btn.onclick = () => onOpenFlightPlan(Number(btn.dataset.fpOpen));
        });
      });
    }
  });
}

/* ============================================================================
 * 11. Quadratic Bezier Logistics Layer
 * ========================================================================== */
function getQuadraticBezierXYatT(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  t: number
) {
  const mt = 1 - t;
  return {
    x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
    y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
  };
}

export function renderLogisticsLayer(
  map: L.Map,
  group: L.LayerGroup,
  requests: CampaignMapLogisticsRequest[]
): void {
  group.clearLayers();
  const directedGroups: Record<string, CampaignMapLogisticsRequest[]> = {};
  requests.forEach((r) => {
    if (!r.origin || !r.destination || !r.origin.lat || !r.destination.lat) return;
    const key = `${r.origin.name}->${r.destination.name}`;
    (directedGroups[key] ||= []).push(r);
  });

  requests.forEach((r) => {
    if (!r.origin || !r.destination || !r.origin.lat || !r.destination.lat) return;
    const dirList = directedGroups[`${r.origin.name}->${r.destination.name}`] || [r];
    const dirIdx = dirList.findIndex((x) => x.id === r.id);
    const k = dirIdx >= 0 ? dirIdx : 0;

    const p1 = map.latLngToLayerPoint([Number(r.origin.lat), Number(r.origin.lng)]);
    const p2 = map.latLngToLayerPoint([Number(r.destination.lat), Number(r.destination.lng)]);
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return;

    let mult = 0.2;
    if (dirList.length > 1) {
      mult = 0.2 + (k - (dirList.length - 1) / 2) * 0.14;
      if (Math.abs(mult) < 0.05) mult = mult < 0 ? -0.08 : 0.08;
    }
    const ctrl = {
      x: (p1.x + p2.x) / 2 + (-dy / dist) * (dist * mult),
      y: (p1.y + p2.y) / 2 + (dx / dist) * (dist * mult),
    };

    const curveLatLngs: L.LatLng[] = [];
    for (let i = 0; i <= 40; i++) {
      const pt = getQuadraticBezierXYatT(p1, ctrl, p2, i / 40);
      curveLatLngs.push(map.layerPointToLatLng([pt.x, pt.y]));
    }

    const strokeColor =
      r.status === 'in_progress' ? '#a855f7' : r.status === 'accepted' ? '#38bdf8' : '#64748b';
    const textColor =
      r.status === 'in_progress'
        ? 'text-purple-400'
        : r.status === 'accepted'
          ? 'text-sky-400'
          : 'text-stone-400';

    const popupHtml = `<div class="p-1 w-[305px] text-stone-200 font-sans">
      <div class="border-b border-stone-700/80 pb-2 mb-2">
        <div class="flex items-center justify-between mb-1">
          <span class="text-xs font-bold text-amber-400 uppercase font-mono">Logistics Sortie</span>
          <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-stone-900 border border-stone-700 font-bold">${escapeHtml(
            r.identifier
          )}</span>
        </div>
        <div class="flex justify-between text-[10px] font-mono">
          <span class="uppercase font-bold">${escapeHtml(r.status_label || r.status)}</span>
          <span class="text-amber-400 font-bold">${r.distance_nm ?? '--'} NM</span>
          <span class="text-stone-400">${escapeHtml(r.created_at || 'Recently')}</span>
        </div>
      </div>
      <div class="bg-stone-950/80 rounded border border-stone-800 p-2 mb-2 font-mono text-xs space-y-1">
        <div class="flex justify-between"><span class="text-stone-500">Origin:</span><b>${escapeHtml(
          r.origin.name
        )}</b></div>
        <div class="flex justify-between"><span class="text-stone-500">Destination:</span><b>${escapeHtml(
          r.destination.name
        )}</b></div>
        <div class="flex justify-between pt-1 border-t border-stone-800/60"><span class="text-stone-500">Pilot:</span><b class="text-sky-400">${escapeHtml(
          r.delivering_pilots_summary || r.pilot || 'Open Sortie'
        )}</b></div>
      </div>
      <div class="p-2 rounded bg-stone-950/80 border border-stone-800 mb-2 font-mono">
        <div class="flex justify-between text-[10px] mb-1"><span class="text-stone-400">Progress</span><b class="text-amber-400">${
          r.delivered_units
        }/${r.total_units} (${r.progress_percent}%)</b></div>
        <div class="w-full bg-stone-900 rounded-full h-1.5 overflow-hidden"><div class="h-full bg-gradient-to-r from-amber-500 to-emerald-400" style="width:${Math.min(
          r.progress_percent,
          100
        )}%"></div></div>
      </div>
      ${
        r.items && r.items.length > 0
          ? `<div class="space-y-1 max-h-32 overflow-y-auto">${r.items
              .map(
                (item) => `<div class="px-2 py-1 rounded bg-stone-950/90 border border-stone-800 text-[11px] font-mono flex justify-between"><span class="truncate">${escapeHtml(
                  item.name
                )}</span><b class="${
                  item.is_completed ? 'text-emerald-400' : 'text-amber-300'
                }">${item.delivered_quantity}/${item.quantity}</b></div>`
              )
              .join('')}</div>`
          : `<div class="text-[11px] text-stone-400 font-mono">${escapeHtml(
              r.items_summary || ''
            )}</div>`
      }
    </div>`;

    const line = L.polyline(curveLatLngs, {
      color: strokeColor,
      weight: 3.5,
      opacity: 0.85,
      dashArray: r.status === 'in_progress' ? '12, 6' : '6, 8',
    }).addTo(group);
    line.bindTooltip(
      `Logistics ${r.identifier}: ${r.origin.name} → ${r.destination.name} (${r.progress_percent}%)`,
      { sticky: true }
    );
    line.bindPopup(popupHtml, { maxWidth: 330 });

    const baseT = r.status === 'accepted' ? 0.25 : 0.5;
    const iconT =
      dirList.length > 1
        ? Math.max(0.15, Math.min(0.85, baseT + (k - (dirList.length - 1) / 2) * 0.12))
        : baseT;
    const posPt = getQuadraticBezierXYatT(p1, ctrl, p2, iconT);
    const iconLatLng = map.layerPointToLatLng([posPt.x, posPt.y]);
    const tx = 2 * (1 - iconT) * (ctrl.x - p1.x) + 2 * iconT * (p2.x - ctrl.x);
    const ty = 2 * (1 - iconT) * (ctrl.y - p1.y) + 2 * iconT * (p2.y - ctrl.y);
    const angleDeg = (Math.atan2(ty, tx) * 180) / Math.PI + 90;
    const size = r.status === 'in_progress' ? 36 : r.status === 'accepted' ? 30 : 24;

    L.marker(iconLatLng, {
      icon: L.divIcon({
        className: 'logistics-icon',
        html: `<div style="transform: rotate(${angleDeg}deg); width:${size}px; height:${size}px;" class="${textColor} cursor-pointer">${SVG_C130}</div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      }),
      zIndexOffset: 500,
    })
      .bindPopup(popupHtml, { maxWidth: 330 })
      .addTo(group);
  });
}

/* ============================================================================
 * 12. ISR Satellite Cluster Markers + 16:9 FOV + Projected Map Overlays
 * ========================================================================== */
export interface IsrActiveOverlayState {
  requestId: number;
  url: string;
  opacity: number;
  filter: 'eo' | 'nvg' | 'whot' | 'night';
}

export function renderIsrCapturesLayer(
  group: L.LayerGroup,
  overlayGroup: L.LayerGroup,
  isrRequests: CampaignMapIsrRequest[],
  activeOverlays: Record<number, IsrActiveOverlayState>,
  callbacks: {
    onOpenLightbox: (req: CampaignMapIsrRequest, url?: string) => void;
    onToggleOverlay: (req: CampaignMapIsrRequest, url: string) => void;
  }
): void {
  group.clearLayers();
  overlayGroup.clearLayers();

  // Render 16:9 footprints for all pending/completed requests + active overlays
  isrRequests.forEach((req) => {
    const bounds = getIsr16x9Bounds(req.lat, req.lon, req.km_size || 2.5);
    L.rectangle(bounds, {
      color: req.is_expired ? '#78716c' : '#00ffcc',
      weight: 1.3,
      opacity: 0.65,
      fillColor: '#06b6d4',
      fillOpacity: req.is_expired ? 0.04 : 0.1,
      dashArray: req.status === 'pending' ? '4, 4' : undefined,
      interactive: false,
    }).addTo(group);

    const activeOv = activeOverlays[req.id];
    if (activeOv?.url) {
      const ov = L.imageOverlay(activeOv.url, bounds, {
        opacity: activeOv.opacity ?? 0.9,
        interactive: false,
        zIndex: 450,
      }).addTo(overlayGroup);
      L.rectangle(bounds, {
        color: '#00ffcc',
        weight: 1.5,
        dashArray: '3, 3',
        fill: false,
        interactive: false,
      }).addTo(overlayGroup);
      const el = ov.getElement();
      if (el) {
        el.style.filter =
          activeOv.filter === 'nvg'
            ? 'brightness(3000%) contrast(220%) grayscale(20%) sepia(100%) hue-rotate(85deg) saturate(380%)'
            : activeOv.filter === 'whot'
              ? 'brightness(2500%) contrast(250%) grayscale(100%)'
              : activeOv.filter === 'night'
                ? 'brightness(3000%) contrast(220%)'
                : 'none';
      }
    }
  });

  // Spatially cluster completed ISR captures (~1.2 km)
  const completed = isrRequests.filter(
    (r) => r.status === 'completed' && Number.isFinite(r.lat) && Number.isFinite(r.lon)
  );
  const clusters: Array<{ lat: number; lon: number; requests: CampaignMapIsrRequest[] }> = [];
  completed.forEach((req) => {
    const match = clusters.find(
      (c) => Math.abs(c.lat - req.lat) < 0.012 && Math.abs(c.lon - req.lon) < 0.015
    );
    if (match) match.requests.push(req);
    else clusters.push({ lat: req.lat, lon: req.lon, requests: [req] });
  });

  clusters.forEach((cluster) => {
    const count = cluster.requests.length;
    const first = cluster.requests[0];
    const kmLbl = (Number(first.km_size) || 2.5).toFixed(1);
    const badge = count > 1 ? `${count}x` : `${kmLbl}k`;

    const hoverRows = cluster.requests
      .map((req) => {
        const variants = resolveIsrVariants(req);
        const firstUrl = variants[0]?.url || '';
        return `<div class="flex items-center justify-between gap-1.5 p-1 rounded bg-stone-900/95 border border-stone-700/70 mb-1">
          ${
            firstUrl
              ? `<img src="${escapeHtml(
                  firstUrl
                )}" data-isr-fly-open="${req.id}" style="width:36px;height:24px;object-fit:cover;border-radius:4px;cursor:pointer;" />`
              : ''
          }
          <div class="flex-1 min-w-0">
            <div class="text-[10px] font-bold font-mono text-cyan-300">${Number(
              req.km_size
            ).toFixed(1)}k FOV · ${escapeHtml(String(req.sensor).toUpperCase())}</div>
            <div class="text-[9px] font-mono text-stone-400">${req.targets.length} Targets</div>
          </div>
          ${
            firstUrl
              ? `<button type="button" data-isr-fly-ov="${req.id}" class="px-1.5 py-0.5 text-[9px] font-mono rounded bg-cyan-950 border border-cyan-700 text-cyan-300 cursor-pointer">Map</button>`
              : ''
          }
        </div>`;
      })
      .join('');

    const icon = L.divIcon({
      className: 'isr-satellite-marker',
      html: `<div class="isr-marker-group relative group" style="width:34px;height:34px;display:flex;align-items:center;justify-content:center;cursor:pointer;">
        <div style="width:30px;height:30px;border-radius:50%;background:rgba(6,24,32,0.94);border:1.5px solid #00ffcc;box-shadow:0 0 12px rgba(0,255,204,0.6);display:flex;align-items:center;justify-content:center;color:#00ffcc;">${SVG_SATELLITE}</div>
        <span style="position:absolute;bottom:-5px;right:-3px;font-size:8px;font-weight:bold;font-family:monospace;background:${
          count > 1 ? '#083344' : '#042f2e'
        };color:${
        count > 1 ? '#38bdf8' : '#2dd4bf'
      };padding:1px 4px;border-radius:4px;border:1px solid #14b8a6;">${badge}</span>
        <div class="isr-hover-flyout opacity-0 pointer-events-none transition-all duration-200" style="position:absolute;bottom:38px;left:50%;transform:translateX(-50%);width:270px;background:rgba(12,10,9,0.96);border:1px solid #00ffcc66;border-radius:10px;padding:8px;box-shadow:0 10px 25px rgba(0,0,0,0.85);">
          <div class="text-[11px] font-bold font-mono text-cyan-300 uppercase border-b border-stone-800 pb-1 mb-1.5">ISR Recon (${count})</div>
          <div class="max-h-48 overflow-y-auto">${hoverRows}</div>
        </div>
      </div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
      popupAnchor: [0, -18],
    });

    const marker = L.marker([cluster.lat, cluster.lon], { icon, zIndexOffset: 1200 }).addTo(group);
    marker.on('mouseover', () => marker.setZIndexOffset(99999));
    marker.on('mouseout', () => marker.setZIndexOffset(1200));

    // Attach click handlers on flyout preview elements once added
    setTimeout(() => {
      const el = marker.getElement();
      if (!el) return;
      el.querySelectorAll<HTMLElement>('[data-isr-fly-open]').forEach((node) => {
        node.onclick = (e) => {
          e.stopPropagation();
          const req = cluster.requests.find((r) => r.id === Number(node.dataset.isrFlyOpen));
          if (req) callbacks.onOpenLightbox(req);
        };
      });
      el.querySelectorAll<HTMLElement>('[data-isr-fly-ov]').forEach((node) => {
        node.onclick = (e) => {
          e.stopPropagation();
          const req = cluster.requests.find((r) => r.id === Number(node.dataset.isrFlyOv));
          if (req) {
            const v = resolveIsrVariants(req)[0];
            if (v) callbacks.onToggleOverlay(req, v.url);
          }
        };
      });
    }, 0);

    marker.bindPopup(() => {
      const firstVariants = resolveIsrVariants(first);
      const firstUrl = firstVariants[0]?.url || '';
      const isActive = Boolean(activeOverlays[first.id]);
      return `<div class="p-1 w-[300px] text-stone-200 font-sans space-y-2">
        <div class="flex items-center justify-between border-b border-stone-700 pb-1.5">
          <span class="text-xs font-bold text-cyan-300 uppercase">ISR Imagery</span>
          <span class="text-[10px] font-mono text-stone-400">${count} ${
        count === 1 ? 'Capture' : 'Captures'
      }</span>
        </div>
        ${
          count > 1
            ? `<div class="flex flex-wrap gap-1">${cluster.requests
                .map(
                  (r, i) =>
                    `<button type="button" data-isr-pick="${r.id}" class="px-2 py-0.5 rounded text-[10px] font-mono border ${
                      i === 0
                        ? 'bg-cyan-950 text-cyan-300 border-cyan-700'
                        : 'bg-stone-900 text-stone-400 border-stone-800'
                    } cursor-pointer">${Number(r.km_size).toFixed(1)}k ${String(
                      r.sensor
                    ).toUpperCase()}</button>`
                )
                .join('')}</div>`
            : ''
        }
        ${
          firstUrl
            ? `<img src="${escapeHtml(
                firstUrl
              )}" data-isr-open="${first.id}" class="w-full h-32 object-cover rounded border border-stone-700 cursor-pointer" />`
            : ''
        }
        <div class="flex items-center justify-between text-[10px] font-mono text-stone-400">
          <span class="text-amber-300 font-bold">${first.targets.length} Targets</span>
          <span>${escapeHtml(first.created_at_human || '')}</span>
        </div>
        ${
          firstUrl
            ? `<div class="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-stone-800">
                <button type="button" data-isr-ov="${first.id}" class="px-2 py-1 rounded text-xs font-semibold border cursor-pointer ${
                isActive
                  ? 'bg-rose-950 border-rose-700 text-rose-300'
                  : 'bg-cyan-950 border-cyan-800 text-cyan-300'
              }">${isActive ? 'Hide Overlay' : 'Project Overlay'}</button>
                <button type="button" data-isr-open="${first.id}" class="px-2 py-1 rounded text-xs font-semibold bg-stone-900 border border-stone-700 text-stone-200 cursor-pointer">Open Lightbox</button>
              </div>`
            : ''
        }
      </div>`;
    });

    marker.on('popupopen', (ev) => {
      const root = ev.popup.getElement();
      if (!root) return;
      root.querySelectorAll<HTMLElement>('[data-isr-open]').forEach((btn) => {
        btn.onclick = () => {
          const req = cluster.requests.find((r) => r.id === Number(btn.dataset.isrOpen)) || first;
          callbacks.onOpenLightbox(req);
        };
      });
      root.querySelectorAll<HTMLElement>('[data-isr-ov]').forEach((btn) => {
        btn.onclick = () => {
          const req = cluster.requests.find((r) => r.id === Number(btn.dataset.isrOv)) || first;
          const v = resolveIsrVariants(req)[0];
          if (v) callbacks.onToggleOverlay(req, v.url);
        };
      });
      root.querySelectorAll<HTMLElement>('[data-isr-pick]').forEach((btn) => {
        btn.onclick = () => {
          const req = cluster.requests.find((r) => r.id === Number(btn.dataset.isrPick));
          if (req) callbacks.onOpenLightbox(req);
        };
      });
    });
  });
}

export function renderIsrPreviewLayer(
  group: L.LayerGroup,
  center: { lat: number; lng: number } | null,
  kmSizes: number[],
  onCenterMoved?: (lat: number, lng: number) => void
): void {
  group.clearLayers();
  if (!center || !Number.isFinite(center.lat) || !Number.isFinite(center.lng)) return;

  const sizes = kmSizes.length > 0 ? kmSizes : [2.5];
  const boxes = sizes.map((kSize, idx) =>
    L.rectangle(getIsr16x9Bounds(center.lat, center.lng, kSize), {
      color: '#00ffcc',
      weight: idx === 0 ? 2 : 1.5,
      dashArray: idx === 0 ? '4, 4' : '2, 4',
      fillColor: '#00ffcc',
      fillOpacity: idx === 0 ? 0.15 : 0.05,
      interactive: false,
    }).addTo(group)
  );

  const marker = L.marker([center.lat, center.lng], {
    icon: L.divIcon({
      className: 'isr-crosshair-icon bg-transparent border-0',
      html: '<div style="position:relative;width:28px;height:28px;display:flex;align-items:center;justify-content:center;cursor:move;"><div style="position:absolute;width:24px;height:24px;border-radius:50%;border:1.5px solid #00ffcc;box-shadow:0 0 10px rgba(0,255,204,0.6);"></div><div style="width:4px;height:4px;border-radius:50%;background:#00ffcc;"></div><div style="position:absolute;width:28px;height:1px;background:#00ffcc;"></div><div style="position:absolute;height:28px;width:1px;background:#00ffcc;"></div></div>',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    }),
    draggable: true,
    zIndexOffset: 3000,
  }).addTo(group);

  marker.on('drag', (ev) => {
    const pos = (ev.target as L.Marker).getLatLng();
    sizes.forEach((k, idx) => boxes[idx]?.setBounds(getIsr16x9Bounds(pos.lat, pos.lng, k)));
  });
  marker.on('dragend', (ev) => {
    const pos = (ev.target as L.Marker).getLatLng();
    onCenterMoved?.(Number(pos.lat.toFixed(6)), Number(pos.lng.toFixed(6)));
  });
}

/* ============================================================================
 * 13. Front Line, Polygon Groups & Tactical Markings
 * ========================================================================== */
function extractLatLngTuple(p: any): [number, number] | null {
  if (!p) return null;
  if (Array.isArray(p)) {
    const a = Number(p[0]);
    const b = Number(p[1]);
    return Number.isFinite(a) && Number.isFinite(b) ? [a, b] : null;
  }
  const lat = Number(p.lat ?? p.latitude);
  const lng = Number(p.lng ?? p.lon ?? p.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
}

export function renderFrontLineLayer(
  group: L.LayerGroup,
  frontLines: CampaignMapFrontLine[]
): void {
  group.clearLayers();
  if (!Array.isArray(frontLines) || frontLines.length === 0) return;

  const normalizedLines: any[] =
    typeof (frontLines[0] as any)?.lat === 'number' ||
    typeof (frontLines[0] as any)?.latitude === 'number'
      ? [frontLines]
      : frontLines;

  normalizedLines.forEach((fl: any) => {
    const isArrayEntry = Array.isArray(fl);
    const rawPoints = isArrayEntry ? fl : fl?.points || [];
    const pts = rawPoints
      .map(extractLatLngTuple)
      .filter((pt: [number, number] | null): pt is [number, number] => pt !== null);
    if (pts.length < 2) return;

    const poly = L.polyline(pts, {
      color: (!isArrayEntry && fl?.color) || '#ef4444',
      weight: !isArrayEntry && fl?.weight !== undefined ? Number(fl.weight) : 3,
      opacity: 0.9,
      dashArray: normalizeLineDashArray((!isArrayEntry && fl?.line_style) || 'dashed'),
    });
    if (!isArrayEntry && fl?.label) {
      poly.bindTooltip(
        `<span class="font-bold uppercase tracking-wider">${escapeHtml(fl.label)}</span>`,
        { direction: 'center', permanent: true, className: 'tactical-shape-label' }
      );
    }
    poly.addTo(group);
  });
}

export function renderPolygonGroupsLayer(
  group: L.LayerGroup,
  polygonGroups: CampaignMapPolygonGroup[],
  enabledStates: Record<string, boolean>
): void {
  group.clearLayers();
  if (!Array.isArray(polygonGroups) || polygonGroups.length === 0) return;

  polygonGroups.forEach((pg: any, idx) => {
    const isArrayEntry = Array.isArray(pg);
    const id = (!isArrayEntry && (pg?.group_name || pg?.name)) || `ao_${idx}`;
    if (enabledStates[id] === false) return;
    const rawPoints = isArrayEntry ? pg : pg?.points || [];
    const pts = rawPoints
      .map(extractLatLngTuple)
      .filter((pt: [number, number] | null): pt is [number, number] => pt !== null);
    if (pts.length < 3) return;
    const stroke = (!isArrayEntry && pg?.color) || '#3388ff';
    const poly = L.polygon(pts, {
      color: stroke,
      weight: !isArrayEntry && pg?.weight !== undefined ? Number(pg.weight) : 3,
      opacity: 0.9,
      dashArray: normalizeLineDashArray((!isArrayEntry && pg?.line_style) || 'solid'),
      fillColor: (!isArrayEntry && pg?.fill_color) || stroke,
      fillOpacity: !isArrayEntry && pg?.fill_opacity !== undefined ? Number(pg.fill_opacity) : 0.2,
    });
    if (!isArrayEntry && pg?.label) {
      poly.bindTooltip(
        `<span class="font-bold uppercase tracking-wider">${escapeHtml(pg.label)}</span>`,
        { direction: 'center', permanent: true, className: 'tactical-shape-label' }
      );
    }
    poly.addTo(group);
  });
}

export function renderTacticalMarkingsLayer(
  group: L.LayerGroup,
  markings: CampaignMapTacticalMarking[],
  selectedSortieId: number | null
): void {
  group.clearLayers();
  markings.forEach((m) => {
    if (selectedSortieId && m.visibility === 'sortie' && m.sortie_id && m.sortie_id !== selectedSortieId)
      return;
    const color = m.properties?.color || '#f59e0b';
    const lbl = m.properties?.label || m.marking_type;
    const g = m.geometry;
    if (!g || !g.coordinates) return;

    if (g.type === 'Point' && Array.isArray(g.coordinates)) {
      const lat = Number(g.coordinates[1]);
      const lng = Number(g.coordinates[0]);
      if (m.properties?.shape === 'circle' && m.properties?.radius_m) {
        L.circle([lat, lng], {
          radius: Number(m.properties.radius_m),
          color,
          fillColor: color,
          fillOpacity: 0.14,
          weight: 2,
        })
          .bindTooltip(escapeHtml(lbl), { className: 'tactical-shape-label' })
          .addTo(group);
      } else if (m.properties?.shape === 'text') {
        L.marker([lat, lng], {
          icon: L.divIcon({
            className: 'tactical-text-static-wrapper',
            html: `<span class="tactical-text-static" style="color:${color}">${escapeHtml(lbl)}</span>`,
          }),
        }).addTo(group);
      } else {
        const pinHtml = m.properties?.icon_svg
          ? `<div style="width:24px;height:24px;color:${color}">${m.properties.icon_svg}</div>`
          : `<div style="width:14px;height:14px;border-radius:9999px;background:${color};border:2px solid #0c0a09"></div>`;
        L.marker([lat, lng], {
          icon: L.divIcon({ className: 'bg-transparent border-0', iconSize: [22, 22], iconAnchor: [11, 11], html: pinHtml }),
        })
          .bindTooltip(`${escapeHtml(lbl)} (${String(m.visibility).toUpperCase()})`, {
            className: 'gtfo-map-tooltip',
          })
          .addTo(group);
      }
    } else if (g.type === 'LineString' && Array.isArray(g.coordinates)) {
      const coords = (g.coordinates as number[][]).map((c) => [c[1], c[0]] as [number, number]);
      if (coords.length >= 2) {
        L.polyline(coords, { color, weight: 2.5 })
          .bindTooltip(escapeHtml(lbl), { className: 'tactical-shape-label' })
          .addTo(group);
      }
    } else if (g.type === 'Polygon' && Array.isArray(g.coordinates?.[0])) {
      const coords = (g.coordinates[0] as number[][]).map((c) => [c[1], c[0]] as [number, number]);
      if (coords.length >= 3) {
        L.polygon(coords, { color, fillColor: color, fillOpacity: 0.16, weight: 2 })
          .bindTooltip(escapeHtml(lbl), { className: 'tactical-shape-label' })
          .addTo(group);
      }
    }
  });
}

/* ============================================================================
 * 14. Airframe Avionics Tactical Layers (F/A-18 SA, F-16 GEO, F-14 TID, JF-17)
 * ========================================================================== */
function computeCapGeometry(
  p0: { lat: number; lng: number },
  course: number,
  lengthNm: number,
  turnDir: 'Left' | 'Right'
) {
  const widthNm = 5.0;
  const radiusNm = widthNm / 2;
  const isCcw = turnDir === 'Left';
  const topCenter = computeDestinationPoint(
    p0.lat,
    p0.lng,
    isCcw ? (course - 90 + 360) % 360 : (course + 90) % 360,
    radiusNm
  );
  const p1 = computeDestinationPoint(
    p0.lat,
    p0.lng,
    isCcw ? (course - 90 + 360) % 360 : (course + 90) % 360,
    widthNm
  );
  const p2 = computeDestinationPoint(p1.lat, p1.lng, (course + 180) % 360, lengthNm);
  const bottomCenter = computeDestinationPoint(
    p2.lat,
    p2.lng,
    isCcw ? (course + 90) % 360 : (course - 90 + 360) % 360,
    radiusNm
  );
  const p3 = computeDestinationPoint(
    p2.lat,
    p2.lng,
    isCcw ? (course + 90) % 360 : (course - 90 + 360) % 360,
    widthNm
  );

  const arc = (center: { lat: number; lng: number }, sDeg: number, eDeg: number) => {
    const res: Array<[number, number]> = [];
    let diff = eDeg - sDeg;
    if (isCcw) while (diff > 0) diff -= 360;
    else while (diff < 0) diff += 360;
    for (let i = 0; i <= 16; i++) {
      const pt = computeDestinationPoint(center.lat, center.lng, (sDeg + diff * (i / 16) + 360) % 360, radiusNm);
      res.push([pt.lat, pt.lng]);
    }
    return res;
  };

  const circuitPts: Array<[number, number]> = [
    [p3.lat, p3.lng],
    [p0.lat, p0.lng],
    ...arc(topCenter, isCcw ? (course + 90) % 360 : (course - 90 + 360) % 360, isCcw ? (course - 90 + 360) % 360 : (course + 90) % 360),
    [p1.lat, p1.lng],
    [p2.lat, p2.lng],
    ...arc(bottomCenter, isCcw ? (course - 90 + 360) % 360 : (course + 90) % 360, isCcw ? (course + 90) % 360 : (course - 90 + 360) % 360),
    [p3.lat, p3.lng],
  ];
  const midInbound = computeDestinationPoint(p3.lat, p3.lng, course, lengthNm / 2);
  return { circuitPts, midInbound, rotateHandlePos: bottomCenter };
}

export function renderAirframeTacticalLayers(
  group: L.LayerGroup,
  activePlan: FlightPlanDetail | null,
  options?: {
    editable?: boolean;
    onMutatePlan?: (updater: (prev: FlightPlanDetail) => FlightPlanDetail) => void;
  }
): void {
  if (!activePlan) return;

  const canEdit = Boolean(options?.editable && options?.onMutatePlan);
  const mutate = options?.onMutatePlan;
  const roundCoord = (v: number) => Number(v.toFixed(6));

  const addVertexHandle = (
    lat: number,
    lng: number,
    color: string,
    tooltip: string,
    onDragEnd: (nextLat: number, nextLng: number) => void,
    shape: 'circle' | 'square' = 'square'
  ) => {
    if (!canEdit) return;
    const radiusStyle = shape === 'circle' ? 'border-radius:9999px;' : 'border-radius:2px;';
    const marker = L.marker([lat, lng], {
      draggable: true,
      zIndexOffset: 2300,
      icon: L.divIcon({
        className: 'bg-transparent border-0',
        iconSize: [12, 12],
        iconAnchor: [6, 6],
        html: `<div style="width:12px;height:12px;${radiusStyle}background:#0c0a09;border:2px solid ${color};box-shadow:0 1px 4px rgba(0,0,0,0.85);cursor:grab;"></div>`,
      }),
    }).addTo(group);
    marker.bindTooltip(tooltip, { className: 'gtfo-map-tooltip' });
    marker.on('dragend', (ev) => {
      const pos = (ev.target as L.Marker).getLatLng();
      onDragEnd(roundCoord(pos.lat), roundCoord(pos.lng));
    });
  };

  // Fallback generic `sa_settings.points` list
  const simplePoints = activePlan.sa_settings?.points;
  if (Array.isArray(simplePoints) && simplePoints.length > 0) {
    const coords = simplePoints
      .filter((p: any) => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)))
      .map((p: any) => [Number(p.lat), Number(p.lng)] as [number, number]);
    if (coords.length >= 2) {
      L.polyline(coords, { color: '#22c55e', weight: 2, dashArray: '6 4' }).addTo(group);
    }
    simplePoints.forEach((p: any, i: number) => {
      const lat = Number(p.lat);
      const lng = Number(p.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      if (canEdit && mutate) {
        addVertexHandle(
          lat,
          lng,
          '#22c55e',
          p.name || `AV ${i + 1}`,
          (nextLat, nextLng) => {
            mutate((prev) => {
              const sa = { ...(prev.sa_settings || {}) } as Record<string, any>;
              const pts = Array.isArray(sa.points) ? [...sa.points] : [];
              if (pts[i]) pts[i] = { ...pts[i], lat: nextLat, lng: nextLng };
              return { ...prev, sa_settings: { ...sa, points: pts } };
            });
          },
          'circle'
        );
      } else {
        L.circleMarker([lat, lng], {
          radius: 4,
          color: '#22c55e',
          fillColor: '#0c0a09',
          fillOpacity: 1,
        })
          .bindTooltip(p.name || `AV ${i + 1}`, { className: 'gtfo-map-tooltip' })
          .addTo(group);
      }
    });
  }

  // Portal F/A-18 SA structure (FLOT, FAOR, CAP, Corridors)
  const sa = activePlan.sa_settings || (activePlan.avionics?.sa as any);
  if (sa && typeof sa === 'object') {
    (sa.flot || []).forEach((flot: any, flotIdx: number) => {
      const rawPts = Array.isArray(flot.points) ? flot.points : [];
      const validCoords = rawPts
        .filter((p: any) => Number.isFinite(Number(p?.lat)) && Number.isFinite(Number(p?.lng)))
        .map((p: any) => [Number(p.lat), Number(p.lng)] as [number, number]);
      if (validCoords.length >= 2) {
        L.polyline(validCoords, { color: '#22c55e', weight: 3, opacity: 0.9 })
          .bindTooltip(`FLOT ${flot.num || flotIdx + 1}`, { sticky: true })
          .addTo(group);
      }
      if (canEdit && mutate) {
        rawPts.forEach((pt: any, ptIdx: number) => {
          const lat = Number(pt?.lat);
          const lng = Number(pt?.lng);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
          addVertexHandle(lat, lng, '#22c55e', `FLOT ${flot.num || 1} #${ptIdx + 1}`, (nl, nlg) => {
            mutate((prev) => {
              const prevSa = { ...(prev.sa_settings || {}) } as Record<string, any>;
              const list = Array.isArray(prevSa.flot) ? [...prevSa.flot] : [];
              const targetIdx = list.findIndex((x: any) => Number(x?.num) === Number(flot.num));
              const idx = targetIdx >= 0 ? targetIdx : flotIdx;
              if (list[idx]?.points?.[ptIdx]) {
                const nextPts = [...list[idx].points];
                nextPts[ptIdx] = { ...nextPts[ptIdx], lat: nl, lng: nlg };
                list[idx] = { ...list[idx], points: nextPts };
              }
              return { ...prev, sa_settings: { ...prevSa, flot: list } };
            });
          });
        });
      }
    });

    (sa.faor || []).forEach((faor: any, faorIdx: number) => {
      const rawPts = Array.isArray(faor.points) ? faor.points : [];
      const validCoords = rawPts
        .filter((p: any) => Number.isFinite(Number(p?.lat)) && Number.isFinite(Number(p?.lng)))
        .map((p: any) => [Number(p.lat), Number(p.lng)] as [number, number]);
      if (validCoords.length >= 2) {
        L.polyline(validCoords, { color: '#22c55e', weight: 2.5, dashArray: '8, 8' })
          .bindTooltip(`FAOR ${faor.num || faorIdx + 1}`, { sticky: true })
          .addTo(group);
      }
      if (canEdit && mutate) {
        rawPts.forEach((pt: any, ptIdx: number) => {
          const lat = Number(pt?.lat);
          const lng = Number(pt?.lng);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
          addVertexHandle(lat, lng, '#22c55e', `FAOR ${faor.num || 1} #${ptIdx + 1}`, (nl, nlg) => {
            mutate((prev) => {
              const prevSa = { ...(prev.sa_settings || {}) } as Record<string, any>;
              const list = Array.isArray(prevSa.faor) ? [...prevSa.faor] : [];
              const targetIdx = list.findIndex((x: any) => Number(x?.num) === Number(faor.num));
              const idx = targetIdx >= 0 ? targetIdx : faorIdx;
              if (list[idx]?.points?.[ptIdx]) {
                const nextPts = [...list[idx].points];
                nextPts[ptIdx] = { ...nextPts[ptIdx], lat: nl, lng: nlg };
                list[idx] = { ...list[idx], points: nextPts };
              }
              return { ...prev, sa_settings: { ...prevSa, faor: list } };
            });
          });
        });
      }
    });

    (sa.cap_points || []).forEach((cap: any, capIdx: number) => {
      const lat = Number(cap.lat);
      const lng = Number(cap.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const course = parseInt(cap.course || 0, 10);
      const len = Number(cap.length_nm || 20) || 20;
      const turnDir = String(cap.turn_direction || 'Right').toLowerCase() === 'left' ? 'Left' : 'Right';
      const geom = computeCapGeometry({ lat, lng }, course, len, turnDir);
      L.polyline(geom.circuitPts, { color: '#ffffff', weight: 2.5, opacity: 0.9 })
        .bindTooltip(`CAP ${cap.num || capIdx + 1} (${course}° / ${len} NM)`, { sticky: true })
        .addTo(group);

      if (canEdit && mutate) {
        addVertexHandle(
          lat,
          lng,
          '#ffffff',
          `CAP ${cap.num || capIdx + 1} Anchor (Drag to move)`,
          (nl, nlg) => {
            mutate((prev) => {
              const prevSa = { ...(prev.sa_settings || {}) } as Record<string, any>;
              const caps = Array.isArray(prevSa.cap_points) ? [...prevSa.cap_points] : [];
              const targetIdx = caps.findIndex((x: any) => Number(x?.num) === Number(cap.num));
              const idx = targetIdx >= 0 ? targetIdx : capIdx;
              if (caps[idx]) caps[idx] = { ...caps[idx], lat: nl, lng: nlg };
              return { ...prev, sa_settings: { ...prevSa, cap_points: caps } };
            });
          },
          'circle'
        );

        const rotMarker = L.marker([geom.rotateHandlePos.lat, geom.rotateHandlePos.lng], {
          draggable: true,
          zIndexOffset: 2310,
          icon: L.divIcon({
            className: 'bg-transparent border-0',
            iconSize: [14, 14],
            iconAnchor: [7, 7],
            html: `<div style="width:14px;height:14px;border-radius:9999px;background:#38bdf8;border:2px solid #0c0a09;box-shadow:0 1px 6px rgba(0,0,0,0.9);cursor:grab;"></div>`,
          }),
        }).addTo(group);
        rotMarker.bindTooltip(`CAP ${cap.num || capIdx + 1} Course/Length Handle`, {
          className: 'gtfo-map-tooltip',
        });
        rotMarker.on('dragend', (ev) => {
          const pos = (ev.target as L.Marker).getLatLng();
          const newCourse = Math.round(calculateBearingDegrees(pos.lat, pos.lng, lat, lng)) % 360;
          const newLengthNm = Math.max(
            5,
            Math.min(60, Math.round(calculateDistanceNm(lat, lng, pos.lat, pos.lng)))
          );
          mutate((prev) => {
            const prevSa = { ...(prev.sa_settings || {}) } as Record<string, any>;
            const caps = Array.isArray(prevSa.cap_points) ? [...prevSa.cap_points] : [];
            const targetIdx = caps.findIndex((x: any) => Number(x?.num) === Number(cap.num));
            const idx = targetIdx >= 0 ? targetIdx : capIdx;
            if (caps[idx]) {
              caps[idx] = { ...caps[idx], course: newCourse, length_nm: newLengthNm };
            }
            return { ...prev, sa_settings: { ...prevSa, cap_points: caps } };
          });
        });
      }
    });

    (sa.corridors || []).forEach((corr: any, corrIdx: number) => {
      const rawPts = Array.isArray(corr.points) ? corr.points : [];
      const validPts = rawPts.filter(
        (p: any) => Number.isFinite(Number(p?.lat)) && Number.isFinite(Number(p?.lng))
      );
      if (validPts.length >= 2) {
        L.polyline(
          validPts.map((p: any) => [Number(p.lat), Number(p.lng)] as [number, number]),
          { color: '#22c55e', weight: 2, dashArray: '4, 6', opacity: 0.7 }
        )
          .bindTooltip(`CORRIDOR ${corr.num || corrIdx + 1} (±5 NM)`, { sticky: true })
          .addTo(group);

        // Parallel +/- 5 NM corridor boundary rails
        const leftRail: [number, number][] = [];
        const rightRail: [number, number][] = [];
        for (let i = 0; i < validPts.length; i++) {
          const cur = validPts[i];
          const prevPt = i > 0 ? validPts[i - 1] : validPts[i];
          const nextPt = i < validPts.length - 1 ? validPts[i + 1] : validPts[i];
          const segBrg = calculateBearingDegrees(
            Number(prevPt.lat),
            Number(prevPt.lng),
            Number(nextPt.lat),
            Number(nextPt.lng)
          );
          const lPt = computeDestinationPoint(
            Number(cur.lat),
            Number(cur.lng),
            (segBrg - 90 + 360) % 360,
            5
          );
          const rPt = computeDestinationPoint(
            Number(cur.lat),
            Number(cur.lng),
            (segBrg + 90) % 360,
            5
          );
          leftRail.push([lPt.lat, lPt.lng]);
          rightRail.push([rPt.lat, rPt.lng]);
        }
        L.polyline(leftRail, { color: '#22c55e', weight: 2.5, opacity: 0.9 }).addTo(group);
        L.polyline(rightRail, { color: '#22c55e', weight: 2.5, opacity: 0.9 }).addTo(group);
      }
      if (canEdit && mutate) {
        rawPts.forEach((pt: any, ptIdx: number) => {
          const lat = Number(pt?.lat);
          const lng = Number(pt?.lng);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
          addVertexHandle(
            lat,
            lng,
            '#22c55e',
            `CORRIDOR ${corr.num || 1} #${ptIdx + 1}`,
            (nl, nlg) => {
              mutate((prev) => {
                const prevSa = { ...(prev.sa_settings || {}) } as Record<string, any>;
                const list = Array.isArray(prevSa.corridors) ? [...prevSa.corridors] : [];
                const targetIdx = list.findIndex((x: any) => Number(x?.num) === Number(corr.num));
                const idx = targetIdx >= 0 ? targetIdx : corrIdx;
                if (list[idx]?.points?.[ptIdx]) {
                  const nextPts = [...list[idx].points];
                  nextPts[ptIdx] = { ...nextPts[ptIdx], lat: nl, lng: nlg };
                  list[idx] = { ...list[idx], points: nextPts };
                }
                return { ...prev, sa_settings: { ...prevSa, corridors: list } };
              });
            }
          );
        });
      }
    });
  }

  // Portal F-16 GEO Lines & DEST Points
  const geo = activePlan.geo_lines_settings || (activePlan.avionics?.geolines as any);
  if (geo && typeof geo === 'object') {
    const colors: Record<number, string> = { 1: '#ef4444', 2: '#10b981', 3: '#06b6d4', 4: '#a855f7' };
    const lines = geo.lines || geo;
    ([1, 2, 3, 4] as const).forEach((n) => {
      const raw = lines?.[n] || lines?.[String(n)];
      if (!Array.isArray(raw) || raw.length === 0) return;
      const validCoords = raw
        .filter((p: any) => Number.isFinite(Number(p?.lat)) && Number.isFinite(Number(p?.lng)))
        .map((p: any) => [Number(p.lat), Number(p.lng)] as [number, number]);
      if (validCoords.length >= 2) {
        L.polyline(validCoords, {
          color: colors[n],
          weight: n === 1 ? 3 : 2.5,
          dashArray: n === 1 ? '8, 6' : undefined,
        })
          .bindTooltip(`F-16 GEO Line ${n}`, { sticky: true })
          .addTo(group);
      }
      if (canEdit && mutate) {
        raw.forEach((pt: any, ptIdx: number) => {
          const lat = Number(pt?.lat);
          const lng = Number(pt?.lng);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
          addVertexHandle(lat, lng, colors[n], `GEO L${n} #${ptIdx + 1}`, (nl, nlg) => {
            mutate((prev) => {
              const prevGeo = { ...(prev.geo_lines_settings || {}) } as Record<string, any>;
              const prevLines = { ...(prevGeo.lines || {}) } as Record<string, any[]>;
              [1, 2, 3, 4].forEach((k) => {
                if (!prevLines[k] && Array.isArray(prevGeo[k])) prevLines[k] = prevGeo[k];
              });
              const cur = Array.isArray(prevLines[n]) ? [...prevLines[n]] : [];
              if (cur[ptIdx]) cur[ptIdx] = { ...cur[ptIdx], lat: nl, lng: nlg };
              prevLines[n] = cur;
              return { ...prev, geo_lines_settings: { ...prevGeo, lines: prevLines } };
            });
          });
        });
      }
    });
  }

  const rawDest = activePlan.dest_points_settings || (activePlan.avionics?.dest_points as any);
  const destList = Array.isArray(rawDest) ? rawDest : Array.isArray(rawDest?.points) ? rawDest.points : [];
  if (Array.isArray(destList)) {
    destList.forEach((pt: any, idx: number) => {
      const lat = Number(pt?.lat);
      const lng = Number(pt?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const destMarker = L.marker([lat, lng], {
        draggable: canEdit,
        zIndexOffset: 2320,
        icon: L.divIcon({
          className: 'f16-dest-point-icon bg-transparent border-0',
          html: `<div class="flex items-center gap-1 text-[10px] font-mono text-amber-300"><span class="w-3 h-3 rotate-45 border-2 border-amber-400 bg-stone-950 inline-block"></span><span class="bg-stone-950/90 px-1 rounded border border-amber-500/50">${escapeHtml(
            pt.text || `D${pt.stpt || 81 + idx}`
          )}</span></div>`,
        }),
      }).addTo(group);

      if (canEdit && mutate) {
        destMarker.on('dragend', (ev) => {
          const pos = (ev.target as L.Marker).getLatLng();
          mutate((prev) => {
            const raw = prev.dest_points_settings;
            const list = Array.isArray(raw)
              ? [...raw]
              : Array.isArray((raw as any)?.points)
                ? [...(raw as any).points]
                : [];
            if (list[idx]) {
              list[idx] = { ...list[idx], lat: roundCoord(pos.lat), lng: roundCoord(pos.lng) };
            }
            return { ...prev, dest_points_settings: list };
          });
        });
      }
    });
  }

  // Portal F-14 TID Plot Lines
  const f14 = activePlan.f14_plot_lines_settings;
  if (f14 && typeof f14 === 'object') {
    const colors: Record<number, string> = { 1: '#ef4444', 2: '#10b981', 3: '#06b6d4', 4: '#a855f7' };
    ([1, 2, 3, 4] as const).forEach((n) => {
      const lineObj = f14[n] || f14[String(n)];
      const rawPts = Array.isArray(lineObj) ? lineObj : lineObj?.points;
      if (!Array.isArray(rawPts) || rawPts.length === 0) return;
      const pts = rawPts
        .filter((p: any) => Number.isFinite(Number(p?.lat)) && Number.isFinite(Number(p?.lng)))
        .map((p: any) => [Number(p.lat), Number(p.lng)] as [number, number]);
      if (pts.length >= 2) {
        const closed = Boolean(lineObj?.closed) && pts.length >= 3;
        L.polyline(closed ? [...pts, pts[0]] : pts, {
          color: colors[n],
          weight: n === 1 ? 3 : 2.5,
          dashArray: n === 1 ? '8, 6' : undefined,
        })
          .bindTooltip(`F-14B TID Line ${n}`, { sticky: true })
          .addTo(group);
      }
      if (canEdit && mutate) {
        rawPts.forEach((pt: any, ptIdx: number) => {
          const lat = Number(pt?.lat);
          const lng = Number(pt?.lng);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
          addVertexHandle(lat, lng, colors[n], `TID ${n} #${ptIdx + 1}`, (nl, nlg) => {
            mutate((prev) => {
              const prevF14 = { ...(prev.f14_plot_lines_settings || {}) } as Record<string, any>;
              const existing = prevF14[n] || prevF14[String(n)];
              const nextPts = Array.isArray(existing)
                ? [...existing]
                : Array.isArray(existing?.points)
                  ? [...existing.points]
                  : [];
              if (nextPts[ptIdx]) nextPts[ptIdx] = { ...nextPts[ptIdx], lat: nl, lng: nlg };
              return {
                ...prev,
                f14_plot_lines_settings: {
                  ...prevF14,
                  [n]: { closed: Boolean(existing?.closed), points: nextPts },
                },
              };
            });
          });
        });
      }
    });
  }

  // Portal JF-17 Custom Airspace (BKYA-BKYD)
  const jf17 = activePlan.jf17_airspace_settings;
  if (jf17 && typeof jf17 === 'object') {
    const defaults: Record<string, string> = {
      BKYA: '#a020f0',
      BKYB: '#00ffff',
      BKYC: '#0000ff',
      BKYD: '#d19275',
    };
    (['BKYA', 'BKYB', 'BKYC', 'BKYD'] as const).forEach((key, idx) => {
      const cfg = jf17[key] || jf17[key.toLowerCase()] || jf17[String(idx + 1)];
      const rawPts = Array.isArray(cfg) ? cfg : cfg?.points;
      if (!Array.isArray(rawPts) || rawPts.length === 0) return;
      const pts = rawPts
        .filter((p: any) => Number.isFinite(Number(p?.lat)) && Number.isFinite(Number(p?.lng ?? p?.lon)))
        .map((p: any) => [Number(p.lat), Number(p.lng ?? p.lon)] as [number, number]);
      const col = cfg?.color || defaults[key];
      const closed = Boolean(cfg?.closed) && pts.length >= 3;
      if (pts.length >= 2) {
        L.polyline(closed ? [...pts, pts[0]] : pts, {
          color: col,
          weight: key === 'BKYA' ? 3 : 2.5,
          dashArray: key === 'BKYA' ? '8, 6' : undefined,
        })
          .bindTooltip(`JF-17 ${key}`, { sticky: true })
          .addTo(group);
      }
      if (closed) {
        L.polygon(pts, { color: col, fillColor: col, fillOpacity: 0.12, weight: 0 }).addTo(group);
      }
      if (canEdit && mutate) {
        rawPts.forEach((pt: any, ptIdx: number) => {
          const lat = Number(pt?.lat);
          const lng = Number(pt?.lng ?? pt?.lon);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
          addVertexHandle(lat, lng, col, `${key} #${ptIdx + 1}`, (nl, nlg) => {
            mutate((prev) => {
              const prevJf = { ...(prev.jf17_airspace_settings || {}) } as Record<string, any>;
              const cur = prevJf[key] || prevJf[key.toLowerCase()];
              const nextPts = Array.isArray(cur)
                ? [...cur]
                : Array.isArray(cur?.points)
                  ? [...cur.points]
                  : [];
              if (nextPts[ptIdx]) nextPts[ptIdx] = { ...nextPts[ptIdx], lat: nl, lng: nlg };
              return {
                ...prev,
                jf17_airspace_settings: {
                  ...prevJf,
                  [key]: { color: cur?.color || defaults[key], closed: Boolean(cur?.closed), points: nextPts },
                },
              };
            });
          });
        });
      }
    });
  }
}
