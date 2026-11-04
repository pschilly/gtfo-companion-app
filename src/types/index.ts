export type UserTier = 'guest' | 'community' | 'core';

export type AssetCategory = 'livery' | 'mod' | 'tool';

export type RequiredTier = 'community' | 'core';

/**
 * Defines whether an asset is mandatory or optional:
 * - 'required_all': Mandatory for all GTFO members (Community & CORE)
 * - 'required_core': Mandatory for CORE Roster members
 * - 'optional': Optional modification or livery package
 */
export type RequirementLevel = 'required_all' | 'required_core' | 'optional';

export type NavigationTab =
  | 'home'
  | 'dashboard'
  | 'checklist'
  | 'airframes'
  | 'qualifications'
  | 'awards'
  | 'service_record'
  | 'atc'
  | 'calendar'
  | 'liveries'
  | 'mods'
  | 'library'
  | 'settings'
  | 'squadrons'
  | 'roster'
  | 'qualifications_zone';

export type MemberGradeLevel =
  | 'G0'
  | 'G1'
  | 'G2'
  | 'G3'
  | 'G4'
  | 'G5'
  | 'G6'
  | 'G7'
  | 'G8'
  | 'G9'
  | 'G10'
  | 'G11';

export type MemberPosition = string;

export interface SquadronAssignment {
  code: string; // e.g., '507th FS', '449th TFS', 'VF-141', '19th AAB'
  name: string;
  nickname: string;
  role: string;
  primaryAirframe: string;
  radioCallsign: string;
  emblemUrl: string;
  rosterUrl?: string;
}

export interface QualifiedAirframe {
  id: number;
  name: string;
  abbreviation: string;
  dcsEntity: string;
  imageUrl?: string | null;
  isPrimary: boolean;
  isPilot: boolean;
  isCrew: boolean;
  isInstructor: boolean;
  role: string;
  roleLabel: string;
  status: string;
  discordRole?: string | number;
  squadron?: string;
}

export interface CertificateRequirement {
  skill: string;
  benchmarks: string;
}

export interface MemberCertificate {
  id: number;
  code: string;
  name: string;
  slug: string;
  description: string;
  requirements?: CertificateRequirement[];
  xpValue: number;
  airframe: string;
  airframeAbbreviation?: string;
  airframes?: string[];
  awardedRole?: string;
  status: string;
  isIssued: boolean;
  progress?: number | null;
  startedAt?: string;
  completedAt?: string;
  issuedAt?: string;
  issuedBy?: string;
}

export interface AwardRequirement {
  requirement: string;
}

export interface AwardIssuance {
  id: number;
  issuedAt: string;
  issuedBy?: string;
  citation?: string | null;
}

export interface MemberAward {
  id: number;
  name: string;
  category: string;
  description: string;
  citation?: string | null;
  requirements?: AwardRequirement[];
  xpValue: number;
  issuedAt: string;
  issuedBy?: string;
  ribbonUrl?: string | null;
  medalUrl?: string | null;
  issueCount: number;
  numeralAlignment?: string;
  numeralType?: string;
  numeralUrl?: string | null;
  issuances?: AwardIssuance[];
}

export interface AdminPositionDetail {
  id: number;
  name: string;
  slug: string;
  discordRole?: string | number;
}

export type ServiceRecordType =
  | 'note'
  | 'enlistment'
  | 'squadron'
  | 'grade'
  | 'certificate'
  | 'xp_award'
  | 'xp_penalty'
  | 'callsign_change'
  | 'operation-sortie'
  | 'opfor-sortie'
  | 'training-sortie'
  | string;

export interface ServiceRecordEntry {
  id: number;
  type: ServiceRecordType;
  typeLabel: string;
  color: 'gray' | 'success' | 'warning' | 'info' | 'danger' | string;
  details: string;
  createdAt?: string | null;
}

