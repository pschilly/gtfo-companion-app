import {
  CampaignMapFlightPlanBrief,
  CampaignMapIsrRequest,
  CampaignMapIsrTarget,
  CampaignMapLoadoutPreset,
  CampaignMapMission,
  CampaignMapPayload,
  CampaignMapSupportAsset,
  CampaignMapTacticalMarking,
  CampaignMapThreat,
  CampaignMapWarehouseInventory,
  FlightPlanCommsEntry,
  FlightPlanDetail,
} from '../types';
import { normalizeCompanionBaseUrl } from './flightPlanService';
import { sendPortalApiRequest } from './tauriBridge';

export interface CampaignMapAuthOptions {
  discordId?: string | null;
  token?: string | null;
}

function appendQuery(endpoint: string, params: Record<string, string | undefined | null>): string {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      qs.set(key, String(value));
    }
  });
  const query = qs.toString();
  return query ? `${endpoint}?${query}` : endpoint;
}

/**
 * GET /api/v1/companion/campaigns/{campaign}/map
 */
export async function fetchCampaignMapPayload(
  baseUrl: string,
  campaignIdOrSlug: string | number,
  options: CampaignMapAuthOptions & { refresh?: boolean } = {}
): Promise<CampaignMapPayload> {
  const cleanBase = normalizeCompanionBaseUrl(baseUrl);
  const endpoint = appendQuery(
    `${cleanBase}/campaigns/${encodeURIComponent(String(campaignIdOrSlug))}/map`,
    {
      discord_id: options.discordId || undefined,
      refresh: options.refresh ? '1' : undefined,
    }
  );

  const res = await sendPortalApiRequest<CampaignMapPayload & { success?: boolean }>(
    endpoint,
    'GET',
    undefined,
    options.token || undefined
  );

  if (!res || !res.campaign) {
    throw new Error('Failed to load interactive campaign map payload.');
  }

  return res;
}

/**
 * GET /api/v1/companion/campaigns/{campaign}/airbases/warehouse?airbase=...
 */
export async function fetchAirbaseWarehouse(
  baseUrl: string,
  campaignIdOrSlug: string | number,
  airbaseName: string,
  options: CampaignMapAuthOptions = {}
): Promise<CampaignMapWarehouseInventory> {
  const cleanBase = normalizeCompanionBaseUrl(baseUrl);
  const endpoint = appendQuery(
    `${cleanBase}/campaigns/${encodeURIComponent(String(campaignIdOrSlug))}/airbases/warehouse`,
    {
      airbase: airbaseName,
      discord_id: options.discordId || undefined,
    }
  );

  const res = await sendPortalApiRequest<{ warehouse?: CampaignMapWarehouseInventory }>(
    endpoint,
    'GET',
    undefined,
    options.token || undefined
  );

  return (
    res?.warehouse || {
      is_unlimited: true,
      weapons: [],
    }
  );
}

/**
 * POST /api/v1/companion/campaigns/{campaign}/flight-plans
 */
export async function createCampaignFlightPlanDraft(
  baseUrl: string,
  campaignIdOrSlug: string | number,
  payload: Record<string, unknown>,
  options: CampaignMapAuthOptions = {}
): Promise<{
  plan: FlightPlanDetail;
  flightPlans: { allPlans: CampaignMapFlightPlanBrief[]; myPlans: CampaignMapFlightPlanBrief[] };
}> {
  const cleanBase = normalizeCompanionBaseUrl(baseUrl);
  const endpoint = `${cleanBase}/campaigns/${encodeURIComponent(String(campaignIdOrSlug))}/flight-plans`;
  const res = await sendPortalApiRequest<{
    plan: FlightPlanDetail;
    flightPlans: { allPlans: CampaignMapFlightPlanBrief[]; myPlans: CampaignMapFlightPlanBrief[] };
  }>(
    endpoint,
    'POST',
    {
      ...payload,
      discord_id: options.discordId || undefined,
    },
    options.token || undefined
  );

  if (!res?.plan) {
    throw new Error('Server did not return created flight plan draft.');
  }
  return res;
}

/**
 * POST /api/v1/companion/campaigns/{campaign}/flight-plans/{flightPlan}/clone
 */
