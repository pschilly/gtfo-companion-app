import {
  HomeLayoutPreferences,
  HomeWidgetColSpan,
  HomeWidgetId,
  HomeWidgetItem,
} from '../types';
import { normalizeCompanionBaseUrl } from './flightPlanService';
import { sendPortalApiRequest } from './tauriBridge';

export interface HomeWidgetCatalogEntry {
  id: HomeWidgetId;
  title: string;
  subtitle: string;
  description: string;
  defaultColSpan: HomeWidgetColSpan;
  defaultEnabled: boolean;
}

export const HOME_WIDGET_CATALOG: HomeWidgetCatalogEntry[] = [
  {
    id: 'upcoming_sorties',
    title: 'Upcoming Sorties & Training',
    subtitle: 'Scheduled taskforce events',
    description:
      'Live calendar feed of upcoming campaign sorties and training hops with direct event modal access.',
    defaultColSpan: 6,
    defaultEnabled: true,
  },
  {
    id: 'filed_flight_plans',
    title: 'Recently Filed Flight Plans',
    subtitle: 'Active ATC route clearances',
    description:
      'Flight plans currently filed with ATC, opening directly into the Air Traffic Control workbench.',
    defaultColSpan: 6,
    defaultEnabled: true,
  },
  {
    id: 'my_flight_plans',
    title: 'My Flight Plans',
    subtitle: 'Authored & mission-assigned routes',
    description:
      'Quick access to your personal, authored, and mission-assigned flight plans with DTC readiness.',
    defaultColSpan: 6,
    defaultEnabled: false,
  },
  {
    id: 'dossier_summary',
    title: 'Pilot Dossier & Progression',
    subtitle: 'Rank, XP progress & squadron billet',
    description:
      'Overview of your current grade, XP progression toward the next rank, squadron billet, and attendance.',
    defaultColSpan: 6,
    defaultEnabled: false,
  },
  {
    id: 'tracked_qualifications',
    title: 'Training Queue & Certifications',
    subtitle: 'Tracked LMS courses & earned quals',
    description:
      'Monitor your tracked Qualifications Zone courses, checkpoint progress, and issued certifications.',
    defaultColSpan: 6,
    defaultEnabled: false,
  },
  {
    id: 'qualified_airframes',
    title: 'Qualified Airframes',
    subtitle: 'Cleared fleet & flight roles',
    description:
      'Snapshot of your qualified DCS aircraft, primary airframe badge, and pilot/crew/instructor roles.',
    defaultColSpan: 6,
    defaultEnabled: false,
  },
];

const VALID_COL_SPANS: HomeWidgetColSpan[] = [4, 6, 8, 12];
const CATALOG_IDS = new Set<HomeWidgetId>(HOME_WIDGET_CATALOG.map((w) => w.id));

function sanitizeColSpan(value: unknown, fallback: HomeWidgetColSpan): HomeWidgetColSpan {
  const num = Number(value) as HomeWidgetColSpan;
  return VALID_COL_SPANS.includes(num) ? num : fallback;
}

export function buildDefaultHomeLayout(): HomeLayoutPreferences {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    widgets: HOME_WIDGET_CATALOG.map((entry, idx) => ({
      id: entry.id,
      enabled: entry.defaultEnabled,
      colSpan: entry.defaultColSpan,
      order: idx,
    })),
  };
}

