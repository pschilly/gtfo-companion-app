import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_SETTINGS, STATIC_CONFIG } from '../config/constants';
import { SAMPLE_MANIFEST } from '../data/sampleManifest';
import {
  buildFallbackMemberProfile,
  GTFO_GRADE_META,
  GTFO_SQUADRONS,
  SAMPLE_ATC_PACKAGES,
} from '../data/samplePortalData';
import {
  SAMPLE_ACTIVE_SORTIE_RESPONSE,
  SAMPLE_MEMBER_FLIGHT_PLANS_RESPONSE,
} from '../data/sampleFlightPlans';
import {
  fetchMemberFlightPlans,
  fetchActiveSortieFlightPlans,
  fetchFlightPlanDetail,
  fetchFiledFlightPlans,
  FetchFiledFlightPlansOptions,
  installDcsRoutePresetCommand,
  getDcsRoutePresetsPath,
  installDtcCartridgeDirect,
  openPdfExternalViewer,
  RoutePresetInstallResult,
} from '../services/flightPlanService';
import {
  detectDcsPaths,
  fetchMemberPortalProfile,
  fetchStaticManifest,
  inspectAtcRouteToolPresetsCommand,
  installAssetCommand,
  installAtcDtcFileCommand,
  installAtcKneeboardCommand,
  loadInstalledAssets,
  mergeAtcRouteToolPresetCommand,
  RoutePresetManifestInfo,
  RoutePresetMergeResult,
  scanExistingInstallations,
  startDiscordOAuthCommand,
  uninstallAssetCommand,
  verifyAssetIntegrityCommand,
  verifyDiscordAccessToken,
  getDcsNicknameCommand,
  updateDcsNicknameCommand,
} from '../services/tauriBridge';
import {
  ActiveSortie,
  AppSettings,
  AssetItem,
  AssetManifest,
  AtcFlightPlanPackage,
  ChecklistSummary,
  DcsEnvironmentInfo,
  DcsNicknameInfo,
  DiscordUserSession,
  DownloadProgressEvent,
  FlightPlanDetail,
  FlightPlanSummary,
  InstalledAssetRecord,
  InstalledAtcState,
  IntegrityCheckResult,
  MemberGradeLevel,
  MemberPortalProfile,
  NavigationTab,
  TelemetryLogEntry,
  UserTier,
} from '../types';
import { formatExpectedDcsNickname } from '../utils/formatters';
import { checkForAppUpdate, AppUpdateInfo } from '../services/updaterService';
import {
  dispatchDesktopToast,
  setWindowPreferencesCommand,
  updateTrayNotificationBadgeCommand,
} from '../services/notificationService';
import { isTauriRuntime } from '../services/tauriBridge';
import { listen } from '@tauri-apps/api/event';
import { AppNotification } from '../types';

export interface MemberProfileOverridePatch {
  rosterTier?: 'CORE' | 'Community';
  grade?: MemberGradeLevel;
  position?: MemberPortalProfile['position'];
  squadronCode?: string | null;
  secondarySquadronCode?: string | null;
  timeServedMonths?: number;
  flightHoursLogged?: number;
}

export interface RepairPromptState {
  asset?: AssetItem;
  record: InstalledAssetRecord;
  result: IntegrityCheckResult;
}