export interface ServiceRecordStats {
  totalRsvps: number;
  attended: number;
  absent: number;
  pending: number;
  rate: number | null;
  rateFormatted: string;
  totalEntries: number;
}

export interface MemberPortalProfile {
  discordId: string;
  callsign: string;
  avatarUrl?: string | null;
  dcsUcid?: string | null;
  flightIdentifier?: string | null;
  rosterTier: 'CORE' | 'Community';
  grade: MemberGradeLevel;
  gradeTitle: string;
  gradeIconUrl: string;
  xp: number;
  currentGradeXpRequired: number;
  remainingXp?: number;
  gradePercentage?: number;
  tierPercentage?: number;
  timeServedMonths: number;
  timeServedLabel: string;
  joinedAt: string;
  adminPosition?: string | null;
  adminPositions?: string[];
  primaryAdminPosition?: string | null;
  adminPositionDetails?: AdminPositionDetail[];
  isCouncilMember?: boolean;
  isSquadronLeader?: boolean;
  nextGrade?: {
    grade: MemberGradeLevel;
    title?: string;
    xpRequired: number;
    monthsRequired: number;
    insigniaUrl?: string;
  };
  position: MemberPosition;
  checkFlightCompleted: boolean;
  squadronAssignment: SquadronAssignment | null;
  secondarySquadronAssignment?: SquadronAssignment | null;
  qualifiedAirframes: QualifiedAirframe[];
  certificates: MemberCertificate[];
  awards: MemberAward[];
  awardsCount: number;
  serviceRecords?: ServiceRecordEntry[];
  serviceRecordStats?: ServiceRecordStats;
  flightHoursLogged: number;
  portalSyncSource: 'portal_api' | 'discord_fallback';
  lastPortalSyncAt: string;
}

export type DcsTheatre =
  | 'Caucasus'
  | 'PersianGulf'
  | 'Syria'
  | 'SinaiMap'
  | 'MarianaIslands'
  | 'Kola'
  | 'Afghanistan'
  | 'Iraq'
  | 'Nevada';

export interface RouteWaypoint {
  index: number;
  name: string;
  lat: number;
  lon: number;
  altFeet: number;
  speedKnots: number;
  x?: number;
  y?: number;
  action?: string;
  notes?: string;
}

export interface FlightPlanAirframe {
  id: number;
  name: string;
  abbreviation: string;
  dcs_entity: string;
  image_url?: string | null;
  is_dtc_compatible?: boolean;
}

export interface FlightPlanSquadron {
  id: number;
  name: string;
  abbreviation: string;
  patch_url?: string | null;
}

export interface RouteSummary {
  waypoint_count: number;
  min_altitude_feet: number | null;
  max_altitude_feet: number | null;
  min_speed_knots: number | null;
  max_speed_knots: number | null;
  total_distance_nm?: number | null;
  estimated_flight_time_formatted?: string | null;
  leg_count?: number | null;
}

export type FlightPlanRouteSummary = RouteSummary;

export interface FlightPlanDownloadUrls {
  dtc: string | null;       // null if airframe is not DTC-compatible
  dcs_route: string;        // .lua route preset file
  pdf: string;              // PDF kneeboard packet
  custom_airspace?: string | null; // JF-17 Custom Airspace (.ini)
  jf17_airspace?: string | null;   // alias
}

export interface FlightPlanDivert {
  name: string;
  icao?: string;
}

export interface FlightPlanRoutePoint {
  index: number;
  name: string;
  lat: number;
  lng: number;
  alt: number;
  speed: number;
  tot?: string | null;
  mgrs?: string | null;
  ddm?: string | null;
  remarks?: string | null;
  notes?: string | null;
  action?: string | null;
  type?: string | null;
  x?: number;
  y?: number;
}