export async function cloneCampaignFlightPlan(
  baseUrl: string,
  campaignIdOrSlug: string | number,
  flightPlanIdOrIdentifier: string | number,
  options: CampaignMapAuthOptions = {}
): Promise<{
  plan: FlightPlanDetail;
  flightPlans: { allPlans: CampaignMapFlightPlanBrief[]; myPlans: CampaignMapFlightPlanBrief[] };
}> {
  const cleanBase = normalizeCompanionBaseUrl(baseUrl);
  const endpoint = `${cleanBase}/campaigns/${encodeURIComponent(
    String(campaignIdOrSlug)
  )}/flight-plans/${encodeURIComponent(String(flightPlanIdOrIdentifier))}/clone`;

  const res = await sendPortalApiRequest<{
    plan: FlightPlanDetail;
    flightPlans: { allPlans: CampaignMapFlightPlanBrief[]; myPlans: CampaignMapFlightPlanBrief[] };
  }>(
    endpoint,
    'POST',
    { discord_id: options.discordId || undefined },
    options.token || undefined
  );

  if (!res?.plan) {
    throw new Error('Failed to clone flight plan.');
  }
  return res;
}

/**
 * PUT /api/v1/companion/flight-plans/{flightPlan}
 */
export async function saveCampaignFlightPlan(
  baseUrl: string,
  flightPlanIdOrIdentifier: string | number,
  payload: Record<string, unknown>,
  options: CampaignMapAuthOptions = {}
): Promise<{ plan: FlightPlanDetail }> {
  const cleanBase = normalizeCompanionBaseUrl(baseUrl);
  const endpoint = `${cleanBase}/flight-plans/${encodeURIComponent(
    String(flightPlanIdOrIdentifier)
  )}`;

  const res = await sendPortalApiRequest<{ plan: FlightPlanDetail }>(
    endpoint,
    'PUT',
    {
      ...payload,
      discord_id: options.discordId || undefined,
    },
    options.token || undefined
  );

  if (!res?.plan) {
    throw new Error('Failed to save flight plan changes.');
  }
  return res;
}

/**
 * DELETE /api/v1/companion/flight-plans/{flightPlan}
 */
export async function deleteCampaignFlightPlan(
  baseUrl: string,
  flightPlanIdOrIdentifier: string | number,
  options: CampaignMapAuthOptions = {}
): Promise<void> {
  const cleanBase = normalizeCompanionBaseUrl(baseUrl);
  const endpoint = appendQuery(
    `${cleanBase}/flight-plans/${encodeURIComponent(String(flightPlanIdOrIdentifier))}`,
    { discord_id: options.discordId || undefined }
  );

  await sendPortalApiRequest(endpoint, 'DELETE', undefined, options.token || undefined);
}

/**
 * POST /api/v1/companion/campaigns/{campaign}/threats
 */
export async function saveCampaignThreats(
  baseUrl: string,
  campaignIdOrSlug: string | number,
  threats: Partial<CampaignMapThreat>[],
  removedIds: number[],
  options: CampaignMapAuthOptions = {}
): Promise<CampaignMapThreat[]> {
  const cleanBase = normalizeCompanionBaseUrl(baseUrl);
  const endpoint = `${cleanBase}/campaigns/${encodeURIComponent(String(campaignIdOrSlug))}/threats`;

  const res = await sendPortalApiRequest<{ threats?: CampaignMapThreat[] }>(
    endpoint,
    'POST',
    {
      threats,
      removed_ids: removedIds,
      discord_id: options.discordId || undefined,
    },
    options.token || undefined
  );

  return res?.threats || [];
}

/**
 * POST /api/v1/companion/campaigns/{campaign}/support-assets
 */
export async function saveCampaignSupportAssets(
  baseUrl: string,
  campaignIdOrSlug: string | number,
  supportAssets: Partial<CampaignMapSupportAsset>[],
  removedIds: number[],
  options: CampaignMapAuthOptions = {}
): Promise<CampaignMapSupportAsset[]> {
  const cleanBase = normalizeCompanionBaseUrl(baseUrl);
  const endpoint = `${cleanBase}/campaigns/${encodeURIComponent(
    String(campaignIdOrSlug)
  )}/support-assets`;

  const res = await sendPortalApiRequest<{ supportAssets?: CampaignMapSupportAsset[] }>(
    endpoint,
    'POST',
    {
      support_assets: supportAssets,
      removed_ids: removedIds,
      discord_id: options.discordId || undefined,
    },
    options.token || undefined
  );

  return res?.supportAssets || [];
}

/**
 * POST /api/v1/companion/campaigns/{campaign}/tactical-markings
 */
