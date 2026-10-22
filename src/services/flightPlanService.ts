import { invoke } from '@tauri-apps/api/core';
import { STATIC_CONFIG } from '../config/constants';
import {
  SAMPLE_ACTIVE_SORTIE_RESPONSE,
  SAMPLE_FLIGHT_PLAN_HORNET,
  SAMPLE_FLIGHT_PLAN_JF17,
  SAMPLE_FLIGHT_PLAN_PRIVATE,
  SAMPLE_FLIGHT_PLAN_TOMCAT,
  SAMPLE_FLIGHT_PLAN_VIPER,
  SAMPLE_MEMBER_FLIGHT_PLANS_RESPONSE,
  formatFlightPlanToLuaPreset,
} from '../data/sampleFlightPlans';
import {
  ActiveSortieResponse,
  FileAtcResponse,
  FiledFlightPlansResponse,
  FlightPlanDetail,
  FlightPlanSummary,
  MemberFlightPlansResponse,
} from '../types';
import { isTauriRuntime, sendPortalApiRequest } from './tauriBridge';

export interface RoutePresetInstallResult {
  filePath: string;
  directoryPath: string;
  action: string;
  theatre: string;
  presetNames: string[];
}

/**
 * Normalizes user-configured base URL to standard companion API base:
 * e.g. 'https://members.globaltaskforceoverlord.org' -> 'https://members.globaltaskforceoverlord.org/api/v1/companion'
 */
export function normalizeCompanionBaseUrl(rawUrl?: string): string {
  const url = (rawUrl || STATIC_CONFIG.portalBaseUrl).trim().replace(/\/+$/, '');
  if (!url) {
    return 'https://members.globaltaskforceoverlord.org/api/v1/companion';
  }
  if (url.includes('/api/v1/companion')) {
    return url;
  }
  return `${url}/api/v1/companion`;
}

/**
 * A. GET /api/v1/companion/member/{discord_id}/flight-plans (?detailed=1)
 */
export async function fetchMemberFlightPlans(
  baseUrl: string,
  discordId: string,
  detailed = false,
  token?: string
): Promise<MemberFlightPlansResponse> {
  const cleanBase = normalizeCompanionBaseUrl(baseUrl);
  const endpoint = `${cleanBase}/member/${encodeURIComponent(discordId)}/flight-plans${
    detailed ? '?detailed=1' : ''
  }`;

  if (isTauriRuntime()) {
    try {
      const res = await invoke<MemberFlightPlansResponse>('fetch_portal_api', {
        endpointUrl: endpoint,
        accessToken: token || null,
      });
      if (res && Array.isArray(res.plans)) {
        return res;
      }
    } catch (err) {
      console.warn('Native fetch member flight-plans failed, trying web fallback:', err);
    }
  }

  // Web fetch fallback
  try {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const resp = await fetch(endpoint, { headers });
    if (resp.ok) {
      const data = (await resp.json()) as MemberFlightPlansResponse;
      if (data && Array.isArray(data.plans)) {
        return data;
      }
    }
  } catch (err) {
    console.warn('Fetch member flight-plans HTTP error, using mock data:', err);
  }

  // Fallback to rich sample data if offline/demo
  return SAMPLE_MEMBER_FLIGHT_PLANS_RESPONSE;
}

/**
 * B. GET /api/v1/companion/sorties/active/flight-plans
 */
