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
  | 'dashboard'
  | 'airframes'
  | 'qualifications'
  | 'awards'
  | 'atc'
  | 'liveries'
  | 'mods'
  | 'library'
  | 'settings';

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
  era: 'Modern' | 'Cold War';
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

export interface AppSettings {
  dcsSavedGamesPath: string;
  autoDetectDcsPath: boolean;
  autoSyncOnStartup: boolean;
  verifyFileHash: boolean;
  memberPortalApiUrl: string;
  hasConfirmedDcsPath?: boolean;
}

export interface IntegrityCheckResult {
  valid: boolean;
  missingFiles: string[];
  modifiedFiles: string[];
  checkedCount: number;
}

