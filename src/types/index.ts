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
  | 'campaigns'
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
  homeLayout?: HomeLayoutPreferences | null;
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
  tasking_id?: number | null;
  tasking?: Record<string, any> | null;
  route_points: Array<FlightPlanRoutePoint>;
  loadout?: Record<string, unknown> | string | null;
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
    mids_a_name?: string | null;
    mids_a_notes?: string | null;
    mids_b_channel?: string | number | null;
    mids_b_name?: string | null;
    mids_b_notes?: string | null;
    net_label?: string | null;
    lead_stn?: string | null;
    [key: string]: any;
  } | null;
  cmds_settings?: Record<string, any> | Array<any> | null;
  sa_settings?: Record<string, any> | null;
  geo_lines_settings?: Record<string, any> | null;
  dest_points_settings?: Array<Record<string, any>> | Record<string, any> | null;
  f14_plot_lines_settings?: Record<string, any> | null;
  jf17_airspace_settings?: Record<string, any> | null;
  overhead_pattern?: Record<string, any> | null;
  comm1?: FlightPlanCommsEntry[];
  comm2?: FlightPlanCommsEntry[];
  comms_ladder_by_radio?: Record<string, FlightPlanCommsEntry[]>;
  gun_loadout?: string | null;
  countermeasures_loadout?: string | null;
  can_edit?: boolean;
  can_delete?: boolean;
  is_f18?: boolean;
  is_f16?: boolean;
  is_f14?: boolean;
  is_jf17?: boolean;
  has_cmds?: boolean;
  has_mids?: boolean;
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
  actionEventUid?: string;
  actionFlightPlanId?: string | number;
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
  /** Home: Optional campaign ID pinned to the Home page dashboard widget */
  pinnedCampaignId?: number | null;
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

export type HomeWidgetId =
  | 'upcoming_sorties'
  | 'filed_flight_plans'
  | 'pinned_campaign'
  | 'my_flight_plans'
  | 'dossier_summary'
  | 'tracked_qualifications'
  | 'qualified_airframes';

export type HomeWidgetColSpan = 4 | 6 | 8 | 12;

export interface HomeWidgetItem {
  id: HomeWidgetId;
  enabled: boolean;
  colSpan: HomeWidgetColSpan;
  order: number;
}

export interface HomeLayoutPreferences {
  version: number;
  updatedAt: string;
  pinnedCampaignId?: number | null;
  widgets: HomeWidgetItem[];
}

export interface CampaignResourcePool {
  key: 'command_points' | 'airframe_credits' | 'isr_credits' | 'logistics_points' | string;
  label: string;
  shortLabel: string;
  description: string;
  color: string;
  balance: number;
}

export interface CampaignSortieAttendeeItem {
  id: number;
  userId?: number | null;
  callsign: string;
  flightCallsign?: string | null;
  discordId?: string | null;
  airframeId?: number | null;
  airframeName?: string | null;
  airframeAbbreviation?: string | null;
  role: string;
  roleLabel: string;
  isSupport: boolean;
  isOpfor: boolean;
  isPresent?: boolean | null;
  xpAwarded: boolean;
  squadronName?: string | null;
  squadronAbbreviation?: string | null;
}

export interface CampaignSortieBdaMediaItem {
  url: string;
  isVideo: boolean;
  extension: string;
  filename: string;
}

export interface CampaignMissionSortieBrief {
  id: number;
  calendarEventUid: string;
  sortieNumber: number;
  name: string;
  scheduledAt?: string | null;
  signupCutoffAt?: string | null;
  isSignupOpen: boolean;
  isConcluded: boolean;
  hasAar: boolean;
  notes?: string | null;
  notesHtml?: string | null;
  allowOpfor: boolean;
  opforSlots?: number | null;
  opforCount: number;
  bluforCount: number;
  gameMasterSlots: number;
  gameMasterCount: number;
  jtacSlots: number;
  jtacCount: number;
  atcSlots: number;
  atcCount: number;
  gciSlots: number;
  gciCount: number;
  attendeesCount: number;
  attendedCount: number;
  absentCount: number;
  attendees: CampaignSortieAttendeeItem[];
  ourLosses?: string | null;
  ourLossesHtml?: string | null;
  enemyLosses?: string | null;
  enemyLossesHtml?: string | null;
  aarNotes?: string | null;
  aarNotesHtml?: string | null;
  bdaMediaItems: CampaignSortieBdaMediaItem[];
  discordEventUrl?: string | null;
  discordMessageUrl?: string | null;
  aarDiscordMessageUrl?: string | null;
}

