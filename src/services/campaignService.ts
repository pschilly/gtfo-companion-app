import { invoke } from '@tauri-apps/api/core';
import { normalizePortalCdnUrl } from '../data/portalData';
import {
  CampaignAirframeSquadronGroup,
  CampaignIntelReportItem,
  CampaignItem,
  CampaignLoreChapter,
  CampaignLorePageItem,
  CampaignMissionAor,
  CampaignMissionFlightItem,
  CampaignMissionFlightPlanBrief,
  CampaignMissionFrequencyItem,
  CampaignMissionItem,
  CampaignMissionObjective,
  CampaignMissionObjectiveSquadron,
  CampaignMissionRewardBadge,
  CampaignMissionRewardBreakdownItem,
  CampaignMissionSmeac,
  CampaignMissionSortieBrief,
  CampaignResourcePool,
  CampaignResourceTransactionItem,
  CampaignSortieAttendeeItem,
  CampaignSortieBdaMediaItem,
  CampaignsResponse,
  CampaignSupplyOrderItem,
  CampaignSupplyOrderManifestItem,
  CampaignTrackedAirframeEntry,
} from '../types';
import { stripHtml } from '../utils/formatters';
import { normalizeCompanionBaseUrl } from './flightPlanService';
import { isTauriRuntime, sendPortalApiRequest } from './tauriBridge';

const DEFAULT_RESOURCE_POOL_DEFS: Array<{
  key: CampaignResourcePool['key'];
  label: string;
  shortLabel: string;
  description: string;
  color: string;
}> = [
  {
    key: 'command_points',
    label: 'Credits',
    shortLabel: 'CR',
    description: 'Primary contract earnings used for general campaign funding and theater progression.',
    color: 'warning',
  },
  {
    key: 'airframe_credits',
    label: 'Fleet Acquisition Credits',
    shortLabel: 'AC',
    description: 'Used solely for the acquisition of new tactical aircraft and expanding flight lines.',
    color: 'info',
  },
  {
    key: 'isr_credits',
    label: 'ISR Tasking Credits',
    shortLabel: 'ISR',
    description: 'Extremely limited reconnaissance budget allocated to task satellite imagery.',
    color: 'success',
  },
  {
    key: 'logistics_points',
    label: 'Logistics & Supply Points',
    shortLabel: 'LP',
    description: 'Supply line capital used for bulk, off map, supply drops and AI driven supply runs.',
    color: 'primary',
  },
];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function asNumberRecord(value: unknown): Record<string, number> {
  const rec = asRecord(value);
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(rec)) {
    const n = Number(v);
    if (Number.isFinite(n)) {
      out[k] = n;
    }
  }
  return out;
}

function normalizeSortieAttendee(raw: unknown): CampaignSortieAttendeeItem {
  const a = asRecord(raw);
  const rawPresent = a.isPresent ?? a.is_present;
  return {
    id: Number(a.id || 0),
    userId: a.userId ?? a.user_id ? Number(a.userId ?? a.user_id) : null,
    callsign: String(a.callsign || 'Unknown Pilot'),
    flightCallsign:
      a.flightCallsign ?? a.flight_callsign
        ? String(a.flightCallsign ?? a.flight_callsign)
        : null,
    discordId:
      a.discordId ?? a.discord_id ? String(a.discordId ?? a.discord_id) : null,
    airframeId:
      a.airframeId ?? a.airframe_id ? Number(a.airframeId ?? a.airframe_id) : null,
    airframeName:
      a.airframeName ?? a.airframe_name
        ? String(a.airframeName ?? a.airframe_name)
        : null,
    airframeAbbreviation:
      a.airframeAbbreviation ?? a.airframe_abbreviation
        ? String(a.airframeAbbreviation ?? a.airframe_abbreviation)
        : null,
    role: String(a.role || 'pilot'),
    roleLabel: String(a.roleLabel ?? a.role_label ?? 'Pilot'),
    isSupport: Boolean(a.isSupport ?? a.is_support ?? false),
    isOpfor: Boolean(a.isOpfor ?? a.is_opfor ?? false),
    isPresent:
      rawPresent === null || rawPresent === undefined ? null : Boolean(rawPresent),
    xpAwarded: Boolean(a.xpAwarded ?? a.xp_awarded ?? false),
    squadronName:
      a.squadronName ?? a.squadron_name
        ? String(a.squadronName ?? a.squadron_name)
        : null,
    squadronAbbreviation:
      a.squadronAbbreviation ?? a.squadron_abbreviation
        ? String(a.squadronAbbreviation ?? a.squadron_abbreviation)
        : null,
  };
}

function normalizeBdaMediaItem(raw: unknown): CampaignSortieBdaMediaItem {
  const m = asRecord(raw);
  const url = String(m.url || '');
  return {
    url: url ? normalizePortalCdnUrl(url, url) : '',
    isVideo: Boolean(m.isVideo ?? m.is_video ?? false),
    extension: String(m.extension || 'jpg'),
    filename: String(m.filename || 'BDA Media'),
  };
}

