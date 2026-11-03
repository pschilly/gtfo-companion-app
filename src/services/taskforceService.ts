import { GTFO_SQUADRONS, normalizePortalCdnUrl } from '../data/portalData';
import { stripHtml } from '../utils/formatters';
import {
  QualificationCourse,
  SquadronCallsignEntry,
  SquadronDetail,
  TaskForceMember,
} from '../types';

export interface FetchRosterOptions {
  tier?: 'core' | 'community' | 'all';
  search?: string;
  squadron_id?: number | string;
}

export interface FetchRosterResponse {
  members: TaskForceMember[];
  total: number;
  coreCount: number;
  communityCount: number;
}

/**
 * Fallback static squadron catalog if API is unreachable.
 */
function getStaticSquadronFallback(): SquadronDetail[] {
  return Object.values(GTFO_SQUADRONS).map((sq, idx) => ({
    id: idx + 1,
    slug: sq.code.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    code: sq.code,
    abbreviation: sq.code,
    name: sq.name,
    nickname: sq.nickname,
    role: sq.role,
    primaryAirframe: sq.primaryAirframe,
    description: `Official Global Task Force Overlord tactical aviation unit flying the ${sq.primaryAirframe}. Radio callsigns: ${sq.radioCallsign}.`,
    emblemUrl: normalizePortalCdnUrl(sq.emblemUrl, sq.emblemUrl),
    callsigns: sq.radioCallsign
      ? sq.radioCallsign.split(' / ').map((s) => ({
          callsign: s.trim(),
          purpose: sq.role,
          airframe: sq.primaryAirframe,
        }))
      : [],
    frequencies: [
      { name: 'Squadron Tactical', frequency: '251.000', modulation: 'AM' },
      { name: 'Flight Common', frequency: '254.000', modulation: 'AM' },
    ],
    pilotsCount: 12,
    airframes: [
      {
        id: idx + 1,
        name: sq.primaryAirframe,
        abbreviation: sq.code,
      },
    ],
    sortOrder: idx,
  }));
}

/**
 * Fetch all task force squadrons with full specs and CDN emblems.
 */
export const KNOWN_AIRFRAME_NAMES: Record<number | string, string> = {
  1: 'AH-64D Apache',
  2: 'CH-47F Chinook',
  3: 'OH-58D Kiowa Warrior',
  4: 'Ka-50 Blackshark 3',
  5: 'Mi-8MTV2 Magnificent Eight',
  6: 'Mi-24P Hind',
  7: 'SA-342M Gazelle',
  8: 'UH-1H Huey',
  9: 'A-4E Skyhawk',
  10: 'A-10A Thunderbolt',
  11: 'A-10C Thunderbolt II',
  12: 'AJS-37 Viggen',
  13: 'AV-8B Night Attack Harrier',
  14: 'F-4E Phantom II',
  15: 'F-5E Tigershark',
  16: 'F-14B Tomcat',
  17: 'F-15C Eagle',
  18: 'F-15E Strike Eagle',
  19: 'F-16 Viper',
  20: 'F/A-18C Hornet',
  21: 'Mirage 2000C',
  22: 'Mirage F1',
  23: 'JF-17 Thunder',
  24: 'MiG-15bis',
  25: 'MiG-19P Farmer',
  26: 'MiG-21bis',
  27: 'MiG-29A Fulcrum',
  28: 'Su-25T Frogfoot',
  29: 'Su-27 Flanker',
  30: 'Su-27 Flanker B',
  31: 'Su-33 Flanker D',
  32: 'C-130J-30 Hercules',
  35: 'MiG-29 Fulcrum',
  36: 'Su-25T Frogfoot',
  37: 'F-14A-135-GR Tomcat',
  38: 'Airframe Agnostic',
  43: 'F-14B Tomcat',
  45: 'F-100D',
  47: 'F-14A-95-GR Export',
  48: 'F-14B(U) Tomcat',
};