export async function saveCampaignTacticalMarking(
  baseUrl: string,
  campaignIdOrSlug: string | number,
  marking: Record<string, unknown>,
  options: CampaignMapAuthOptions = {}
): Promise<CampaignMapTacticalMarking[]> {
  const cleanBase = normalizeCompanionBaseUrl(baseUrl);
  const endpoint = `${cleanBase}/campaigns/${encodeURIComponent(
    String(campaignIdOrSlug)
  )}/tactical-markings`;

  const res = await sendPortalApiRequest<{ tacticalMarkings?: CampaignMapTacticalMarking[] }>(
    endpoint,
    'POST',
    {
      ...marking,
      discord_id: options.discordId || undefined,
    },
    options.token || undefined
  );

  return res?.tacticalMarkings || [];
}

/**
 * DELETE /api/v1/companion/campaigns/{campaign}/tactical-markings/{marking}
 */
export async function deleteCampaignTacticalMarking(
  baseUrl: string,
  campaignIdOrSlug: string | number,
  markingId: number,
  options: CampaignMapAuthOptions = {}
): Promise<CampaignMapTacticalMarking[]> {
  const cleanBase = normalizeCompanionBaseUrl(baseUrl);
  const endpoint = appendQuery(
    `${cleanBase}/campaigns/${encodeURIComponent(
      String(campaignIdOrSlug)
    )}/tactical-markings/${markingId}`,
    { discord_id: options.discordId || undefined }
  );

  const res = await sendPortalApiRequest<{ tacticalMarkings?: CampaignMapTacticalMarking[] }>(
    endpoint,
    'DELETE',
    undefined,
    options.token || undefined
  );

  return res?.tacticalMarkings || [];
}

/**
 * POST /api/v1/companion/campaigns/{campaign}/tactical-markings/{marking}/assign-aor
 */
export async function assignCampaignTacticalMarkingAsAor(
  baseUrl: string,
  campaignIdOrSlug: string | number,
  markingId: number,
  payload: {
    mission_id: number;
    target_type: 'mission' | 'objective';
    objective_index?: number | null;
  },
  options: CampaignMapAuthOptions = {}
): Promise<{
  missions: CampaignMapMission[];
  tacticalMarkings: CampaignMapTacticalMarking[];
  aorPresets: NonNullable<CampaignMapPayload['aorPresets']>;
}> {
  const cleanBase = normalizeCompanionBaseUrl(baseUrl);
  const endpoint = `${cleanBase}/campaigns/${encodeURIComponent(
    String(campaignIdOrSlug)
  )}/tactical-markings/${markingId}/assign-aor`;

  const res = await sendPortalApiRequest<{
    missions?: CampaignMapMission[];
    tacticalMarkings?: CampaignMapTacticalMarking[];
    aorPresets?: CampaignMapPayload['aorPresets'];
  }>(
    endpoint,
    'POST',
    {
      ...payload,
      discord_id: options.discordId || undefined,
    },
    options.token || undefined
  );

  return {
    missions: res?.missions || [],
    tacticalMarkings: res?.tacticalMarkings || [],
    aorPresets: res?.aorPresets || [],
  };
}

/**
 * POST /api/v1/companion/campaigns/{campaign}/isr-requests
 */
export async function submitCampaignIsrRequest(
  baseUrl: string,
  campaignIdOrSlug: string | number,
  payload: Record<string, unknown>,
  options: CampaignMapAuthOptions = {}
): Promise<{ isrRequests: CampaignMapIsrRequest[]; isrCreditsBalance: number }> {
  const cleanBase = normalizeCompanionBaseUrl(baseUrl);
  const endpoint = `${cleanBase}/campaigns/${encodeURIComponent(
    String(campaignIdOrSlug)
  )}/isr-requests`;

  const res = await sendPortalApiRequest<{
    isrRequests?: CampaignMapIsrRequest[];
    isrCreditsBalance?: number;
  }>(
    endpoint,
    'POST',
    {
      ...payload,
      discord_id: options.discordId || undefined,
    },
    options.token || undefined
  );

  return {
    isrRequests: res?.isrRequests || [],
    isrCreditsBalance: typeof res?.isrCreditsBalance === 'number' ? res.isrCreditsBalance : 0,
  };
}

/**
 * POST /api/v1/companion/loadout-presets
 */