export interface FlightPlanSummary {
  id: number;
  identifier: string;             // Permanent FP ID (e.g. "FP-B7K9Q") - READ ONLY
  name: string;                   // Display / custom name or callsign
  callsign: string;
  description: string | null;
  color: string;
  is_opfor: boolean;
  is_private: boolean;
  is_assigned_to_mission: boolean;
  is_creator: boolean;
  is_slotted: boolean;
  is_signed_up: boolean;
  is_filed: boolean;              // true if filed with ATC
  filed_at: string | null;        // ISO 8601 timestamp (e.g. "2026-10-22T14:02:18+00:00")
  departure_airfield: string | null;
  destination_airfield: string | null;
  diverts: Array<FlightPlanDivert | string>;
  launch_time: string | null;
  fuel_amount: string | null;
  flight_rules: 'VFR' | 'IFR' | string;
  coordinate_format?: 'LATLON' | 'MGRS' | string;
  remarks: string | null;
  formatted_loadout: string | null;
  route_summary: RouteSummary;
  airframe_id?: number | null;
  airframe: {
    id: number;
    name: string;
    abbreviation: string;
    dcs_entity: string;
    image_url?: string | null;
    is_dtc_compatible: boolean;
  } | null;
  squadron_id?: number | null;
  squadron: {
    id: number;
    name: string;
    abbreviation: string;
    patch_url?: string | null;
  } | null;
  campaign_id?: number | null;
  campaign?: {
    id: number;
    name: string;
    slug?: string;
    theatre?: string | null;
  } | null;
  mission_id?: number | null;
  mission?: {
    id: number;
    name: string;
    status: string;
    start_time?: string | null;
    mission_time?: string | null;
  } | null;
  sortie_id?: number | null;
  sortie?: {
    id: number;
    name: string;
    sortie_number: number;
    scheduled_at?: string | null;
  } | null;
  flight_id?: number | null;
  flight?: {
    id: number;
    callsign: string;
  } | null;
  creator?: {
    id: number;
    name: string;
    callsign: string;
    discord_id: string | null;
  } | null;
  is_dtc_compatible: boolean;
  detail_url?: string;
  download_urls: FlightPlanDownloadUrls;
  file_atc_url?: string;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface FlightPlanCommsEntry {
  type?: string;
  label?: string;
  name?: string;
  frequency: string;
  channel?: string | number;
  modulation?: string;
  notes?: string;
  [key: string]: any;
}

export interface FlightPlanDetail extends FlightPlanSummary {
  route_points: Array<FlightPlanRoutePoint>;
  loadout?: Record<string, unknown> | null;
  station_loadout?: Record<string, string>;
  comms_ladder?: FlightPlanCommsEntry[] | Record<string, any> | null;
  default_comms_ladder?: {
    task_force?: FlightPlanCommsEntry[] | Record<string, any>;
    squadron?: FlightPlanCommsEntry[] | Record<string, any>;
    support?: FlightPlanCommsEntry[] | Record<string, any>;
    tankers?: FlightPlanCommsEntry[] | Record<string, any>;
    awacs?: FlightPlanCommsEntry[] | Record<string, any>;
    [key: string]: any;
  };
  airfield_frequencies?: Record<string, FlightPlanCommsEntry[]> | Array<any>;
  avionics?: {
    mids: Record<string, unknown> | null;
    cmds: Record<string, unknown> | null;
    sa: Record<string, unknown> | null;
    geolines: Record<string, unknown> | null;
    dest_points: Record<string, unknown> | null;
  };
  mids_settings?: {
    mids_a_channel?: string | number | null;
    mids_b_channel?: string | number | null;
    net_label?: string | null;
    [key: string]: any;
  } | null;
  cmds_settings?: Record<string, any> | Array<any> | null;
  sa_settings?: Record<string, any> | null;
  geo_lines_settings?: Record<string, any> | null;
  dest_points_settings?: Record<string, any> | null;
  metadata?: Record<string, unknown> | null;
}

export interface FiledFlightPlansResponse {
  total: number;
  plans: FlightPlanSummary[];
}

export interface FileAtcResponse {
  success: boolean;
  message: string;
  filed_at?: string | null;
  plan?: FlightPlanSummary | FlightPlanDetail;
}

export interface ActiveSortie {
  id: number;
  name: string;
  sortie_number: number;
  scheduled_at: string;
  signup_cutoff_at?: string | null;
  is_signup_open: boolean;
  has_aar: boolean;
  mission_name: string;
  campaign_name: string;
  theatre: string;
  notes?: string | null;
}

export interface ActiveSortieResponse {
  active_sortie: ActiveSortie | null;
  total: number;
  plans: FlightPlanSummary[];
}

export interface MemberFlightPlansResponse {
  member?: {
    id: number;
    callsign: string;
    discord_id: string;
    dcs_ucid?: string | null;
  };
  total: number;
  missions_count: number;
  authored_count: number;
  private_count: number;
  plans: FlightPlanSummary[];
}

export interface DcsDtcData {
  format: 'dcs_native_dtc' | 'dcs_dtc_mod';
  fileName: string;
  aircraft: string;
  targetSubfolder: 'DataCartridge' | 'DTC';
  radioPresets: {
    radioName: string;
    channels: { channel: number; frequencyMhz: string; label: string }[];
  }[];
  waypoints: RouteWaypoint[];
  cmsProgram?: string;
  bingoFuelLbs?: number;
  rawPayload: Record<string, unknown>;
}

export interface RouteToolPresetData {
  presetName: string;
  theatre: DcsTheatre;
  aircraft: string;
  waypoints: RouteWaypoint[];
}

export interface AtcKneeboardItem {
  id: string;
  title: string;
  fileName: string;
  aircraftFolder: string; // e.g. 'F-16C_50', 'FA-18C_hornet', or 'ALL' (root Kneeboard)
  pageType: 'briefing_card' | 'comms_matrix' | 'approach_plate' | 'mission_miz';
  downloadUrl?: string;
  generatedSvgContent?: string;
}

export interface AtcFlightPlanPackage {
  id: string;
  operationName: string;
  missionTitle: string;
  missionDate: string;
  zuluTime: string;
  theatre: DcsTheatre;
  squadron: string;
  callsign: string;
  aircraft: string;
  tasking: string;
  depAirfield: string;
  arrAirfield: string;
  altAirfield?: string;
  cruiseAlt: string;
  packageCommander: string;
  tacticalSummary: string;
  requiredTier: RequiredTier;
  dtcPackage: DcsDtcData;
  routePreset: RouteToolPresetData;
  kneeboards: AtcKneeboardItem[];
}

export interface InstalledAtcState {
  installedDtcIds: Record<string, { installedPath: string; installedAt: string }>;
  mergedRoutePresets: Record<string, { theatre: DcsTheatre; filePath: string; mergedAt: string }>;
  installedKneeboardIds: Record<string, { installedPath: string; installedAt: string }>;
}

export interface AssetItem {
  id: string;
  name: string;
  description: string;
  category: AssetCategory;
  aircraftOrModule: string;
  version: string;
  author: string;
  imagePreviewUrl: string;
  previewGallery?: { label: string; url: string }[];
  targetFolder: string;
  installFolderName: string;
  githubRepo?: string;
  githubBranch?: string;
  githubPathPrefixes?: string[];
  fileCount?: number;
  requiredTier: RequiredTier;
  requirementLevel: RequirementLevel;
  downloadUrl: string;
  archiveSubfolder?: string;
  sha256: string;
  fileSizeBytes: number;
  updatedAt: string;
  changelog?: string[];
  tags?: string[];
  featured?: boolean;
  isExternal?: boolean;
  externalUrl?: string;
  detectionPath?: string;
}

export interface AssetManifest {
  schemaVersion: number;
  communityName: string;
  manifestVersion: string;
  generatedAt: string;
  announcement?: {
    title: string;
    message: string;
    type: 'info' | 'warning' | 'tactical';
  };
  assets: AssetItem[];
}

export interface InstalledAssetRecord {
  assetId: string;
  name: string;
  category: AssetCategory;
  aircraftOrModule: string;
  installedVersion: string;
  targetFolder: string;
  installFolderName: string;
  installedPath: string;
  installedAt: string;
  sha256: string;
  extractedFiles: string[];
}

export interface DiscordUserSession {
  id: string;
  username: string;
  globalName: string;
  discriminator: string;
  avatarUrl: string | null;
  guildId: string;
  isGuildMember: boolean;
  roleIds: string[];
  tier: UserTier;
  accessToken?: string;
  serverNickname?: string | null;
  authenticatedAt: string;
}

export interface DcsPathCandidate {
  label: string;
  path: string;
  exists: boolean;
  variant: 'openbeta' | 'release' | 'custom';
}

export interface DcsEnvironmentInfo {
  activeSavedGamesPath: string;
  detectedCandidates: DcsPathCandidate[];
  savedGamesRoot: string;
  activeWorldRootPath: string;
  detectedWorldCandidates: DcsPathCandidate[];
}

export interface Jf17AirspaceInstallResult {
  filePath: string;
  directoryPath: string;
  fileName: string;
  fileSizeBytes?: number;
}

export interface DownloadProgressEvent {
  assetId: string;
  stage: 'connecting' | 'downloading' | 'verifying' | 'extracting' | 'completed' | 'error';
  bytesDownloaded: number;
  totalBytes: number;
  percent: number;
  message: string;
}

export interface TelemetryLogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'success' | 'warn' | 'error';
  source: 'SYSTEM' | 'AUTH' | 'MANIFEST' | 'INSTALLER' | 'PORTAL' | 'ATC';
  message: string;
}