interface AppContextValue {
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
  manifest: AssetManifest;
  isSyncingManifest: boolean;
  lastSyncedAt: string | null;
  syncManifest: () => Promise<void>;
  installedAssets: Record<string, InstalledAssetRecord>;
  rescanLocalAssets: () => Promise<void>;
  activeDownloads: Record<string, DownloadProgressEvent>;
  dcsEnv: DcsEnvironmentInfo | null;
  refreshDcsEnv: (overridePath?: string) => Promise<void>;
  userSession: DiscordUserSession | null;
  effectiveTier: UserTier;
  memberProfile: MemberPortalProfile;
  isPortalLive: boolean;
  syncMemberPortal: () => Promise<void>;
  overrideMemberProfile: (patch: MemberProfileOverridePatch) => void;
  atcPackages: AtcFlightPlanPackage[];
  installedAtc: InstalledAtcState;
  deployAtcDtc: (pkg: AtcFlightPlanPackage) => Promise<void>;
  mergeAtcRoutePreset: (pkg: AtcFlightPlanPackage) => Promise<RoutePresetMergeResult | null>;
  deployAtcKneeboards: (pkg: AtcFlightPlanPackage) => Promise<void>;
  deployFullAtcPackage: (pkg: AtcFlightPlanPackage) => Promise<void>;
  inspectTheatreRouteLua: (theatreFileName: string) => Promise<RoutePresetManifestInfo>;
  // Flight Plans API & Integrations
  memberFlightPlans: FlightPlanSummary[];
  memberFlightPlansMeta: { total: number; missions_count: number; authored_count: number; private_count: number };
  activeSortie: ActiveSortie | null;
  activeSortieFlightPlans: FlightPlanSummary[];
  filedFlightPlans: FlightPlanSummary[];
  isLoadingFlightPlans: boolean;
  syncFlightPlans: () => Promise<void>;
  fetchFiledPlans: (options?: FetchFiledFlightPlansOptions) => Promise<FlightPlanSummary[]>;
  loadFlightPlanDetail: (idOrIdentifier: string | number) => Promise<FlightPlanDetail>;
  saveRouteToDcs: (theatre: string, luaContent: string) => Promise<RoutePresetInstallResult>;
  copyDcsRoutePresetsPathToClipboard: () => Promise<string>;
  saveDtcCartridgeDirect: (fileName: string, content: string, subfolder?: string) => Promise<string>;
  openPdfKneeboardViewer: (pdfUrl: string, fileName?: string) => Promise<string>;
  loginModalOpen: boolean;
  setLoginModalOpen: (open: boolean) => void;
  selectedAsset: AssetItem | null;
  setSelectedAsset: (asset: AssetItem | null) => void;
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
  installAsset: (asset: AssetItem) => Promise<void>;
  uninstallAsset: (assetId: string) => Promise<void>;
  verifyAsset: (assetId: string) => Promise<boolean>;
  verifyingAssetId: string | null;
  lastVerifyResults: Record<string, IntegrityCheckResult>;
  repairPrompt: RepairPromptState | null;
  setRepairPrompt: (prompt: RepairPromptState | null) => void;
  updateAllOutdated: () => Promise<void>;
  installAllRequiredForUser: () => Promise<void>;
  outdatedAssets: AssetItem[];
  missingRequiredAssets: AssetItem[];
  canAccessAsset: (asset: AssetItem) => boolean;
  isRequiredForCurrentUser: (asset: AssetItem) => boolean;
  isUpdateAvailable: (asset: AssetItem) => boolean;
  loginWithDiscordOAuth: () => Promise<void>;
  logoutDiscord: () => void;
  selectedFlightPlanId: string | number | null;
  setSelectedFlightPlanId: (id: string | number | null) => void;
  highlightedCertId: number | null;
  setHighlightedCertId: (id: number | null) => void;
  hasConfirmedDcsPath: boolean;
  pathOnboardingOpen: boolean;
  setPathOnboardingOpen: (open: boolean) => void;
  confirmDcsPath: (confirmedPath: string) => void;
  logs: TelemetryLogEntry[];
  clearLogs: () => void;
  addLog: (
    level: TelemetryLogEntry['level'],
    source: TelemetryLogEntry['source'],
    message: string
  ) => void;
  dcsNicknameInfo: DcsNicknameInfo | null;
  isLoadingNickname: boolean;
  refreshDcsNickname: () => Promise<void>;
  updateDcsNickname: (newNickname: string) => Promise<DcsNicknameInfo>;
  expectedDcsNickname: string;
  isNicknameMatching: boolean;
  installRequiredMods: () => Promise<void>;
  installRequiredLiveries: () => Promise<void>;
  checklistSummary: ChecklistSummary;
  appUpdate: AppUpdateInfo | null;
  isCheckingAppUpdate: boolean;
  checkForAppUpdateAction: () => Promise<AppUpdateInfo>;
  isUpdateModalOpen: boolean;
  setIsUpdateModalOpen: (open: boolean) => void;
  notifications: AppNotification[];
  unreadNotificationsCount: number;
  addNotification: (notification: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  clearNotification: (id: string) => void;
  clearAllNotifications: () => void;
  sendTestNotification: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

const STORAGE_KEYS = {
  SETTINGS: 'gtfo_settings_v2',
  SESSION: 'gtfo_discord_session_v2',
  INSTALLED: 'gtfo_installed_assets_v2',
  INSTALLED_ATC: 'gtfo_installed_atc_v2',
  PORTAL_PROFILE: 'gtfo_member_profile_v5',
  DCS_PATH_CONFIRMED: 'gtfo_dcs_path_confirmed_v1',
  NOTIFICATIONS: 'gtfo_notifications_v1',
  DISMISSED_NOTIFICATIONS: 'gtfo_dismissed_notifications_v1',
};

const DEFAULT_INSTALLED_ATC: InstalledAtcState = {
  installedDtcIds: {},
  mergedRoutePresets: {},
  installedKneeboardIds: {},
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<NavigationTab>('home');
  const [manifest, setManifest] = useState<AssetManifest>(SAMPLE_MANIFEST);
  const [isSyncingManifest, setIsSyncingManifest] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [installedAssets, setInstalledAssets] = useState<Record<string, InstalledAssetRecord>>({});
  const [activeDownloads, setActiveDownloads] = useState<Record<string, DownloadProgressEvent>>({});
  const [dcsEnv, setDcsEnv] = useState<DcsEnvironmentInfo | null>(null);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<AssetItem | null>(null);
  const [selectedFlightPlanId, setSelectedFlightPlanId] = useState<string | number | null>(null);
  const [highlightedCertId, setHighlightedCertId] = useState<number | null>(null);
  const [logs, setLogs] = useState<TelemetryLogEntry[]>([]);
  const [isPortalLive, setIsPortalLive] = useState(false);
  const [atcPackages, setAtcPackages] = useState<AtcFlightPlanPackage[]>(SAMPLE_ATC_PACKAGES);
  const [verifyingAssetId, setVerifyingAssetId] = useState<string | null>(null);
  const [lastVerifyResults, setLastVerifyResults] = useState<Record<string, IntegrityCheckResult>>(
    {}
  );
  const [repairPrompt, setRepairPrompt] = useState<RepairPromptState | null>(null);

  // Flight Plans State
  const [memberFlightPlans, setMemberFlightPlans] = useState<FlightPlanSummary[]>(
    SAMPLE_MEMBER_FLIGHT_PLANS_RESPONSE.plans
  );
  const [memberFlightPlansMeta, setMemberFlightPlansMeta] = useState({
    total: SAMPLE_MEMBER_FLIGHT_PLANS_RESPONSE.total,
    missions_count: SAMPLE_MEMBER_FLIGHT_PLANS_RESPONSE.missions_count,
    authored_count: SAMPLE_MEMBER_FLIGHT_PLANS_RESPONSE.authored_count,
    private_count: SAMPLE_MEMBER_FLIGHT_PLANS_RESPONSE.private_count,
  });
  const [activeSortie, setActiveSortie] = useState<ActiveSortie | null>(
    SAMPLE_ACTIVE_SORTIE_RESPONSE.active_sortie
  );
  const [activeSortieFlightPlans, setActiveSortieFlightPlans] = useState<FlightPlanSummary[]>(
    SAMPLE_ACTIVE_SORTIE_RESPONSE.plans
  );
  const [filedFlightPlans, setFiledFlightPlans] = useState<FlightPlanSummary[]>(() => {
    return [
      ...SAMPLE_MEMBER_FLIGHT_PLANS_RESPONSE.plans,
      ...SAMPLE_ACTIVE_SORTIE_RESPONSE.plans,
    ].filter((p) => p.is_filed);
  });
  const [isLoadingFlightPlans, setIsLoadingFlightPlans] = useState(false);

  const [installedAtc, setInstalledAtc] = useState<InstalledAtcState>(() => {
    const raw = localStorage.getItem(STORAGE_KEYS.INSTALLED_ATC);
    if (raw) {
      try {
        return { ...DEFAULT_INSTALLED_ATC, ...JSON.parse(raw) };
      } catch {
        return DEFAULT_INSTALLED_ATC;
      }
    }
    return DEFAULT_INSTALLED_ATC;
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (saved) {
      try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      } catch {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });

  const [hasConfirmedDcsPath, setHasConfirmedDcsPath] = useState<boolean>(() => {
    const cached = localStorage.getItem(STORAGE_KEYS.DCS_PATH_CONFIRMED);
    if (cached === 'true') return true;
    const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.hasConfirmedDcsPath) return true;
      } catch {
        // ignore
      }
    }
    return false;
  });

  const [pathOnboardingOpen, setPathOnboardingOpen] = useState(false);