export async function saveLoadoutPreset(
  baseUrl: string,
  payload: {
    name: string;
    description?: string;
    airframe_id?: number | null;
    airframe_key?: string;
    stations: Record<string, unknown>;
    gun?: string | null;
    countermeasures?: string | null;
  },
  options: CampaignMapAuthOptions = {}
): Promise<CampaignMapLoadoutPreset[]> {
  const cleanBase = normalizeCompanionBaseUrl(baseUrl);
  const endpoint = `${cleanBase}/loadout-presets`;

  const res = await sendPortalApiRequest<{ presets?: CampaignMapLoadoutPreset[] }>(
    endpoint,
    'POST',
    {
      ...payload,
      discord_id: options.discordId || undefined,
    },
    options.token || undefined
  );

  return res?.presets || [];
}

/**
 * DELETE /api/v1/companion/loadout-presets/{preset}
 */
export async function deleteLoadoutPreset(
  baseUrl: string,
  presetId: number,
  options: CampaignMapAuthOptions = {}
): Promise<CampaignMapLoadoutPreset[]> {
  const cleanBase = normalizeCompanionBaseUrl(baseUrl);
  const endpoint = appendQuery(`${cleanBase}/loadout-presets/${presetId}`, {
    discord_id: options.discordId || undefined,
  });

  const res = await sendPortalApiRequest<{ presets?: CampaignMapLoadoutPreset[] }>(
    endpoint,
    'DELETE',
    undefined,
    options.token || undefined
  );

  return res?.presets || [];
}

/**
 * GET /api/v1/companion/elevation?lat=...&lng=...
 */
export async function fetchTerrainElevation(
  baseUrl: string,
  lat: number,
  lng: number,
  token?: string | null
): Promise<number | null> {
  const cleanBase = normalizeCompanionBaseUrl(baseUrl);
  const endpoint = `${cleanBase}/elevation?lat=${encodeURIComponent(
    lat.toFixed(5)
  )}&lng=${encodeURIComponent(lng.toFixed(5))}`;

  try {
    const res = await sendPortalApiRequest<{ elevation_ft?: number | null }>(
      endpoint,
      'GET',
      undefined,
      token || undefined
    );
    return typeof res?.elevation_ft === 'number' ? res.elevation_ft : null;
  } catch {
    return null;
  }
}

/**
 * POST /api/v1/companion/campaigns/{campaign}/flight-plans/default-comms
 */
export async function pullCampaignDefaultComms(
  baseUrl: string,
  campaignIdOrSlug: string | number,
  payload: {
    airframe_id?: number | null;
    mission_id?: number | null;
    departure_airfield?: string | null;
    destination_airfield?: string | null;
    diverts?: Array<string | { name?: string }>;
  },
  options: CampaignMapAuthOptions = {}
): Promise<Record<string, FlightPlanCommsEntry[]>> {
  const cleanBase = normalizeCompanionBaseUrl(baseUrl);
  const endpoint = `${cleanBase}/campaigns/${encodeURIComponent(
    String(campaignIdOrSlug)
  )}/flight-plans/default-comms`;

  const res = await sendPortalApiRequest<{ comms?: Record<string, FlightPlanCommsEntry[]> }>(
    endpoint,
    'POST',
    {
      ...payload,
      discord_id: options.discordId || undefined,
    },
    options.token || undefined
  );

  return res?.comms || {};
}

/**
 * POST /api/v1/companion/campaigns/{campaign}/flight-plans/airfield-comms
 */
export async function pullCampaignAirfieldComms(
  baseUrl: string,
  campaignIdOrSlug: string | number,
  payload: {
    radio_key?: string;
    airframe_id?: number | null;
    airbase_id?: number | null;
    departure_airfield?: string | null;
    destination_airfield?: string | null;
    diverts?: Array<string | { name?: string }>;
    include_dcs?: boolean;
  },
  options: CampaignMapAuthOptions = {}
): Promise<FlightPlanCommsEntry[]> {
  const cleanBase = normalizeCompanionBaseUrl(baseUrl);
  const endpoint = `${cleanBase}/campaigns/${encodeURIComponent(
    String(campaignIdOrSlug)
  )}/flight-plans/airfield-comms`;

  const res = await sendPortalApiRequest<{ channels?: FlightPlanCommsEntry[] }>(
    endpoint,
    'POST',
    {
      ...payload,
      discord_id: options.discordId || undefined,
    },
    options.token || undefined
  );

  return res?.channels || [];
}

/**
 * GET /api/v1/companion/campaigns/{campaign}/flight-plans/default-mids
 */