export interface WindowPreferences {
  startMinimized: boolean;
  minimizeToTray: boolean;
  closeToTray: boolean;
}

export type NotificationCategory = 'app' | 'livery' | 'mod' | 'flight_plan' | 'calendar' | 'announcement';

export interface AppNotification {
  id: string;
  fingerprint?: string;
  title: string;
  message: string;
  category: NotificationCategory;
  timestamp: string; // ISO string
  read: boolean;
  actionTab?: NavigationTab;
  actionAssetId?: string;
  metadata?: Record<string, unknown>;
}

export interface AppSettings {
  dcsSavedGamesPath: string;
  dcsWorldRootPath: string;
  autoDetectDcsPath: boolean;
  autoSyncOnStartup: boolean;
  verifyFileHash: boolean;
  memberPortalApiUrl: string;
  hasConfirmedDcsPath?: boolean;
  startMinimized: boolean;
  minimizeToTray: boolean;
  closeToTray: boolean;
  enableDesktopNotifications: boolean;
  notifyAppUpdates: boolean;
  notifyAssetUpdates: boolean;
  notifyFlightPlans: boolean;
  notifyCalendarEvents: boolean;
  calendarReminderMinutes: number[];
  calendarRemindOnlyAttending: boolean;
  pollingIntervalMinutes: number;
  /** S1: Task Force Roster display preference (default false = CORE only) */
  rosterShowAllMembers: boolean;
  /** S3: User-tracked qualification IDs in progress in the LMS */
  trackedQualificationIds: number[];
  /** S3: Interactive checklist checkpoints keyed by `${certId}_${skillIdx}_${itemIdx}` */
  completedQualificationCheckpoints: Record<string, boolean>;
}