  const [userSession, setUserSession] = useState<DiscordUserSession | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SESSION);
    if (saved) {
      try {
        return JSON.parse(saved) as DiscordUserSession;
      } catch {
        return null;
      }
    }
    return null;
  });

  const baseDiscordTier: UserTier = useMemo(() => {
    if (!userSession || !userSession.isGuildMember) return 'guest';
    if (userSession.roleIds.includes(STATIC_CONFIG.coreRoleId)) {
      return 'core';
    }
    if (userSession.roleIds.includes(STATIC_CONFIG.communityRoleId)) {
      return 'community';
    }
    return 'guest';
  }, [userSession]);

  const [memberProfile, setMemberProfile] = useState<MemberPortalProfile>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PORTAL_PROFILE);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as MemberPortalProfile;
        if (parsed && typeof parsed.grade === 'string' && parsed.gradeTitle) {
          return parsed;
        }
      } catch {
        // Ignore parse error
      }
    }
    return buildFallbackMemberProfile(
      userSession,
      baseDiscordTier === 'guest' ? 'core' : baseDiscordTier
    );
  });

  const effectiveTier: UserTier = useMemo(() => {
    if (!userSession || !userSession.isGuildMember || baseDiscordTier === 'guest') {
      return 'guest';
    }
    if (memberProfile?.rosterTier === 'CORE') {
      return 'core';
    }
    if (memberProfile?.rosterTier === 'Community') {
      return 'community';
    }
    return baseDiscordTier;
  }, [baseDiscordTier, memberProfile?.rosterTier, userSession]);

  const addLog = useCallback(
    (
      level: TelemetryLogEntry['level'],
      source: TelemetryLogEntry['source'],
      message: string
    ) => {
      const entry: TelemetryLogEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toLocaleTimeString([], {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        level,
        source,
        message,
      };
      setLogs((prev) => [entry, ...prev.slice(0, 149)]);
    },
    []
  );

  const clearLogs = useCallback(() => setLogs([]), []);

  const updateSettings = useCallback(
    (patch: Partial<AppSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(next));
        return next;
      });
      addLog('info', 'SYSTEM', 'Settings saved.');
    },
    [addLog]
  );

  const persistInstalledAtc = useCallback((next: InstalledAtcState) => {
    localStorage.setItem(STORAGE_KEYS.INSTALLED_ATC, JSON.stringify(next));
  }, []);

  const refreshDcsEnv = useCallback(
    async (overridePath?: string) => {
      try {
        const custom =
          overridePath !== undefined
            ? overridePath
            : !settings.autoDetectDcsPath && settings.dcsSavedGamesPath
            ? settings.dcsSavedGamesPath
            : undefined;

        const envInfo = await detectDcsPaths(custom);
        setDcsEnv(envInfo);
        if (!settings.dcsSavedGamesPath && envInfo.activeSavedGamesPath) {
          setSettings((prev) => {
            const next = { ...prev, dcsSavedGamesPath: envInfo.activeSavedGamesPath };
            localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(next));
            return next;
          });
        }
        addLog(
          'info',
          'SYSTEM',
          `Active DCS Saved Games directory: ${envInfo.activeSavedGamesPath}`
        );
      } catch (err) {
        addLog('error', 'SYSTEM', `Failed to detect DCS Saved Games directory: ${String(err)}`);
      }
    },
    [addLog, settings.autoDetectDcsPath, settings.dcsSavedGamesPath]
  );

  const syncMemberPortal = useCallback(async () => {
    const tierForFallback = baseDiscordTier === 'guest' ? 'core' : baseDiscordTier;

    addLog('info', 'PORTAL', 'Syncing Member Dossier from GTFO Member Portal...');

    try {
      const profileRes = await fetchMemberPortalProfile(
        userSession,
        tierForFallback,
        STATIC_CONFIG.portalBaseUrl
      );

      setIsPortalLive(profileRes.fromLiveApi);

      if (profileRes.fromLiveApi) {
        setMemberProfile(profileRes.profile);
        localStorage.setItem(STORAGE_KEYS.PORTAL_PROFILE, JSON.stringify(profileRes.profile));
        addLog(
          'success',
          'PORTAL',
          `Member Dossier synced (${profileRes.profile.grade} // ${
            profileRes.profile.squadronAssignment?.code || 'Unassigned'
          }).`
        );
      } else {
        setMemberProfile((prev) => {
          const updated: MemberPortalProfile = {
            ...prev,
            discordId: userSession?.id || prev.discordId,
            callsign: userSession?.globalName || userSession?.username || prev.callsign,
            lastPortalSyncAt: new Date().toISOString(),
          };
          localStorage.setItem(STORAGE_KEYS.PORTAL_PROFILE, JSON.stringify(updated));
          return updated;
        });
        addLog('info', 'PORTAL', 'Member Dossier synchronized.');
      }
    } catch (err) {
      addLog('warn', 'PORTAL', `Portal sync notice: ${String(err)}`);
    }
  }, [addLog, baseDiscordTier, userSession]);

  const overrideMemberProfile = useCallback(
    (patch: MemberProfileOverridePatch) => {
      setMemberProfile((prev) => {
        const gradeOrder: MemberGradeLevel[] = [
          'G0',
          'G1',
          'G2',
          'G3',
          'G4',
          'G5',
          'G6',
          'G7',
          'G8',
          'G9',
          'G10',
          'G11',
        ];
        const nextGradeKey = patch.grade ?? prev.grade;
        const meta = GTFO_GRADE_META[nextGradeKey];
        const idx = gradeOrder.indexOf(nextGradeKey);
        const nextStepKey =
          idx >= 0 && idx < gradeOrder.length - 1 ? gradeOrder[idx + 1] : undefined;

        const nextPrimarySq =
          patch.squadronCode === null
            ? null
            : patch.squadronCode !== undefined
            ? GTFO_SQUADRONS[patch.squadronCode] || null
            : prev.squadronAssignment;

        const nextSecondarySq =
          patch.secondarySquadronCode === null
            ? null
            : patch.secondarySquadronCode !== undefined
            ? GTFO_SQUADRONS[patch.secondarySquadronCode] || null
            : prev.secondarySquadronAssignment;

        const next: MemberPortalProfile = {
          ...prev,
          rosterTier: patch.rosterTier ?? prev.rosterTier,
          position: patch.position ?? prev.position,
          grade: nextGradeKey,
          gradeTitle: meta.title,
          gradeIconUrl: meta.iconUrl,
          currentGradeXpRequired: meta.xpRequired,
          timeServedMonths:
            patch.timeServedMonths ??
            (patch.grade !== undefined ? Math.max(1, meta.monthsRequired) : prev.timeServedMonths),
          nextGrade: nextStepKey
            ? {
                grade: nextStepKey,
                xpRequired: GTFO_GRADE_META[nextStepKey].xpRequired,
                monthsRequired: GTFO_GRADE_META[nextStepKey].monthsRequired,
              }
            : undefined,
          squadronAssignment: nextPrimarySq,
          secondarySquadronAssignment: nextSecondarySq,
          flightHoursLogged: patch.flightHoursLogged ?? prev.flightHoursLogged,
        };
        localStorage.setItem(STORAGE_KEYS.PORTAL_PROFILE, JSON.stringify(next));
        return next;
      });
      addLog(
        'info',
        'PORTAL',
        'Updated Member Dossier preview state (Grade / Squadron / Roster status).'
      );
    },
    [addLog]
  );

  const syncManifest = useCallback(async () => {
    setIsSyncingManifest(true);
    addLog('info', 'MANIFEST', 'Syncing asset manifest from GTFO Member Portal...');
    try {
      const remote = await fetchStaticManifest(
        STATIC_CONFIG.portalBaseUrl,
        userSession?.accessToken
      );
      setManifest(remote);
      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setLastSyncedAt(now);
      addLog(
        'success',
        'MANIFEST',
        `Manifest v${remote.manifestVersion} synced (${remote.assets.length} packages available).`
      );
    } catch (err) {
      addLog('warn', 'MANIFEST', `Manifest sync notice: ${String(err)}`);
    } finally {
      setIsSyncingManifest(false);
    }
  }, [addLog, userSession?.accessToken]);

  const persistInstalledMap = useCallback((nextMap: Record<string, InstalledAssetRecord>) => {
    localStorage.setItem(STORAGE_KEYS.INSTALLED, JSON.stringify(Object.values(nextMap)));
  }, []);

  const rescanLocalAssets = useCallback(async () => {
    const activePath =
      settings.dcsSavedGamesPath || dcsEnv?.activeSavedGamesPath;
    if (!activePath) return;

    try {
      const records = await scanExistingInstallations(activePath, manifest.assets);
      const map: Record<string, InstalledAssetRecord> = {};
      for (const r of records) {
        map[r.assetId] = r;
      }
      setInstalledAssets(map);
      persistInstalledMap(map);
      if (records.length > 0) {
        addLog(
          'info',
          'INSTALLER',
          `Detected ${records.length} installed GTFO package(s) in ${activePath}`
        );
      }
    } catch (err) {
      addLog('warn', 'INSTALLER', `Local DCS folder scan notice: ${String(err)}`);
    }
  }, [addLog, dcsEnv?.activeSavedGamesPath, manifest.assets, persistInstalledMap, settings.dcsSavedGamesPath]);

  const [appUpdate, setAppUpdate] = useState<AppUpdateInfo | null>(null);
  const [isCheckingAppUpdate, setIsCheckingAppUpdate] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);

  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as AppNotification[];
        return parsed.map((n) => ({
          ...n,
          fingerprint: n.fingerprint || `${n.category}:${n.title}:${n.message}`,
        }));
      } catch {
        return [];
      }
    }
    return [];
  });

  const [dismissedFingerprints, setDismissedFingerprints] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.DISMISSED_NOTIFICATIONS);
    if (saved) {
      try {
        return JSON.parse(saved) as Record<string, number>;
      } catch {
        return {};
      }
    }
    return {};
  });

  const activeFingerprintsRef = useRef<Set<string>>(
    new Set(notifications.map((n) => n.fingerprint || `${n.category}:${n.title}:${n.message}`))
  );

  useEffect(() => {
    activeFingerprintsRef.current = new Set(
      notifications.map((n) => n.fingerprint || `${n.category}:${n.title}:${n.message}`)
    );
  }, [notifications]);

  const unreadNotificationsCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  const persistNotifications = useCallback((items: AppNotification[]) => {
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(items.slice(0, 50)));
  }, []);

  const persistDismissedFingerprints = useCallback((map: Record<string, number>) => {
    const entries = Object.entries(map);
    if (entries.length > 500) {
      const trimmed = Object.fromEntries(
        entries.sort((a, b) => b[1] - a[1]).slice(0, 500)
      );
      localStorage.setItem(STORAGE_KEYS.DISMISSED_NOTIFICATIONS, JSON.stringify(trimmed));
    } else {
      localStorage.setItem(STORAGE_KEYS.DISMISSED_NOTIFICATIONS, JSON.stringify(map));
    }
  }, []);

  const addNotification = useCallback(
    (item: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
      const fingerprint = item.fingerprint || `${item.category}:${item.title}:${item.message}`;

      // 1. If previously cleared/dismissed by user and the info has not changed, do not re-add
      if (dismissedFingerprints[fingerprint]) {
        return;
      }

      // 2. If already active in the notifications tray, do not duplicate
      if (activeFingerprintsRef.current.has(fingerprint)) {
        return;
      }

      // Mark active immediately to prevent duplication during synchronous loops
      activeFingerprintsRef.current.add(fingerprint);

      const newNotification: AppNotification = {
        ...item,
        fingerprint,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toISOString(),
        read: false,
      };

      setNotifications((prev) => {
        const isDuplicate = prev.some(
          (n) => (n.fingerprint && n.fingerprint === fingerprint) ||
                 (n.title === item.title && n.message === item.message)
        );
        if (isDuplicate) return prev;

        const next = [newNotification, ...prev].slice(0, 50);
        persistNotifications(next);
        return next;
      });

      // Desktop OS Toast check - only dispatched for genuinely new, non-dismissed notifications
      if (settings.enableDesktopNotifications) {
        let shouldToast = true;
        if (item.category === 'app' && !settings.notifyAppUpdates) shouldToast = false;
        if ((item.category === 'livery' || item.category === 'mod') && !settings.notifyAssetUpdates)
          shouldToast = false;
        if (item.category === 'flight_plan' && !settings.notifyFlightPlans) shouldToast = false;

        if (shouldToast) {
          dispatchDesktopToast(`GTFO: ${item.title}`, item.message);
        }
      }
    },
    [
      dismissedFingerprints,
      persistNotifications,
      settings.enableDesktopNotifications,
      settings.notifyAppUpdates,
      settings.notifyAssetUpdates,
      settings.notifyFlightPlans,
    ]
  );

  const markNotificationAsRead = useCallback(
    (id: string) => {
      setNotifications((prev) => {
        const next = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
        persistNotifications(next);
        return next;
      });
    },
    [persistNotifications]
  );

  const markAllNotificationsAsRead = useCallback(() => {
    setNotifications((prev) => {
      const next = prev.map((n) => ({ ...n, read: true }));
      persistNotifications(next);
      return next;
    });
  }, [persistNotifications]);

  const clearNotification = useCallback(
    (id: string) => {
      setNotifications((prev) => {
        const target = prev.find((n) => n.id === id);
        if (target) {
          const fp = target.fingerprint || `${target.category}:${target.title}:${target.message}`;
          setDismissedFingerprints((dPrev) => {
            const next = { ...dPrev, [fp]: Date.now() };
            persistDismissedFingerprints(next);
            return next;
          });
          activeFingerprintsRef.current.delete(fp);
        }
        const next = prev.filter((n) => n.id !== id);
        persistNotifications(next);
        return next;
      });
    },
    [persistDismissedFingerprints, persistNotifications]
  );

  const clearAllNotifications = useCallback(() => {
    setNotifications((prev) => {
      setDismissedFingerprints((dPrev) => {
        const next = { ...dPrev };
        const now = Date.now();
        prev.forEach((n) => {
          const fp = n.fingerprint || `${n.category}:${n.title}:${n.message}`;
          next[fp] = now;
        });
        persistDismissedFingerprints(next);
        return next;
      });
      activeFingerprintsRef.current.clear();
      localStorage.removeItem(STORAGE_KEYS.NOTIFICATIONS);
      return [];
    });
  }, [persistDismissedFingerprints]);

  const sendTestNotification = useCallback(async () => {
    const testFp = `test_notification:${Date.now()}`;
    addNotification({
      title: 'Tactical Uplink Connected',
      message: 'Desktop and in-app notifications are functioning properly. Ready for flight ops.',
      category: 'announcement',
      fingerprint: testFp,
    });
  }, [addNotification]);

  // Synchronize window minimization & tray preferences to Rust backend
  useEffect(() => {
    setWindowPreferencesCommand({
      startMinimized: settings.startMinimized,
      minimizeToTray: settings.minimizeToTray,
      closeToTray: settings.closeToTray,
    }).catch((err) => {
      console.warn('Failed to sync window preferences with Rust:', err);
    });
  }, [settings.startMinimized, settings.minimizeToTray, settings.closeToTray]);

  // Synchronize unread notifications badge to System Tray icon
  useEffect(() => {
    updateTrayNotificationBadgeCommand(unreadNotificationsCount);
  }, [unreadNotificationsCount]);

  const checkForAppUpdateAction = useCallback(async (): Promise<AppUpdateInfo> => {
    setIsCheckingAppUpdate(true);
    try {
      const info = await checkForAppUpdate();
      setAppUpdate(info);
      if (info.available) {
        addLog('info', 'SYSTEM', `Companion App update v${info.version} available!`);
        addNotification({
          title: `App Update Available: v${info.version}`,
          message: `A new version of GTFO Companion App is available. Click to review release notes and install.`,
          category: 'app',
          fingerprint: `app_update:v${info.version}`,
        });
      }
      return info;
    } finally {
      setIsCheckingAppUpdate(false);
    }
  }, [addLog, addNotification]);

  // Listen for Tray "Check for Updates..." trigger
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    if (isTauriRuntime()) {
      listen('trigger-check-updates', () => {
        checkForAppUpdateAction().then(() => {
          setIsUpdateModalOpen(true);
        });
      }).then((fn) => {
        unlisten = fn;
      });
    }
    return () => {
      if (unlisten) unlisten();
    };
  }, [checkForAppUpdateAction]);

  useEffect(() => {
    addLog('info', 'SYSTEM', `${STATIC_CONFIG.appTitle} initialized.`);
    refreshDcsEnv();

    syncManifest();
    syncMemberPortal();
    syncFlightPlans();
    checkForAppUpdateAction();

    if (window.location.hash.includes('access_token=')) {
      const params = new URLSearchParams(window.location.hash.slice(1));
      const token = params.get('access_token');
      window.history.replaceState({}, document.title, window.location.pathname);
      if (token) {
        verifyDiscordAccessToken(token)
          .then((session) => {
            setUserSession(session);
            localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
            addLog(
              'success',
              'AUTH',
              `Authenticated as ${session.globalName} — Assigned Tier: ${session.tier.toUpperCase()}`
            );
          })
          .catch((err) => {
            addLog('error', 'AUTH', `Discord verification error: ${String(err)}`);
          });
      }
    } else if (userSession?.accessToken) {
      verifyDiscordAccessToken(userSession.accessToken)
        .then((fresh) => {
          setUserSession(fresh);
          localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(fresh));
        })
        .catch(() => {
          // Keep cached session if offline
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (userSession?.id) {
      syncMemberPortal();
      syncManifest();
    }
  }, [userSession?.id, syncMemberPortal, syncManifest]);

  // Configurable periodic background polling & window refocus sync
  useEffect(() => {
    if (settings.pollingIntervalMinutes <= 0) return;

    const pollIntervalMs = settings.pollingIntervalMinutes * 60 * 1000;
    const intervalId = setInterval(() => {
      syncManifest();
      syncMemberPortal();
      syncFlightPlans();
      checkForAppUpdateAction();
    }, pollIntervalMs);

    let lastFocusSync = Date.now();
    const handleFocus = () => {
      // Throttle focus sync to once every 2 minutes
      if (Date.now() - lastFocusSync > 2 * 60 * 1000) {
        lastFocusSync = Date.now();
        syncManifest();
        syncMemberPortal();
        syncFlightPlans();
        checkForAppUpdateAction();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, [settings.pollingIntervalMinutes, syncManifest, syncMemberPortal, checkForAppUpdateAction]);

  // Notify when new remote announcements are broadcast in manifest
  useEffect(() => {
    if (manifest.announcement?.message) {
      const annKey = `announcement:${manifest.announcement.title || ''}:${manifest.announcement.message}`;
      addNotification({
        title: manifest.announcement.title || 'GTFO Announcement',
        message: manifest.announcement.message,
        category: 'announcement',
        actionTab: 'home',
        fingerprint: annKey,
      });
    }
  }, [manifest.announcement, addNotification]);

  // Notify on new flight plans / ATC packages
  useEffect(() => {
    if (settings.notifyFlightPlans && lastSyncedAt) {
      atcPackages.forEach((pkg) => {
        const pkgKey = `atc_pkg:${pkg.id}:${pkg.operationName || pkg.missionTitle || ''}:${pkg.theatre || ''}`;
        addNotification({
          title: `Flight Plan: ${pkg.operationName || pkg.missionTitle}`,
          message: `${pkg.aircraft} package at ${pkg.theatre}. Callsign: ${pkg.callsign}.`,
          category: 'flight_plan',
          actionTab: 'atc',
          fingerprint: pkgKey,
        });
      });

      memberFlightPlans.forEach((plan) => {
        const planKey = `flight_plan:${plan.identifier || plan.id}:${plan.updated_at || plan.filed_at || 'v1'}:${plan.is_filed ? '1' : '0'}:${plan.name || ''}`;
        const cleanTitle = plan.callsign && plan.name && plan.callsign !== plan.name
          ? `${plan.callsign} (${plan.name})`
          : plan.callsign || plan.name || plan.identifier;
        addNotification({
          title: cleanTitle,
          message: `${plan.airframe?.name || 'Aircraft'} — ${plan.departure_airfield || 'DEP'} to ${plan.destination_airfield || 'ARR'}${plan.description ? ` • ${plan.description}` : ''}`,
          category: 'flight_plan',
          actionTab: 'atc',
          fingerprint: planKey,
        });
      });
    }
  }, [atcPackages, memberFlightPlans, settings.notifyFlightPlans, addNotification, lastSyncedAt]);

  useEffect(() => {
    const activePath = settings.dcsSavedGamesPath || dcsEnv?.activeSavedGamesPath;
    if (activePath && manifest.assets.length > 0) {
      rescanLocalAssets();
    } else if (manifest.assets.length === 0) {
      setInstalledAssets({});
    }
  }, [dcsEnv?.activeSavedGamesPath, settings.dcsSavedGamesPath, manifest.assets, rescanLocalAssets]);

  const [dcsNicknameInfo, setDcsNicknameInfo] = useState<DcsNicknameInfo | null>(null);
  const [isLoadingNickname, setIsLoadingNickname] = useState<boolean>(false);

  const expectedDcsNickname = useMemo(() => {
    return formatExpectedDcsNickname(
      memberProfile?.callsign || userSession?.globalName || userSession?.username || 'Aviator',
      userSession?.serverNickname
    );
  }, [
    memberProfile?.callsign,
    userSession?.globalName,
    userSession?.username,
    userSession?.serverNickname,
  ]);

  const isNicknameMatching = useMemo(() => {
    if (!dcsNicknameInfo?.currentNickname) return false;
    return dcsNicknameInfo.currentNickname.trim() === expectedDcsNickname.trim();
  }, [dcsNicknameInfo?.currentNickname, expectedDcsNickname]);

  const refreshDcsNickname = useCallback(async () => {
    const activePath = settings.dcsSavedGamesPath || dcsEnv?.activeSavedGamesPath;
    if (!activePath) return;
    setIsLoadingNickname(true);
    try {
      const info = await getDcsNicknameCommand(activePath);
      setDcsNicknameInfo(info);
    } catch (err) {
      console.error('Failed to get DCS nickname:', err);
    } finally {
      setIsLoadingNickname(false);
    }
  }, [settings.dcsSavedGamesPath, dcsEnv?.activeSavedGamesPath]);

  const updateDcsNickname = useCallback(
    async (newNickname: string) => {
      const activePath = settings.dcsSavedGamesPath || dcsEnv?.activeSavedGamesPath;
      if (!activePath) throw new Error('DCS Saved Games path not determined');
      setIsLoadingNickname(true);
      try {
        const info = await updateDcsNicknameCommand(newNickname, activePath);
        setDcsNicknameInfo(info);
        addLog('success', 'SYSTEM', `DCS nickname updated in slot #1: "${newNickname}"`);
        return info;
      } catch (err: any) {
        addLog('error', 'SYSTEM', `Failed to update DCS nickname: ${err?.message || err}`);
        throw err;
      } finally {
        setIsLoadingNickname(false);
      }
    },
    [settings.dcsSavedGamesPath, dcsEnv?.activeSavedGamesPath, addLog]
  );

  useEffect(() => {
    const activePath = settings.dcsSavedGamesPath || dcsEnv?.activeSavedGamesPath;
    if (activePath) {
      refreshDcsNickname();
    }
  }, [dcsEnv?.activeSavedGamesPath, settings.dcsSavedGamesPath, refreshDcsNickname]);

  const canAccessAsset = useCallback(
    (asset: AssetItem): boolean => {
      if (asset.requiredTier === 'community') {
        return effectiveTier === 'community' || effectiveTier === 'core';
      }
      if (asset.requiredTier === 'core') {
        return effectiveTier === 'core';
      }
      return false;
    },
    [effectiveTier]
  );

  const isRequiredForCurrentUser = useCallback(
    (asset: AssetItem): boolean => {
      if (asset.requirementLevel === 'required_all') {
        return true;
      }
      if (asset.requirementLevel === 'required_core' && effectiveTier === 'core') {
        return true;
      }
      return false;
    },
    [effectiveTier]
  );

  const isUpdateAvailable = useCallback(
    (asset: AssetItem): boolean => {
      const installed = installedAssets[asset.id];
      if (!installed) return false;
      return installed.installedVersion !== asset.version;
    },
    [installedAssets]
  );

  const outdatedAssets = useMemo(() => {
    return manifest.assets.filter((asset) => isUpdateAvailable(asset));
  }, [manifest.assets, isUpdateAvailable]);

  // Notify when new updates for installed assets become available
  useEffect(() => {
    if (outdatedAssets.length > 0 && settings.notifyAssetUpdates) {
      outdatedAssets.forEach((asset) => {
        const key = `asset_update:${asset.id}:${asset.version}`;
        addNotification({
          title: `Update Ready: ${asset.name}`,
          message: `Version v${asset.version} is now available in the GTFO manifest.`,
          category: asset.category === 'livery' ? 'livery' : 'mod',
          actionTab: 'library',
          actionAssetId: asset.id,
          fingerprint: key,
        });
      });
    }
  }, [outdatedAssets, settings.notifyAssetUpdates, addNotification]);

  const missingRequiredAssets = useMemo(() => {
    return manifest.assets.filter(
      (asset) =>
        isRequiredForCurrentUser(asset) &&
        canAccessAsset(asset) &&
        (!installedAssets[asset.id] || isUpdateAvailable(asset))
    );
  }, [manifest.assets, isRequiredForCurrentUser, canAccessAsset, installedAssets, isUpdateAvailable]);

  const installAsset = useCallback(
    async (asset: AssetItem) => {
      if (!canAccessAsset(asset)) {
        addLog(
          'warn',
          'AUTH',
          `Access denied for "${asset.name}": Requires ${
            asset.requiredTier === 'core' ? 'CORE Roster' : 'Community Member'
          } Discord role.`
        );
        setLoginModalOpen(true);
        return;
      }

      const targetBase =
        settings.dcsSavedGamesPath ||
        dcsEnv?.activeSavedGamesPath ||
        'C:\\Users\\Pilot\\Saved Games\\DCS';

      addLog(
        'info',
        'INSTALLER',
        `Starting deployment of "${asset.name}" (${asset.version}) -> ${targetBase}\\${asset.targetFolder.replace(
          /\//g,
          '\\'
        )}`
      );

      setActiveDownloads((prev) => ({
        ...prev,
        [asset.id]: {
          assetId: asset.id,
          stage: 'connecting',
          bytesDownloaded: 0,
          totalBytes: asset.fileSizeBytes,
          percent: 1,
          message: 'Initializing deployment...',
        },
      }));

      try {
        const record = await installAssetCommand(
          asset,
          targetBase,
          settings.verifyFileHash,
          (progress) => {
            setActiveDownloads((prev) => ({
              ...prev,
              [asset.id]: progress,
            }));
          }
        );

        setInstalledAssets((prev) => {
          const next = { ...prev, [asset.id]: record };
          persistInstalledMap(next);
          return next;
        });

        setLastVerifyResults((prev) => ({
          ...prev,
          [asset.id]: {
            valid: true,
            missingFiles: [],
            modifiedFiles: [],
            checkedCount: record.extractedFiles.length,
          },
        }));

        setRepairPrompt((prev) => (prev && prev.record.assetId === asset.id ? null : prev));

        addLog(
          'success',
          'INSTALLER',
          `Successfully deployed "${asset.name}" (${asset.version}) to ${record.installedPath}`
        );
      } catch (err) {
        addLog('error', 'INSTALLER', `Deployment failed for "${asset.name}": ${String(err)}`);
      } finally {
        setTimeout(() => {
          setActiveDownloads((prev) => {
            const copy = { ...prev };
            delete copy[asset.id];
            return copy;
          });
        }, 1200);
      }
    },
    [
      addLog,
      canAccessAsset,
      dcsEnv?.activeSavedGamesPath,
      persistInstalledMap,
      settings.dcsSavedGamesPath,
      settings.verifyFileHash,
    ]
  );

  const uninstallAsset = useCallback(
    async (assetId: string) => {
      const record = installedAssets[assetId];
      if (!record) return;

      const targetBase =
        settings.dcsSavedGamesPath ||
        dcsEnv?.activeSavedGamesPath ||
        'C:\\Users\\Pilot\\Saved Games\\DCS';

      addLog('info', 'INSTALLER', `Removing "${record.name}" from ${record.installedPath}...`);
      try {
        await uninstallAssetCommand(record, targetBase);
        setInstalledAssets((prev) => {
          const next = { ...prev };
          delete next[assetId];
          persistInstalledMap(next);
          return next;
        });
        addLog('success', 'INSTALLER', `Cleanly uninstalled "${record.name}".`);
      } catch (err) {
        addLog('error', 'INSTALLER', `Failed to uninstall "${record.name}": ${String(err)}`);
      }
    },
    [addLog, dcsEnv?.activeSavedGamesPath, installedAssets, persistInstalledMap, settings.dcsSavedGamesPath]
  );

  const verifyAsset = useCallback(
    async (assetId: string): Promise<boolean> => {
      const record = installedAssets[assetId];
      if (!record) return false;

      const remoteAsset = manifest.assets.find((a) => a.id === assetId);
      const targetBase =
        settings.dcsSavedGamesPath ||
        dcsEnv?.activeSavedGamesPath ||
        'C:\\Users\\Pilot\\Saved Games\\DCS';

      setVerifyingAssetId(assetId);
      addLog('info', 'INSTALLER', `Verifying local file integrity for "${record.name}"...`);
      try {
        const res = await verifyAssetIntegrityCommand(record, remoteAsset, targetBase);
        setLastVerifyResults((prev) => ({
          ...prev,
          [assetId]: res,
        }));

        if (res.valid) {
          addLog(
            'success',
            'INSTALLER',
            `Integrity check passed for "${record.name}" (${
              res.checkedCount || record.extractedFiles.length
            } file(s) verified).`
          );
          return true;
        } else {
          const missingCount = res.missingFiles.length;
          const modifiedCount = res.modifiedFiles?.length || 0;
          addLog(
            'warn',
            'INSTALLER',
            `Integrity mismatch for "${record.name}": ${missingCount} missing, ${modifiedCount} modified file(s).`
          );
          setRepairPrompt({
            asset: remoteAsset,
            record,
            result: res,
          });
          return false;
        }
      } catch (err) {
        addLog('error', 'INSTALLER', `Integrity check error: ${String(err)}`);
        return false;
      } finally {
        setVerifyingAssetId(null);
      }
    },
    [addLog, dcsEnv?.activeSavedGamesPath, installedAssets, manifest.assets, settings.dcsSavedGamesPath]
  );

  const updateAllOutdated = useCallback(async () => {
    for (const asset of outdatedAssets) {
      if (canAccessAsset(asset)) {
        await installAsset(asset);
      }
    }
  }, [canAccessAsset, installAsset, outdatedAssets]);

  const installAllRequiredForUser = useCallback(async () => {
    for (const asset of missingRequiredAssets) {
      await installAsset(asset);
    }
  }, [installAsset, missingRequiredAssets]);

  const installRequiredMods = useCallback(async () => {
    const requiredMods = missingRequiredAssets.filter((a) => a.category === 'mod');
    for (const asset of requiredMods) {
      await installAsset(asset);
    }
  }, [installAsset, missingRequiredAssets]);

  const installRequiredLiveries = useCallback(async () => {
    const requiredLiveries = missingRequiredAssets.filter((a) => a.category === 'livery');
    for (const asset of requiredLiveries) {
      await installAsset(asset);
    }
  }, [installAsset, missingRequiredAssets]);

  const checklistSummary: ChecklistSummary = useMemo(() => {
    const requiredMods = manifest.assets.filter(
      (a) => a.category === 'mod' && isRequiredForCurrentUser(a) && canAccessAsset(a)
    );
    const missingRequiredMods = missingRequiredAssets.filter((a) => a.category === 'mod');
    const installedModsCount = Object.values(installedAssets).filter(
      (a) =>
        a.category === 'mod' ||
        manifest.assets.find((m) => m.id === a.assetId)?.category === 'mod'
    ).length;
    const isModsComplete =
      requiredMods.length > 0
        ? missingRequiredMods.length === 0
        : installedModsCount > 0 || manifest.assets.filter((a) => a.category === 'mod').length === 0;

    const requiredLiveries = manifest.assets.filter(
      (a) => a.category === 'livery' && isRequiredForCurrentUser(a) && canAccessAsset(a)
    );
    const missingRequiredLiveries = missingRequiredAssets.filter((a) => a.category === 'livery');
    const installedLiveriesCount = Object.values(installedAssets).filter(
      (a) =>
        a.category === 'livery' ||
        manifest.assets.find((m) => m.id === a.assetId)?.category === 'livery'
    ).length;
    const isLiveriesComplete =
      requiredLiveries.length > 0
        ? missingRequiredLiveries.length === 0
        : installedLiveriesCount > 0;

    const isNickComplete = isNicknameMatching;
    const isDcsBotLinked = Boolean(
      memberProfile?.dcsUcid && memberProfile.dcsUcid.trim().length > 0
    );

    const totalSteps = 4;
    const completedSteps =
      (isModsComplete ? 1 : 0) +
      (isLiveriesComplete ? 1 : 0) +
      (isNickComplete ? 1 : 0) +
      (isDcsBotLinked ? 1 : 0);
    const pendingCount = totalSteps - completedSteps;
    const allComplete = completedSteps === totalSteps;

    return {
      isModsComplete,
      isLiveriesComplete,
      isNickComplete,
      isDcsBotLinked,
      completedSteps,
      totalSteps,
      pendingCount,
      allComplete,
    };
  }, [
    manifest.assets,
    isRequiredForCurrentUser,
    canAccessAsset,
    missingRequiredAssets,
    installedAssets,
    isNicknameMatching,
    memberProfile?.dcsUcid,
  ]);

  // --- ATC Deployment Actions ---
  const deployAtcDtc = useCallback(
    async (pkg: AtcFlightPlanPackage) => {
      const targetBase =
        settings.dcsSavedGamesPath ||
        dcsEnv?.activeSavedGamesPath ||
        'C:\\Users\\Pilot\\Saved Games\\DCS';

      try {
        const writtenPath = await installAtcDtcFileCommand(targetBase, pkg.dtcPackage);
        setInstalledAtc((prev) => {
          const next: InstalledAtcState = {
            ...prev,
            installedDtcIds: {
              ...prev.installedDtcIds,
              [pkg.id]: {
                installedPath: writtenPath,
                installedAt: new Date().toISOString(),
              },
            },
          };
          persistInstalledAtc(next);
          return next;
        });
        addLog(
          'success',
          'ATC',
          `Deployed DTC cartridge "${pkg.dtcPackage.fileName}" -> ${writtenPath}`
        );
      } catch (err) {
        addLog('error', 'ATC', `Failed deploying DTC for "${pkg.missionTitle}": ${String(err)}`);
      }
    },
    [addLog, dcsEnv?.activeSavedGamesPath, persistInstalledAtc, settings.dcsSavedGamesPath]
  );

  const mergeAtcRoutePreset = useCallback(
    async (pkg: AtcFlightPlanPackage): Promise<RoutePresetMergeResult | null> => {
      const targetBase =
        settings.dcsSavedGamesPath ||
        dcsEnv?.activeSavedGamesPath ||
        'C:\\Users\\Pilot\\Saved Games\\DCS';

      try {
        const result = await mergeAtcRouteToolPresetCommand(targetBase, pkg.routePreset);
        setInstalledAtc((prev) => {
          const next: InstalledAtcState = {
            ...prev,
            mergedRoutePresets: {
              ...prev.mergedRoutePresets,
              [pkg.id]: {
                theatre: pkg.routePreset.theatre,
                filePath: result.filePath,
                mergedAt: new Date().toISOString(),
              },
            },
          };
          persistInstalledAtc(next);
          return next;
        });
        addLog(
          'success',
          'ATC',
          `Route Tool Preset ["${pkg.routePreset.presetName}"] ${result.action} in ${result.filePath} (${result.presetNames.length} total preset(s) in theatre manifest).`
        );
        return result;
      } catch (err) {
        addLog(
          'error',
          'ATC',
          `Failed merging Route Tool preset for "${pkg.missionTitle}": ${String(err)}`
        );
        return null;
      }
    },
    [addLog, dcsEnv?.activeSavedGamesPath, persistInstalledAtc, settings.dcsSavedGamesPath]
  );

  const deployAtcKneeboards = useCallback(
    async (pkg: AtcFlightPlanPackage) => {
      if (!pkg.kneeboards.length) return;
      const targetBase =
        settings.dcsSavedGamesPath ||
        dcsEnv?.activeSavedGamesPath ||
        'C:\\Users\\Pilot\\Saved Games\\DCS';

      try {
        for (const kb of pkg.kneeboards) {
          const writtenPath = await installAtcKneeboardCommand(targetBase, pkg, kb);
          setInstalledAtc((prev) => {
            const next: InstalledAtcState = {
              ...prev,
              installedKneeboardIds: {
                ...prev.installedKneeboardIds,
                [kb.id]: {
                  installedPath: writtenPath,
                  installedAt: new Date().toISOString(),
                },
              },
            };
            persistInstalledAtc(next);
            return next;
          });
          addLog('success', 'ATC', `Installed Kneeboard "${kb.title}" -> ${writtenPath}`);
        }
      } catch (err) {
        addLog('error', 'ATC', `Failed deploying Kneeboards for "${pkg.missionTitle}": ${String(err)}`);
      }
    },
    [addLog, dcsEnv?.activeSavedGamesPath, persistInstalledAtc, settings.dcsSavedGamesPath]
  );

  const deployFullAtcPackage = useCallback(
    async (pkg: AtcFlightPlanPackage) => {
      addLog(
        'info',
        'ATC',
        `Deploying complete ATC Flight Package "${pkg.operationName} // ${pkg.missionTitle}"...`
      );
      await deployAtcDtc(pkg);
      await mergeAtcRoutePreset(pkg);
      await deployAtcKneeboards(pkg);
    },
    [addLog, deployAtcDtc, deployAtcKneeboards, mergeAtcRoutePreset]
  );

  const inspectTheatreRouteLua = useCallback(
    async (theatreFileName: string): Promise<RoutePresetManifestInfo> => {
      const targetBase =
        settings.dcsSavedGamesPath ||
        dcsEnv?.activeSavedGamesPath ||
        'C:\\Users\\Pilot\\Saved Games\\DCS';

      return await inspectAtcRouteToolPresetsCommand(targetBase, theatreFileName);
    },
    [dcsEnv?.activeSavedGamesPath, settings.dcsSavedGamesPath]
  );

  // --- Flight Plans API & Integrations Handlers ---
  const fetchFiledPlans = useCallback(
    async (options?: FetchFiledFlightPlansOptions): Promise<FlightPlanSummary[]> => {
      const baseUrl = settings.memberPortalApiUrl || STATIC_CONFIG.portalBaseUrl;
      const token = userSession?.accessToken;
      try {
        const res = await fetchFiledFlightPlans(baseUrl, options || { limit: 50 }, token);
        if (res && Array.isArray(res.plans)) {
          setFiledFlightPlans(res.plans);
          return res.plans;
        }
      } catch (err) {
        console.warn('fetchFiledPlans error:', err);
      }
      return [];
    },
    [settings.memberPortalApiUrl, userSession?.accessToken]
  );

  const syncFlightPlans = useCallback(async () => {
    setIsLoadingFlightPlans(true);
    addLog('info', 'ATC', 'Fetching Member, Sortie Package & Filed Flight Plans from Portal...');
    const baseUrl = settings.memberPortalApiUrl || STATIC_CONFIG.portalBaseUrl;
    const discordId = userSession?.id || memberProfile.discordId || '112233445566778899';
    const token = userSession?.accessToken;

    try {
      const [memberRes, sortieRes, filedRes] = await Promise.all([
        fetchMemberFlightPlans(baseUrl, discordId, true, token),
        fetchActiveSortieFlightPlans(baseUrl, token),
        fetchFiledFlightPlans(baseUrl, { limit: 50 }, token),
      ]);

      setMemberFlightPlans(memberRes.plans);
      setMemberFlightPlansMeta({
        total: memberRes.total,
        missions_count: memberRes.missions_count,
        authored_count: memberRes.authored_count,
        private_count: memberRes.private_count,
      });

      setActiveSortie(sortieRes.active_sortie);
      setActiveSortieFlightPlans(sortieRes.plans);
      if (filedRes && Array.isArray(filedRes.plans)) {
        setFiledFlightPlans(filedRes.plans);
      }

      addLog(
        'success',
        'ATC',
        `Flight Plans synchronized: ${memberRes.plans.length} member plan(s), ${sortieRes.plans.length} sortie plan(s), ${filedRes?.plans?.length || 0} filed with ATC.`
      );
    } catch (err) {
      addLog('warn', 'ATC', `Flight Plans sync warning: ${String(err)}`);
    } finally {
      setIsLoadingFlightPlans(false);
    }
  }, [addLog, memberProfile.discordId, settings.memberPortalApiUrl, userSession?.accessToken, userSession?.id]);

  const loadFlightPlanDetail = useCallback(
    async (idOrIdentifier: string | number): Promise<FlightPlanDetail> => {
      const baseUrl = settings.memberPortalApiUrl || STATIC_CONFIG.portalBaseUrl;
      const token = userSession?.accessToken;
      return await fetchFlightPlanDetail(baseUrl, idOrIdentifier, token);
    },
    [settings.memberPortalApiUrl, userSession?.accessToken]
  );

  const saveRouteToDcs = useCallback(
    async (theatre: string, luaContent: string): Promise<RoutePresetInstallResult> => {
      const customDcsPath = settings.dcsSavedGamesPath || dcsEnv?.activeSavedGamesPath;
      addLog('info', 'ATC', `Saving route preset to DCS theatre manifest "${theatre}"...`);
      try {
        const res = await installDcsRoutePresetCommand(theatre, luaContent, customDcsPath);
        addLog(
          'success',
          'ATC',
          `Route preset successfully ${res.action} in "${res.filePath}"!`
        );
        return res;
      } catch (err: any) {
        addLog('error', 'ATC', `Failed to save route preset to DCS: ${String(err)}`);
        throw err;
      }
    },
    [addLog, dcsEnv?.activeSavedGamesPath, settings.dcsSavedGamesPath]
  );

  const copyDcsRoutePresetsPathToClipboard = useCallback(async (): Promise<string> => {
    const customDcsPath = settings.dcsSavedGamesPath || dcsEnv?.activeSavedGamesPath;
    const path = await getDcsRoutePresetsPath(customDcsPath);
    try {
      await navigator.clipboard.writeText(path);
      addLog('info', 'ATC', `Copied RouteToolPresets directory path to clipboard: ${path}`);
    } catch {
      // fallback
    }
    return path;
  }, [addLog, dcsEnv?.activeSavedGamesPath, settings.dcsSavedGamesPath]);

  const saveDtcCartridgeDirect = useCallback(
    async (fileName: string, content: string, subfolder = 'DTC'): Promise<string> => {
      const customDcsPath = settings.dcsSavedGamesPath || dcsEnv?.activeSavedGamesPath;
      addLog('info', 'ATC', `Deploying DTC Cartridge "${fileName}" directly to DCS...`);
      try {
        const fullPath = await installDtcCartridgeDirect(fileName, content, subfolder, customDcsPath);
        addLog('success', 'ATC', `Saved DTC Cartridge -> ${fullPath}`);
        return fullPath;
      } catch (err: any) {
        addLog('error', 'ATC', `Failed to save DTC Cartridge: ${String(err)}`);
        throw err;
      }
    },
    [addLog, dcsEnv?.activeSavedGamesPath, settings.dcsSavedGamesPath]
  );

  const openPdfKneeboardViewer = useCallback(
    async (pdfUrl: string, fileName?: string): Promise<string> => {
      addLog('info', 'ATC', `Opening PDF Kneeboard viewer for ${fileName || 'flight plan'}...`);
      const token = userSession?.accessToken;
      try {
        const opened = await openPdfExternalViewer(pdfUrl, fileName, token);
        addLog('success', 'ATC', `Opened PDF Kneeboard in system viewer.`);
        return opened;
      } catch (err: any) {
        addLog('error', 'ATC', `Failed opening PDF in default viewer: ${String(err)}`);
        throw err;
      }
    },
    [addLog, userSession?.accessToken]
  );

  const confirmDcsPath = useCallback(
    (confirmedPath: string) => {
      const clean = confirmedPath.trim();
      setHasConfirmedDcsPath(true);
      localStorage.setItem(STORAGE_KEYS.DCS_PATH_CONFIRMED, 'true');
      updateSettings({
        dcsSavedGamesPath: clean,
        hasConfirmedDcsPath: true,
      });
      refreshDcsEnv(clean);
      setPathOnboardingOpen(false);
      addLog('success', 'SYSTEM', `DCS Saved Games directory confirmed: ${clean}`);
    },
    [addLog, refreshDcsEnv, updateSettings]
  );

  const loginWithDiscordOAuth = useCallback(async () => {
    addLog('info', 'AUTH', 'Initiating Discord OAuth2 authentication...');
    const session = await startDiscordOAuthCommand();
    setUserSession(session);
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
    const nextProfile = buildFallbackMemberProfile(session, session.tier);
    setMemberProfile(nextProfile);
    localStorage.setItem(STORAGE_KEYS.PORTAL_PROFILE, JSON.stringify(nextProfile));
    addLog(
      'success',
      'AUTH',
      `Authenticated as ${session.globalName} (@${session.username}) — Clearance: ${session.tier.toUpperCase()}`
    );
    if (!hasConfirmedDcsPath) {
      setPathOnboardingOpen(true);
    }
  }, [addLog, hasConfirmedDcsPath]);

  useEffect(() => {
    const isVerifiedUser =
      userSession &&
      userSession.isGuildMember &&
      userSession.tier !== 'guest';

    if (isVerifiedUser && !hasConfirmedDcsPath) {
      setPathOnboardingOpen(true);
    }
  }, [userSession, hasConfirmedDcsPath]);

  const logoutDiscord = useCallback(() => {
    setUserSession(null);
    localStorage.removeItem(STORAGE_KEYS.SESSION);
    addLog('info', 'AUTH', 'Signed out of Discord.');
  }, [addLog]);

  return (
    <AppContext.Provider
      value={{
        activeTab,
        setActiveTab,
        manifest,
        isSyncingManifest,
        lastSyncedAt,
        syncManifest,
        installedAssets,
        rescanLocalAssets,
        activeDownloads,
        dcsEnv,
        refreshDcsEnv,
        userSession,
        effectiveTier,
        memberProfile,
        isPortalLive,
        syncMemberPortal,
        overrideMemberProfile,
        atcPackages,
        installedAtc,
        deployAtcDtc,
        mergeAtcRoutePreset,
        deployAtcKneeboards,
        deployFullAtcPackage,
        inspectTheatreRouteLua,
        memberFlightPlans,
        memberFlightPlansMeta,
        activeSortie,
        activeSortieFlightPlans,
        filedFlightPlans,
        isLoadingFlightPlans,
        syncFlightPlans,
        fetchFiledPlans,
        loadFlightPlanDetail,
        saveRouteToDcs,
        copyDcsRoutePresetsPathToClipboard,
        saveDtcCartridgeDirect,
        openPdfKneeboardViewer,
        loginModalOpen,
        setLoginModalOpen,
        selectedAsset,
        setSelectedAsset,
        selectedFlightPlanId,
        setSelectedFlightPlanId,
        highlightedCertId,
        setHighlightedCertId,
        settings,
        updateSettings,
        installAsset,
        uninstallAsset,
        verifyAsset,
        verifyingAssetId,
        lastVerifyResults,
        repairPrompt,
        setRepairPrompt,
        updateAllOutdated,
        installAllRequiredForUser,
        outdatedAssets,
        missingRequiredAssets,
        canAccessAsset,
        isRequiredForCurrentUser,
        isUpdateAvailable,
        loginWithDiscordOAuth,
        logoutDiscord,
        hasConfirmedDcsPath,
        pathOnboardingOpen,
        setPathOnboardingOpen,
        confirmDcsPath,
        logs,
        clearLogs,
        addLog,
        dcsNicknameInfo,
        isLoadingNickname,
        refreshDcsNickname,
        updateDcsNickname,
        expectedDcsNickname,
        isNicknameMatching,
        installRequiredMods,
        installRequiredLiveries,
        checklistSummary,
        appUpdate,
        isCheckingAppUpdate,
        checkForAppUpdateAction,
        isUpdateModalOpen,
        setIsUpdateModalOpen,
        notifications,
        unreadNotificationsCount,
        addNotification,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        clearNotification,
        clearAllNotifications,
        sendTestNotification,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp must be used inside AppProvider');
  }
  return ctx;
}