export interface CampaignMissionObjectiveSquadron {
  id: number;
  name: string;
  abbreviation: string;
  emblemUrl?: string | null;
}

export interface CampaignMissionAor {
  type: string;
  label?: string | null;
  center_lat?: number | null;
  center_lng?: number | null;
  radius_nm?: number | null;
  north?: number | null;
  south?: number | null;
  east?: number | null;
  west?: number | null;
  coordinates?: unknown[];
}

export interface CampaignMissionObjective {
  index?: number;
  name: string;
  objective?: string;
  priority?: string;
  status: string;
  isCompleted: boolean;
  points?: number;
  resourceType?: string;
  resourceLabel?: string;
  resourceShortLabel?: string;
  mgrs?: string | null;
  aor?: CampaignMissionAor | null;
  squadrons?: CampaignMissionObjectiveSquadron[];
}

export interface CampaignMissionFrequencyItem {
  name: string;
  frequency: string;
  modulation: string;
  band: string;
  notes?: string | null;
}

export interface CampaignMissionRewardBreakdownItem {
  type: string;
  label: string;
  shortLabel: string;
  color: string;
  total: number;
  earned: number;
  missionAmount: number;
  objectiveAmount: number;
  isFullyEarned: boolean;
}

export interface CampaignMissionFlightSlotItem {
  position: number;
  status: string;
  pilotName?: string | null;
}

export interface CampaignMissionFlightItem {
  id: number;
  callsign: string;
  task?: string | null;
  frequency?: string | null;
  packageName?: string | null;
  slotsCount: number;
  squadronName?: string | null;
  airframeName?: string | null;
  slots: CampaignMissionFlightSlotItem[];
}

export interface CampaignMissionFlightPlanBrief {
  id: number;
  identifier: string;
  name: string;
  callsign: string;
  authorName?: string | null;
  airframeName?: string | null;
  squadronName?: string | null;
  departureAirfield?: string | null;
  destinationAirfield?: string | null;
  launchTime?: string | null;
  flightRules: string;
  isFiled: boolean;
  isOpfor: boolean;
  waypointsCount: number;
}

export interface CampaignMissionRewardBadge {
  type: string;
  label: string;
  shortLabel: string;
  amount: number;
}

export type CampaignSubTab =
  | 'overview'
  | 'map'
  | 'lore'
  | 'missions'
  | 'intel'
  | 'airframes'
  | 'campaigns_grid';

export interface CampaignMissionSmeac {
  situation?: string | null;
  mission?: string | null;
  execution?: string | null;
  admin_logistics?: string | null;
  command_signals?: string | null;
}

export interface CampaignLorePageItem {
  id: number;
  pageNumber: number;
  title?: string | null;
  contentHtml?: string | null;
  imageUrl?: string | null;
  audioUrl?: string | null;
  audioTitle?: string | null;
  videoUrl?: string | null;
  videoEmbedUrl?: string | null;
  videoTitle?: string | null;
}

export interface CampaignLoreChapter {
  id: number;
  title: string;
  slug: string;
  order: number;
  author?: string | null;
  summary?: string | null;
  coverImageUrl?: string | null;
  totalPages: number;
  pages: CampaignLorePageItem[];
  updatedAt?: string | null;
}

export interface CampaignIntelReportItem {
  id: number;
  title: string;
  type: 'image' | 'video' | 'audio' | 'document' | 'note' | string;
  missionId?: number | null;
  missionName?: string | null;
  sortieId?: number | null;
  sortieName?: string | null;
  reporterName?: string | null;
  notes?: string | null;
  fileUrls: string[];
  videoUrl?: string | null;
  discordMessageUrl?: string | null;
  portalUrl?: string | null;
  createdAt?: string | null;
}

export interface CampaignTrackedAirframeEntry {
  dcsEntity: string;
  name: string;
  abbreviation: string;
  imageUrl?: string | null;
  totalCount: number;
  airbaseBreakdown: Record<string, number>;
}

export interface CampaignAirframeSquadronGroup {
  id?: number | null;
  name: string;
  nickname?: string | null;
  abbreviation?: string | null;
  imageUrl?: string | null;
  totalCount: number;
  airframes: CampaignTrackedAirframeEntry[];
}