export function normalizeHomeLayout(raw: unknown): HomeLayoutPreferences | null {
  if (!raw) return null;

  let parsedRaw = raw;
  if (typeof parsedRaw === 'string') {
    try {
      parsedRaw = JSON.parse(parsedRaw);
    } catch {
      return null;
    }
  }

  if (typeof parsedRaw !== 'object' || parsedRaw === null) {
    return null;
  }

  const obj = parsedRaw as Record<string, unknown>;
  const rawWidgets = Array.isArray(obj.widgets) ? obj.widgets : null;
  if (!rawWidgets || rawWidgets.length === 0) {
    return null;
  }

  const catalogById = new Map<HomeWidgetId, HomeWidgetCatalogEntry>(
    HOME_WIDGET_CATALOG.map((c) => [c.id, c])
  );

  const parsedItems: HomeWidgetItem[] = [];
  const seenIds = new Set<HomeWidgetId>();

  rawWidgets.forEach((item, idx) => {
    if (!item || typeof item !== 'object') return;
    const w = item as Record<string, unknown>;
    const id = String(w.id || '') as HomeWidgetId;
    if (!CATALOG_IDS.has(id) || seenIds.has(id)) return;

    const catalogEntry = catalogById.get(id)!;
    seenIds.add(id);

    parsedItems.push({
      id,
      enabled: typeof w.enabled === 'boolean' ? w.enabled : catalogEntry.defaultEnabled,
      colSpan: sanitizeColSpan(w.colSpan ?? w.col_span, catalogEntry.defaultColSpan),
      order: typeof w.order === 'number' && Number.isFinite(w.order) ? w.order : idx,
    });
  });

  if (parsedItems.length === 0) {
    return null;
  }

  parsedItems.sort((a, b) => a.order - b.order);

  // Append any newly introduced catalog widgets that were absent from saved layout
  HOME_WIDGET_CATALOG.forEach((entry) => {
    if (!seenIds.has(entry.id)) {
      parsedItems.push({
        id: entry.id,
        enabled: entry.defaultEnabled,
        colSpan: entry.defaultColSpan,
        order: parsedItems.length,
      });
    }
  });

  const normalizedWidgets: HomeWidgetItem[] = parsedItems.map((item, index) => ({
    ...item,
    order: index,
  }));

  const rawUpdatedAt = obj.updatedAt ?? obj.updated_at;
  const updatedAt =
    typeof rawUpdatedAt === 'string' && !Number.isNaN(new Date(rawUpdatedAt).getTime())
      ? rawUpdatedAt
      : new Date().toISOString();

  return {
    version: typeof obj.version === 'number' ? obj.version : 1,
    updatedAt,
    widgets: normalizedWidgets,
  };
}

export function getHomeLayoutStorageKey(discordId?: string | null): string {
  const cleanId = discordId && String(discordId).trim() ? String(discordId).trim() : 'default';
  return `gtfo_home_layout_v1_${cleanId}`;
}

export function loadCachedHomeLayout(discordId?: string | null): HomeLayoutPreferences | null {
  try {
    const raw = localStorage.getItem(getHomeLayoutStorageKey(discordId));
    if (!raw) return null;
    return normalizeHomeLayout(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveCachedHomeLayout(
  discordId: string | null | undefined,
  layout: HomeLayoutPreferences
): void {
  try {
    localStorage.setItem(getHomeLayoutStorageKey(discordId), JSON.stringify(layout));
  } catch {
    // Ignore storage quota errors
  }
}

export async function fetchRemoteHomeLayout(
  baseUrl: string,
  discordId: string,
  token?: string
): Promise<HomeLayoutPreferences | null> {
  if (!discordId) return null;
  const cleanBase = normalizeCompanionBaseUrl(baseUrl);
  const endpoint = `${cleanBase}/member/${encodeURIComponent(discordId)}/preferences`;

  try {
    const res = await sendPortalApiRequest<Record<string, unknown>>(
      endpoint,
      'GET',
      undefined,
      token
    );
    if (!res || typeof res !== 'object') return null;

    const dataObj =
      res.data && typeof res.data === 'object' ? (res.data as Record<string, unknown>) : null;
    const prefsObj =
      res.preferences && typeof res.preferences === 'object'
        ? (res.preferences as Record<string, unknown>)
        : null;

    const candidate =
      res.homeLayout ??
      res.home_layout ??
      dataObj?.homeLayout ??
      dataObj?.home_layout ??
      prefsObj?.homeLayout ??
      prefsObj?.home_layout ??
      res;

    return normalizeHomeLayout(candidate);
  } catch {
    return null;
  }
}

export async function saveRemoteHomeLayout(
  baseUrl: string,
  discordId: string,
  layout: HomeLayoutPreferences,
  token?: string
): Promise<boolean> {
  if (!discordId) return false;
  const cleanBase = normalizeCompanionBaseUrl(baseUrl);
  const endpoint = `${cleanBase}/member/${encodeURIComponent(discordId)}/preferences`;

  try {
    await sendPortalApiRequest<Record<string, unknown>>(
      endpoint,
      'PUT',
      {
        discord_id: discordId,
        home_layout: layout,
      },
      token
    );
    return true;
  } catch {
    return false;
  }
}
