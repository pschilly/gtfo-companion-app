import * as geomagnetism from 'geomagnetism';
import { forward as mgrsForward, toPoint as mgrsToPoint } from 'mgrs';

/**
 * Convert WGS84 lat/lng to formatted MGRS string (e.g. "37S BV 12345 67890").
 */
export function toMgrs(lat: number, lng: number, accuracy = 5): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return '---';
  }
  try {
    const raw = mgrsForward([lng, lat], accuracy);
    const match = raw.match(/^(\d+[A-Z])([A-Z]{2})(\d+)$/);
    if (!match) {
      return raw;
    }
    const [, gridZone, sq, digits] = match;
    if (digits.length === 0) {
      return `${gridZone} ${sq}`;
    }
    const half = digits.length / 2;
    return `${gridZone} ${sq} ${digits.slice(0, half)} ${digits.slice(half)}`;
  } catch {
    return 'INVALID';
  }
}

/**
 * Convert MGRS string (spaced or compact) into WGS84 { lat, lng }.
 */
export function fromMgrs(mgrsInput: string): { lat: number; lng: number } | null {
  const cleaned = mgrsInput.trim().toUpperCase().replace(/\s+/g, '');
  if (!cleaned || cleaned.length < 4) {
    return null;
  }
  try {
    const [lng, lat] = mgrsToPoint(cleaned);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Resolve magnetic declination in degrees East (+) / West (-) for a coordinate & campaign date.
 */
export function getMagneticDeclination(
  lat: number,
  lng: number,
  campaignDate?: string | null,
  theatreDeclination?: number | null
): number {
  if (typeof theatreDeclination === 'number' && Number.isFinite(theatreDeclination)) {
    return theatreDeclination;
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return 0;
  }
  try {
    const date = campaignDate ? new Date(campaignDate) : new Date();
    const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
    const model = geomagnetism.model(safeDate, { allowOutOfBoundsModel: true });
    return Number(model.point([lat, lng]).decl.toFixed(1));
  } catch {
    return 0;
  }
}

export function normalizeHeadingDeg(deg: number): number {
  const mod = ((deg % 360) + 360) % 360;
  return mod === 0 ? 360 : mod;
}

export function trueToMagnetic(trueDeg: number, declination: number): number {
  return Math.round(normalizeHeadingDeg(trueDeg - declination)) % 360;
}

export function magneticToTrue(magDeg: number, declination: number): number {
  return Math.round(normalizeHeadingDeg(magDeg + declination)) % 360;
}

/**
 * ISA Standard Atmosphere approximation converting Calibrated Airspeed (kts) to True Airspeed (kts).
 */
export function casToTas(casKts: number, altFt: number): number {
  const safeAlt = Math.max(0, Math.min(65000, altFt || 0));
  const tempRatio = safeAlt <= 36089 ? 1 - 6.87535e-6 * safeAlt : 0.751865;
  const pressureRatio =
    safeAlt <= 36089
      ? Math.pow(tempRatio, 5.25588)
      : 0.223361 * Math.exp((-safeAlt + 36089) / 20806);
  const densityRatio = pressureRatio / tempRatio;
  if (densityRatio <= 0) {
    return casKts;
  }
  return Math.round(casKts / Math.sqrt(densityRatio));
}

/**
 * ISA Standard Atmosphere approximation converting True Airspeed (kts) to Calibrated Airspeed (kts).
 */
export function tasToCas(tasKts: number, altFt: number): number {
  const safeAlt = Math.max(0, Math.min(65000, altFt || 0));
  const tempRatio = safeAlt <= 36089 ? 1 - 6.87535e-6 * safeAlt : 0.751865;
  const pressureRatio =
    safeAlt <= 36089
      ? Math.pow(tempRatio, 5.25588)
      : 0.223361 * Math.exp((-safeAlt + 36089) / 20806);
  const densityRatio = pressureRatio / tempRatio;
  if (densityRatio <= 0) {
    return tasKts;
  }
  return Math.round(tasKts * Math.sqrt(densityRatio));
}

const EARTH_RADIUS_NM = 3440.065;
const EARTH_RADIUS_KM = 6371.0088;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/**
 * Haversine great-circle distance in Nautical Miles.
 */
export function calculateDistanceNm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_NM * c;
}

/**
 * Haversine great-circle distance in Kilometers.
 */
export function calculateDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Initial forward azimuth / true bearing (0 - 360 deg).
 */
export function calculateBearingDegrees(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const lambda1 = toRad(lng1);
  const lambda2 = toRad(lng2);

  const y = Math.sin(lambda2 - lambda1) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(lambda2 - lambda1);
  const brg = toDeg(Math.atan2(y, x));
  return (brg + 360) % 360;
}

/**
 * Spherical destination point given starting lat/lng, true bearing (deg), and distance (NM).
 */
export function computeDestinationPoint(
  lat: number,
  lng: number,
  bearingDeg: number,
  distanceNm: number
): { lat: number; lng: number } {
  const angularDistance = distanceNm / EARTH_RADIUS_NM;
  const bearingRad = toRad(bearingDeg);
  const lat1 = toRad(lat);
  const lng1 = toRad(lng);

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearingRad)
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2)
    );

  return {
    lat: toDeg(lat2),
    lng: ((toDeg(lng2) + 540) % 360) - 180,
  };
}