export async function fetchSquadrons(
  portalBaseUrl: string,
  token?: string
): Promise<SquadronDetail[]> {
  const url = `${portalBaseUrl.replace(/\/+$/, '')}/squadrons`;

  try {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(url, { headers, cache: 'no-cache' });
    if (!res.ok) {
      throw new Error(`Failed to fetch squadrons: HTTP ${res.status}`);
    }

    const data = await res.json();
    if (Array.isArray(data.squadrons)) {
      return data.squadrons.map((sq: Record<string, unknown>) => {
        const parsedAirframes = Array.isArray(sq.airframes)
          ? sq.airframes.map((af: Record<string, unknown>) => ({
              id: Number(af.id || 0),
              name: String(af.name || ''),
              abbreviation: String(af.abbreviation || ''),
              dcsEntity: af.dcsEntity ? String(af.dcsEntity) : undefined,
              imageUrl: af.imageUrl ? normalizePortalCdnUrl(af.imageUrl, '') : null,
            }))
          : [];

        // Build lookup map for resolving airframe IDs or abbreviations to full names
        const afLookup = new Map<string, string>();
        parsedAirframes.forEach((af) => {
          if (af.id) afLookup.set(String(af.id), af.name);
          if (af.abbreviation) afLookup.set(af.abbreviation.toLowerCase(), af.name);
          if (af.dcsEntity) afLookup.set(af.dcsEntity.toLowerCase(), af.name);
        });

        const primaryAf = sq.primaryAirframe
          ? String(sq.primaryAirframe)
          : parsedAirframes[0]?.name || null;

        const parsedCallsigns = Array.isArray(sq.callsigns)
          ? sq.callsigns
              .map((item: any) => {
                if (typeof item === 'string') {
                  const str = item.trim();
                  return str ? { callsign: str, purpose: null, airframe: primaryAf } : null;
                }
                if (item && typeof item === 'object') {
                  const csName = String(item.callsign || item.name || '').trim();
                  if (!csName) return null;

                  const rawAf = item.airframe ?? item.plane ?? item.airframe_id;
                  let resolvedPlane: string | null = null;
                  if (rawAf !== undefined && rawAf !== null) {
                    const rawStr = String(rawAf).trim();
                    if (/^\d+$/.test(rawStr)) {
                      const num = Number(rawStr);
                      resolvedPlane =
                        afLookup.get(rawStr) ||
                        KNOWN_AIRFRAME_NAMES[num] ||
                        primaryAf ||
                        null;
                    } else if (rawStr) {
                      resolvedPlane =
                        afLookup.get(rawStr.toLowerCase()) ||
                        (rawStr !== '0' ? rawStr : null) ||
                        primaryAf ||
                        null;
                    }
                  }

                  if (!resolvedPlane && primaryAf) {
                    resolvedPlane = primaryAf;
                  }

                  return {
                    callsign: csName,
                    purpose: item.purpose
                      ? String(item.purpose)
                      : item.tasking
                      ? String(item.tasking)
                      : null,
                    airframe: resolvedPlane,
                  };
                }
                return null;
              })
              .filter((c: any): c is SquadronCallsignEntry => Boolean(c && c.callsign))
          : [];

        return {
          id: Number(sq.id || 0),
          slug: String(sq.slug || ''),
          code: String(sq.code || sq.abbreviation || sq.name || ''),
          abbreviation: String(sq.abbreviation || sq.code || ''),
          name: String(sq.name || ''),
          nickname: sq.nickname ? String(sq.nickname) : null,
          role: String(sq.role || 'Multi-Role Squadron'),
          primaryAirframe: primaryAf,
          description: sq.description ? String(sq.description) : null,
          emblemUrl: normalizePortalCdnUrl(
            sq.emblemUrl || sq.emblem_url || sq.logoUrl || sq.imageUrl,
            'https://cdn.globaltaskforceoverlord.org/GTFO-Logo.png'
          ),
          callsigns: parsedCallsigns,
          frequencies: Array.isArray(sq.frequencies) ? sq.frequencies : [],
          liveries: Array.isArray(sq.liveries) ? sq.liveries.map(String) : [],
          discordRole: sq.discordRole ? String(sq.discordRole) : null,
          pilotsCount: Number(sq.pilotsCount || 0),
          airframes: parsedAirframes,
          sortOrder: Number(sq.sortOrder || 0),
        };
      });
    }
  } catch (err) {
    console.warn('fetchSquadrons error, falling back to static roster:', err);
  }

  return getStaticSquadronFallback();
}

/**
 * Fetch task force members roster from the portal API.
 */