export async function fetchActiveSortieFlightPlans(
  baseUrl: string,
  token?: string
): Promise<ActiveSortieResponse> {
  const cleanBase = normalizeCompanionBaseUrl(baseUrl);
  const endpoint = `${cleanBase}/sorties/active/flight-plans`;

  if (isTauriRuntime()) {
    try {
      const res = await invoke<ActiveSortieResponse>('fetch_portal_api', {
        endpointUrl: endpoint,
        accessToken: token || null,
      });
      if (res && Array.isArray(res.plans)) {
        return res;
      }
    } catch (err) {
      console.warn('Native fetch active sortie flight-plans failed, trying web fallback:', err);
    }
  }

  // Web fetch fallback
  try {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const resp = await fetch(endpoint, { headers });
    if (resp.ok) {
      const data = (await resp.json()) as ActiveSortieResponse;
      if (data && Array.isArray(data.plans)) {
        return data;
      }
    }
  } catch (err) {
    console.warn('Fetch active sortie flight-plans HTTP error, using mock data:', err);
  }

  return SAMPLE_ACTIVE_SORTIE_RESPONSE;
}

export interface FetchFiledFlightPlansOptions {
  sortie_id?: number;
  mission_id?: number;
  discord_id?: string;
  detailed?: boolean;
  limit?: number;
}

/**
 * C. GET /api/v1/companion/flight-plans/filed
 * Pull all filed flight plans with optional filters.
 */
export async function fetchFiledFlightPlans(
  baseUrl: string,
  options: FetchFiledFlightPlansOptions = {},
  token?: string
): Promise<FiledFlightPlansResponse> {
  const cleanBase = normalizeCompanionBaseUrl(baseUrl);
  const params = new URLSearchParams();
  if (options.sortie_id !== undefined) params.set('sortie_id', String(options.sortie_id));
  if (options.mission_id !== undefined) params.set('mission_id', String(options.mission_id));
  if (options.discord_id) params.set('discord_id', options.discord_id);
  if (options.detailed) params.set('detailed', '1');
  if (options.limit !== undefined) params.set('limit', String(options.limit));

  const query = params.toString() ? `?${params.toString()}` : '';
  const endpoint = `${cleanBase}/flight-plans/filed${query}`;

  try {
    const res = await sendPortalApiRequest<FiledFlightPlansResponse>(
      endpoint,
      'GET',
      undefined,
      token
    );
    if (res && Array.isArray(res.plans)) {
      return res;
    }
  } catch (err) {
    console.warn('Native/fetch filed flight-plans failed, using fallback:', err);
  }

  // Fallback to active plans marked filed or sample data
  const samplePlans = [
    ...(SAMPLE_MEMBER_FLIGHT_PLANS_RESPONSE.plans || []),
    ...(SAMPLE_ACTIVE_SORTIE_RESPONSE.plans || []),
  ];
  const filed = samplePlans.filter((p) => p.is_filed);
  return {
    total: filed.length,
    plans:
      filed.length > 0
        ? filed
        : samplePlans.slice(0, 2).map((p) => ({
            ...p,
            is_filed: true,
            filed_at: p.filed_at || new Date().toISOString(),
          })),
  };
}

/**
 * D. POST /api/v1/companion/flight-plans/{id}/file-atc
 * Files (or refiles) a flight plan with ATC and broadcasts to Discord ATC channel.
 */
export async function fileFlightPlanWithAtc(
  baseUrl: string,
  idOrIdentifier: string | number,
  discordId?: string,
  token?: string
): Promise<FileAtcResponse> {
  const cleanBase = normalizeCompanionBaseUrl(baseUrl);
  const endpoint = `${cleanBase}/flight-plans/${encodeURIComponent(String(idOrIdentifier))}/file-atc`;
  const body = discordId ? { discord_id: discordId } : {};

  try {
    const res = await sendPortalApiRequest<FileAtcResponse>(
      endpoint,
      'POST',
      body,
      token
    );
    return res;
  } catch (err: any) {
    console.error('fileFlightPlanWithAtc API error:', err);
    throw new Error(err.message || 'Failed to file flight plan with ATC');
  }
}

/**
 * E. PATCH /api/v1/companion/flight-plans/{id}
 * Renames or appends a suffix to an existing flight plan.
 * Note: FP identifier is permanent and cannot be modified.
 */