/**
 * Calculate Bullseye BRAA (bearing magnetic & true + range).
 */
export function calculateBullseyeBraa(
  targetLat: number,
  targetLng: number,
  bullseyeLat: number,
  bullseyeLng: number,
  declination = 0,
  unit: 'nm' | 'km' = 'nm'
): {
  bearingTrue: number;
  bearingMag: number;
  rangeNm: number;
  rangeKm: number;
  formatted: string;
} {
  const bearingTrue = Math.round(
    calculateBearingDegrees(bullseyeLat, bullseyeLng, targetLat, targetLng)
  ) % 360;
  const bearingMag = trueToMagnetic(bearingTrue, declination);
  const rangeNm = calculateDistanceNm(bullseyeLat, bullseyeLng, targetLat, targetLng);
  const rangeKm = calculateDistanceKm(bullseyeLat, bullseyeLng, targetLat, targetLng);
  const brgStr = String(bearingMag === 0 ? 360 : bearingMag).padStart(3, '0');
  const distStr = unit === 'km' ? `${Math.round(rangeKm)} km` : `${Math.round(rangeNm)} nm`;

  return {
    bearingTrue,
    bearingMag,
    rangeNm,
    rangeKm,
    formatted: `${brgStr}°M / ${distStr}`,
  };
}

export function formatLatDdm(lat: number): string {
  const hemi = lat >= 0 ? 'N' : 'S';
  const abs = Math.abs(lat);
  const deg = Math.floor(abs);
  const min = (abs - deg) * 60;
  return `${hemi} ${String(deg).padStart(2, '0')}° ${min.toFixed(3).padStart(6, '0')}'`;
}

export function formatLngDdm(lng: number): string {
  const hemi = lng >= 0 ? 'E' : 'W';
  const abs = Math.abs(lng);
  const deg = Math.floor(abs);
  const min = (abs - deg) * 60;
  return `${hemi} ${String(deg).padStart(3, '0')}° ${min.toFixed(3).padStart(6, '0')}'`;
}

export function formatCoordinateDdm(lat: number, lng: number): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '---';
  return `${formatLatDdm(lat)}  ${formatLngDdm(lng)}`;
}