function normalizeSortie(raw: unknown): CampaignMissionSortieBrief {
  const s = asRecord(raw);
  const id = Number(s.id || 0);
  const rawAttendees = Array.isArray(s.attendees) ? s.attendees : [];
  const rawBda = Array.isArray(s.bdaMediaItems ?? s.bda_media_items)
    ? ((s.bdaMediaItems ?? s.bda_media_items) as unknown[])
    : [];

  return {
    id,
    calendarEventUid: String(
      s.calendarEventUid ?? s.calendar_event_uid ?? `campaign-${id}`
    ),
    sortieNumber: Number(s.sortieNumber ?? s.sortie_number ?? 1),
    name: String(s.name || `Sortie ${Number(s.sortieNumber ?? s.sortie_number ?? 1)}`),
    scheduledAt: s.scheduledAt || s.scheduled_at ? String(s.scheduledAt || s.scheduled_at) : null,
    signupCutoffAt:
      s.signupCutoffAt || s.signup_cutoff_at
        ? String(s.signupCutoffAt || s.signup_cutoff_at)
        : null,
    isSignupOpen: Boolean(s.isSignupOpen ?? s.is_signup_open ?? false),
    isConcluded: Boolean(s.isConcluded ?? s.is_concluded ?? false),
    hasAar: Boolean(s.hasAar ?? s.has_aar ?? false),
    notes: s.notes ? String(s.notes) : null,
    notesHtml: s.notesHtml ?? s.notes_html ? String(s.notesHtml ?? s.notes_html) : null,
    allowOpfor: Boolean(s.allowOpfor ?? s.allow_opfor ?? false),
    opforSlots:
      s.opforSlots !== undefined && s.opforSlots !== null
        ? Number(s.opforSlots)
        : s.opfor_slots !== undefined && s.opfor_slots !== null
        ? Number(s.opfor_slots)
        : null,
    opforCount: Number(s.opforCount ?? s.opfor_count ?? 0),
    bluforCount: Number(s.bluforCount ?? s.blufor_count ?? 0),
    gameMasterSlots: Number(s.gameMasterSlots ?? s.game_master_slots ?? 0),
    gameMasterCount: Number(s.gameMasterCount ?? s.game_master_count ?? 0),
    jtacSlots: Number(s.jtacSlots ?? s.jtac_slots ?? 0),
    jtacCount: Number(s.jtacCount ?? s.jtac_count ?? 0),
    atcSlots: Number(s.atcSlots ?? s.atc_slots ?? 0),
    atcCount: Number(s.atcCount ?? s.atc_count ?? 0),
    gciSlots: Number(s.gciSlots ?? s.gci_slots ?? 0),
    gciCount: Number(s.gciCount ?? s.gci_count ?? 0),
    attendeesCount: Number(s.attendeesCount ?? s.attendees_count ?? rawAttendees.length),
    attendedCount: Number(s.attendedCount ?? s.attended_count ?? 0),
    absentCount: Number(s.absentCount ?? s.absent_count ?? 0),
    attendees: rawAttendees.map(normalizeSortieAttendee),
    ourLosses: s.ourLosses ?? s.our_losses ? String(s.ourLosses ?? s.our_losses) : null,
    ourLossesHtml:
      s.ourLossesHtml ?? s.our_losses_html
        ? String(s.ourLossesHtml ?? s.our_losses_html)
        : null,
    enemyLosses:
      s.enemyLosses ?? s.enemy_losses ? String(s.enemyLosses ?? s.enemy_losses) : null,
    enemyLossesHtml:
      s.enemyLossesHtml ?? s.enemy_losses_html
        ? String(s.enemyLossesHtml ?? s.enemy_losses_html)
        : null,
    aarNotes: s.aarNotes ?? s.aar_notes ? String(s.aarNotes ?? s.aar_notes) : null,
    aarNotesHtml:
      s.aarNotesHtml ?? s.aar_notes_html
        ? String(s.aarNotesHtml ?? s.aar_notes_html)
        : null,
    bdaMediaItems: rawBda.map(normalizeBdaMediaItem).filter((item) => Boolean(item.url)),
    discordEventUrl:
      s.discordEventUrl ?? s.discord_event_url
        ? String(s.discordEventUrl ?? s.discord_event_url)
        : null,
    discordMessageUrl:
      s.discordMessageUrl ?? s.discord_message_url
        ? String(s.discordMessageUrl ?? s.discord_message_url)
        : null,
    aarDiscordMessageUrl:
      s.aarDiscordMessageUrl ?? s.aar_discord_message_url
        ? String(s.aarDiscordMessageUrl ?? s.aar_discord_message_url)
        : null,
  };
}