export async function updateFlightPlanName(
  baseUrl: string,
  idOrIdentifier: string | number,
  payload: { name?: string; append?: string },
  token?: string
): Promise<{ success: boolean; plan: FlightPlanSummary | FlightPlanDetail }> {
  const cleanBase = normalizeCompanionBaseUrl(baseUrl);
  const endpoint = `${cleanBase}/flight-plans/${encodeURIComponent(String(idOrIdentifier))}`;

  try {
    const res = await sendPortalApiRequest<{
      success?: boolean;
      plan?: FlightPlanSummary | FlightPlanDetail;
    }>(endpoint, 'PATCH', payload, token);
    const plan = res.plan || (res as any);
    return {
      success: true,
      plan,
    };
  } catch (err: any) {
    console.error('updateFlightPlanName API error:', err);
    throw new Error(err.message || 'Failed to update flight plan name');
  }
}

/**
 * C. GET /api/v1/companion/flight-plans/{id_or_identifier}
 */
export async function fetchFlightPlanDetail(
  baseUrl: string,
  idOrIdentifier: string | number,
  token?: string
): Promise<FlightPlanDetail> {
  const cleanBase = normalizeCompanionBaseUrl(baseUrl);
  const endpoint = `${cleanBase}/flight-plans/${encodeURIComponent(String(idOrIdentifier))}`;

  if (isTauriRuntime()) {
    try {
      const res = await invoke<any>('fetch_portal_api', {
        endpointUrl: endpoint,
        accessToken: token || null,
      });
      // The API response might wrap inside { plan: ... } or return plan directly
      const plan = res?.plan || res;
      if (plan && plan.identifier) {
        return plan as FlightPlanDetail;
      }
    } catch (err) {
      console.warn('Native fetch flight-plan detail failed, trying web fallback:', err);
    }
  }

  // Web fetch fallback
  try {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const resp = await fetch(endpoint, { headers });
    if (resp.ok) {
      const data = await resp.json();
      const plan = data?.plan || data;
      if (plan && plan.identifier) {
        return plan as FlightPlanDetail;
      }
    }
  } catch (err) {
    console.warn('Fetch flight-plan detail HTTP error, using mock fallback:', err);
  }

  // Fallback sample lookup matching the requested plan ID or identifier
  const allSampleDetails: FlightPlanDetail[] = [
    SAMPLE_FLIGHT_PLAN_VIPER,
    SAMPLE_FLIGHT_PLAN_HORNET,
    SAMPLE_FLIGHT_PLAN_TOMCAT,
    SAMPLE_FLIGHT_PLAN_JF17,
    SAMPLE_FLIGHT_PLAN_PRIVATE,
    ...(SAMPLE_ACTIVE_SORTIE_RESPONSE.plans as FlightPlanDetail[]),
  ];
  const matched = allSampleDetails.find(
    (p) =>
      String(p.id) === String(idOrIdentifier) ||
      p.identifier.toLowerCase() === String(idOrIdentifier).toLowerCase()
  );
  if (matched) {
    return matched;
  }

  return SAMPLE_FLIGHT_PLAN_VIPER;
}

/**
 * D. File Downloads: DTC Cartridge (.dtc JSON)
 * GET /api/v1/companion/flight-plans/{id}/dtc
 */