export async function pullCampaignDefaultMids(
  baseUrl: string,
  campaignIdOrSlug: string | number,
  airframeId?: number | null,
  options: CampaignMapAuthOptions = {}
): Promise<Record<string, any>> {
  const cleanBase = normalizeCompanionBaseUrl(baseUrl);
  const endpoint = appendQuery(
    `${cleanBase}/campaigns/${encodeURIComponent(
      String(campaignIdOrSlug)
    )}/flight-plans/default-mids`,
    {
      airframe_id: airframeId ? String(airframeId) : undefined,
      discord_id: options.discordId || undefined,
    }
  );

  const res = await sendPortalApiRequest<{ mids?: Record<string, any> }>(
    endpoint,
    'GET',
    undefined,
    options.token || undefined
  );

  return res?.mids || {};
}

/**
 * POST /api/v1/companion/campaigns/{campaign}/flight-plans/import-dtc
 */
export async function importCampaignDtcFlightPlan(
  baseUrl: string,
  campaignIdOrSlug: string | number,
  payload: {
    dtc_json: string;
    airframe_id?: number | null;
    name?: string | null;
    is_opfor?: boolean;
    mission_id?: number | null;
    sortie_id?: number | null;
    color?: string | null;
  },
  options: CampaignMapAuthOptions = {}
): Promise<{
  plan: FlightPlanDetail;
  flightPlans: { allPlans: CampaignMapFlightPlanBrief[]; myPlans: CampaignMapFlightPlanBrief[] };
}> {
  const cleanBase = normalizeCompanionBaseUrl(baseUrl);
  const endpoint = `${cleanBase}/campaigns/${encodeURIComponent(
    String(campaignIdOrSlug)
  )}/flight-plans/import-dtc`;

  const res = await sendPortalApiRequest<{
    plan: FlightPlanDetail;
    flightPlans: { allPlans: CampaignMapFlightPlanBrief[]; myPlans: CampaignMapFlightPlanBrief[] };
  }>(
    endpoint,
    'POST',
    {
      ...payload,
      discord_id: options.discordId || undefined,
    },
    options.token || undefined
  );

  if (!res?.plan) {
    throw new Error('Failed to import DTC flight plan.');
  }
  return res;
}

/**
 * DELETE /api/v1/companion/campaigns/{campaign}/isr-requests/{isrRequest}
 */
export async function deleteCampaignIsrRequest(
  baseUrl: string,
  campaignIdOrSlug: string | number,
  isrRequestId: number,
  options: CampaignMapAuthOptions = {}
): Promise<{ isrRequests: CampaignMapIsrRequest[]; isrCreditsBalance: number }> {
  const cleanBase = normalizeCompanionBaseUrl(baseUrl);
  const endpoint = appendQuery(
    `${cleanBase}/campaigns/${encodeURIComponent(
      String(campaignIdOrSlug)
    )}/isr-requests/${isrRequestId}`,
    { discord_id: options.discordId || undefined }
  );

  const res = await sendPortalApiRequest<{
    isrRequests?: CampaignMapIsrRequest[];
    isrCreditsBalance?: number;
  }>(endpoint, 'DELETE', undefined, options.token || undefined);

  return {
    isrRequests: res?.isrRequests || [],
    isrCreditsBalance: typeof res?.isrCreditsBalance === 'number' ? res.isrCreditsBalance : 0,
  };
}

/**
 * POST /api/v1/companion/campaigns/{campaign}/isr-requests/{isrRequest}/invalidate
 */
export async function invalidateCampaignIsrRequest(
  baseUrl: string,
  campaignIdOrSlug: string | number,
  isrRequestId: number,
  options: CampaignMapAuthOptions = {}
): Promise<CampaignMapIsrRequest[]> {
  const cleanBase = normalizeCompanionBaseUrl(baseUrl);
  const endpoint = `${cleanBase}/campaigns/${encodeURIComponent(
    String(campaignIdOrSlug)
  )}/isr-requests/${isrRequestId}/invalidate`;

  const res = await sendPortalApiRequest<{ isrRequests?: CampaignMapIsrRequest[] }>(
    endpoint,
    'POST',
    { discord_id: options.discordId || undefined },
    options.token || undefined
  );

  return res?.isrRequests || [];
}

/**
 * POST /api/v1/companion/campaigns/{campaign}/isr-requests/{isrRequest}/revalidate
 */