function normalizeAor(raw: unknown): CampaignMissionAor | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = asRecord(raw);
  if (!a.type) return null;
  return {
    type: String(a.type),
    label: a.label ? String(a.label) : null,
    center_lat:
      a.center_lat !== undefined && a.center_lat !== null ? Number(a.center_lat) : null,
    center_lng:
      a.center_lng !== undefined && a.center_lng !== null ? Number(a.center_lng) : null,
    radius_nm:
      a.radius_nm !== undefined && a.radius_nm !== null ? Number(a.radius_nm) : null,
    north: a.north !== undefined && a.north !== null ? Number(a.north) : null,
    south: a.south !== undefined && a.south !== null ? Number(a.south) : null,
    east: a.east !== undefined && a.east !== null ? Number(a.east) : null,
    west: a.west !== undefined && a.west !== null ? Number(a.west) : null,
    coordinates: Array.isArray(a.coordinates) ? a.coordinates : undefined,
  };
}

function normalizeObjectiveSquadron(raw: unknown): CampaignMissionObjectiveSquadron {
  const sq = asRecord(raw);
  const rawEmblem = sq.emblemUrl ?? sq.emblem_url;
  const emblemStr = rawEmblem ? String(rawEmblem) : '';
  return {
    id: Number(sq.id || 0),
    name: String(sq.name || 'Squadron'),
    abbreviation: String(sq.abbreviation || sq.name || 'SQN'),
    emblemUrl: emblemStr ? normalizePortalCdnUrl(emblemStr, emblemStr) : null,
  };
}

function normalizeObjective(raw: unknown, idx = 0): CampaignMissionObjective {
  if (typeof raw === 'string') {
    const clean = raw.trim();
    return {
      index: idx,
      name: clean || `Objective ${idx + 1}`,
      objective: clean || `Objective ${idx + 1}`,
      status: 'pending',
      isCompleted: false,
    };
  }
  const o = asRecord(raw);
  const resolvedName = String(
    o.objective || o.name || o.title || o.description || `Objective ${idx + 1}`
  ).trim();
  const rawSquadrons = Array.isArray(o.squadrons) ? o.squadrons : [];

  return {
    index: o.index !== undefined ? Number(o.index) : idx,
    name: resolvedName || `Objective ${idx + 1}`,
    objective: resolvedName || `Objective ${idx + 1}`,
    priority: o.priority ? String(o.priority) : undefined,
    status: String(o.status || 'pending'),
    isCompleted: Boolean(o.isCompleted ?? o.is_completed ?? false),
    points: o.points !== undefined ? Number(o.points) : undefined,
    resourceType:
      o.resourceType ?? o.resource_type
        ? String(o.resourceType ?? o.resource_type)
        : undefined,
    resourceLabel:
      o.resourceLabel ?? o.resource_label
        ? String(o.resourceLabel ?? o.resource_label)
        : undefined,
    resourceShortLabel:
      o.resourceShortLabel ?? o.resource_short_label
        ? String(o.resourceShortLabel ?? o.resource_short_label)
        : undefined,
    mgrs: o.mgrs ? String(o.mgrs) : null,
    aor: normalizeAor(o.aor),
    squadrons: rawSquadrons.map(normalizeObjectiveSquadron),
  };
}

function normalizeRewardBadge(raw: unknown): CampaignMissionRewardBadge {
  const b = asRecord(raw);
  return {
    type: String(b.type || 'command_points'),
    label: String(b.label || 'Credits'),
    shortLabel: String(b.shortLabel ?? b.short_label ?? 'CR'),
    amount: Number(b.amount || 0),
  };
}

function normalizeRewardBreakdownItem(raw: unknown): CampaignMissionRewardBreakdownItem {
  const b = asRecord(raw);
  return {
    type: String(b.type || 'command_points'),
    label: String(b.label || 'Credits'),
    shortLabel: String(b.shortLabel ?? b.short_label ?? 'CR'),
    color: String(b.color || 'warning'),
    total: Number(b.total || 0),
    earned: Number(b.earned || 0),
    missionAmount: Number(b.missionAmount ?? b.mission_amount ?? 0),
    objectiveAmount: Number(b.objectiveAmount ?? b.objective_amount ?? 0),
    isFullyEarned: Boolean(b.isFullyEarned ?? b.is_fully_earned ?? false),
  };
}

function normalizeFrequency(raw: unknown): CampaignMissionFrequencyItem {
  const f = asRecord(raw);
  return {
    name: String(f.name || 'Net'),
    frequency: String(f.frequency || ''),
    modulation: String(f.modulation || 'AM'),
    band: String(f.band || 'UHF'),
    notes: f.notes ? String(f.notes) : null,
  };
}

function normalizeMissionFlight(raw: unknown): CampaignMissionFlightItem {
  const f = asRecord(raw);
  const rawSlots = Array.isArray(f.slots) ? f.slots : [];
  return {
    id: Number(f.id || 0),
    callsign: String(f.callsign || 'Flight'),
    task: f.task ? String(f.task) : null,
    frequency: f.frequency ? String(f.frequency) : null,
    packageName:
      f.packageName ?? f.package_name ? String(f.packageName ?? f.package_name) : null,
    slotsCount: Number(f.slotsCount ?? f.slots_count ?? rawSlots.length ?? 0),
    squadronName:
      f.squadronName ?? f.squadron_name ? String(f.squadronName ?? f.squadron_name) : null,
    airframeName:
      f.airframeName ?? f.airframe_name ? String(f.airframeName ?? f.airframe_name) : null,
    slots: rawSlots.map((slot) => {
      const sl = asRecord(slot);
      return {
        position: Number(sl.position || 1),
        status: String(sl.status || 'open'),
        pilotName:
          sl.pilotName ?? sl.pilot_name ? String(sl.pilotName ?? sl.pilot_name) : null,
      };
    }),
  };
}