export async function fetchTaskForceRoster(
  portalBaseUrl: string,
  options?: FetchRosterOptions,
  token?: string
): Promise<FetchRosterResponse> {
  const query = new URLSearchParams();
  if (options?.tier && options.tier !== 'all') {
    query.set('tier', options.tier);
  }
  if (options?.search) {
    query.set('search', options.search);
  }
  if (options?.squadron_id) {
    query.set('squadron_id', String(options.squadron_id));
  }

  const queryString = query.toString();
  const url = `${portalBaseUrl.replace(/\/+$/, '')}/roster${queryString ? `?${queryString}` : ''}`;

  try {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(url, { headers, cache: 'no-cache' });
    if (!res.ok) {
      throw new Error(`Failed to fetch task force roster: HTTP ${res.status}`);
    }

    const data = await res.json();
    if (Array.isArray(data.members)) {
      const members: TaskForceMember[] = data.members.map((u: Record<string, unknown>) => {
        const rawAdmin = Array.isArray(u.adminPositions)
          ? u.adminPositions
          : Array.isArray(u.admin_positions)
          ? u.admin_positions
          : [];
        const adminPositions = rawAdmin.map((p) => String(p || '')).filter(Boolean);

        return {
          id: Number(u.id || 0),
          name: String(u.name || u.callsign || 'Aviator'),
          callsign: String(u.callsign || u.name || 'Aviator'),
          discordId: u.discordId ? String(u.discordId) : null,
          group: String(u.group || (u.isCore ? 'CORE' : 'Community')),
          tier: String(u.tier || (u.isCore ? 'CORE' : 'Community')),
          isCore: Boolean(u.isCore),
          status: String(u.status || 'Active'),
          avatar: u.avatar ? normalizePortalCdnUrl(u.avatar, '') : null,
          grade: String(u.grade || 'G0'),
          gradeName: String(u.gradeName || 'Grade 0'),
          rank: String(u.rank || u.gradeName || 'Grade 0'),
          insigniaUrl: u.insigniaUrl ? normalizePortalCdnUrl(u.insigniaUrl, '') : null,
          squadron: u.squadron ? String(u.squadron) : null,
          squadronAbbreviation: u.squadronAbbreviation ? String(u.squadronAbbreviation) : null,
          squadronEmblemUrl: u.squadronEmblemUrl ? normalizePortalCdnUrl(u.squadronEmblemUrl, '') : null,
          position: u.position ? String(u.position) : 'Aviator',
          flightIdentifier: u.flightIdentifier ? String(u.flightIdentifier) : null,
          primaryAirframe: u.primaryAirframe ? String(u.primaryAirframe) : null,
          primaryAirframeAbbreviation: u.primaryAirframeAbbreviation
            ? String(u.primaryAirframeAbbreviation)
            : null,
          adminPositions,
          primaryAdminPosition: u.primaryAdminPosition
            ? String(u.primaryAdminPosition)
            : adminPositions[0] || null,
          isCouncil: Boolean(u.isCouncil || u.isCouncilMember || u.is_council || u.is_council_member),
          isCouncilMember: Boolean(u.isCouncil || u.isCouncilMember || u.is_council || u.is_council_member),
          isLeadership: Boolean(u.isLeadership || u.isSquadronLeader || u.is_leadership || u.is_squadron_leader),
          isSquadronLeader: Boolean(u.isLeadership || u.isSquadronLeader || u.is_leadership || u.is_squadron_leader),
          isSpecialist: Boolean(u.isSpecialist || u.is_specialist),
          ribbons: Array.isArray(u.ribbons)
            ? u.ribbons.map((r: any) => ({
                id: Number(r.id || 0),
                name: String(r.name || 'Award'),
                description: r.description ? stripHtml(String(r.description)) : null,
                ribbonUrl: normalizePortalCdnUrl(r.ribbonUrl || r.ribbon_url, ''),
                medalUrl: r.medalUrl || r.medal_url ? normalizePortalCdnUrl(r.medalUrl || r.medal_url, '') : null,
                issueCount: Number(r.issueCount || r.issue_count || 1),
                numeralUrl: r.numeralUrl || r.numeral_url ? normalizePortalCdnUrl(r.numeralUrl || r.numeral_url, '') : null,
              }))
            : [],
          ribbonRackUrl: u.ribbonRackUrl || u.ribbon_rack_url ? normalizePortalCdnUrl(String(u.ribbonRackUrl || u.ribbon_rack_url), '') : null,
          xp: Number(u.xp || 0),
          enlistedAt: u.enlistedAt ? String(u.enlistedAt) : null,
          certificatesCount: Number(u.certificatesCount || 0),
          awardsCount: Number(u.awardsCount || 0),
        };
      });

      return {
        members,
        total: Number(data.total || members.length),
        coreCount: Number(data.coreCount || members.filter((m) => m.isCore).length),
        communityCount: Number(data.communityCount || members.filter((m) => !m.isCore).length),
      };
    }
  } catch (err) {
    console.warn('fetchTaskForceRoster error:', err);
  }

  return {
    members: [],
    total: 0,
    coreCount: 0,
    communityCount: 0,
  };
}

/**
 * Fetch full qualifications catalog with hops and benchmarks for the LMS zone.
 */
export async function fetchQualificationsCatalog(
  portalBaseUrl: string,
  token?: string
): Promise<QualificationCourse[]> {
  const url = `${portalBaseUrl.replace(/\/+$/, '')}/qualifications`;

  try {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(url, { headers, cache: 'no-cache' });
    if (!res.ok) {
      throw new Error(`Failed to fetch qualifications catalog: HTTP ${res.status}`);
    }

    const data = await res.json();
    if (Array.isArray(data.qualifications)) {
      return data.qualifications.map((q: Record<string, unknown>) => ({
        id: Number(q.id || 0),
        code: String(q.code || ''),
        name: String(q.name || ''),
        slug: String(q.slug || ''),
        category: String(q.category || 'General Qualification'),
        description: q.description ? String(q.description) : null,
        airframe: q.airframe ? String(q.airframe) : null,
        airframeAbbreviation: q.airframeAbbreviation ? String(q.airframeAbbreviation) : null,
        airframes: Array.isArray(q.airframes) ? q.airframes.map(String) : [],
        awardedRole: q.awardedRole ? String(q.awardedRole) : null,
        xpValue: Number(q.xpValue || q.xp_value || 0),
        requirements: Array.isArray(q.requirements)
          ? q.requirements.map((r: Record<string, unknown>) => ({
              skill: String(r.skill || 'Requirement'),
              benchmarks: String(r.benchmarks || ''),
            }))
          : [],
        totalHops: Number(q.totalHops || 0),
        sortOrder: Number(q.sortOrder || 0),
      }));
    }
  } catch (err) {
    console.warn('fetchQualificationsCatalog error:', err);
  }

  return [];
}

