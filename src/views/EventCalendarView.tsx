import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AirplaneTilt,
  ArrowClockwise,
  ArrowSquareOut,
  CalendarBlank,
  CaretLeft,
  CaretRight,
  CheckCircle,
  Clock,
  Crosshair,
  DiscordLogo,
  Funnel,
  GlobeHemisphereWest,
  GraduationCap,
  Info,
  ListBullets,
  Lock,
  MapPin,
  Note,
  ShieldCheck,
  ShieldWarning,
  SquaresFour,
  Sword,
  Trash,
  UserCheck,
  Users,
  WarningCircle,
  X,
} from '@phosphor-icons/react';
import { useApp } from '../context/AppContext';
import {
  fetchCalendarEvents,
  submitCalendarEventRsvp,
} from '../services/calendarService';
import { openExternalUrl } from '../services/tauriBridge';
import {
  CalendarAuthorizedCallsignOption,
  CalendarEventAttendee,
  CalendarEventItem,
  CalendarRsvpAirframeOption,
  CalendarRsvpOptions,
} from '../types';

type EventFilterType = 'all' | 'campaign' | 'training' | 'attending';
type ViewLayoutMode = 'grid' | 'agenda';

interface CalendarDayCell {
  dateKey: string;
  date: Date;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: CalendarEventItem[];
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function toLocalDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatLocalTime(iso: string | null | undefined): string {
  if (!iso) return 'TBD';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'TBD';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function formatZuluTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}Z`;
}

function formatFullDateTime(iso: string | null | undefined): string {
  if (!iso) return 'Not set';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Not set';
  return d.toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getRoleBadgeStyle(role: string): string {
  switch (role) {
    case 'instructor':
      return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    case 'student':
      return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    case 'crew':
      return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
    case 'pilot':
    default:
      return 'bg-sky-500/20 text-sky-300 border-sky-500/40';
  }
}

/**
 * Fallback authorized callsigns by airframe / squadron matching the Member Portal squadrons table.
 */
function getFallbackAuthorizedCallsigns(
  airframeName?: string | null,
  airframeAbbr?: string | null,
  squadronName?: string | null,
  isOpfor = false
): CalendarAuthorizedCallsignOption[] {
  const afText = `${airframeName || ''} ${airframeAbbr || ''}`.toLowerCase();
  const sqText = (squadronName || '').toLowerCase();

  const s507All: CalendarAuthorizedCallsignOption[] = [
    { callsign: 'Dagger', purpose: 'F-16 Viper', is_primary_for_airframe: false },
    { callsign: 'Hammer', purpose: 'JF-17 Thunder', is_primary_for_airframe: false },
    { callsign: 'Mace', purpose: 'Mirage F1', is_primary_for_airframe: false },
    { callsign: 'Spear', purpose: 'MiG-29 Fulcrum', is_primary_for_airframe: false },
    { callsign: 'Arrow', purpose: 'MiG-21bis', is_primary_for_airframe: false },
    { callsign: 'Axe', purpose: 'F-100D', is_primary_for_airframe: false },
  ];

  const s19All: CalendarAuthorizedCallsignOption[] = [
    { callsign: 'Shake', purpose: 'Logistics (CH-47F)', is_primary_for_airframe: false },
    { callsign: 'Bake', purpose: 'Attack (AH-64D)', is_primary_for_airframe: false },
    { callsign: 'Hawg', purpose: 'Attack (A-10C)', is_primary_for_airframe: false },
    { callsign: 'Wonder', purpose: 'Logistics (C-130J)', is_primary_for_airframe: false },
    { callsign: 'El Diablo', purpose: 'Recon (OH-58D)', is_primary_for_airframe: false },
  ];

  const prioritize = (
    primaryCallsign: string,
    pool: CalendarAuthorizedCallsignOption[]
  ): CalendarAuthorizedCallsignOption[] => {
    const primary = pool
      .filter((c) => c.callsign.toLowerCase() === primaryCallsign.toLowerCase())
      .map((c) => ({ ...c, is_primary_for_airframe: true }));
    const rest = pool
      .filter((c) => c.callsign.toLowerCase() !== primaryCallsign.toLowerCase())
      .map((c) => ({ ...c, is_primary_for_airframe: false }));
    return [...primary, ...rest];
  };

  let list: CalendarAuthorizedCallsignOption[] = [];

  if (afText.includes('f-16') || afText.includes('f16') || afText.includes('viper')) {
    list = prioritize('Dagger', s507All);
  } else if (afText.includes('jf-17') || afText.includes('jf17') || afText.includes('thunder')) {
    list = prioritize('Hammer', s507All);
  } else if (afText.includes('mirage') || afText.includes('f1')) {
    list = prioritize('Mace', s507All);
  } else if (afText.includes('mig-29') || afText.includes('mig29') || afText.includes('fulcrum')) {
    list = prioritize('Spear', s507All);
  } else if (afText.includes('mig-21') || afText.includes('mig21')) {
    list = prioritize('Arrow', s507All);
  } else if (afText.includes('f-100') || afText.includes('f100')) {
    list = prioritize('Axe', s507All);
  } else if (
    afText.includes('f/a-18') ||
    afText.includes('fa18') ||
    afText.includes('hornet') ||
    afText.includes('viggen') ||
    afText.includes('f-4') ||
    afText.includes('f4e') ||
    sqText.includes('449')
  ) {
    list = [{ callsign: 'Logan', purpose: 'All', is_primary_for_airframe: true }];
  } else if (
    afText.includes('f-14') ||
    afText.includes('f14') ||
    afText.includes('tomcat') ||
    sqText.includes('141')
  ) {
    list = [
      { callsign: 'Camelot', purpose: 'A2A', is_primary_for_airframe: true },
      { callsign: 'Gypsy', purpose: 'A2A', is_primary_for_airframe: false },
      { callsign: 'Black Knight', purpose: 'A2G', is_primary_for_airframe: false },
    ];
  } else if (afText.includes('ch-47') || afText.includes('ch47') || afText.includes('chinook')) {
    list = prioritize('Shake', s19All);
  } else if (afText.includes('ah-64') || afText.includes('ah64') || afText.includes('apache')) {
    list = prioritize('Bake', s19All);
  } else if (afText.includes('a-10') || afText.includes('a10') || afText.includes('thunderbolt')) {
    list = prioritize('Hawg', s19All);
  } else if (afText.includes('c-130') || afText.includes('c130') || afText.includes('hercules')) {
    list = prioritize('Wonder', s19All);
  } else if (afText.includes('oh-58') || afText.includes('oh58') || afText.includes('kiowa')) {
    list = prioritize('El Diablo', s19All);
  } else if (
    sqText.includes('19') ||
    afText.includes('uh-1') ||
    afText.includes('huey') ||
    afText.includes('mi-8') ||
    afText.includes('mi-24') ||
    afText.includes('ka-50') ||
    afText.includes('gazelle')
  ) {
    list = prioritize('Shake', s19All);
  } else if (sqText.includes('507')) {
    list = prioritize('Dagger', s507All);
  } else if (sqText.includes('777')) {
    list = [
      { callsign: 'Red Air', purpose: 'Aggressor', is_primary_for_airframe: true },
      { callsign: 'Bandit', purpose: 'Aggressor', is_primary_for_airframe: false },
    ];
  } else {
    list = [{ callsign: 'Overlord', purpose: 'Taskforce', is_primary_for_airframe: true }];
  }

  if (isOpfor) {
    const opforOpts: CalendarAuthorizedCallsignOption[] = [
      { callsign: 'Red Air', purpose: 'OPFOR Adversary', is_primary_for_airframe: true },
      { callsign: 'Bandit', purpose: 'OPFOR Adversary', is_primary_for_airframe: false },
    ];
    const seen = new Set(opforOpts.map((o) => o.callsign.toLowerCase()));
    const merged = [...opforOpts];
    list.forEach((item) => {
      if (!seen.has(item.callsign.toLowerCase())) {
        seen.add(item.callsign.toLowerCase());
        merged.push({ ...item, is_primary_for_airframe: false });
      }
    });
    return merged;
  }

  return list;
}

function getAuthorizedCallsignsForOption(
  af: CalendarRsvpAirframeOption | undefined,
  isOpfor = false
): CalendarAuthorizedCallsignOption[] {
  if (af?.authorized_callsigns && af.authorized_callsigns.length > 0 && !isOpfor) {
    return af.authorized_callsigns;
  }
  const fallback = getFallbackAuthorizedCallsigns(
    af?.name,
    af?.abbreviation,
    af?.squadron_name,
    isOpfor
  );
  if (af?.authorized_callsigns && af.authorized_callsigns.length > 0 && isOpfor) {
    const seen = new Set<string>();
    const combined: CalendarAuthorizedCallsignOption[] = [];
    [...fallback, ...af.authorized_callsigns].forEach((c) => {
      const key = c.callsign.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        combined.push(c);
      }
    });
    return combined;
  }
  return fallback;
}

/**
 * Resolve display callsigns for all attendees on a sortie (preserving explicit flight_callsign
 * and assigning 1-1..1-4, 2-1..2-4 in order for any attendee without an explicit flight_callsign).
 */
function resolveAttendeeCallsignMap(
  attendees: CalendarEventAttendee[]
): Map<number, string> {
  const result = new Map<number, string>();
  const takenByBase = new Map<string, Set<string>>();

  const markTaken = (base: string, slot: string) => {
    const key = base.toLowerCase();
    let set = takenByBase.get(key);
    if (!set) {
      set = new Set<string>();
      takenByBase.set(key, set);
    }
    set.add(slot);
  };

  const isTaken = (base: string, slot: string): boolean => {
    return takenByBase.get(base.toLowerCase())?.has(slot) ?? false;
  };

  // Pass 1: Explicit flight_callsign
  attendees.forEach((att, idx) => {
    const keyId = att.id || idx + 1;
    const explicit = (att.flight_callsign || '').trim();
    if (explicit) {
      result.set(keyId, explicit);
      const match = explicit.match(/^(.+?)\s+(\d+)\s*-\s*(\d+)$/);
      if (match) {
        markTaken(match[1].trim(), `${Number(match[2])}-${Number(match[3])}`);
      }
    }
  });

  // Pass 2: Auto-assign sequential 1-1..1-4, 2-1..2-4 for any record missing flight_callsign
  attendees.forEach((att, idx) => {
    const keyId = att.id || idx + 1;
    if (result.has(keyId)) return;

    const opts = getFallbackAuthorizedCallsigns(
      att.airframe_name,
      att.airframe_abbreviation,
      att.squadron_name,
      att.is_opfor
    );
    const base = opts[0]?.callsign || 'Overlord';

    for (let f = 1; f <= 50; f++) {
      for (let p = 1; p <= 4; p++) {
        const slot = `${f}-${p}`;
        if (!isTaken(base, slot)) {
          markTaken(base, slot);
          result.set(keyId, `${base} ${slot}`);
          return;
        }
      }
    }
  });

  return result;
}

/**
 * Get the set of taken "flight-pos" slots (e.g. "1-1", "1-2") for a given base callsign on a sortie,
 * excluding the current user.
 */
function getTakenSlotsForBaseCallsign(
  baseCallsign: string,
  attendees: CalendarEventAttendee[],
  excludeDiscordId?: string | null
): Map<string, string> {
  const taken = new Map<string, string>(); // slot ("1-1") -> pilot name ("Cookie")
  const cleanBase = baseCallsign.replace(/\s+\d+\s*-\s*\d+$/, '').trim();
  if (!cleanBase) return taken;

  const resolvedMap = resolveAttendeeCallsignMap(attendees);

  attendees.forEach((att, idx) => {
    if (
      excludeDiscordId &&
      att.discord_id &&
      String(att.discord_id) === String(excludeDiscordId)
    ) {
      return;
    }

    const keyId = att.id || idx + 1;
    const effectiveCs = (att.flight_callsign || resolvedMap.get(keyId) || '').trim();
    if (!effectiveCs) return;

    const match = effectiveCs.match(/^(.+?)\s+(\d+)\s*-\s*(\d+)$/);
    if (match && match[1].trim().toLowerCase() === cleanBase.toLowerCase()) {
      const slot = `${Number(match[2])}-${Number(match[3])}`;
      taken.set(slot, att.callsign);
    }
  });

  return taken;
}

/**
 * Compute the next available callsign (e.g. "Dagger 1-1", "Dagger 1-2" ... "Dagger 1-4", "Dagger 2-1")
 * for a given base callsign among existing sortie attendees.
 */
function computeNextAvailableCallsign(
  baseCallsign: string,
  attendees: CalendarEventAttendee[],
  excludeDiscordId?: string | null
): string {
  const cleanBase = baseCallsign.replace(/\s+\d+\s*-\s*\d+$/, '').trim() || 'Overlord';
  const taken = getTakenSlotsForBaseCallsign(cleanBase, attendees, excludeDiscordId);

  for (let flight = 1; flight <= 50; flight++) {
    for (let pos = 1; pos <= 4; pos++) {
      const slot = `${flight}-${pos}`;
      if (!taken.has(slot)) {
        return `${cleanBase} ${slot}`;
      }
    }
  }

  return `${cleanBase} 1-1`;
}

export const EventCalendarView: React.FC = () => {
  const { userSession, memberProfile, settings, addLog } = useApp();

  const now = useMemo(() => new Date(), []);
  const [currentYear, setCurrentYear] = useState<number>(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(now.getMonth() + 1); // 1-12
  const [filterType, setFilterType] = useState<EventFilterType>('all');
  const [layoutMode, setLayoutMode] = useState<ViewLayoutMode>('grid');

  const [events, setEvents] = useState<CalendarEventItem[]>([]);
  const [rsvpOptions, setRsvpOptions] = useState<CalendarRsvpOptions>({
    campaign_airframes: [],
    training_airframes: [],
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Selected event modal state
  const [selectedEventUid, setSelectedEventUid] = useState<string | null>(null);

  // RSVP Form state inside modal
  const [rsvpAirframeId, setRsvpAirframeId] = useState<number | ''>('');
  const [rsvpRole, setRsvpRole] = useState<string>('pilot');
  const [rsvpSide, setRsvpSide] = useState<'blufor' | 'opfor'>('blufor');
  const [rsvpCallsign, setRsvpCallsign] = useState<string>('');
  const [rsvpNotes, setRsvpNotes] = useState<string>('');
  const [isSubmittingRsvp, setIsSubmittingRsvp] = useState<boolean>(false);
  const [rsvpFeedback, setRsvpFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const loadCalendar = useCallback(
    async (year?: number, month?: number, silent = false) => {
      if (!silent) {
        setIsLoading(true);
      }
      setErrorMessage(null);

      try {
        const res = await fetchCalendarEvents(
          settings.memberPortalApiUrl,
          {
            year,
            month,
            type: 'all',
            discord_id: userSession?.id,
          },
          userSession?.accessToken
        );

        if (res.year && res.month) {
          setCurrentYear(res.year);
          setCurrentMonth(res.month);
        }

        setEvents(res.events || []);
        if (res.rsvp_options) {
          setRsvpOptions(res.rsvp_options);
        }
      } catch (err: any) {
        const msg = err?.message || 'Unable to load Event Calendar from Member Portal.';
        setErrorMessage(msg);
        addLog('error', 'PORTAL', `[Calendar] ${msg}`);
      } finally {
        setIsLoading(false);
      }
    },
    [settings.memberPortalApiUrl, userSession?.id, userSession?.accessToken, addLog]
  );

  const [hasInitialized, setHasInitialized] = useState(false);

  useEffect(() => {
    if (!hasInitialized) {
      setHasInitialized(true);
      loadCalendar(undefined, undefined);
    } else {
      loadCalendar(currentYear, currentMonth);
    }
  }, [currentYear, currentMonth, hasInitialized, loadCalendar]);

  const selectedEvent = useMemo(() => {
    if (!selectedEventUid) return null;
    return events.find((e) => e.uid === selectedEventUid) || null;
  }, [events, selectedEventUid]);

  // Available airframes for the currently selected event
  const availableAirframesForSelectedEvent = useMemo<CalendarRsvpAirframeOption[]>(() => {
    if (!selectedEvent) return [];
    const list =
      selectedEvent.type === 'campaign'
        ? rsvpOptions.campaign_airframes
        : rsvpOptions.training_airframes;

    if (list && list.length > 0) {
      return list;
    }

    // Fallback to memberProfile qualified airframes if API options aren't populated
    return (memberProfile.qualifiedAirframes || [])
      .filter((af) => typeof af.id === 'number')
      .map((af) => ({
        id: af.id as number,
        name: af.name,
        abbreviation: af.abbreviation || af.name,
        is_primary: Boolean(af.isPrimary),
        status: af.status || 'qualified',
        allowed_roles:
          selectedEvent.type === 'training'
            ? [
                { value: 'pilot', label: 'Pilot' },
                { value: 'student', label: 'Student / Trainee' },
              ]
            : [{ value: 'pilot', label: 'Pilot' }],
      }));
  }, [selectedEvent, rsvpOptions, memberProfile.qualifiedAirframes]);

  // Available roles for the currently selected airframe
  const availableRolesForSelectedAirframe = useMemo(() => {
    if (!selectedEvent) return [{ value: 'pilot', label: 'Pilot' }];
    const found = availableAirframesForSelectedEvent.find(
      (a) => a.id === Number(rsvpAirframeId)
    );
    if (found && found.allowed_roles && found.allowed_roles.length > 0) {
      return found.allowed_roles;
    }
    return [{ value: 'pilot', label: 'Pilot' }];
  }, [selectedEvent, availableAirframesForSelectedEvent, rsvpAirframeId]);

  // Authorized callsigns for the currently selected airframe & side
  const authorizedCallsignsForSelectedAirframe = useMemo<
    CalendarAuthorizedCallsignOption[]
  >(() => {
    if (!selectedEvent) return [];
    const found = availableAirframesForSelectedEvent.find(
      (a) => a.id === Number(rsvpAirframeId)
    );
    const isOpfor =
      selectedEvent.type === 'campaign' && rsvpSide === 'opfor';
    return getAuthorizedCallsignsForOption(found, isOpfor);
  }, [selectedEvent, availableAirframesForSelectedEvent, rsvpAirframeId, rsvpSide]);

  // Resolved callsigns map for all attendees on the selected event
  const resolvedAttendeeCallsigns = useMemo(() => {
    if (!selectedEvent) return new Map<number, string>();
    return resolveAttendeeCallsignMap(selectedEvent.attendees || []);
  }, [selectedEvent]);

  // Parse current rsvpCallsign into prefix + flight + pos
  const parsedRsvpCallsign = useMemo(() => {
    const trimmed = rsvpCallsign.trim();
    const match = trimmed.match(/^(.+?)\s+(\d+)\s*-\s*(\d+)$/);
    if (match) {
      return {
        prefix: match[1].trim(),
        flight: Math.max(1, Math.min(9, Number(match[2]) || 1)),
        pos: Math.max(1, Math.min(4, Number(match[3]) || 1)),
      };
    }
    const defaultPrefix =
      authorizedCallsignsForSelectedAirframe[0]?.callsign ||
      trimmed ||
      'Overlord';
    return {
      prefix: defaultPrefix,
      flight: 1,
      pos: 1,
    };
  }, [rsvpCallsign, authorizedCallsignsForSelectedAirframe]);

  // Taken slots for the currently selected callsign prefix (excluding current user)
  const takenSlotsForCurrentPrefix = useMemo(() => {
    if (!selectedEvent) return new Map<string, string>();
    return getTakenSlotsForBaseCallsign(
      parsedRsvpCallsign.prefix,
      selectedEvent.attendees || [],
      userSession?.id
    );
  }, [selectedEvent, parsedRsvpCallsign.prefix, userSession?.id]);

  // Initialize RSVP form state whenever selectedEvent changes
  useEffect(() => {
    if (!selectedEvent) {
      setRsvpFeedback(null);
      return;
    }

    setRsvpFeedback(null);

    if (selectedEvent.my_rsvp) {
      const existingAfId = selectedEvent.my_rsvp.airframe_id;
      setRsvpAirframeId(existingAfId ?? '');
      setRsvpRole(selectedEvent.my_rsvp.role || 'pilot');
      const isOpfor = Boolean(selectedEvent.my_rsvp.is_opfor);
      setRsvpSide(isOpfor ? 'opfor' : 'blufor');
      setRsvpNotes(selectedEvent.my_rsvp.notes || '');

      const savedCallsign =
        selectedEvent.my_rsvp.flight_callsign ||
        selectedEvent.my_rsvp.callsign ||
        resolvedAttendeeCallsigns.get(selectedEvent.my_rsvp.id);

      if (savedCallsign) {
        setRsvpCallsign(savedCallsign);
      } else {
        const afOpt = availableAirframesForSelectedEvent.find(
          (a) => a.id === Number(existingAfId)
        );
        const authList = getAuthorizedCallsignsForOption(afOpt, isOpfor);
        const base = authList[0]?.callsign || 'Overlord';
        setRsvpCallsign(
          computeNextAvailableCallsign(
            base,
            selectedEvent.attendees || [],
            userSession?.id
          )
        );
      }
    } else {
      const primaryAf =
        availableAirframesForSelectedEvent.find((a) => a.is_primary) ||
        availableAirframesForSelectedEvent[0];
      const defaultAfId = primaryAf ? primaryAf.id : '';
      setRsvpAirframeId(defaultAfId);

      const defaultRole =
        primaryAf?.allowed_roles?.[0]?.value || 'pilot';
      setRsvpRole(defaultRole);
      setRsvpSide('blufor');
      setRsvpNotes('');

      const authList = getAuthorizedCallsignsForOption(primaryAf, false);
      const base = authList[0]?.callsign || 'Overlord';
      setRsvpCallsign(
        computeNextAvailableCallsign(
          base,
          selectedEvent.attendees || [],
          userSession?.id
        )
      );
    }
  }, [
    selectedEvent?.uid,
    selectedEvent?.is_attending,
    availableAirframesForSelectedEvent,
    resolvedAttendeeCallsigns,
    userSession?.id,
  ]);

  const handleAirframeChange = (newAirframeId: number | '') => {
    setRsvpAirframeId(newAirframeId);
    const af = availableAirframesForSelectedEvent.find(
      (a) => a.id === Number(newAirframeId)
    );
    if (af && af.allowed_roles.length > 0) {
      const stillValid = af.allowed_roles.some((r) => r.value === rsvpRole);
      if (!stillValid) {
        setRsvpRole(af.allowed_roles[0].value);
      }
    }
    if (selectedEvent && af) {
      const isOpfor =
        selectedEvent.type === 'campaign' && rsvpSide === 'opfor';
      const authList = getAuthorizedCallsignsForOption(af, isOpfor);
      const base = authList[0]?.callsign || 'Overlord';
      setRsvpCallsign(
        computeNextAvailableCallsign(
          base,
          selectedEvent.attendees || [],
          userSession?.id
        )
      );
    }
  };

  const handleSideChange = (newSide: 'blufor' | 'opfor') => {
    setRsvpSide(newSide);
    if (selectedEvent) {
      const af = availableAirframesForSelectedEvent.find(
        (a) => a.id === Number(rsvpAirframeId)
      );
      const authList = getAuthorizedCallsignsForOption(af, newSide === 'opfor');
      const base = authList[0]?.callsign || 'Overlord';
      setRsvpCallsign(
        computeNextAvailableCallsign(
          base,
          selectedEvent.attendees || [],
          userSession?.id
        )
      );
    }
  };

  const handleCallsignPrefixChange = (newPrefix: string) => {
    if (!selectedEvent) return;
    setRsvpCallsign(
      computeNextAvailableCallsign(
        newPrefix,
        selectedEvent.attendees || [],
        userSession?.id
      )
    );
  };

  const handleCallsignNumberChange = (newFlight: number, newPos: number) => {
    const prefix = parsedRsvpCallsign.prefix || 'Overlord';
    setRsvpCallsign(`${prefix} ${newFlight}-${newPos}`);
  };

  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentYear((y) => y - 1);
      setCurrentMonth(12);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentYear((y) => y + 1);
      setCurrentMonth(1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth() + 1);
  };

  // Filtered events
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      if (filterType === 'campaign') return ev.type === 'campaign';
      if (filterType === 'training') return ev.type === 'training';
      if (filterType === 'attending') return ev.is_attending;
      return true;
    });
  }, [events, filterType]);

  // Build 7-day calendar grid cells (Sunday to Saturday)
  const calendarWeeks = useMemo<CalendarDayCell[][]>(() => {
    const firstOfMonth = new Date(currentYear, currentMonth - 1, 1);
    const lastOfMonth = new Date(currentYear, currentMonth, 0);

    // Start on Sunday on or before firstOfMonth
    const gridStart = new Date(firstOfMonth);
    gridStart.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());

    // End on Saturday on or after lastOfMonth
    const gridEnd = new Date(lastOfMonth);
    gridEnd.setDate(lastOfMonth.getDate() + (6 - lastOfMonth.getDay()));

    const eventsByDateKey = new Map<string, CalendarEventItem[]>();
    filteredEvents.forEach((ev) => {
      const d = ev.scheduled_at ? new Date(ev.scheduled_at) : null;
      const key =
        d && !Number.isNaN(d.getTime())
          ? toLocalDateKey(d)
          : '';
      if (!key) return;
      const list = eventsByDateKey.get(key) || [];
      list.push(ev);
      eventsByDateKey.set(key, list);
    });

    const todayKey = toLocalDateKey(new Date());
    const weeks: CalendarDayCell[][] = [];
    let currentWeek: CalendarDayCell[] = [];

    const cursor = new Date(gridStart);
    while (cursor <= gridEnd) {
      const dateKey = toLocalDateKey(cursor);
      const dayEvents = (eventsByDateKey.get(dateKey) || []).sort((a, b) => {
        const tA = a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0;
        const tB = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0;
        return tA - tB;
      });

      currentWeek.push({
        dateKey,
        date: new Date(cursor),
        dayNumber: cursor.getDate(),
        isCurrentMonth: cursor.getMonth() === currentMonth - 1,
        isToday: dateKey === todayKey,
        events: dayEvents,
      });

      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }

      cursor.setDate(cursor.getDate() + 1);
    }

    return weeks;
  }, [currentYear, currentMonth, filteredEvents]);

  // Stats counters for current view
  const stats = useMemo(() => {
    const campaignCount = events.filter((e) => e.type === 'campaign').length;
    const trainingCount = events.filter((e) => e.type === 'training').length;
    const attendingCount = events.filter((e) => e.is_attending).length;
    return {
      total: events.length,
      campaignCount,
      trainingCount,
      attendingCount,
    };
  }, [events]);

  // Upcoming events from today onwards
  const upcomingEvents = useMemo(() => {
    const nowMs = Date.now() - 2 * 60 * 60 * 1000;
    return filteredEvents
      .filter((e) => {
        if (!e.scheduled_at) return false;
        return new Date(e.scheduled_at).getTime() >= nowMs && !e.is_concluded;
      })
      .sort((a, b) => {
        const tA = a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0;
        const tB = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0;
        return tA - tB;
      });
  }, [filteredEvents]);

  const handleSubmitRsvp = async (action: 'attend' | 'cancel') => {
    if (!selectedEvent) return;

    if (action === 'attend' && !rsvpAirframeId) {
      setRsvpFeedback({
        type: 'error',
        message: 'Please select a qualified aircraft before confirming your RSVP.',
      });
      return;
    }

    setIsSubmittingRsvp(true);
    setRsvpFeedback(null);

    try {
      const submittedCallsign =
        action === 'attend' ? rsvpCallsign.trim() || null : null;

      const response = await submitCalendarEventRsvp(
        settings.memberPortalApiUrl,
        selectedEvent.type,
        selectedEvent.id,
        {
          discord_id: userSession?.id || '',
          action,
          airframe_id: action === 'attend' ? Number(rsvpAirframeId) : null,
          role: action === 'attend' ? rsvpRole : undefined,
          is_opfor:
            action === 'attend' && selectedEvent.type === 'campaign'
              ? rsvpSide === 'opfor'
              : false,
          callsign: submittedCallsign,
          notes:
            action === 'attend' && selectedEvent.type === 'training'
              ? rsvpNotes.trim() || null
              : null,
        },
        userSession?.accessToken
      );

      const updatedEvent = response.event;
      if (updatedEvent) {
        if (action === 'attend' && submittedCallsign) {
          if (updatedEvent.my_rsvp && !updatedEvent.my_rsvp.flight_callsign) {
            updatedEvent.my_rsvp.flight_callsign = submittedCallsign;
            updatedEvent.my_rsvp.callsign = submittedCallsign;
          }
          updatedEvent.attendees = (updatedEvent.attendees || []).map((att) => {
            if (
              (userSession?.id &&
                att.discord_id &&
                String(att.discord_id) === String(userSession.id)) ||
              (updatedEvent.my_rsvp && att.id === updatedEvent.my_rsvp.id)
            ) {
              return {
                ...att,
                flight_callsign: att.flight_callsign || submittedCallsign,
              };
            }
            return att;
          });
        }

        setEvents((prev) =>
          prev.map((item) =>
            item.uid === updatedEvent.uid ? updatedEvent : item
          )
        );
      }

      setRsvpFeedback({
        type: 'success',
        message:
          response.message ||
          (action === 'cancel' ? 'RSVP cancelled.' : 'RSVP saved.'),
      });

      addLog(
        'success',
        'PORTAL',
        `[Calendar] ${response.message || 'Updated sortie RSVP.'}`
      );
    } catch (err: any) {
      const msg = err?.message || 'Failed to update RSVP.';
      setRsvpFeedback({
        type: 'error',
        message: msg,
      });
      addLog('error', 'PORTAL', `[Calendar] RSVP error: ${msg}`);
    } finally {
      setIsSubmittingRsvp(false);
    }
  };

  // Group attendees for modal roster display
  const groupedAttendees = useMemo(() => {
    if (!selectedEvent) return { bluforBySquadron: {}, opfor: [] as CalendarEventAttendee[] };

    const bluforBySquadron: Record<string, CalendarEventAttendee[]> = {};
    const opfor: CalendarEventAttendee[] = [];

    (selectedEvent.attendees || []).forEach((att) => {
      if (att.is_opfor) {
        opfor.push(att);
      } else {
        const sq = att.squadron_name || 'Unassigned / Attached';
        if (!bluforBySquadron[sq]) {
          bluforBySquadron[sq] = [];
        }
        bluforBySquadron[sq].push(att);
      }
    });

    return { bluforBySquadron, opfor };
  }, [selectedEvent]);

  return (
    <div className="space-y-6 pb-10 max-w-7xl mx-auto">
      {/* TOP HEADER BANNER */}
      <div className="relative rounded-3xl overflow-hidden border border-stone-800 bg-stone-900/90 shadow-2xl p-6 sm:p-7">
        <div className="absolute -top-28 -left-24 w-96 h-96 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-28 -right-24 w-96 h-96 rounded-full bg-sky-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-[10px] font-bold uppercase tracking-wider">
                <CalendarBlank className="w-3.5 h-3.5 text-amber-400" />
                <span>Operations &amp; Training</span>
              </span>
              {stats.attendingCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono text-[10px] font-bold uppercase tracking-wider">
                  <CheckCircle weight="fill" className="w-3 h-3 text-emerald-400" />
                  <span>{stats.attendingCount} Active RSVP{stats.attendingCount === 1 ? '' : 's'}</span>
                </span>
              )}
            </div>

            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-stone-100 tracking-tight">
              Taskforce Event Calendar
            </h1>
            <p className="text-xs sm:text-sm text-stone-400 leading-relaxed">
              Unified schedule for official Campaign Operations and Training Sorties. Click any sortie to inspect the flight roster, briefing notes, and submit or update your aircraft RSVP.
            </p>
          </div>

          {/* Summary Stat Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
            <div className="px-3.5 py-2.5 rounded-2xl bg-stone-950/80 border border-stone-800/90 text-center">
              <p className="text-[10px] font-mono uppercase text-stone-400">Total Window</p>
              <p className="text-lg font-display font-bold text-stone-100 mt-0.5">{stats.total}</p>
            </div>
            <div className="px-3.5 py-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-center">
              <p className="text-[10px] font-mono uppercase text-amber-300/90">Operation</p>
              <p className="text-lg font-display font-bold text-amber-400 mt-0.5">{stats.campaignCount}</p>
            </div>
            <div className="px-3.5 py-2.5 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-center">
              <p className="text-[10px] font-mono uppercase text-sky-300/90">Training</p>
              <p className="text-lg font-display font-bold text-sky-400 mt-0.5">{stats.trainingCount}</p>
            </div>
            <div className="px-3.5 py-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center">
              <p className="text-[10px] font-mono uppercase text-emerald-300/90">My RSVPs</p>
              <p className="text-lg font-display font-bold text-emerald-400 mt-0.5">{stats.attendingCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* CONTROLS BAR: FILTERS, VIEW MODE, & MONTH NAVIGATION */}
      <div className="p-4 rounded-2xl bg-stone-900/90 border border-stone-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-lg">
        {/* Left: Category Filters */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-mono text-stone-400 mr-1 flex items-center gap-1">
            <Funnel className="w-3.5 h-3.5 text-amber-400" />
            <span>Filter:</span>
          </span>

          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono transition-all flex items-center gap-1.5 ${
              filterType === 'all'
                ? 'bg-amber-500 text-stone-950 font-bold shadow-sm'
                : 'bg-stone-950 text-stone-400 hover:text-stone-200 border border-stone-800'
            }`}
          >
            <span>All Events</span>
            <span className="text-[10px] opacity-80">({stats.total})</span>
          </button>

          <button
            onClick={() => setFilterType('campaign')}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono transition-all flex items-center gap-1.5 ${
              filterType === 'campaign'
                ? 'bg-amber-500 text-stone-950 font-bold shadow-sm'
                : 'bg-stone-950 text-amber-300/90 hover:bg-amber-500/10 border border-amber-500/30'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>Operation</span>
            <span className="text-[10px] opacity-80">({stats.campaignCount})</span>
          </button>

          <button
            onClick={() => setFilterType('training')}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono transition-all flex items-center gap-1.5 ${
              filterType === 'training'
                ? 'bg-sky-500 text-stone-950 font-bold shadow-sm'
                : 'bg-stone-950 text-sky-300/90 hover:bg-sky-500/10 border border-sky-500/30'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Training</span>
            <span className="text-[10px] opacity-80">({stats.trainingCount})</span>
          </button>

          <button
            onClick={() => setFilterType('attending')}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono transition-all flex items-center gap-1.5 ${
              filterType === 'attending'
                ? 'bg-emerald-500 text-stone-950 font-bold shadow-sm'
                : 'bg-stone-950 text-emerald-300/90 hover:bg-emerald-500/10 border border-emerald-500/30'
            }`}
          >
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Attending</span>
            <span className="text-[10px] opacity-80">({stats.attendingCount})</span>
          </button>
        </div>

        {/* Right: Month Navigation & Layout Switcher */}
        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2.5">
          {/* Month Navigation */}
          <div className="flex items-center gap-1.5 bg-stone-950 p-1 rounded-xl border border-stone-800">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg text-stone-400 hover:text-amber-300 hover:bg-stone-900 transition-colors"
              title="Previous Month"
            >
              <CaretLeft className="w-4 h-4" />
            </button>

            <button
              onClick={handleToday}
              className="px-2.5 py-1 rounded-lg text-xs font-mono text-stone-300 hover:text-amber-300 hover:bg-stone-900 transition-colors"
              title="Jump to Current Month"
            >
              Today
            </button>

            <div className="px-3 py-1 min-w-[140px] text-center font-display font-bold text-sm text-stone-100">
              {MONTH_NAMES[currentMonth - 1]} {currentYear}
            </div>

            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg text-stone-400 hover:text-amber-300 hover:bg-stone-900 transition-colors"
              title="Next Month"
            >
              <CaretRight className="w-4 h-4" />
            </button>
          </div>

          {/* Grid vs Agenda Toggle */}
          <div className="flex items-center bg-stone-950 p-1 rounded-xl border border-stone-800">
            <button
              onClick={() => setLayoutMode('grid')}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-all ${
                layoutMode === 'grid'
                  ? 'bg-stone-800 text-amber-300 font-semibold'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
              title="Monthly Calendar Grid"
            >
              <SquaresFour className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Calendar</span>
            </button>
            <button
              onClick={() => setLayoutMode('agenda')}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-all ${
                layoutMode === 'agenda'
                  ? 'bg-stone-800 text-amber-300 font-semibold'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
              title="Agenda List View"
            >
              <ListBullets className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Agenda</span>
            </button>
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => loadCalendar(currentYear, currentMonth)}
            disabled={isLoading}
            className="p-2 rounded-xl bg-stone-950 hover:bg-stone-800 border border-stone-800 text-stone-300 hover:text-amber-300 transition-all disabled:opacity-50"
            title="Refresh Calendar Events"
          >
            <ArrowClockwise className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* ERROR BANNER */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <WarningCircle className="w-5 h-5 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => loadCalendar(currentYear, currentMonth)}
            className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-200 font-mono font-bold shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* CALENDAR GRID VIEW */}
      {layoutMode === 'grid' ? (
        <div className="rounded-2xl overflow-hidden border border-stone-800 bg-stone-900/90 shadow-2xl">
          {/* 7-Day Weekday Header */}
          <div className="grid grid-cols-7 bg-stone-950/90 border-b border-stone-800">
            {WEEKDAYS.map((dayName) => (
              <div
                key={dayName}
                className="py-2.5 px-2 text-center text-[11px] font-mono font-bold uppercase tracking-wider text-stone-400 border-r last:border-r-0 border-stone-800/60"
              >
                {dayName}
              </div>
            ))}
          </div>

          {/* Weeks Grid */}
          <div className="divide-y divide-stone-800/80">
            {calendarWeeks.map((week, wIdx) => (
              <div key={wIdx} className="grid grid-cols-7 divide-x divide-stone-800/70">
                {week.map((day) => (
                  <div
                    key={day.dateKey}
                    className={`min-h-[104px] p-1.5 flex flex-col gap-1 transition-colors ${
                      !day.isCurrentMonth
                        ? 'bg-stone-950/60 opacity-50'
                        : day.isToday
                        ? 'bg-amber-500/5'
                        : 'bg-stone-900/40 hover:bg-stone-900/70'
                    }`}
                  >
                    {/* Day Cell Header */}
                    <div className="flex items-center justify-between px-0.5">
                      <span
                        className={`inline-flex items-center justify-center text-xs font-mono font-bold ${
                          day.isToday
                            ? 'w-5 h-5 rounded-full bg-amber-500 text-stone-950 shadow-sm shadow-amber-500/30'
                            : day.isCurrentMonth
                            ? 'text-stone-300'
                            : 'text-stone-600'
                        }`}
                      >
                        {day.dayNumber}
                      </span>

                      {day.events.length > 0 && (
                        <span className="text-[9px] font-mono text-stone-500">
                          {day.events.length}
                        </span>
                      )}
                    </div>

                    {/* Day Events Stack (Compact Single-Row Items) */}
                    <div className="flex flex-col gap-1">
                      {day.events.map((ev) => {
                        const isCampaign = ev.type === 'campaign';
                        const displayLabel =
                          ev.name &&
                          !/^sortie\s+\d+$/i.test(ev.name.trim())
                            ? ev.name
                            : ev.mission_name || ev.name;
                        const hoverTooltip = [
                          `[${isCampaign ? 'OP' : 'TRG'}] ${ev.title || ev.name}`,
                          ev.subtitle || '',
                          `${formatLocalTime(ev.scheduled_at)} (${formatZuluTime(ev.scheduled_at)}) • ${ev.attendee_count} Attending`,
                          ev.is_attending
                            ? `✓ Attending (${ev.my_rsvp?.airframe_name || 'Registered'})`
                            : '',
                        ]
                          .filter(Boolean)
                          .join('\n');

                        return (
                          <button
                            key={ev.uid}
                            type="button"
                            onClick={() => setSelectedEventUid(ev.uid)}
                            title={hoverTooltip}
                            className={`w-full text-left px-1.5 py-1 rounded-lg border flex items-center justify-between gap-1.5 transition-all group cursor-pointer ${
                              ev.is_attending
                                ? 'bg-emerald-950/50 border-emerald-500/50 hover:border-emerald-400'
                                : ev.is_concluded
                                ? 'bg-stone-950/80 border-stone-800/90 opacity-75 hover:opacity-100 hover:border-stone-700'
                                : isCampaign
                                ? 'bg-amber-500/10 border-amber-500/30 hover:border-amber-400/70 hover:bg-amber-500/15'
                                : 'bg-sky-500/10 border-sky-500/30 hover:border-sky-400/70 hover:bg-sky-500/15'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <span
                                className={`px-1 py-0.2 rounded text-[9px] font-mono font-bold uppercase leading-tight shrink-0 ${
                                  isCampaign
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                                }`}
                              >
                                {isCampaign ? 'OP' : 'TRG'}
                              </span>
                              <span className="font-display font-semibold text-[11px] text-stone-100 truncate group-hover:text-amber-300 transition-colors">
                                {displayLabel}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 shrink-0 font-mono text-[10px]">
                              {ev.is_attending && (
                                <span
                                  className="text-emerald-400 font-bold"
                                  title="You are attending"
                                >
                                  ✓
                                </span>
                              )}
                              <span className="text-stone-400">
                                {formatLocalTime(ev.scheduled_at)}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Calendar Legend Footer */}
          <div className="px-4 py-3 bg-stone-950/90 border-t border-stone-800 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-stone-400">
            <div className="flex flex-wrap items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span>Operation</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                <span>Training</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <span>Attending (Your RSVP)</span>
              </span>
            </div>
            <span className="text-[11px] text-stone-500">
              Times shown in your local timezone (with Zulu/UTC inside event details)
            </span>
          </div>
        </div>
      ) : (
        /* AGENDA LIST VIEW */
        <div className="space-y-3">
          {filteredEvents.length === 0 ? (
            <div className="p-10 rounded-2xl bg-stone-900/90 border border-stone-800 text-center space-y-2">
              <CalendarBlank className="w-10 h-10 text-stone-600 mx-auto" />
              <p className="font-display font-bold text-stone-200 text-base">
                No sorties scheduled in this window
              </p>
              <p className="text-xs text-stone-400">
                Try switching the filter or navigating to another month.
              </p>
            </div>
          ) : (
            filteredEvents.map((ev) => {
              const isCampaign = ev.type === 'campaign';
              return (
                <div
                  key={ev.uid}
                  onClick={() => setSelectedEventUid(ev.uid)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 group ${
                    ev.is_attending
                      ? 'bg-emerald-950/20 border-emerald-500/40 hover:border-emerald-400'
                      : 'bg-stone-900/90 border-stone-800 hover:border-amber-500/40'
                  }`}
                >
                  <div className="flex items-start gap-4 min-w-0">
                    <div
                      className={`w-12 h-12 rounded-2xl border flex flex-col items-center justify-center shrink-0 font-mono ${
                        isCampaign
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                          : 'bg-sky-500/10 border-sky-500/30 text-sky-300'
                      }`}
                    >
                      {isCampaign ? (
                        <Crosshair className="w-5 h-5" />
                      ) : (
                        <GraduationCap className="w-5 h-5" />
                      )}
                      <span className="text-[9px] font-bold uppercase mt-0.5">
                        {isCampaign ? 'OP' : 'TRG'}
                      </span>
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display font-bold text-stone-100 text-base group-hover:text-amber-300 transition-colors">
                          {ev.title}
                        </h3>
                        {ev.is_attending && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            ✓ Attending • {ev.my_rsvp?.airframe_name} ({ev.my_rsvp?.role_label})
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-stone-400">{ev.subtitle}</p>
                      <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-stone-400 pt-1">
                        <span className="flex items-center gap-1 text-stone-300">
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          <span>
                            {formatFullDateTime(ev.scheduled_at)} ({formatZuluTime(ev.scheduled_at)})
                          </span>
                        </span>
                        {ev.theatre && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-stone-500" />
                            <span>{ev.theatre}</span>
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-stone-500" />
                          <span>{ev.attendee_count} Attending</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <span className="px-3 py-1.5 rounded-xl bg-stone-950 border border-stone-800 text-xs font-mono text-amber-300 group-hover:border-amber-500/40">
                      Inspect &amp; RSVP &rarr;
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* UPCOMING ACTIVE SORTIES STRIP */}
      {upcomingEvents.length > 0 && layoutMode === 'grid' && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-base text-stone-200 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>Upcoming Active Sorties</span>
            </h2>
            <span className="text-xs font-mono text-stone-400">
              Click any card to RSVP or inspect roster
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcomingEvents.slice(0, 6).map((ev) => {
              const isCampaign = ev.type === 'campaign';
              return (
                <div
                  key={ev.uid}
                  onClick={() => setSelectedEventUid(ev.uid)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-2.5 group ${
                    ev.is_attending
                      ? 'bg-emerald-950/20 border-emerald-500/40 hover:border-emerald-400'
                      : 'bg-stone-900/90 border-stone-800 hover:border-amber-500/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                        isCampaign
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                      }`}
                    >
                      {isCampaign ? 'Operation' : 'Training'}
                    </span>
                    <span className="text-xs font-mono text-stone-400">
                      {ev.attendee_count} Pilot{ev.attendee_count === 1 ? '' : 's'}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-display font-bold text-stone-100 text-sm group-hover:text-amber-300 transition-colors truncate">
                      {ev.name}
                    </h3>
                    <p className="text-xs text-stone-400 truncate mt-0.5">{ev.subtitle}</p>
                  </div>

                  <div className="pt-2 border-t border-stone-800/80 flex items-center justify-between text-[11px] font-mono">
                    <span className="text-stone-300">
                      {formatFullDateTime(ev.scheduled_at)}
                    </span>
                    {ev.is_attending ? (
                      <span className="text-emerald-400 font-bold">✓ Attending</span>
                    ) : (
                      <span className="text-amber-400">Details &rarr;</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* EVENT DETAILS & RSVP MODAL */}
      {selectedEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/80 backdrop-blur-md animate-in fade-in duration-150"
          onClick={() => setSelectedEventUid(null)}
        >
          <div
            className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-3xl bg-stone-900 border border-stone-800 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 sm:p-6 bg-stone-950/90 border-b border-stone-800 flex items-start justify-between gap-4">
              <div className="space-y-1.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border ${
                      selectedEvent.type === 'campaign'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                    }`}
                  >
                    {selectedEvent.type === 'campaign' ? (
                      <>
                        <Crosshair className="w-3 h-3" />
                        <span>Operation</span>
                      </>
                    ) : (
                      <>
                        <GraduationCap className="w-3 h-3" />
                        <span>Training</span>
                      </>
                    )}
                  </span>

                  {selectedEvent.has_aar ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      AAR Filed
                    </span>
                  ) : selectedEvent.is_concluded ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-stone-800 text-stone-400 border border-stone-700">
                      Concluded
                    </span>
                  ) : selectedEvent.is_signup_open ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      Sign-up Open
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-red-500/20 text-red-300 border border-red-500/40">
                      Sign-up Cut-off Passed
                    </span>
                  )}

                  {selectedEvent.is_attending && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-emerald-500 text-stone-950">
                      ✓ You Are Attending
                    </span>
                  )}
                </div>

                <h2 className="font-display text-xl sm:text-2xl font-extrabold text-stone-100 leading-tight">
                  {selectedEvent.title}
                </h2>
                {selectedEvent.subtitle && (
                  <p className="text-xs sm:text-sm text-stone-400 font-mono">
                    {selectedEvent.subtitle}
                  </p>
                )}
              </div>

              <button
                onClick={() => setSelectedEventUid(null)}
                className="p-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-stone-100 border border-stone-800 transition-colors shrink-0"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Modal Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
              {/* Key Metadata Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-stone-950/90 border border-stone-800/90">
                  <div className="text-[10px] font-mono uppercase text-stone-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Scheduled Time</span>
                  </div>
                  <div className="text-xs font-semibold text-stone-100 mt-1">
                    {formatFullDateTime(selectedEvent.scheduled_at)}
                  </div>
                  <div className="text-[11px] font-mono text-amber-400/90 mt-0.5">
                    Zulu: {formatZuluTime(selectedEvent.scheduled_at)}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-stone-950/90 border border-stone-800/90">
                  <div className="text-[10px] font-mono uppercase text-stone-400 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-stone-400" />
                    <span>Sign-up Cut-off</span>
                  </div>
                  <div className="text-xs font-semibold text-stone-100 mt-1">
                    {selectedEvent.signup_cutoff_at
                      ? formatFullDateTime(selectedEvent.signup_cutoff_at)
                      : 'No Cut-off (Open)'}
                  </div>
                  <div className="text-[11px] font-mono text-stone-400 mt-0.5">
                    {selectedEvent.is_signup_open ? 'Registrations Active' : 'Locked'}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-stone-950/90 border border-stone-800/90">
                  <div className="text-[10px] font-mono uppercase text-stone-400 flex items-center gap-1.5">
                    <GlobeHemisphereWest className="w-3.5 h-3.5 text-sky-400" />
                    <span>Theatre &amp; Server</span>
                  </div>
                  <div className="text-xs font-semibold text-stone-100 mt-1 truncate">
                    {selectedEvent.theatre || 'Standard Theatre'}
                  </div>
                  <div className="text-[11px] font-mono text-stone-400 mt-0.5 truncate">
                    {selectedEvent.server || 'GTFO Dedicated Server'}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-stone-950/90 border border-stone-800/90">
                  <div className="text-[10px] font-mono uppercase text-stone-400 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{selectedEvent.has_aar ? 'Sortie Attendance' : 'Confirmed Roster'}</span>
                  </div>
                  <div className="text-base font-display font-bold text-emerald-400 mt-1">
                    {selectedEvent.has_aar
                      ? `${selectedEvent.attendees.filter((a) => a.is_present === true).length} Attended / ${
                          selectedEvent.attendees.filter((a) => a.is_present === false).length
                        } Absent`
                      : `${selectedEvent.attendee_count} Attending`}
                  </div>
                  {selectedEvent.type === 'campaign' && selectedEvent.allow_opfor && (
                    <div className="text-[10px] font-mono text-red-400 mt-0.5">
                      OPFOR Enabled ({selectedEvent.opfor_count || 0}/{selectedEvent.opfor_slots || '∞'})
                    </div>
                  )}
                </div>
              </div>

              {/* Briefing / Notes Section */}
              {selectedEvent.notes && (
                <div className="p-4 rounded-2xl bg-stone-950/80 border border-stone-800 space-y-1.5">
                  <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <Note className="w-4 h-4" />
                    <span>Sortie Briefing &amp; Syllabus Notes</span>
                  </div>
                  <p className="text-xs sm:text-sm text-stone-300 whitespace-pre-line leading-relaxed">
                    {selectedEvent.notes}
                  </p>
                </div>
              )}

              {/* AAR Summary (For concluded Campaign Sorties with AAR) */}
              {selectedEvent.has_aar && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold uppercase text-amber-300 flex items-center gap-1.5">
                      <Sword className="w-4 h-4 text-amber-400" />
                      <span>After Action Report (AAR)</span>
                    </span>
                    <div className="flex items-center gap-3 text-xs font-mono">
                      <span className="text-red-300">
                        Friendly Losses: <strong>{selectedEvent.our_losses ?? 0}</strong>
                      </span>
                      <span className="text-emerald-300">
                        Enemy Losses: <strong>{selectedEvent.enemy_losses ?? 0}</strong>
                      </span>
                    </div>
                  </div>
                  {selectedEvent.aar_notes && (
                    <p className="text-xs text-stone-300 whitespace-pre-line leading-relaxed">
                      {selectedEvent.aar_notes}
                    </p>
                  )}
                </div>
              )}

              {/* INTERACTIVE RSVP WORKBENCH */}
              {!selectedEvent.is_concluded && (
                <div className="p-5 rounded-2xl bg-stone-950 border border-stone-800 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-800">
                    <div>
                      <h3 className="font-display font-bold text-sm sm:text-base text-stone-100 flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-amber-400" />
                        <span>
                          {selectedEvent.is_attending
                            ? 'Update or Manage Your Sortie RSVP'
                            : 'Register Your Sortie RSVP'}
                        </span>
                      </h3>
                      <p className="text-xs text-stone-400 mt-0.5">
                        {selectedEvent.type === 'campaign'
                          ? 'Select a qualified aircraft and crew position for this Operation.'
                          : 'Select a qualified or in-training aircraft and role for this Training sortie.'}
                      </p>
                    </div>

                    {selectedEvent.is_attending && selectedEvent.my_rsvp && (
                      <div className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-mono">
                        Current:{' '}
                        <strong>
                          {selectedEvent.my_rsvp.flight_callsign ||
                            selectedEvent.my_rsvp.callsign ||
                            rsvpCallsign ||
                            selectedEvent.my_rsvp.airframe_name}
                        </strong>
                        {selectedEvent.my_rsvp.flight_callsign ||
                        selectedEvent.my_rsvp.callsign ||
                        rsvpCallsign ? (
                          <span>
                            {' '}
                            • {selectedEvent.my_rsvp.airframe_name} (
                            {selectedEvent.my_rsvp.role_label})
                          </span>
                        ) : (
                          <span> ({selectedEvent.my_rsvp.role_label})</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Feedback Alert */}
                  {rsvpFeedback && (
                    <div
                      className={`p-3 rounded-xl border text-xs font-mono flex items-center gap-2 ${
                        rsvpFeedback.type === 'success'
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                          : 'bg-red-500/15 border-red-500/40 text-red-300'
                      }`}
                    >
                      {rsvpFeedback.type === 'success' ? (
                        <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <WarningCircle className="w-4 h-4 text-red-400 shrink-0" />
                      )}
                      <span>{rsvpFeedback.message}</span>
                    </div>
                  )}

                  {!selectedEvent.is_signup_open && !selectedEvent.is_attending ? (
                    <div className="p-3.5 rounded-xl bg-stone-900 border border-stone-800 text-xs text-stone-400 flex items-center gap-2.5">
                      <Lock className="w-4 h-4 text-red-400 shrink-0" />
                      <span>
                        The sign-up cut-off for this sortie has passed. Contact S2/S3 command on Discord for late slot changes.
                      </span>
                    </div>
                  ) : availableAirframesForSelectedEvent.length === 0 ? (
                    <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex items-center gap-2.5">
                      <Info className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>
                        No qualified {selectedEvent.type === 'training' ? 'or in-training ' : ''}airframes were found on your Member Dossier. Complete an airframe qualification to RSVP.
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {selectedEvent.is_signup_open && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Aircraft Selector */}
                          <div className="space-y-1.5">
                            <label className="block text-[11px] font-mono uppercase text-stone-400">
                              Select Aircraft
                            </label>
                            <select
                              value={rsvpAirframeId}
                              onChange={(e) =>
                                handleAirframeChange(
                                  e.target.value ? Number(e.target.value) : ''
                                )
                              }
                              className="w-full px-3.5 py-2.5 rounded-xl bg-stone-900 border border-stone-800 text-xs sm:text-sm text-stone-100 focus:outline-none focus:border-amber-500"
                            >
                              <option value="">-- Choose Aircraft --</option>
                              {availableAirframesForSelectedEvent.map((af) => (
                                <option key={af.id} value={af.id}>
                                  {af.name}
                                  {af.is_primary ? ' ★ (Primary)' : ''}
                                  {af.status === 'in_training'
                                    ? ' [In Training]'
                                    : ''}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Role Selector */}
                          <div className="space-y-1.5">
                            <label className="block text-[11px] font-mono uppercase text-stone-400">
                              Flight Position / Role
                            </label>
                            <select
                              value={rsvpRole}
                              onChange={(e) => setRsvpRole(e.target.value)}
                              className="w-full px-3.5 py-2.5 rounded-xl bg-stone-900 border border-stone-800 text-xs sm:text-sm text-stone-100 focus:outline-none focus:border-amber-500"
                            >
                              {availableRolesForSelectedAirframe.map((roleOpt) => (
                                <option key={roleOpt.value} value={roleOpt.value}>
                                  {roleOpt.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}

                      {/* Flight Callsign Selector & Pre-Assigned Numbering */}
                      {selectedEvent.is_signup_open && (
                        <div className="p-3.5 rounded-xl bg-stone-900/70 border border-stone-800 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <label className="block text-[11px] font-mono uppercase text-amber-300 font-semibold">
                              Flight Callsign &amp; Element Number
                            </label>
                            <span className="text-[11px] font-mono text-stone-400">
                              Auto-assigned next open slot (1-1 &rarr; 1-4, then 2-1...) &bull; Editable
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {/* Authorized Squadron Callsign */}
                            <div className="space-y-1">
                              <label className="block text-[10px] font-mono uppercase text-stone-400">
                                Authorized Callsign
                              </label>
                              <select
                                value={
                                  authorizedCallsignsForSelectedAirframe.some(
                                    (c) =>
                                      c.callsign.toLowerCase() ===
                                      parsedRsvpCallsign.prefix.toLowerCase()
                                  )
                                    ? authorizedCallsignsForSelectedAirframe.find(
                                        (c) =>
                                          c.callsign.toLowerCase() ===
                                          parsedRsvpCallsign.prefix.toLowerCase()
                                      )?.callsign || ''
                                    : authorizedCallsignsForSelectedAirframe[0]
                                        ?.callsign || ''
                                }
                                onChange={(e) =>
                                  handleCallsignPrefixChange(e.target.value)
                                }
                                className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
                              >
                                {authorizedCallsignsForSelectedAirframe.map(
                                  (csOpt) => (
                                    <option
                                      key={csOpt.callsign}
                                      value={csOpt.callsign}
                                    >
                                      {csOpt.label || csOpt.callsign}
                                    </option>
                                  )
                                )}
                              </select>
                            </div>

                            {/* Flight & Element Slot (1-1..1-4, 2-1..2-4, etc.) */}
                            <div className="space-y-1">
                              <label className="block text-[10px] font-mono uppercase text-stone-400">
                                Flight &amp; Position
                              </label>
                              <select
                                value={`${parsedRsvpCallsign.flight}-${parsedRsvpCallsign.pos}`}
                                onChange={(e) => {
                                  const [fStr, pStr] =
                                    e.target.value.split('-');
                                  const fNum = parseInt(fStr || '1', 10);
                                  const pNum = parseInt(pStr || '1', 10);
                                  handleCallsignNumberChange(
                                    Number.isFinite(fNum) ? fNum : 1,
                                    Number.isFinite(pNum) ? pNum : 1
                                  );
                                }}
                                className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-xs font-mono text-stone-100 focus:outline-none focus:border-amber-500"
                              >
                                {[1, 2, 3, 4, 5, 6].map((flightNum) => (
                                  <optgroup
                                    key={`flight-${flightNum}`}
                                    label={`${parsedRsvpCallsign.prefix || 'Flight'} ${flightNum}`}
                                  >
                                    {[1, 2, 3, 4].map((posNum) => {
                                      const slotKey = `${flightNum}-${posNum}`;
                                      const takenBy =
                                        takenSlotsForCurrentPrefix.get(slotKey);
                                      const posLabel =
                                        posNum === 1
                                          ? 'Flight Lead'
                                          : posNum === 2
                                          ? 'Element 1 Wing'
                                          : posNum === 3
                                          ? 'Element 2 Lead'
                                          : 'Element 2 Wing';
                                      return (
                                        <option key={slotKey} value={slotKey}>
                                          {parsedRsvpCallsign.prefix}{' '}
                                          {slotKey} ({posLabel})
                                          {takenBy
                                            ? ` — Taken: ${takenBy}`
                                            : ''}
                                        </option>
                                      );
                                    })}
                                  </optgroup>
                                ))}
                              </select>
                            </div>

                            {/* Direct Custom / Override Callsign Input */}
                            <div className="space-y-1">
                              <label className="block text-[10px] font-mono uppercase text-stone-400">
                                Assigned Callsign (Editable)
                              </label>
                              <input
                                type="text"
                                value={rsvpCallsign}
                                onChange={(e) =>
                                  setRsvpCallsign(e.target.value)
                                }
                                maxLength={64}
                                placeholder="e.g. Dagger 1-1"
                                className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-amber-500/40 text-xs font-mono font-bold text-amber-300 placeholder:text-stone-500 focus:outline-none focus:border-amber-400"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Optional Faction Selector for OPFOR-eligible Campaign Sorties */}
                      {selectedEvent.is_signup_open &&
                        selectedEvent.type === 'campaign' &&
                        selectedEvent.is_opfor_eligible && (
                          <div className="space-y-1.5">
                            <label className="block text-[11px] font-mono uppercase text-stone-400">
                              Force Assignment (OPFOR Certified)
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                              <button
                                type="button"
                                onClick={() => handleSideChange('blufor')}
                                className={`py-2 px-3 rounded-xl border text-xs font-mono font-bold transition-all ${
                                  rsvpSide === 'blufor'
                                    ? 'bg-sky-500/20 border-sky-500 text-sky-300'
                                    : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200'
                                }`}
                              >
                                BLUFOR (Taskforce)
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSideChange('opfor')}
                                className={`py-2 px-3 rounded-xl border text-xs font-mono font-bold transition-all ${
                                  rsvpSide === 'opfor'
                                    ? 'bg-red-500/20 border-red-500 text-red-300'
                                    : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200'
                                }`}
                              >
                                OPFOR (Red Air Aggressor)
                              </button>
                            </div>
                          </div>
                        )}

                      {/* Optional Notes for Training Sorties */}
                      {selectedEvent.is_signup_open &&
                        selectedEvent.type === 'training' && (
                          <div className="space-y-1.5">
                            <label className="block text-[11px] font-mono uppercase text-stone-400">
                              Training Objectives / Remarks (Optional)
                            </label>
                            <input
                              type="text"
                              value={rsvpNotes}
                              onChange={(e) => setRsvpNotes(e.target.value)}
                              maxLength={500}
                              placeholder="e.g. Working on Case III recoveries, AAR proficiency, or TQC checkride..."
                              className="w-full px-3.5 py-2 rounded-xl bg-stone-900 border border-stone-800 text-xs sm:text-sm text-stone-100 placeholder:text-stone-500 focus:outline-none focus:border-sky-500"
                            />
                          </div>
                        )}

                      {/* Action Buttons */}
                      <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
                        {selectedEvent.is_attending && (
                          <button
                            type="button"
                            disabled={isSubmittingRsvp}
                            onClick={() => handleSubmitRsvp('cancel')}
                            className="px-4 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 text-red-300 font-mono font-bold text-xs flex items-center gap-1.5 transition-all disabled:opacity-50"
                          >
                            <Trash className="w-3.5 h-3.5" />
                            <span>Cancel RSVP</span>
                          </button>
                        )}

                        {selectedEvent.is_signup_open && (
                          <button
                            type="button"
                            disabled={isSubmittingRsvp || !rsvpAirframeId}
                            onClick={() => handleSubmitRsvp('attend')}
                            className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-mono font-bold text-xs flex items-center gap-2 transition-all shadow-md shadow-amber-500/20 disabled:opacity-50"
                          >
                            <CheckCircle weight="bold" className="w-4 h-4" />
                            <span>
                              {isSubmittingRsvp
                                ? 'Saving RSVP...'
                                : selectedEvent.is_attending
                                ? 'Update RSVP'
                                : 'Confirm RSVP'}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* REGISTERED PILOTS & AIRCREW ROSTER */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-bold text-sm sm:text-base text-stone-100 flex items-center gap-2">
                    <Users className="w-4 h-4 text-amber-400" />
                    <span>
                      {selectedEvent.has_aar
                        ? `Flight Attendance (${selectedEvent.attendees.filter((a) => a.is_present === true).length} Attended / ${selectedEvent.attendees.filter((a) => a.is_present === false).length} Absent)`
                        : `Registered Flight Roster (${selectedEvent.attendee_count})`}
                    </span>
                  </h3>
                </div>

                {selectedEvent.attendees.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-stone-950/60 border border-stone-800/80 text-center text-xs text-stone-400">
                    No pilots or aircrew have registered for this sortie yet. Be the first to RSVP above!
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* BLUFOR Squadrons */}
                    {Object.entries(groupedAttendees.bluforBySquadron).map(
                      ([squadronName, list]) => (
                        <div
                          key={squadronName}
                          className="rounded-2xl bg-stone-950/80 border border-stone-800 overflow-hidden"
                        >
                          <div className="px-4 py-2 bg-stone-900/90 border-b border-stone-800 flex items-center justify-between text-xs font-mono">
                            <span className="font-bold text-amber-300">
                              {squadronName}
                            </span>
                            <span className="text-stone-400">
                              {selectedEvent.has_aar
                                ? `${list.filter((a) => a.is_present === true).length} Attended / ${list.filter((a) => a.is_present === false).length} Absent`
                                : `${list.length} Member${list.length === 1 ? '' : 's'}`}
                            </span>
                          </div>
                          <div className="divide-y divide-stone-800/60">
                            {list.map((att, idx) => {
                              const resolvedFlightCs =
                                att.flight_callsign ||
                                (att.id
                                  ? resolvedAttendeeCallsigns.get(att.id)
                                  : undefined);
                              const isAbsent = selectedEvent.has_aar && att.is_present === false;
                              return (
                                <div
                                  key={`${att.callsign}-${idx}`}
                                  className={`px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs transition-colors ${
                                    isAbsent ? 'bg-stone-950/40 opacity-70' : ''
                                  }`}
                                >
                                  <div className="flex flex-wrap items-center gap-2">
                                    <AirplaneTilt className={`w-4 h-4 shrink-0 ${isAbsent ? 'text-stone-600' : 'text-stone-400'}`} />
                                    {resolvedFlightCs && (
                                      <span className={`px-2 py-0.5 rounded font-mono font-bold text-[11px] border ${
                                        isAbsent
                                          ? 'bg-stone-800/40 border-stone-700/50 text-stone-500 line-through'
                                          : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                                      }`}>
                                        {resolvedFlightCs}
                                      </span>
                                    )}
                                    <span className={`font-display font-semibold ${
                                      isAbsent ? 'line-through text-stone-500' : 'text-stone-100'
                                    }`}>
                                      {att.callsign}
                                    </span>
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${getRoleBadgeStyle(
                                        att.role
                                      )} ${isAbsent ? 'opacity-60' : ''}`}
                                    >
                                      {att.role_label}
                                    </span>
                                    {selectedEvent.has_aar && (
                                      att.is_present === false ? (
                                        <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[9px] font-bold uppercase font-mono">
                                          Not Present
                                        </span>
                                      ) : att.xp_awarded ? (
                                        <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-bold font-mono">
                                          +500 XP
                                        </span>
                                      ) : (
                                        <span className="px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[9px] font-bold uppercase font-mono">
                                          Attended
                                        </span>
                                      )
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 font-mono text-stone-300">
                                    {att.notes && (
                                      <span className="text-[11px] text-stone-400 italic truncate max-w-xs">
                                        &ldquo;{att.notes}&rdquo;
                                      </span>
                                    )}
                                    <span className={`px-2 py-0.5 rounded border text-[11px] ${
                                      isAbsent
                                        ? 'bg-stone-900/60 border-stone-800/60 text-stone-500 line-through'
                                        : 'bg-stone-900 border-stone-800 text-amber-300'
                                    }`}>
                                      {att.airframe_name ||
                                        att.airframe_abbreviation ||
                                        'TBD'}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )
                    )}

                    {/* OPFOR Roster (if any visible) */}
                    {groupedAttendees.opfor.length > 0 && (
                      <div className="rounded-2xl bg-red-950/20 border border-red-500/30 overflow-hidden">
                        <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/30 flex items-center justify-between text-xs font-mono">
                          <span className="font-bold text-red-300">
                            OPFOR Aggressor Element
                          </span>
                          <span className="text-red-300/80">
                            {selectedEvent.has_aar
                              ? `${groupedAttendees.opfor.filter((a) => a.is_present === true).length} Attended / ${groupedAttendees.opfor.filter((a) => a.is_present === false).length} Absent`
                              : `${groupedAttendees.opfor.length} Pilot${groupedAttendees.opfor.length === 1 ? '' : 's'}`}
                          </span>
                        </div>
                        <div className="divide-y divide-red-500/20">
                          {groupedAttendees.opfor.map((att, idx) => {
                            const resolvedOpforCs =
                              att.flight_callsign ||
                              (att.id
                                ? resolvedAttendeeCallsigns.get(att.id)
                                : undefined);
                            const isAbsent = selectedEvent.has_aar && att.is_present === false;
                            return (
                              <div
                                key={`opfor-${idx}`}
                                className={`px-4 py-2.5 flex items-center justify-between gap-2 text-xs transition-colors ${
                                  isAbsent ? 'bg-stone-950/40 opacity-70' : ''
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  {resolvedOpforCs && (
                                    <span className={`px-2 py-0.5 rounded border font-mono font-bold text-[11px] ${
                                      isAbsent
                                        ? 'bg-stone-800/40 border-stone-700/50 text-stone-500 line-through'
                                        : 'bg-red-500/20 border-red-500/40 text-red-200'
                                    }`}>
                                      {resolvedOpforCs}
                                    </span>
                                  )}
                                  <span className={`font-display font-semibold ${
                                    isAbsent ? 'line-through text-stone-500' : 'text-red-200'
                                  }`}>
                                    {att.callsign}
                                  </span>
                                  {selectedEvent.has_aar && (
                                    att.is_present === false ? (
                                      <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[9px] font-bold uppercase font-mono">
                                        Not Present
                                      </span>
                                    ) : att.xp_awarded ? (
                                      <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-bold font-mono">
                                        +500 XP
                                      </span>
                                    ) : (
                                      <span className="px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[9px] font-bold uppercase font-mono">
                                        Attended
                                      </span>
                                    )
                                  )}
                                </div>
                                <span className={`px-2 py-0.5 rounded border font-mono text-[11px] ${
                                  isAbsent
                                    ? 'bg-stone-950/60 border-stone-800 text-stone-500 line-through'
                                    : 'bg-stone-950 border-red-500/30 text-red-300'
                                }`}>
                                  {att.airframe_name ||
                                    att.airframe_abbreviation ||
                                    'Classified'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer: External Links */}
            <div className="p-4 sm:px-6 bg-stone-950 border-t border-stone-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {selectedEvent.discord_event_url && (
                  <button
                    type="button"
                    onClick={() =>
                      selectedEvent.discord_event_url &&
                      openExternalUrl(selectedEvent.discord_event_url)
                    }
                    className="px-3 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <DiscordLogo className="w-4 h-4" />
                    <span>Discord Event</span>
                    <ArrowSquareOut className="w-3.5 h-3.5" />
                  </button>
                )}

                {selectedEvent.discord_thread_url && (
                  <button
                    type="button"
                    onClick={() =>
                      selectedEvent.discord_thread_url &&
                      openExternalUrl(selectedEvent.discord_thread_url)
                    }
                    className="px-3 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <DiscordLogo className="w-4 h-4" />
                    <span>Briefing Thread</span>
                    <ArrowSquareOut className="w-3.5 h-3.5" />
                  </button>
                )}

                {selectedEvent.aar_discord_url && (
                  <button
                    type="button"
                    onClick={() =>
                      selectedEvent.aar_discord_url &&
                      openExternalUrl(selectedEvent.aar_discord_url)
                    }
                    className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <DiscordLogo className="w-4 h-4" />
                    <span>Discord AAR</span>
                    <ArrowSquareOut className="w-3.5 h-3.5" />
                  </button>
                )}

                {selectedEvent.portal_url && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedEvent.portal_url) return;
                      const fixedUrl = selectedEvent.portal_url
                        .replace(
                          /\/campaigns\/([^/]+)\/missions\/(\d+)$/,
                          '/campaigns/$1/map?mission_id=$2'
                        )
                        .replace(
                          /\/admin\/training-sorties$/,
                          `/training-sorties/${selectedEvent.id}`
                        );
                      openExternalUrl(fixedUrl);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-300 hover:text-amber-300 text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>Open in Member Portal</span>
                    <ArrowSquareOut className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setSelectedEventUid(null)}
                className="px-4 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-mono font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