function normalizeMissionFlightPlanBrief(raw: unknown): CampaignMissionFlightPlanBrief {
  const fp = asRecord(raw);
  return {
    id: Number(fp.id || 0),
    identifier: String(fp.identifier || fp.id || ''),
    name: String(fp.name || fp.callsign || fp.identifier || 'Flight Plan'),
    callsign: String(fp.callsign || fp.name || fp.identifier || 'Flight Plan'),
    authorName:
      fp.authorName ?? fp.author_name ? String(fp.authorName ?? fp.author_name) : null,
    airframeName:
      fp.airframeName ?? fp.airframe_name
        ? String(fp.airframeName ?? fp.airframe_name)
        : null,
    squadronName:
      fp.squadronName ?? fp.squadron_name
        ? String(fp.squadronName ?? fp.squadron_name)
        : null,
    departureAirfield:
      fp.departureAirfield ?? fp.departure_airfield
        ? String(fp.departureAirfield ?? fp.departure_airfield)
        : null,
    destinationAirfield:
      fp.destinationAirfield ?? fp.destination_airfield
        ? String(fp.destinationAirfield ?? fp.destination_airfield)
        : null,
    launchTime:
      fp.launchTime ?? fp.launch_time ? String(fp.launchTime ?? fp.launch_time) : null,
    flightRules: String(fp.flightRules ?? fp.flight_rules ?? 'VFR'),
    isFiled: Boolean(fp.isFiled ?? fp.is_filed ?? false),
    isOpfor: Boolean(fp.isOpfor ?? fp.is_opfor ?? false),
    waypointsCount: Number(fp.waypointsCount ?? fp.waypoints_count ?? 0),
  };
}

function normalizeMission(raw: unknown): CampaignMissionItem {
  const m = asRecord(raw);
  const sorties = Array.isArray(m.sorties) ? m.sorties.map(normalizeSortie) : [];
  const objectives = Array.isArray(m.objectives)
    ? m.objectives.map((obj, idx) => normalizeObjective(obj, idx))
    : [];
  const rewardBadges = Array.isArray(m.rewardBadges ?? m.reward_badges)
    ? ((m.rewardBadges ?? m.reward_badges) as unknown[]).map(normalizeRewardBadge)
    : [];
  const rewardsBreakdown = Array.isArray(m.rewardsBreakdown ?? m.rewards_breakdown)
    ? ((m.rewardsBreakdown ?? m.rewards_breakdown) as unknown[]).map(normalizeRewardBreakdownItem)
    : [];
  const frequencies = Array.isArray(m.frequencies)
    ? m.frequencies.map(normalizeFrequency)
    : [];
  const images = Array.isArray(m.images)
    ? m.images
        .map((img) => {
          const s = String(img || '');
          return s ? normalizePortalCdnUrl(s, s) : '';
        })
        .filter(Boolean)
    : [];
  const flights = Array.isArray(m.flights) ? m.flights.map(normalizeMissionFlight) : [];
  const flightPlans = Array.isArray(m.flightPlans ?? m.flight_plans)
    ? ((m.flightPlans ?? m.flight_plans) as unknown[]).map(normalizeMissionFlightPlanBrief)
    : [];

  const rawSmeac = asRecord(m.smeac);
  const smeaC: CampaignMissionSmeac = {
    situation: rawSmeac.situation ? String(rawSmeac.situation) : null,
    mission: rawSmeac.mission ? String(rawSmeac.mission) : null,
    execution: rawSmeac.execution ? String(rawSmeac.execution) : null,
    admin_logistics: rawSmeac.admin_logistics ? String(rawSmeac.admin_logistics) : null,
    command_signals: rawSmeac.command_signals ? String(rawSmeac.command_signals) : null,
  };

  return {
    id: Number(m.id || 0),
    name: String(m.name || 'Unnamed Mission'),
    status: String(m.status || 'open'),
    statusLabel: String(m.statusLabel ?? m.status_label ?? 'Open'),
    type: m.type ? String(m.type) : null,
    taskingName: String(m.taskingName ?? m.tasking_name ?? m.type ?? 'Strike'),
    squadronName:
      m.squadronName || m.squadron_name ? String(m.squadronName || m.squadron_name) : null,
    planningUserName:
      m.planningUserName || m.planning_user_name
        ? String(m.planningUserName || m.planning_user_name)
        : null,
    descriptionHtml:
      m.descriptionHtml || m.description_html
        ? String(m.descriptionHtml || m.description_html)
        : null,
    smeac: smeaC,
    weather: m.weather ? String(m.weather) : null,
    missionTime:
      m.missionTime || m.mission_time ? String(m.missionTime || m.mission_time) : null,
    startTime: m.startTime || m.start_time ? String(m.startTime || m.start_time) : null,
    lat: m.lat !== null && m.lat !== undefined ? Number(m.lat) : null,
    lng: m.lng !== null && m.lng !== undefined ? Number(m.lng) : null,
    aor: normalizeAor(m.aor),
    frequencies,
    images,
    flightsCount: Number(m.flightsCount ?? m.flights_count ?? flights.length ?? 0),
    flights,
    flightPlans,
    objectivesCount: Number(m.objectivesCount ?? m.objectives_count ?? objectives.length),
    completedObjectivesCount: Number(
      m.completedObjectivesCount ?? m.completed_objectives_count ?? 0
    ),
    objectives,
    sorties,
    totalRewards: asNumberRecord(m.totalRewards ?? m.total_rewards),
    earnedRewards: asNumberRecord(m.earnedRewards ?? m.earned_rewards),
    totalRewardsSummary: String(m.totalRewardsSummary ?? m.total_rewards_summary ?? 'None'),
    earnedRewardsSummary: String(m.earnedRewardsSummary ?? m.earned_rewards_summary ?? 'None'),
    rewardBadges,
    rewardsBreakdown,
    discordThreadUrl:
      m.discordThreadUrl ?? m.discord_thread_url
        ? String(m.discordThreadUrl ?? m.discord_thread_url)
        : null,
    mapUrl: m.mapUrl || m.map_url ? String(m.mapUrl || m.map_url) : null,
  };
}