export async function downloadFlightPlanDtc(
  baseUrl: string,
  idOrIdentifier: string | number,
  token?: string
): Promise<{ success: boolean; data?: any; rawText?: string; error?: string }> {
  const endpoint =
    typeof idOrIdentifier === 'string' && (idOrIdentifier.startsWith('http://') || idOrIdentifier.startsWith('https://'))
      ? idOrIdentifier
      : `${normalizeCompanionBaseUrl(baseUrl)}/flight-plans/${encodeURIComponent(String(idOrIdentifier))}/dtc`;

  if (isTauriRuntime()) {
    try {
      const text = await invoke<string>('fetch_portal_text', {
        endpointUrl: endpoint,
        accessToken: token || null,
      });
      try {
        const parsed = JSON.parse(text);
        if (parsed.error) {
          return { success: false, error: parsed.error, rawText: text };
        }
        return { success: true, data: parsed, rawText: text };
      } catch {
        return { success: true, rawText: text };
      }
    } catch (err: any) {
      return { success: false, error: String(err.message || err) };
    }
  }

  // Browser fetch fallback
  try {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const resp = await fetch(endpoint, { headers });
    if (resp.status === 422) {
      const errJson = await resp.json();
      return { success: false, error: errJson.error || 'DTC not compatible with this airframe' };
    }
    const text = await resp.text();
    try {
      const parsed = JSON.parse(text);
      return { success: true, data: parsed, rawText: text };
    } catch {
      return { success: true, rawText: text };
    }
  } catch (err: any) {
    return { success: false, error: String(err.message || err) };
  }
}

/**
 * D. File Downloads: DCS Route Preset (.lua)
 * GET /api/v1/companion/flight-plans/{id}/dcs-route
 */
export async function downloadFlightPlanDcsRoute(
  baseUrl: string,
  idOrIdentifier: string | number,
  fallbackPlan?: FlightPlanDetail,
  token?: string
): Promise<string> {
  const cleanBase = normalizeCompanionBaseUrl(baseUrl);
  const endpoint = `${cleanBase}/flight-plans/${encodeURIComponent(String(idOrIdentifier))}/dcs-route`;

  if (isTauriRuntime()) {
    try {
      const lua = await invoke<string>('fetch_portal_text', {
        endpointUrl: endpoint,
        accessToken: token || null,
      });
      if (lua && lua.trim().length > 0) {
        return lua;
      }
    } catch (err) {
      console.warn('Native fetch DCS route lua failed, using fallback generator:', err);
    }
  }

  try {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const resp = await fetch(endpoint, { headers });
    if (resp.ok) {
      const text = await resp.text();
      if (text && text.trim().length > 0) {
        return text;
      }
    }
  } catch (err) {
    console.warn('Fetch DCS route HTTP error, using fallback generator:', err);
  }

  if (fallbackPlan) {
    return formatFlightPlanToLuaPreset(fallbackPlan);
  }

  return `["${idOrIdentifier}"] = \n{\n    -- Route points placeholder\n},`;
}

/**
 * Gets the PDF download endpoint URL
 */
export function getFlightPlanPdfUrl(baseUrl: string, idOrIdentifier: string | number): string {
  const cleanBase = normalizeCompanionBaseUrl(baseUrl);
  return `${cleanBase}/flight-plans/${encodeURIComponent(String(idOrIdentifier))}/pdf`;
}

/**
 * Normalizes DCS theatre name into official DCS RouteToolPresets Lua file name
 * e.g., 'Persian Gulf' -> 'PersianGulf.lua' (no space)
 */
export function normalizeDcsTheatreFileName(theatre: string): string {
  const clean = (theatre || '').trim().replace(/\.lua$/i, '');
  const lowerNoSpace = clean.toLowerCase().replace(/[\s_-]+/g, '');
  if (lowerNoSpace === 'persiangulf') return 'PersianGulf.lua';
  if (lowerNoSpace === 'syria') return 'Syria.lua';
  if (lowerNoSpace === 'caucasus') return 'Caucasus.lua';
  if (lowerNoSpace === 'nevada') return 'Nevada.lua';
  if (lowerNoSpace === 'sinai' || lowerNoSpace === 'sinaimap') return 'SinaiMap.lua';
  if (
    lowerNoSpace === 'mariana' ||
    lowerNoSpace === 'marianas' ||
    lowerNoSpace === 'marianaislands'
  )
    return 'MarianaIslands.lua';
  if (lowerNoSpace === 'kola') return 'Kola.lua';
  if (lowerNoSpace === 'southatlantic') return 'SouthAtlantic.lua';
  if (lowerNoSpace === 'afghanistan') return 'Afghanistan.lua';
  if (lowerNoSpace === 'iraq') return 'Iraq.lua';
  if (lowerNoSpace === 'normandy') return 'Normandy.lua';
  return `${clean.replace(/\s+/g, '')}.lua`;
}