export function formatLatDms(lat: number): string {
  const hemi = lat >= 0 ? 'N' : 'S';
  const abs = Math.abs(lat);
  const deg = Math.floor(abs);
  const minFloat = (abs - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = (minFloat - min) * 60;
  return `${hemi} ${String(deg).padStart(2, '0')}° ${String(min).padStart(2, '0')}' ${sec
    .toFixed(2)
    .padStart(5, '0')}"`;
}

export function formatLngDms(lng: number): string {
  const hemi = lng >= 0 ? 'E' : 'W';
  const abs = Math.abs(lng);
  const deg = Math.floor(abs);
  const minFloat = (abs - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = (minFloat - min) * 60;
  return `${hemi} ${String(deg).padStart(3, '0')}° ${String(min).padStart(2, '0')}' ${sec
    .toFixed(2)
    .padStart(5, '0')}"`;
}

export function formatCoordinateDms(lat: number, lng: number): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '---';
  return `${formatLatDms(lat)}  ${formatLngDms(lng)}`;
}

export function formatCoordinateDec(lat: number, lng: number, precision = 5): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '---';
  return `${lat.toFixed(precision)}, ${lng.toFixed(precision)}`;
}

/**
 * Parse MGRS, Decimal Lat/Lng, DDM, or DMS strings into { lat, lng, detectedFormat }.
 */
export function parseAnyCoordinate(
  input: string
): { lat: number; lng: number; detectedFormat: 'MGRS' | 'Decimal' | 'DDM' | 'DMS' } | null {
  const raw = input.trim();
  if (!raw) return null;

  // 1. MGRS check (starts with 1-2 digits + 1 letter + 2 letters)
  const compactMgrs = raw.toUpperCase().replace(/\s+/g, '');
  if (/^\d{1,2}[C-HJ-NP-X][A-HJ-NP-Z]{2}\d*$/.test(compactMgrs)) {
    const res = fromMgrs(compactMgrs);
    if (res) {
      return { ...res, detectedFormat: 'MGRS' };
    }
  }

  // 2. Simple decimal pair: e.g. "36.1234, 37.4567" or "36.1234 37.4567"
  const decMatch = raw.match(/^\s*(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (decMatch) {
    const lat = parseFloat(decMatch[1]);
    const lng = parseFloat(decMatch[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng, detectedFormat: 'Decimal' };
    }
  }

  // 3. DMS / DDM pair with hemisphere indicators (N/S and E/W)
  const dmsRegex =
    /([NS])\s*(\d{1,2})[°\s:-]+(\d{1,2})['\s:-]+(\d{1,2}(?:\.\d+)?)["\s]*[,/\s]+([EW])\s*(\d{1,3})[°\s:-]+(\d{1,2})['\s:-]+(\d{1,2}(?:\.\d+)?)["\s]*/i;
  const dmsMatch = raw.match(dmsRegex);
  if (dmsMatch) {
    const latSign = dmsMatch[1].toUpperCase() === 'S' ? -1 : 1;
    const lat =
      latSign *
      (parseInt(dmsMatch[2], 10) + parseInt(dmsMatch[3], 10) / 60 + parseFloat(dmsMatch[4]) / 3600);
    const lngSign = dmsMatch[5].toUpperCase() === 'W' ? -1 : 1;
    const lng =
      lngSign *
      (parseInt(dmsMatch[6], 10) + parseInt(dmsMatch[7], 10) / 60 + parseFloat(dmsMatch[8]) / 3600);
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng, detectedFormat: 'DMS' };
    }
  }

  const ddmRegex =
    /([NS])\s*(\d{1,2})[°\s:-]+(\d{1,2}(?:\.\d+)?)['\s]*[,/\s]+([EW])\s*(\d{1,3})[°\s:-]+(\d{1,2}(?:\.\d+)?)['\s]*/i;
  const ddmMatch = raw.match(ddmRegex);
  if (ddmMatch) {
    const latSign = ddmMatch[1].toUpperCase() === 'S' ? -1 : 1;
    const lat = latSign * (parseInt(ddmMatch[2], 10) + parseFloat(ddmMatch[3]) / 60);
    const lngSign = ddmMatch[4].toUpperCase() === 'W' ? -1 : 1;
    const lng = lngSign * (parseInt(ddmMatch[5], 10) + parseFloat(ddmMatch[6]) / 60);
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng, detectedFormat: 'DDM' };
    }
  }

  return null;
}

/**
 * Compute 16:9 bounding box around center lat/lng given horizontal coverage km_size.
 */