function normalizeSupplyManifestItem(raw: unknown): CampaignSupplyOrderManifestItem {
  const i = asRecord(raw);
  return {
    id: Number(i.id || 0),
    name: String(i.name || 'Cargo Item'),
    quantity: Number(i.quantity || 1),
    unitWeightLbs: Number(i.unitWeightLbs ?? i.unit_weight_lbs ?? 0),
    totalWeightLbs: Number(i.totalWeightLbs ?? i.total_weight_lbs ?? 0),
    requestedBy:
      i.requestedBy || i.requested_by ? String(i.requestedBy || i.requested_by) : null,
    notes: i.notes ? String(i.notes) : null,
  };
}

function normalizeSupplyOrder(raw: unknown): CampaignSupplyOrderItem {
  const o = asRecord(raw);
  const items = Array.isArray(o.items) ? o.items.map(normalizeSupplyManifestItem) : [];
  return {
    id: Number(o.id || 0),
    identifier: String(o.identifier || 'SUP-00000'),
    flightCallsign: String(o.flightCallsign ?? o.flight_callsign ?? 'Transport Sortie'),
    airframeType: String(o.airframeType ?? o.airframe_type ?? 'c17'),
    airframeShortName: String(o.airframeShortName ?? o.airframe_short_name ?? 'C-17'),
    airframeLabel: String(o.airframeLabel ?? o.airframe_label ?? 'C-17 Globemaster III'),
    status: String(o.status || 'pending'),
    statusLabel: String(o.statusLabel ?? o.status_label ?? 'Pending'),
    statusColor: String(o.statusColor ?? o.status_color ?? 'warning'),
    isOpen: Boolean(o.isOpen ?? o.is_open ?? true),
    originName: String(o.originName ?? o.origin_name ?? 'Off-Map Staging Hub'),
    originIcao: o.originIcao || o.origin_icao ? String(o.originIcao || o.origin_icao) : null,
    destinationName: String(o.destinationName ?? o.destination_name ?? 'Frontline Airbase'),
    distanceNm: Number(o.distanceNm ?? o.distance_nm ?? 0),
    costLogisticsPoints: Number(o.costLogisticsPoints ?? o.cost_logistics_points ?? 0),
    totalWeightLbs: Number(o.totalWeightLbs ?? o.total_weight_lbs ?? 0),
    maxPayloadLbs: Number(o.maxPayloadLbs ?? o.max_payload_lbs ?? 170900),
    remainingPayloadLbs: Number(o.remainingPayloadLbs ?? o.remaining_payload_lbs ?? 0),
    payloadPercentage: Number(o.payloadPercentage ?? o.payload_percentage ?? 0),
    totalItemsCount: Number(o.totalItemsCount ?? o.total_items_count ?? 0),
    notes: o.notes ? String(o.notes) : null,
    createdBy: o.createdBy || o.created_by ? String(o.createdBy || o.created_by) : null,
    items,
  };
}

function normalizeTransaction(raw: unknown): CampaignResourceTransactionItem {
  const t = asRecord(raw);
  return {
    id: Number(t.id || 0),
    resourceType: String(t.resourceType ?? t.resource_type ?? 'command_points'),
    resourceLabel: String(t.resourceLabel ?? t.resource_label ?? 'Credits'),
    resourceShortLabel: String(t.resourceShortLabel ?? t.resource_short_label ?? 'CR'),
    transactionType: String(t.transactionType ?? t.transaction_type ?? 'manual_adjustment'),
    transactionTypeLabel: String(
      t.transactionTypeLabel ?? t.transaction_type_label ?? 'Adjustment'
    ),
    amount: Number(t.amount || 0),
    description: t.description ? String(t.description) : null,
    userName: t.userName || t.user_name ? String(t.userName || t.user_name) : null,
    createdAt: t.createdAt || t.created_at ? String(t.createdAt || t.created_at) : null,
  };
}