export interface CampaignMissionItem {
  id: number;
  name: string;
  status: string;
  statusLabel: string;
  type?: string | null;
  taskingName: string;
  squadronName?: string | null;
  planningUserName?: string | null;
  descriptionHtml?: string | null;
  smeac?: CampaignMissionSmeac;
  weather?: string | null;
  missionTime?: string | null;
  startTime?: string | null;
  lat?: number | null;
  lng?: number | null;
  aor?: CampaignMissionAor | null;
  frequencies: CampaignMissionFrequencyItem[];
  images: string[];
  flightsCount: number;
  flights: CampaignMissionFlightItem[];
  flightPlans: CampaignMissionFlightPlanBrief[];
  objectivesCount: number;
  completedObjectivesCount: number;
  objectives: CampaignMissionObjective[];
  sorties: CampaignMissionSortieBrief[];
  totalRewards: Record<string, number>;
  earnedRewards: Record<string, number>;
  totalRewardsSummary: string;
  earnedRewardsSummary: string;
  rewardBadges: CampaignMissionRewardBadge[];
  rewardsBreakdown: CampaignMissionRewardBreakdownItem[];
  discordThreadUrl?: string | null;
  mapUrl?: string | null;
}

export interface CampaignSupplyOrderManifestItem {
  id: number;
  name: string;
  quantity: number;
  unitWeightLbs: number;
  totalWeightLbs: number;
  requestedBy?: string | null;
  notes?: string | null;
}

export interface CampaignSupplyOrderItem {
  id: number;
  identifier: string;
  flightCallsign: string;
  airframeType: string;
  airframeShortName: string;
  airframeLabel: string;
  status: string;
  statusLabel: string;
  statusColor: string;
  isOpen: boolean;
  originName: string;
  originIcao?: string | null;
  destinationName: string;
  distanceNm: number;
  costLogisticsPoints: number;
  totalWeightLbs: number;
  maxPayloadLbs: number;
  remainingPayloadLbs: number;
  payloadPercentage: number;
  totalItemsCount: number;
  notes?: string | null;
  createdBy?: string | null;
  items: CampaignSupplyOrderManifestItem[];
}

export interface CampaignResourceTransactionItem {
  id: number;
  resourceType: string;
  resourceLabel: string;
  resourceShortLabel: string;
  transactionType: string;
  transactionTypeLabel: string;
  amount: number;
  description?: string | null;
  userName?: string | null;
  createdAt?: string | null;
}

export interface CampaignItem {
  id: number;
  slug: string;
  name: string;
  abbreviation: string;
  era?: string | null;
  status: string;
  statusLabel: string;
  statusColor: string;
  isActive: boolean;
  isCompleted: boolean;
  theatre?: string | null;
  theatreId?: number | null;
  dcsServer?: string | null;
  coverImageUrl?: string | null;
  descriptionHtml?: string | null;
  descriptionSummary?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  publishedAt?: string | null;
  progressPercentage: number;
  totalMissions: number;
  activeMissionsCount: number;
  targetMissions: number;
  earnedMissionPoints: number;
  totalObjectivesCount: number;
  completedObjectivesCount: number;
  resourceBalances: Record<string, number>;
  resourcePools: CampaignResourcePool[];
  activeMissions: CampaignMissionItem[];
  missions: CampaignMissionItem[];
  lores: CampaignLoreChapter[];
  loresCount: number;
  intelReports: CampaignIntelReportItem[];
  intelReportsCount: number;
  airframeSquadronGroups: CampaignAirframeSquadronGroup[];
  totalTrackedAirframes: number;
  pendingSupplyOrders: CampaignSupplyOrderItem[];
  pendingSupplyOrdersCount: number;
  recentTransactions: CampaignResourceTransactionItem[];
  portalUrl?: string | null;
  mapUrl?: string | null;
  updatedAt?: string | null;
}

export interface CampaignsResponse {
  campaigns: CampaignItem[];
  activeCampaignId: number | null;
  total: number;
  activeCount: number;
}