/**
 * 2. Desktop (Tauri / Rust) Native Integrations:
 * One-Click "Save Route to DCS":
 * Saves or prepends the route preset into %USERPROFILE%\Saved Games\DCS\Config\RouteToolPresets\<Theatre>.lua
 */
export async function installDcsRoutePresetCommand(
  theatre: string,
  luaContent: string,
  customDcsPath?: string
): Promise<RoutePresetInstallResult> {
  const theatreNormalized = normalizeDcsTheatreFileName(theatre);

  if (isTauriRuntime()) {
    return await invoke<RoutePresetInstallResult>('install_dcs_route_preset', {
      theatre: theatreNormalized,
      luaContent,
      customDcsPath: customDcsPath || null,
    });
  }

  // Browser dev simulation
  const theatreFile = theatreNormalized;
  const storageKey = `gtfo_sim_routetool_${theatreFile}`;
  const existing = localStorage.getItem(storageKey);
  const baseDcs = customDcsPath || 'C:\\Users\\Pilot\\Saved Games\\DCS';
  const presetsDir = `${baseDcs}\\Config\\RouteToolPresets`;

  let content = existing ? `${luaContent}\n${existing}` : `presets = \n{\n${luaContent}\n} -- end of presets\n`;
  localStorage.setItem(storageKey, content);

  return {
    filePath: `${presetsDir}\\${theatreFile}`,
    directoryPath: presetsDir,
    action: existing ? 'prepended' : 'created',
    theatre: theatreFile,
    presetNames: [theatre],
  };
}

/**
 * Gets the DCS Route Tool presets directory path for "Copy Path" button fallback
 */
export async function getDcsRoutePresetsPath(customDcsPath?: string): Promise<string> {
  if (isTauriRuntime()) {
    return await invoke<string>('get_dcs_route_presets_path', {
      customDcsPath: customDcsPath || null,
    });
  }
  const baseDcs = customDcsPath || 'C:\\Users\\Pilot\\Saved Games\\DCS';
  return `${baseDcs}\\Config\\RouteToolPresets`;
}

/**
 * DTC Direct Install to %USERPROFILE%\Saved Games\DCS\DTC\<fileName>
 */
export async function installDtcCartridgeDirect(
  fileName: string,
  content: string,
  subfolder = 'DTC',
  customDcsPath?: string
): Promise<string> {
  if (isTauriRuntime()) {
    return await invoke<string>('install_dtc_cartridge', {
      dcsSavedGamesPath: customDcsPath || null,
      fileName,
      content,
      subfolder,
    });
  }

  const baseDcs = customDcsPath || 'C:\\Users\\Pilot\\Saved Games\\DCS';
  const fullPath = `${baseDcs}\\${subfolder}\\${fileName}`;
  localStorage.setItem(`gtfo_sim_dtc_${fileName}`, content);
  return fullPath;
}

/**
 * Open PDF in default OS system viewer via Tauri shell/opener
 */
export async function openPdfExternalViewer(
  pdfUrl: string,
  fileName?: string,
  token?: string
): Promise<string> {
  if (isTauriRuntime()) {
    return await invoke<string>('open_pdf_kneeboard', {
      pdfUrl,
      fileName: fileName || null,
      accessToken: token || null,
    });
  }

  window.open(pdfUrl, '_blank');
  return pdfUrl;
}

/**
 * Install kneeboard page image into %USERPROFILE%\Saved Games\DCS\Kneeboard\<aircraftFolder>\<fileName>
 */