function normalizeLorePage(raw: unknown, idx: number): CampaignLorePageItem {
  const p = asRecord(raw);
  const rawImage = p.imageUrl ?? p.image_url;
  const rawAudio = p.audioUrl ?? p.audio_url;
  const rawVideo = p.videoUrl ?? p.video_url;
  const rawEmbed = p.videoEmbedUrl ?? p.video_embed_url;

  return {
    id: Number(p.id || idx + 1),
    pageNumber: Number(p.pageNumber ?? p.page_number ?? idx + 1),
    title: p.title ? String(p.title) : null,
    contentHtml:
      p.contentHtml || p.content_html ? String(p.contentHtml || p.content_html) : null,
    imageUrl: rawImage ? normalizePortalCdnUrl(String(rawImage), '') : null,
    audioUrl: rawAudio ? normalizePortalCdnUrl(String(rawAudio), '') : null,
    audioTitle: p.audioTitle || p.audio_title ? String(p.audioTitle || p.audio_title) : null,
    videoUrl: rawVideo ? String(rawVideo) : null,
    videoEmbedUrl: rawEmbed ? String(rawEmbed) : null,
    videoTitle: p.videoTitle || p.video_title ? String(p.videoTitle || p.video_title) : null,
  };
}

function normalizeLoreChapter(raw: unknown, idx: number): CampaignLoreChapter {
  const l = asRecord(raw);
  const pages = Array.isArray(l.pages) ? l.pages.map(normalizeLorePage) : [];
  const rawCover = l.coverImageUrl ?? l.cover_image_url;

  return {
    id: Number(l.id || idx + 1),
    title: String(l.title || `Chapter ${idx + 1}`),
    slug: String(l.slug || ''),
    order: Number(l.order ?? idx + 1),
    author: l.author ? String(l.author) : null,
    summary: l.summary ? String(l.summary) : null,
    coverImageUrl: rawCover ? normalizePortalCdnUrl(String(rawCover), '') : null,
    totalPages: Number(l.totalPages ?? l.total_pages ?? pages.length),
    pages,
    updatedAt: l.updatedAt || l.updated_at ? String(l.updatedAt || l.updated_at) : null,
  };
}

function normalizeIntelReport(raw: unknown): CampaignIntelReportItem {
  const r = asRecord(raw);
  const rawFiles = r.fileUrls ?? r.file_urls;
  const fileUrls = Array.isArray(rawFiles)
    ? rawFiles.map((u) => normalizePortalCdnUrl(String(u), '')).filter(Boolean)
    : [];

  return {
    id: Number(r.id || 0),
    title: String(r.title || 'Intelligence Report'),
    type: String(r.type || 'note'),
    missionId:
      r.missionId !== null && r.missionId !== undefined
        ? Number(r.missionId)
        : r.mission_id !== null && r.mission_id !== undefined
        ? Number(r.mission_id)
        : null,
    missionName: r.missionName || r.mission_name ? String(r.missionName || r.mission_name) : null,
    sortieId:
      r.sortieId !== null && r.sortieId !== undefined
        ? Number(r.sortieId)
        : r.sortie_id !== null && r.sortie_id !== undefined
        ? Number(r.sortie_id)
        : null,
    sortieName: r.sortieName || r.sortie_name ? String(r.sortieName || r.sortie_name) : null,
    reporterName:
      r.reporterName || r.reporter_name ? String(r.reporterName || r.reporter_name) : null,
    notes: r.notes ? String(r.notes) : null,
    fileUrls,
    videoUrl: r.videoUrl || r.video_url ? String(r.videoUrl || r.video_url) : null,
    discordMessageUrl:
      r.discordMessageUrl || r.discord_message_url
        ? String(r.discordMessageUrl || r.discord_message_url)
        : null,
    portalUrl: r.portalUrl || r.portal_url ? String(r.portalUrl || r.portal_url) : null,
    createdAt: r.createdAt || r.created_at ? String(r.createdAt || r.created_at) : null,
  };
}

function normalizeAirframeEntry(raw: unknown): CampaignTrackedAirframeEntry {
  const a = asRecord(raw);
  const rawImg = a.imageUrl ?? a.image_url;
  const rawBreakdown = asNumberRecord(a.airbaseBreakdown ?? a.airbase_breakdown);

  return {
    dcsEntity: String(a.dcsEntity ?? a.dcs_entity ?? ''),
    name: String(a.name ?? a.dcsEntity ?? a.dcs_entity ?? 'Airframe'),
    abbreviation: String(a.abbreviation ?? a.name ?? ''),
    imageUrl: rawImg ? normalizePortalCdnUrl(String(rawImg), '') : null,
    totalCount: Number(a.totalCount ?? a.total_count ?? 0),
    airbaseBreakdown: rawBreakdown,
  };
}

