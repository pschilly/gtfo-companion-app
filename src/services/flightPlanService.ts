import { invoke } from '@tauri-apps/api/core';
import { STATIC_CONFIG } from '../config/constants';
import {
  SAMPLE_ACTIVE_SORTIE_RESPONSE,
  SAMPLE_FLIGHT_PLAN_HORNET,
  SAMPLE_FLIGHT_PLAN_PRIVATE,
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