export interface TaskForceRibbon {
  id: number;
  name: string;
  description?: string | null;
  ribbonUrl: string;
  medalUrl?: string | null;
  issueCount?: number;
  numeralUrl?: string | null;
}

export interface TaskForceMember {
  id: number;
  name: string;
  callsign: string;
  discordId?: string | number | null;
  group: 'CORE' | 'Community' | string;
  tier: 'CORE' | 'Community' | string;
  isCore: boolean;
  status: string;
  avatar?: string | null;
  grade: MemberGradeLevel | string;
  gradeName: string;
  rank: string;
  insigniaUrl?: string | null;
  squadron?: string | null;
  squadronAbbreviation?: string | null;
  squadronEmblemUrl?: string | null;
  position?: string | null;
  flightIdentifier?: string | null;
  primaryAirframe?: string | null;
  primaryAirframeAbbreviation?: string | null;
  adminPositions?: string[];
  primaryAdminPosition?: string | null;
  isCouncil?: boolean;
  isCouncilMember?: boolean;
  isLeadership?: boolean;
  isSquadronLeader?: boolean;
  isSpecialist?: boolean;
  ribbons?: TaskForceRibbon[];
  ribbonRackUrl?: string | null;
  xp: number;
  enlistedAt?: string | null;
  certificatesCount?: number;
  awardsCount?: number;
}