export function getIsr16x9Bounds(
  centerLat: number,
  centerLng: number,
  kmSize: number
): [[number, number], [number, number]] {
  const halfWidthKm = kmSize / 2;
  const halfHeightKm = (kmSize * (9 / 16)) / 2;
  const kmPerDegLat = 111.132;
  const kmPerDegLng = Math.max(0.01, 111.32 * Math.cos(toRad(centerLat)));

  const dLat = halfHeightKm / kmPerDegLat;
  const dLng = halfWidthKm / kmPerDegLng;

  return [
    [centerLat - dLat, centerLng - dLng],
    [centerLat + dLat, centerLng + dLng],
  ];
}

export function formatDurationSeconds(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

const terrariumTileCache = new Map<string, HTMLImageElement>();
const terrariumInFlight = new Map<string, Array<(img: HTMLImageElement | null) => void>>();
let terrariumCanvas: HTMLCanvasElement | null = null;
let terrariumCtx: CanvasRenderingContext2D | null = null;

function getTerrariumContext(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  if (!terrariumCanvas) {
    terrariumCanvas = document.createElement('canvas');
    terrariumCanvas.width = 256;
    terrariumCanvas.height = 256;
    terrariumCtx = terrariumCanvas.getContext('2d', { willReadFrequently: true });
  }
  return terrariumCtx;
}

function decodeTerrariumPixel(
  img: HTMLImageElement,
  px: number,
  py: number
): number | null {
  const ctx = getTerrariumContext();
  if (!ctx) return null;
  try {
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(px, py, 1, 1).data;
    const elevationMeters = data[0] * 256 + data[1] + data[2] / 256 - 32768;
    if (elevationMeters > -10000 && elevationMeters < 10000) {
      return Math.round(elevationMeters * 3.28084);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Decode terrain ground elevation in feet MSL from AWS Terrarium z=12 PNG tiles,
 * sharing tile downloads across rapid hover events.
 */
export function lookupTerrariumElevationFt(
  lat: number,
  lng: number,
  onResult: (elevFt: number | null, failed?: boolean) => void
): void {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -85.05 || lat > 85.05) {
    onResult(null, true);
    return;
  }

  const z = 12;
  const n = Math.pow(2, z);
  const lngDeg = ((lng + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const latDeg =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;

  const x = Math.max(0, Math.min(n - 1, Math.floor(lngDeg)));
  const y = Math.max(0, Math.min(n - 1, Math.floor(latDeg)));
  const px = Math.max(0, Math.min(255, Math.floor((lngDeg - x) * 256)));
  const py = Math.max(0, Math.min(255, Math.floor((latDeg - y) * 256)));

  const tileKey = `${z}/${x}/${y}`;
  const cached = terrariumTileCache.get(tileKey);
  if (cached) {
    onResult(decodeTerrariumPixel(cached, px, py), false);
    return;
  }

  const handler = (img: HTMLImageElement | null) => {
    if (!img) {
      onResult(null, true);
      return;
    }
    onResult(decodeTerrariumPixel(img, px, py), false);
  };

  const pending = terrariumInFlight.get(tileKey);
  if (pending) {
    pending.push(handler);
    return;
  }

  terrariumInFlight.set(tileKey, [handler]);

  const img = new Image();
  img.crossOrigin = 'Anonymous';
  img.onload = () => {
    if (terrariumTileCache.size >= 64) {
      const oldestKey = terrariumTileCache.keys().next().value;
      if (oldestKey !== undefined) {
        terrariumTileCache.delete(oldestKey);
      }
    }
    terrariumTileCache.set(tileKey, img);
    const callbacks = terrariumInFlight.get(tileKey) || [];
    terrariumInFlight.delete(tileKey);
    callbacks.forEach((cb) => cb(img));
  };
  img.onerror = () => {
    const callbacks = terrariumInFlight.get(tileKey) || [];
    terrariumInFlight.delete(tileKey);
    callbacks.forEach((cb) => cb(null));
  };
  img.src = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
}
