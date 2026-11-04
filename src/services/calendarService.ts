import { invoke } from '@tauri-apps/api/core';
import {
  CalendarEventItem,
  CalendarEventsResponse,
  CalendarEventType,
  CalendarRsvpResponse,
  SubmitCalendarCompletePayload,
} from '../types';
import { normalizeCompanionBaseUrl } from './flightPlanService';
import { isTauriRuntime, sendPortalApiRequest } from './tauriBridge';

export interface FetchCalendarEventsOptions {
  year?: number;
  month?: number;
  start?: string;
  end?: string;
  type?: 'all' | 'campaign' | 'training';
  discord_id?: string;
}

/**
 * GET /api/v1/companion/calendar
 * Fetches both Campaign Sorties and Training Sorties for the given month/year.
 */
export async function fetchCalendarEvents(
  baseUrl: string,
  options: FetchCalendarEventsOptions = {},
  token?: string
): Promise<CalendarEventsResponse> {
  const cleanBase = normalizeCompanionBaseUrl(baseUrl);
  const params = new URLSearchParams();

  if (options.year !== undefined) params.set('year', String(options.year));
  if (options.month !== undefined) params.set('month', String(options.month));
  if (options.start) params.set('start', options.start);
  if (options.end) params.set('end', options.end);
  if (options.type && options.type !== 'all') params.set('type', options.type);
  if (options.discord_id) params.set('discord_id', options.discord_id);

  const query = params.toString() ? `?${params.toString()}` : '';
  const endpoint = `${cleanBase}/calendar${query}`;

  let lastError: unknown = null;

  if (isTauriRuntime()) {
    try {
      const res = await invoke<CalendarEventsResponse>('fetch_portal_api', {
        endpointUrl: endpoint,
        accessToken: token || null,
      });
      if (res && Array.isArray(res.events)) {
        return res;
      }
    } catch (err) {
      lastError = err;
      console.warn('Native fetch calendar events failed, trying fallback:', err);
    }
  }

  try {
    const res = await sendPortalApiRequest<CalendarEventsResponse>(
      endpoint,
      'GET',
      undefined,
      token
    );
    if (res && Array.isArray(res.events)) {
      return res;
    }
  } catch (err) {
    lastError = err;
    console.warn('Fetch calendar events HTTP error:', err);
  }

  const errMsg =
    lastError instanceof Error
      ? lastError.message
      : lastError
      ? String(lastError)
      : 'Empty or invalid calendar response from portal.';

  throw new Error(`${errMsg} (${endpoint})`);
}

/**
 * GET /api/v1/companion/calendar/{type}/{id}
 */
export async function fetchCalendarEventDetail(
  baseUrl: string,
  type: CalendarEventType,
  id: number,
  discordId?: string,
  token?: string
): Promise<{ event: CalendarEventItem }> {
  const cleanBase = normalizeCompanionBaseUrl(baseUrl);
  const query = discordId ? `?discord_id=${encodeURIComponent(discordId)}` : '';
  const endpoint = `${cleanBase}/calendar/${encodeURIComponent(type)}/${id}${query}`;

  return await sendPortalApiRequest<{ event: CalendarEventItem }>(
    endpoint,
    'GET',
    undefined,
    token
  );
}

export interface SubmitCalendarRsvpPayload {
  discord_id: string;
  action: 'attend' | 'cancel';
  airframe_id?: number | null;
  role?: string;
  is_opfor?: boolean;
  callsign?: string | null;
  notes?: string | null;
}

/**
 * POST /api/v1/companion/calendar/{type}/{id}/rsvp
 */
export async function submitCalendarEventRsvp(
  baseUrl: string,
  type: CalendarEventType,
  id: number,
  payload: SubmitCalendarRsvpPayload,
  token?: string
): Promise<CalendarRsvpResponse> {
  const cleanBase = normalizeCompanionBaseUrl(baseUrl);
  const endpoint = `${cleanBase}/calendar/${encodeURIComponent(type)}/${id}/rsvp`;

  return await sendPortalApiRequest<CalendarRsvpResponse>(
    endpoint,
    'POST',
    payload,
    token
  );
}

/**
 * POST /api/v1/companion/calendar/{type}/{id}/complete
 * Completes a training sortie, records attendance, awards XP, and publishes debrief.
 */
export async function submitCalendarEventComplete(
  baseUrl: string,
  type: CalendarEventType,
  id: number,
  payload: SubmitCalendarCompletePayload,
  token?: string
): Promise<{ success: boolean; message: string; event?: CalendarEventItem }> {
  const cleanBase = normalizeCompanionBaseUrl(baseUrl);
  const endpoint = `${cleanBase}/calendar/${encodeURIComponent(type)}/${id}/complete`;

  return await sendPortalApiRequest<{ success: boolean; message: string; event?: CalendarEventItem }>(
    endpoint,
    'POST',
    payload,
    token
  );
}