export interface SquadronOperatedAirframe {
  id: number;
  name: string;
  abbreviation: string;
  dcsEntity?: string;
  imageUrl?: string | null;
}

export interface SquadronCallsignEntry {
  callsign: string;
  purpose?: string | null;
  airframe?: string | null;
}

export interface SquadronDetail {
  id: number;
  slug: string;
  code: string;
  abbreviation: string;
  name: string;
  nickname?: string | null;
  role: string;
  primaryAirframe?: string | null;
  description?: string | null;
  emblemUrl: string;
  callsigns?: SquadronCallsignEntry[];
  frequencies?: Array<{
    name?: string;
    frequency?: string;
    modulation?: string;
    description?: string;
    notes?: string;
  }>;
  liveries?: string[];
  discordRole?: string | number | null;
  pilotsCount?: number;
  airframes?: SquadronOperatedAirframe[];
  sortOrder?: number;
}

export interface QualificationCourse {
  id: number;
  code: string;
  name: string;
  slug: string;
  category: string;
  description?: string | null;
  airframe?: string | null;
  airframeAbbreviation?: string | null;
  airframes?: string[];
  awardedRole?: string | null;
  xpValue: number;
  requirements: CertificateRequirement[];
  totalHops?: number;
  sortOrder?: number;
}

export interface IntegrityCheckResult {
  valid: boolean;
  missingFiles: string[];
  modifiedFiles: string[];
  checkedCount: number;
}

export interface DcsNicknameInfo {
  currentNickname: string | null;
  nicknames: string[];
  filePath: string;
  fileExists: boolean;
}

export interface ChecklistSummary {
  isModsComplete: boolean;
  isLiveriesComplete: boolean;
  isNickComplete: boolean;
  isDcsBotLinked: boolean;
  completedSteps: number;
  totalSteps: number;
  pendingCount: number;
  allComplete: boolean;
}

export type CalendarEventType = 'campaign' | 'training';

export interface CalendarEventAttendee {
  id: number;
  user_id: number;
  callsign: string;
  flight_callsign?: string | null;
  discord_id?: string | null;
  airframe_id?: number | null;
  airframe_name?: string | null;
  airframe_abbreviation?: string | null;
  role: string;
  role_label: string;
  is_support?: boolean;
  is_opfor: boolean;
  is_present?: boolean | null;
  xp_awarded?: boolean;
  squadron_name?: string | null;
  squadron_abbreviation?: string | null;
  notes?: string | null;
}

export interface CalendarEventMyRsvp {
  id: number;
  airframe_id?: number | null;
  airframe_name?: string | null;
  airframe_abbreviation?: string | null;
  role: string;
  role_label: string;
  is_support?: boolean;
  is_opfor: boolean;
  callsign?: string | null;
  flight_callsign?: string | null;
  notes?: string | null;
}