export async function installAircraftKneeboardPageCommand(
  aircraftFolder: string,
  fileName: string,
  contentOrBase64: string,
  isBinary = false,
  customDcsPath?: string
): Promise<string> {
  if (isTauriRuntime()) {
    return await invoke<string>('install_aircraft_kneeboard_page', {
      dcsSavedGamesPath: customDcsPath || null,
      aircraftFolder,
      fileName,
      contentOrBase64,
      isBinary,
    });
  }

  const baseDcs = customDcsPath || 'C:\\Users\\Pilot\\Saved Games\\DCS';
  return `${baseDcs}\\Kneeboard\\${aircraftFolder}\\${fileName}`;
}

/**
 * Browser-friendly download trigger for files
 */
export function triggerBrowserFileDownload(fileName: string, content: string, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const JF17_TERRAIN_NAMES = [
  'Caucasus',
  'Nevada',
  'PersianGulf',
  'Syria',
  'SinaiMap',
  'MarianaIslands',
  'Falklands',
  'Normandy',
  'TheChannel',
] as const;

export type Jf17TerrainName = (typeof JF17_TERRAIN_NAMES)[number];

/**
 * Normalizes any theatre / map string into the exact case-sensitive DCS JF-17 terrain name:
 * Caucasus, Nevada, PersianGulf, Syria, SinaiMap, MarianaIslands, Falklands, Normandy, TheChannel
 */
export function normalizeJf17TerrainName(theatre?: string): Jf17TerrainName {
  if (!theatre) return 'Syria';
  const clean = theatre.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

  if (clean.includes('caucasus') || clean.includes('blacksea') || clean.includes('georgia')) {
    return 'Caucasus';
  }
  if (clean.includes('persian') || clean.includes('gulf') || clean === 'pg') {
    return 'PersianGulf';
  }
  if (clean.includes('sinai')) {
    return 'SinaiMap';
  }
  if (clean.includes('mariana')) {
    return 'MarianaIslands';
  }
  if (clean.includes('falkland') || clean.includes('southatlantic') || clean.includes('malvinas')) {
    return 'Falklands';
  }
  if (clean.includes('normandy')) {
    return 'Normandy';
  }
  if (clean.includes('channel')) {
    return 'TheChannel';
  }
  if (clean.includes('nevada') || clean.includes('nttr')) {
    return 'Nevada';
  }
  if (clean.includes('syria')) {
    return 'Syria';
  }

  // Exact matching against known terrain names
  const directMatch = JF17_TERRAIN_NAMES.find(
    (name) => name.toLowerCase() === clean
  );
  if (directMatch) return directMatch;

  return 'Syria';
}

/**
 * Returns the exact case-sensitive DCS JF-17 Custom Airspace filename:
 * e.g. Custom_AirSpace_PersianGulf.lua
 */
export function getJf17AirspaceFileName(theatre?: string): string {
  const terrain = normalizeJf17TerrainName(theatre);
  return `Custom_AirSpace_${terrain}.lua`;
}

/**
 * Generates an authentic DCS JF-17 Custom Airspace (.lua) file
 * from flight plan route points and tactical coordinates.
 * Target location: <DCS World>\Mods\aircraft\JF-17\Customization\airspace\Custom_AirSpace_<Terrain>.lua
 */
export function generateFallbackJf17Airspace(plan: FlightPlanDetail): string {
  const rawTheatre = plan.campaign?.theatre || (plan as any).theatre || 'Syria';
  const terrain = normalizeJf17TerrainName(rawTheatre);
  const targetFileName = `Custom_AirSpace_${terrain}.lua`;
  const callsign = plan.callsign.replace(/[^a-zA-Z0-9_-]/g, '_');
  const identifier = plan.identifier || `FP-${plan.id}`;

  let out = `-- ==============================================================================\n`;
  out += `-- DCS JF-17 Thunder Custom Airspace Preset\n`;
  out += `-- Flight Plan: ${identifier} (${plan.callsign})\n`;
  out += `-- Terrain: ${terrain} (${rawTheatre}) | Generated by GTFO Companion\n`;
  out += `-- Target File: ${targetFileName}\n`;
  out += `-- Target Folder: <DCS World>\\Mods\\aircraft\\JF-17\\Customization\\airspace\\\n`;
  out += `-- ==============================================================================\n\n`;

  out += `local airspace = {\n`;

  // 1. Airspace A (RKYA) - Flight Plan Navigation Route Corridor (open polyline)
  if (plan.route_points && plan.route_points.length > 0) {
    const routePts = plan.route_points.slice(0, 10);
    out += `    -- Airspace A: Flight Plan Navigation Corridor\n`;
    out += `    RKYA = {\n`;
    out += `        name = "${callsign}_ROUTE",\n`;
    out += `        closed = false,\n`;
    out += `        color = { 0, 255, 128 },\n`;
    out += `        points = {\n`;
    routePts.forEach((pt) => {
      out += `            { lat = ${Number(pt.lat).toFixed(4)}, lon = ${Number(pt.lng).toFixed(4)} },\n`;
    });
    out += `        },\n`;
    out += `    },\n\n`;
  }

  // 2. Airspace B (RKYB) - Tactical Buffer / CAP Polygon / Safe Corridor (closed polygon)
  const rawAny = plan as any;
  const saPoints = rawAny.sa_points || rawAny.saData?.safeCorridors;
  if (Array.isArray(saPoints) && saPoints.length > 0) {
    const polyPts = saPoints.slice(0, 10);
    out += `    -- Airspace B: Designated Tactical Safe Corridor\n`;
    out += `    RKYB = {\n`;
    out += `        name = "SAFE_CORRIDOR",\n`;
    out += `        closed = true,\n`;
    out += `        color = { 0, 200, 255 },\n`;
    out += `        points = {\n`;
    polyPts.forEach((pt: any) => {
      const lat = pt.lat ?? pt.latitude ?? 36.0;
      const lng = pt.lng ?? pt.lon ?? pt.longitude ?? 36.0;
      out += `            { lat = ${Number(lat).toFixed(4)}, lon = ${Number(lng).toFixed(4)} },\n`;
    });
    out += `        },\n`;
    out += `    },\n`;
  } else if (plan.route_points && plan.route_points.length >= 3) {
    const mid = plan.route_points[Math.floor(plan.route_points.length / 2)];
    out += `    -- Airspace B: Tactical CAP Perimeter Station\n`;
    out += `    RKYB = {\n`;
    out += `        name = "CAP_STATION",\n`;
    out += `        closed = true,\n`;
    out += `        color = { 255, 64, 64 },\n`;
    out += `        points = {\n`;
    out += `            { lat = ${(mid.lat + 0.35).toFixed(4)}, lon = ${(mid.lng - 0.45).toFixed(4)} },\n`;
    out += `            { lat = ${(mid.lat + 0.35).toFixed(4)}, lon = ${(mid.lng + 0.45).toFixed(4)} },\n`;
    out += `            { lat = ${(mid.lat - 0.35).toFixed(4)}, lon = ${(mid.lng + 0.45).toFixed(4)} },\n`;
    out += `            { lat = ${(mid.lat - 0.35).toFixed(4)}, lon = ${(mid.lng - 0.45).toFixed(4)} },\n`;
    out += `        },\n`;
    out += `    },\n`;
  }

  out += `}\n\n`;
  out += `return airspace\n`;

  return out;
}

/**
 * Downloads JF-17 Custom Airspace from backend endpoints:
 * 1. Dedicated: GET /api/v1/companion/flight-plans/{flightPlan}/custom-airspace
 * 2. Dedicated alias: GET /api/v1/companion/flight-plans/{flightPlan}/jf17-airspace
 * 3. Generic export: GET /api/v1/companion/flight-plans/{flightPlan}/export/custom_airspace
 * 4. Generic export alias: GET /api/v1/companion/flight-plans/{flightPlan}/export/jf17_airspace
 */
export async function downloadFlightPlanJf17Airspace(
  baseUrl: string,
  idOrIdentifier: string | number,
  fallbackPlan?: FlightPlanDetail,
  token?: string
): Promise<{ success: boolean; content: string; fileName: string; error?: string }> {
  const isDirectUrl =
    typeof idOrIdentifier === 'string' &&
    (idOrIdentifier.startsWith('http://') || idOrIdentifier.startsWith('https://'));

  const cleanBase = normalizeCompanionBaseUrl(baseUrl);
  const targetTheatre = fallbackPlan?.campaign?.theatre || (fallbackPlan as any)?.theatre;
  const defaultFileName = getJf17AirspaceFileName(targetTheatre);

  const endpointsToTry: string[] = [];
  if (isDirectUrl) {
    endpointsToTry.push(String(idOrIdentifier));
  } else {
    const targetId = encodeURIComponent(String(idOrIdentifier));
    endpointsToTry.push(
      `${cleanBase}/flight-plans/${targetId}/jf17-airspace`,
      `${cleanBase}/flight-plans/${targetId}/custom-airspace`,
      `${cleanBase}/flight-plans/${targetId}/export/jf17_airspace`,
      `${cleanBase}/flight-plans/${targetId}/export/custom_airspace`
    );
  }

  for (const ep of endpointsToTry) {
    if (isTauriRuntime()) {
      try {
        const res = await invoke<{ content: string; filename?: string }>('fetch_portal_download', {
          endpointUrl: ep,
          accessToken: token || null,
        });
        if (
          res &&
          res.content &&
          res.content.trim().length > 0 &&
          !res.content.includes('"message":"Not Found"') &&
          !res.content.includes('404 Not Found')
        ) {
          const fileName = res.filename?.trim() || defaultFileName;
          return { success: true, content: res.content, fileName };
        }
      } catch {
        // try next endpoint or fallback to fetch_portal_text
        try {
          const text = await invoke<string>('fetch_portal_text', {
            endpointUrl: ep,
            accessToken: token || null,
          });
          if (
            text &&
            text.trim().length > 0 &&
            !text.includes('"message":"Not Found"') &&
            !text.includes('404 Not Found')
          ) {
            return { success: true, content: text, fileName: defaultFileName };
          }
        } catch {
          // continue to next endpoint
        }
      }
    } else {
      try {
        const headers: Record<string, string> = { Accept: 'text/plain, application/json, */*' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const resp = await fetch(ep, { headers });
        if (resp.ok) {
          const text = await resp.text();
          if (text && text.trim().length > 0) {
            let fileName = defaultFileName;
            const cd = resp.headers.get('content-disposition');
            if (cd && cd.includes('filename=')) {
              const match = cd.match(/filename="?([^";]+)"?/);
              if (match && match[1]) fileName = match[1].trim();
            }
            return { success: true, content: text, fileName };
          }
        }
      } catch {
        // try next endpoint
      }
    }
  }

  // Fallback to client-side generation if offline/demo
  if (fallbackPlan) {
    const generated = generateFallbackJf17Airspace(fallbackPlan);
    return { success: true, content: generated, fileName: defaultFileName };
  }

  return {
    success: false,
    content: '',
    fileName: defaultFileName,
    error: 'Custom airspace not available for this flight plan',
  };
}

/**
 * Direct install of JF-17 Custom Airspace into DCS World core folder
 */
export async function installJf17AirspaceDirect(
  fileName: string,
  content: string,
  customDcsWorldPath?: string
): Promise<string> {
  const { installJf17CustomAirspaceCommand } = await import('./tauriBridge');
  return await installJf17CustomAirspaceCommand(customDcsWorldPath, fileName, content);
}