export async function revalidateCampaignIsrRequest(
  baseUrl: string,
  campaignIdOrSlug: string | number,
  isrRequestId: number,
  options: CampaignMapAuthOptions = {}
): Promise<CampaignMapIsrRequest[]> {
  const cleanBase = normalizeCompanionBaseUrl(baseUrl);
  const endpoint = `${cleanBase}/campaigns/${encodeURIComponent(
    String(campaignIdOrSlug)
  )}/isr-requests/${isrRequestId}/revalidate`;

  const res = await sendPortalApiRequest<{ isrRequests?: CampaignMapIsrRequest[] }>(
    endpoint,
    'POST',
    { discord_id: options.discordId || undefined },
    options.token || undefined
  );

  return res?.isrRequests || [];
}

/**
 * POST /api/v1/companion/campaigns/{campaign}/isr-requests/{isrRequest}/retry
 */
export async function retryCampaignIsrRequest(
  baseUrl: string,
  campaignIdOrSlug: string | number,
  isrRequestId: number,
  options: CampaignMapAuthOptions = {}
): Promise<CampaignMapIsrRequest[]> {
  const cleanBase = normalizeCompanionBaseUrl(baseUrl);
  const endpoint = `${cleanBase}/campaigns/${encodeURIComponent(
    String(campaignIdOrSlug)
  )}/isr-requests/${isrRequestId}/retry`;

  const res = await sendPortalApiRequest<{ isrRequests?: CampaignMapIsrRequest[] }>(
    endpoint,
    'POST',
    { discord_id: options.discordId || undefined },
    options.token || undefined
  );

  return res?.isrRequests || [];
}

/**
 * PATCH /api/v1/companion/campaigns/{campaign}/isr-requests/{isrRequest}/mission
 */
export async function updateCampaignIsrRequestMission(
  baseUrl: string,
  campaignIdOrSlug: string | number,
  isrRequestId: number,
  missionId: number | null,
  options: CampaignMapAuthOptions = {}
): Promise<CampaignMapIsrRequest[]> {
  const cleanBase = normalizeCompanionBaseUrl(baseUrl);
  const endpoint = `${cleanBase}/campaigns/${encodeURIComponent(
    String(campaignIdOrSlug)
  )}/isr-requests/${isrRequestId}/mission`;

  const res = await sendPortalApiRequest<{ isrRequests?: CampaignMapIsrRequest[] }>(
    endpoint,
    'PATCH',
    {
      mission_id: missionId,
      discord_id: options.discordId || undefined,
    },
    options.token || undefined
  );

  return res?.isrRequests || [];
}

/**
 * POST /api/v1/companion/campaigns/{campaign}/isr-requests/{isrRequest}/targets
 */
export async function saveCampaignIsrTarget(
  baseUrl: string,
  campaignIdOrSlug: string | number,
  isrRequestId: number,
  payload: {
    id?: number;
    label: string;
    notes?: string | null;
    lat?: number;
    lon?: number;
    bbox: { x_min: number; y_min: number; x_max: number; y_max: number };
  },
  options: CampaignMapAuthOptions = {}
): Promise<{ target: CampaignMapIsrTarget; isrRequests: CampaignMapIsrRequest[] }> {
  const cleanBase = normalizeCompanionBaseUrl(baseUrl);
  const endpoint = `${cleanBase}/campaigns/${encodeURIComponent(
    String(campaignIdOrSlug)
  )}/isr-requests/${isrRequestId}/targets`;

  const res = await sendPortalApiRequest<{
    target: CampaignMapIsrTarget;
    isrRequests?: CampaignMapIsrRequest[];
  }>(
    endpoint,
    'POST',
    {
      ...payload,
      discord_id: options.discordId || undefined,
    },
    options.token || undefined
  );

  if (!res?.target) {
    throw new Error('Failed to save ISR target.');
  }

  return {
    target: res.target,
    isrRequests: res.isrRequests || [],
  };
}

/**
 * DELETE /api/v1/companion/campaigns/{campaign}/isr-targets/{target}
 */
export async function deleteCampaignIsrTarget(
  baseUrl: string,
  campaignIdOrSlug: string | number,
  targetId: number,
  options: CampaignMapAuthOptions = {}
): Promise<CampaignMapIsrRequest[]> {
  const cleanBase = normalizeCompanionBaseUrl(baseUrl);
  const endpoint = appendQuery(
    `${cleanBase}/campaigns/${encodeURIComponent(
      String(campaignIdOrSlug)
    )}/isr-targets/${targetId}`,
    { discord_id: options.discordId || undefined }
  );

  const res = await sendPortalApiRequest<{ isrRequests?: CampaignMapIsrRequest[] }>(
    endpoint,
    'DELETE',
    undefined,
    options.token || undefined
  );

  return res?.isrRequests || [];
}