export interface CalendarRsvpRoleOption {
  value: string;
  label: string;
}

export interface CalendarAuthorizedCallsignOption {
  callsign: string;
  purpose?: string | null;
  airframe_id?: number | null;
  is_primary_for_airframe?: boolean;
  label?: string | null;
}

export interface CalendarRsvpAirframeOption {
  id: number;
  name: string;
  abbreviation: string;
  label?: string;
  dcs_entity?: string;
  image_url?: string | null;
  is_primary?: boolean;
  status?: string;
  squadron_id?: number | null;
  squadron_name?: string | null;
  squadron_abbreviation?: string | null;
  authorized_callsigns?: CalendarAuthorizedCallsignOption[];
  allowed_roles: CalendarRsvpRoleOption[];
}

export interface CalendarSupportRoleOption {
  value: string;
  label: string;
  short_label?: string;
  eligible: boolean;
}

export interface CalendarRsvpOptions {
  campaign_airframes: CalendarRsvpAirframeOption[];
  training_airframes: CalendarRsvpAirframeOption[];
  support_roles?: CalendarSupportRoleOption[];
}

export interface CalendarEventItem {
  uid: string; // e.g., "campaign-12" or "training-5"
  id: number;
  type: CalendarEventType;
  type_label: string;
  category_badge: string;
  name: string;
  title: string;
  subtitle?: string | null;
  scheduled_at: string;
  signup_cutoff_at?: string | null;
  has_cutoff: boolean;
  is_signup_open: boolean;
  is_concluded: boolean;
  has_aar: boolean;
  theatre?: string | null;
  server?: string | null;
  notes?: string | null;
  campaign_id?: number | null;
  campaign_name?: string | null;
  campaign_abbreviation?: string | null;
  mission_id?: number | null;
  mission_name?: string | null;
  sortie_number?: number | null;
  trainer_name?: string | null;
  trainer_discord_id?: string | null;
  allow_opfor: boolean;
  opfor_slots?: number | null;
  opfor_count?: number;
  is_opfor_eligible: boolean;
  has_available_opfor_slots: boolean;
  game_master_slots?: number;
  game_master_count?: number;
  has_available_game_master_slots?: boolean;
  can_rsvp_game_master?: boolean;
  jtac_slots?: number;
  jtac_count?: number;
  has_available_jtac_slots?: boolean;
  can_rsvp_jtac?: boolean;
  atc_slots?: number;
  atc_count?: number;
  has_available_atc_slots?: boolean;
  can_rsvp_atc?: boolean;
  gci_slots?: number;
  gci_count?: number;
  has_available_gci_slots?: boolean;
  can_rsvp_gci?: boolean;
  attendee_count: number;
  blufor_count: number;
  is_attending: boolean;
  my_rsvp?: CalendarEventMyRsvp | null;
  attendees: CalendarEventAttendee[];
  discord_event_url?: string | null;
  discord_thread_url?: string | null;
  aar_discord_url?: string | null;
  portal_url?: string | null;
  our_losses?: string | null;
  enemy_losses?: string | null;
  aar_notes?: string | null;
  concluded_at?: string | null;
  can_complete?: boolean;
}

export interface SubmitCalendarCompletePayload {
  discord_id?: string;
  notes?: string | null;
  aar_notes?: string | null;
  attendance?: Record<number, boolean>;
}

export interface CalendarEventsResponse {
  year: number;
  month: number;
  month_name: string;
  range_start: string;
  range_end: string;
  latest_event_date?: string | null;
  latest_event_year?: number | null;
  latest_event_month?: number | null;
  total: number;
  campaign_count: number;
  training_count: number;
  attending_count: number;
  rsvp_options: CalendarRsvpOptions;
  events: CalendarEventItem[];
}

export interface CalendarRsvpResponse {
  success: boolean;
  message?: string;
  error?: string;
  event?: CalendarEventItem;
}