export interface CampaignMapPermissions {
  canViewMap: boolean;
  canCreateFlightPlan: boolean;
  canManageFlightPlans: boolean;
  canManageBothCoalitions: boolean;
  canManageThreats: boolean;
  canManageSupportAssets: boolean;
  canCreateTacticalMarkings: boolean;
  canManageCampaignTacticalMarkings: boolean;
  canManageMissionTacticalMarkings: boolean;
  canManageSortieTacticalMarkings: boolean;
  canManageSharedTacticalMarkings: boolean;
  canViewIsr: boolean;
  canRequestIsr: boolean;
  canManageIsr: boolean;
  canMarkupIsr: boolean;
  canEditMissionAor: boolean;
  isSuperAdmin: boolean;
  isCouncil: boolean;
}

export interface CampaignMapHeader {
  id: number;
  name: string;
  slug: string;
  theatre?: string | null;
  theatreDcsName?: string | null;
  dcsServer?: string | null;
  isTraining: boolean;
  magneticDeclination?: number | null;
  campaignDate?: string | null;
  center: {
    lat: number;
    lng: number;
    zoom: number;
  };
  bounds?: any;
  isrCreditsBalance: number;
}

export interface CampaignMapProcedureWaypoint {
  name?: string;
  lat: number;
  lng: number;
  alt?: number | string | null;
  speed?: number | string | null;
  notes?: string | null;
}

export interface CampaignMapProcedure {
  id: number;
  airbase_id: number;
  airbase_name?: string;
  name: string;
  type: 'sid' | 'star' | 'iap' | 'overhead' | string;
  type_label?: string;
  runway?: string | null;
  initial_altitude?: number | string | null;
  color?: string | null;
  waypoints: CampaignMapProcedureWaypoint[];
  description?: string | null;
}

export interface CampaignMapAirbase {
  id?: number | null;
  dcs_id?: number | string | null;
  name: string;
  icao?: string | null;
  code?: string | null;
  coalition: 'blue' | 'red' | 'neutral' | string;
  lat: number;
  lng: number;
  category?: string;
  runways?: Array<any>;
  frequencies?: Array<any>;
  custom_frequencies?: Array<any>;
  dcs_frequencies?: Array<any>;
  tacan?: string | null;
  elevation?: number | null;
  ils?: any;
  description?: string | null;
  status?: string | null;
  procedures: CampaignMapProcedure[];
}

export interface CampaignMapBullseye {
  name: string;
  coalition?: number | string;
  lat: number;
  lng: number;
}

export interface CampaignMapFrontLine {
  group_name?: string;
  name?: string;
  source_type?: string;
  label?: string | null;
  line_style?: string;
  weight?: number;
  color?: string;
  points: Array<{ lat: number; lng: number } | [number, number]>;
}

export interface CampaignMapPolygonGroup {
  group_name?: string;
  name?: string;
  source_type?: string;
  label?: string | null;
  line_style?: string;
  weight?: number;
  color?: string;
  fill_color?: string;
  fill_opacity?: number;
  points: Array<{ lat: number; lng: number } | [number, number]>;
}

export interface CampaignMapThreat {
  id?: number;
  type: string;
  sam_system_id?: number | null;
  sam_name?: string | null;
  range: number;
  max_range_nm?: number;
  range_m: number;
  color?: string;
  title?: string | null;
  description?: string | null;
  image_url?: string | null;
  heading?: number | null;
  lat: number;
  lng: number;
  is_visible?: boolean;
}

export interface CampaignMapThreatTypeOption {
  value: string;
  label: string;
  category?: string | null;
  icon?: string;
}

export interface CampaignMapSamSystem {
  id: number;
  name: string;
  type?: string;
  range: number;
  max_range: number;
  range_m: number;
  color?: string;
}

export interface CampaignMapSupportAsset {
  id?: number;
  type: string;
  sam_system_id?: number | null;
  sam_name?: string | null;
  range?: number;
  range_m?: number;
  color?: string;
  title?: string | null;
  description?: string | null;
  lat: number;
  lng: number;
  heading?: number | null;
  leg_length?: number | null;
  altitude?: number | string | null;
  aircraft_type?: string | null;
  speed?: number | null;
  tacan_channel?: string | null;
  radio_freq?: string | null;
  dcs_group_name?: string | null;
  dcs_group_type?: string | null;
  waypoints?: Array<{ lat: number; lng: number }> | null;
  dcs_lat?: number | null;
  dcs_lng?: number | null;
  dcs_heading?: number | null;
  dcs_altitude?: number | null;
  dcs_speed?: number | null;
  is_dcs_tracked?: boolean;
  status?: string | null;
  mission_file?: string | null;
  image_url?: string | null;
}