function normalizeAirframeGroup(raw: unknown): CampaignAirframeSquadronGroup {
  const g = asRecord(raw);
  const rawImg = g.imageUrl ?? g.image_url;
  const airframes = Array.isArray(g.airframes) ? g.airframes.map(normalizeAirframeEntry) : [];

  return {
    id: g.id !== null && g.id !== undefined ? Number(g.id) : null,
    name: String(g.name || 'Task Force / Unassigned'),
    nickname: g.nickname ? String(g.nickname) : null,
    abbreviation: g.abbreviation ? String(g.abbreviation) : null,
    imageUrl: rawImg ? normalizePortalCdnUrl(String(rawImg), '') : null,
    totalCount: Number(g.totalCount ?? g.total_count ?? 0),
    airframes,
  };
}

export function normalizeCampaignItem(raw: unknown): CampaignItem {
  const c = asRecord(raw);
  const resourceBalances = asNumberRecord(c.resourceBalances ?? c.resource_balances);

  const rawPools = c.resourcePools ?? c.resource_pools;
  const resourcePools: CampaignResourcePool[] = Array.isArray(rawPools)
    ? rawPools.map((p) => {
        const pool = asRecord(p);
        return {
          key: String(pool.key || 'command_points'),
          label: String(pool.label || 'Credits'),
          shortLabel: String(pool.shortLabel ?? pool.short_label ?? 'CR'),
          description: String(pool.description || ''),
          color: String(pool.color || 'warning'),
          balance: Number(pool.balance ?? 0),
        };
      })
    : DEFAULT_RESOURCE_POOL_DEFS.map((def) => ({
        ...def,
        balance: Number(resourceBalances[def.key] ?? 0),
      }));

  const rawActiveMissions = c.activeMissions ?? c.active_missions;
  const activeMissions = Array.isArray(rawActiveMissions)
    ? rawActiveMissions.map(normalizeMission)
    : [];

  const rawAllMissions = c.missions;
  const missions = Array.isArray(rawAllMissions)
    ? rawAllMissions.map(normalizeMission)
    : activeMissions;

  const rawLores = c.lores;
  const lores = Array.isArray(rawLores) ? rawLores.map(normalizeLoreChapter) : [];

  const rawIntel = c.intelReports ?? c.intel_reports;
  const intelReports = Array.isArray(rawIntel) ? rawIntel.map(normalizeIntelReport) : [];

  const rawGroups = c.airframeSquadronGroups ?? c.airframe_squadron_groups;
  const airframeSquadronGroups = Array.isArray(rawGroups)
    ? rawGroups.map(normalizeAirframeGroup)
    : [];

  const rawOrders = c.pendingSupplyOrders ?? c.pending_supply_orders;
  const pendingSupplyOrders = Array.isArray(rawOrders)
    ? rawOrders.map(normalizeSupplyOrder)
    : [];

  const rawTx = c.recentTransactions ?? c.recent_transactions;
  const recentTransactions = Array.isArray(rawTx) ? rawTx.map(normalizeTransaction) : [];

  const rawCover = c.coverImageUrl ?? c.cover_image_url;
  const coverImageUrl = rawCover ? normalizePortalCdnUrl(String(rawCover), '') : null;

  const descriptionHtml =
    c.descriptionHtml || c.description_html
      ? String(c.descriptionHtml || c.description_html)
      : null;

  const rawSummary = c.descriptionSummary ?? c.description_summary;
  const descriptionSummary = rawSummary
    ? String(rawSummary)
    : descriptionHtml
    ? stripHtml(descriptionHtml)
    : null;

  const status = String(c.status || 'active');
  const isCompleted = Boolean(c.isCompleted ?? c.is_completed ?? status === 'completed');
  const isActive = Boolean(c.isActive ?? c.is_active ?? status === 'active');

  const computedAirframesTotal = airframeSquadronGroups.reduce(
    (sum, g) => sum + (g.totalCount || 0),
    0
  );

  return {
    id: Number(c.id || 0),
    slug: String(c.slug || ''),
    name: String(c.name || 'Campaign'),
    abbreviation: String(c.abbreviation || 'GTFO'),
    era: c.era ? String(c.era) : null,
    status,
    statusLabel: String(c.statusLabel ?? c.status_label ?? (isCompleted ? 'Completed' : 'Active')),
    statusColor: String(c.statusColor ?? c.status_color ?? (isActive ? 'success' : 'primary')),
    isActive,
    isCompleted,
    theatre: c.theatre ? String(c.theatre) : null,
    theatreId:
      c.theatreId !== null && c.theatreId !== undefined
        ? Number(c.theatreId)
        : c.theatre_id !== null && c.theatre_id !== undefined
        ? Number(c.theatre_id)
        : null,
    dcsServer: c.dcsServer || c.dcs_server ? String(c.dcsServer || c.dcs_server) : null,
    coverImageUrl: coverImageUrl || null,
    descriptionHtml,
    descriptionSummary: descriptionSummary || null,
    startedAt: c.startedAt || c.started_at ? String(c.startedAt || c.started_at) : null,
    endedAt: c.endedAt || c.ended_at ? String(c.endedAt || c.ended_at) : null,
    publishedAt: c.publishedAt || c.published_at ? String(c.publishedAt || c.published_at) : null,
    progressPercentage: Number(c.progressPercentage ?? c.progress_percentage ?? 0),
    totalMissions: Number(c.totalMissions ?? c.total_missions ?? missions.length),
    activeMissionsCount: Number(
      c.activeMissionsCount ?? c.active_missions_count ?? activeMissions.length
    ),
    targetMissions: Number(c.targetMissions ?? c.target_missions ?? 0),
    earnedMissionPoints: Number(c.earnedMissionPoints ?? c.earned_mission_points ?? 0),
    totalObjectivesCount: Number(c.totalObjectivesCount ?? c.total_objectives_count ?? 0),
    completedObjectivesCount: Number(
      c.completedObjectivesCount ?? c.completed_objectives_count ?? 0
    ),
    resourceBalances,
    resourcePools,
    activeMissions,
    missions,
    lores,
    loresCount: Number(c.loresCount ?? c.lores_count ?? lores.length),
    intelReports,
    intelReportsCount: Number(
      c.intelReportsCount ?? c.intel_reports_count ?? intelReports.length
    ),
    airframeSquadronGroups,
    totalTrackedAirframes: Number(
      c.totalTrackedAirframes ?? c.total_tracked_airframes ?? computedAirframesTotal
    ),
    pendingSupplyOrders,
    pendingSupplyOrdersCount: Number(
      c.pendingSupplyOrdersCount ?? c.pending_supply_orders_count ?? pendingSupplyOrders.length
    ),
    recentTransactions,
    portalUrl: c.portalUrl || c.portal_url ? String(c.portalUrl || c.portal_url) : null,
    mapUrl: c.mapUrl || c.map_url ? String(c.mapUrl || c.map_url) : null,
    updatedAt: c.updatedAt || c.updated_at ? String(c.updatedAt || c.updated_at) : null,
  };
}