export interface CampaignMapSupportAssetTypeOption {
  value: string;
  label: string;
  icon?: string;
}

export interface CampaignMapTacticalMarking {
  id: number;
  marking_type: string;
  geometry: Record<string, any>;
  properties: Record<string, any>;
  visibility: 'personal' | 'campaign' | 'mission' | 'sortie' | string;
  mission_id?: number | null;
  mission_name?: string | null;
  sortie_id?: number | null;
  sortie_name?: string | null;
  user_id?: number | null;
  creator_name?: string | null;
  can_edit: boolean;
}

export interface CampaignMapTacticalIcon {
  id?: string;
  key?: string;
  name?: string;
  label?: string;
  category?: string;
  svg?: string;
  url?: string;
  [key: string]: any;
}

export interface CampaignMapIsrTarget {
  id: number;
  user_id?: number | null;
  user_name?: string;
  label: string;
  label_text?: string;
  notes?: string | null;
  lat: number;
  lon: number;
  bbox?: any;
  created_at?: string | null;
}

export interface CampaignMapIsrImageVariant {
  type?: string;
  label?: string;
  path?: string;
  url: string;
}

export interface CampaignMapIsrRequest {
  id: number;
  campaign_id: number;
  mission_id?: number | null;
  mission_name?: string | null;
  user_id?: number | null;
  user_name?: string;
  mission_file?: string | null;
  is_current_mission?: boolean;
  lat: number;
  lon: number;
  km_size: number;
  sensor: 'eo' | 'flir_white' | 'flir_black' | 'whot' | 'bhot' | 'nvg' | string;
  sensor_label?: string;
  cost: number;
  status: string;
  status_label?: string;
  is_expired?: boolean;
  image_url?: string | null;
  image_urls?: Array<CampaignMapIsrImageVariant | string> | null;
  targets: CampaignMapIsrTarget[];
  created_at?: string | null;
  created_at_human?: string | null;
}

export interface CampaignMapLogisticsItem {
  id: number;
  name: string;
  quantity: number;
  delivered_quantity: number;
  progress_percent: number;
  is_completed: boolean;
  completed_by?: string | null;
  category?: string;
  xp_reward?: number;
  xp_awarded?: number;
}

export interface CampaignMapLogisticsRequest {
  id: number;
  identifier: string;
  type?: string;
  status: string;
  status_label?: string;
  pilot?: string | null;
  contributing_pilots?: string[];
  delivering_pilots_summary?: string | null;
  requester?: string;
  distance_nm?: number | null;
  xp_reward?: number | null;
  created_at?: string | null;
  origin?: { id?: number; name: string; lat: number; lng: number } | null;
  destination?: { id?: number; name: string; lat: number; lng: number } | null;
  total_units: number;
  delivered_units: number;
  progress_percent: number;
  items_count?: number;
  items_lines_count?: number;
  items_completed_count?: number;
  items_summary?: string;
  items?: CampaignMapLogisticsItem[];
}

export interface CampaignMapNavaid {
  id?: number | string;
  name?: string;
  ident?: string;
  mgrs?: string;
  type?: string;
  frequency?: string | null;
  tacan?: string | null;
  channel?: string | null;
  lat?: number;
  lng?: number;
  coordinates?: { lat: number; lon: number; lng?: number };
  elevation?: number | null;
  [key: string]: any;
}

export interface CampaignMapMissionObjective {
  index: number;
  priority: string;
  status: string;
  objective: string;
  squadron_id?: number | null;
  squadron_name?: string | null;
  squadron_abbreviation?: string | null;
  squadron_ids?: number[];
  squadrons?: Array<{ id: number; name: string; abbreviation?: string; logo?: string | null }>;
  resource_type?: string | null;
  points?: number | null;
  lat?: number | null;
  lng?: number | null;
  mgrs?: string | null;
  aor?: any;
}

export interface CampaignMapMissionSortie {
  id: number;
  mission_id: number;
  sortie_number: number;
  name: string;
  scheduled_at?: string | null;
  scheduled_at_human?: string | null;
  flight_plans_count: number;
}

export interface CampaignMapMission {
  id: number;
  name: string;
  lat?: number | null;
  lng?: number | null;
  aor?: any;
  status: string;
  status_label?: string;
  tasking_id?: number | null;
  tasking_label?: string;
  type?: string;
  color_hex: string;
  color: string;
  icon_html?: string;
  squadron_name?: string | null;
  squadron_abbreviation?: string | null;
  squadron_nickname?: string | null;
  squadron_logo?: string | null;
  planning_user_name?: string | null;
  scheduled_date?: string | null;
  scheduled_date_relative?: string | null;
  objective_mgrs?: string | null;
  objectives: CampaignMapMissionObjective[];
  total_objectives?: number;
  completed_objectives?: number;
  high_priority_count?: number;
  medium_priority_count?: number;
  low_priority_count?: number;
  high_priority_pending?: number;
  progress_percent?: number;
  rewards_summary?: string | null;
  earned_rewards_summary?: string | null;
  description?: string | null;
  remarks?: string | null;
  sorties: CampaignMapMissionSortie[];
}

export interface CampaignMapFlightPlanBrief {
  id: number;
  flight_plan_id: number;
  flight_id?: number | null;
  identifier: string;
  callsign?: string | null;
  name?: string | null;
  airframe_id?: number | null;
  airframe_name?: string | null;
  airframe_abbr?: string | null;
  squadron_id?: number | null;
  squadron_name?: string | null;
  squadron_logo?: string | null;
  mission_id?: number | null;
  mission_name?: string | null;
  sortie_id?: number | null;
  sortie_name?: string | null;
  tasking_id?: number | null;
  tasking_label?: string | null;
  user_id?: number | null;
  creator_name?: string | null;
  is_opfor: boolean;
  is_filed: boolean;
  filed_at?: string | null;
  can_edit: boolean;
  can_delete: boolean;
  color: string;
  route_points: Array<any>;
  points_count: number;
  has_plan: boolean;
  updated_at?: string | null;
}

export interface CampaignMapAirframeCatalogItem {
  id: number;
  name: string;
  abbreviation: string;
  dcs_entity: string;
  squadron_id?: number | null;
  squadron_name?: string | null;
  is_qualified: boolean;
  is_f18: boolean;
  is_f16: boolean;
  is_f14: boolean;
  is_jf17: boolean;
  has_mids: boolean;
  has_cmds: boolean;
  is_dtc_compatible: boolean;
  loadout_config?: Record<string, any> | null;
  radios_config?: Record<string, any> | null;
  default_cmds?: Record<string, any> | null;
}

export interface CampaignMapLoadoutPreset {
  id: number;
  name: string;
  description?: string | null;
  airframe_id?: number | null;
  airframe_key?: string | null;
  stations?: Record<string, any> | null;
  gun?: string | null;
  countermeasures?: string | null;
}

export interface CampaignMapTasking {
  id: number;
  name: string;
  slug: string;
  label: string;
  description?: string | null;
  color?: string | null;
  color_hex?: string;
  icon?: string | null;
  icon_html?: string;
}

export interface CampaignMapWarehouseInventory {
  is_unlimited: boolean;
  weapons: Record<string, number> | Array<any>;
}

export interface CampaignMapPayload {
  campaign: CampaignMapHeader;
  permissions: CampaignMapPermissions;
  airbases: CampaignMapAirbase[];
  bullseyes: CampaignMapBullseye[];
  frontLine: CampaignMapFrontLine[];
  polygonGroups: CampaignMapPolygonGroup[];
  threats: CampaignMapThreat[];
  threatTypes: CampaignMapThreatTypeOption[];
  samSystems: CampaignMapSamSystem[];
  supportAssets: CampaignMapSupportAsset[];
  supportAssetTypes: CampaignMapSupportAssetTypeOption[];
  tacticalMarkings: CampaignMapTacticalMarking[];
  tacticalIcons: CampaignMapTacticalIcon[];
  isrRequests: CampaignMapIsrRequest[];
  isrTargetTypes: Record<string, string> | Array<{ value: string; label: string }>;
  logisticsRequests: CampaignMapLogisticsRequest[];
  navaids: CampaignMapNavaid[];
  missions: CampaignMapMission[];
  flightPlans: {
    allPlans: CampaignMapFlightPlanBrief[];
    myPlans: CampaignMapFlightPlanBrief[];
  };
  airframesCatalog: CampaignMapAirframeCatalogItem[];
  loadoutPresets: CampaignMapLoadoutPreset[];
  taskings: CampaignMapTasking[];
  fetchedAt?: string;
}