async function fetchPortalEndpoint<T>(endpoint: string, token?: string): Promise<T | null> {
  if (isTauriRuntime()) {
    try {
      const res = await invoke<T>('fetch_portal_api', {
        endpointUrl: endpoint,
        accessToken: token || null,
      });
      if (res) {
        return res;
      }
    } catch (err) {
      console.warn('Native fetch_portal_api failed, trying sendPortalApiRequest:', err);
    }
  }

  try {
    return await sendPortalApiRequest<T>(endpoint, 'GET', undefined, token);
  } catch (err) {
    console.warn('sendPortalApiRequest failed, trying direct fetch:', err);
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const resp = await fetch(endpoint, { headers, cache: 'no-cache' });
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}`);
  }
  return (await resp.json()) as T;
}

/**
 * GET /api/v1/companion/campaigns
 * Fetches active operational campaigns for S2 - Operations > Campaigns.
 */
export async function fetchCampaigns(
  portalBaseUrl: string,
  token?: string
): Promise<CampaignsResponse> {
  const cleanBase = normalizeCompanionBaseUrl(portalBaseUrl);
  const endpoint = `${cleanBase}/campaigns`;

  try {
    const data = await fetchPortalEndpoint<Record<string, unknown>>(endpoint, token);
    if (data && Array.isArray(data.campaigns)) {
      const campaigns = data.campaigns
        .map(normalizeCampaignItem)
        .filter((c) => c.isActive);
      const rawActiveId = data.activeCampaignId ?? data.active_campaign_id;
      const parsedActiveId = Number(rawActiveId);
      const activeCampaignId =
        rawActiveId !== null &&
        rawActiveId !== undefined &&
        Number.isFinite(parsedActiveId) &&
        campaigns.some((c) => c.id === parsedActiveId)
          ? parsedActiveId
          : campaigns[0]?.id ?? null;

      return {
        campaigns,
        activeCampaignId,
        total: campaigns.length,
        activeCount: campaigns.length,
      };
    }
  } catch (err) {
    console.warn('fetchCampaigns error:', err);
  }

  return {
    campaigns: [],
    activeCampaignId: null,
    total: 0,
    activeCount: 0,
  };
}

/**
 * GET /api/v1/companion/campaigns/{idOrSlug}
 */
export async function fetchCampaignDetail(
  portalBaseUrl: string,
  idOrSlug: number | string,
  token?: string
): Promise<CampaignItem | null> {
  const cleanBase = normalizeCompanionBaseUrl(portalBaseUrl);
  const endpoint = `${cleanBase}/campaigns/${encodeURIComponent(String(idOrSlug))}`;

  try {
    const data = await fetchPortalEndpoint<Record<string, unknown>>(endpoint, token);
    if (data && data.campaign) {
      const normalized = normalizeCampaignItem(data.campaign);
      return normalized.isActive ? normalized : null;
    }
  } catch (err) {
    console.warn('fetchCampaignDetail error:', err);
  }

  return null;
}
