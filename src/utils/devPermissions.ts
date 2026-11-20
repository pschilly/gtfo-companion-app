import {
  CampaignMapPayload,
  CampaignMapPermissions,
  DevPermissionOverrides,
  UserTier,
} from '../types';

export const DEV_PERMISSION_STORAGE_KEY = 'gtfo_dev_permission_overrides_v1';

export const DEFAULT_DEV_PERMISSION_OVERRIDES: DevPermissionOverrides = {
  enabled: false,
  presetId: 'default',
  tierOverride: 'default',
  mapPermissions: {},
  forceRecordsReadOnly: false,
};

export interface DevPermissionPreset {
  id: string;
  label: string;
  description: string;
  tierOverride: 'default' | UserTier;
  mapPermissions: Partial<CampaignMapPermissions>;
  forceRecordsReadOnly: boolean;
}

export const DEV_PERMISSION_PRESETS: DevPermissionPreset[] = [
  {
    id: 'default',
    label: 'Default (Live)',
    description: 'Use your real pulled Discord role tier & server map permissions.',
    tierOverride: 'default',
    mapPermissions: {},
    forceRecordsReadOnly: false,
  },
  {
    id: 'guest_readonly',
    label: 'Guest / Read-Only',
    description: 'View-only mode with all editing tools and records locked.',
    tierOverride: 'guest',
    mapPermissions: {
      canViewMap: true,
      canCreateFlightPlan: false,
      canManageFlightPlans: false,
      canManageBothCoalitions: false,
      canManageThreats: false,
      canManageSupportAssets: false,
      canCreateTacticalMarkings: false,
      canManageCampaignTacticalMarkings: false,
      canManageMissionTacticalMarkings: false,
      canManageSortieTacticalMarkings: false,
      canManageSharedTacticalMarkings: false,
      canEditMissionAor: false,
      isSuperAdmin: false,
      isCouncil: false,
    },
    forceRecordsReadOnly: true,
  },
  {
    id: 'community_pilot',
    label: 'Community Pilot',
    description: 'Community tier with Flight Planner and personal Tactical Markings.',
    tierOverride: 'community',
    mapPermissions: {
      canViewMap: true,
      canCreateFlightPlan: true,
      canManageFlightPlans: true,
      canManageBothCoalitions: false,
      canManageThreats: false,
      canManageSupportAssets: false,
      canCreateTacticalMarkings: true,
      canManageCampaignTacticalMarkings: false,
      canManageMissionTacticalMarkings: false,
      canManageSortieTacticalMarkings: false,
      canManageSharedTacticalMarkings: false,
      canEditMissionAor: false,
      isSuperAdmin: false,
      isCouncil: false,
    },
    forceRecordsReadOnly: false,
  },
  {
    id: 'core_pilot',
    label: 'CORE Pilot',
    description: 'CORE tier with Flight Planner plus personal and Sortie markings.',
    tierOverride: 'core',
    mapPermissions: {
      canViewMap: true,
      canCreateFlightPlan: true,
      canManageFlightPlans: true,
      canManageBothCoalitions: false,
      canManageThreats: false,
      canManageSupportAssets: false,
      canCreateTacticalMarkings: true,
      canManageCampaignTacticalMarkings: false,
      canManageMissionTacticalMarkings: false,
      canManageSortieTacticalMarkings: true,
      canManageSharedTacticalMarkings: true,
      canEditMissionAor: false,
      isSuperAdmin: false,
      isCouncil: false,
    },
    forceRecordsReadOnly: false,
  },
  {
    id: 'flight_plan_manager',
    label: 'Flight Plan Mgr',
    description: 'Manage both coalitions and Mission/Sortie tactical markings.',
    tierOverride: 'core',
    mapPermissions: {
      canViewMap: true,
      canCreateFlightPlan: true,
      canManageFlightPlans: true,
      canManageBothCoalitions: true,
      canManageThreats: false,
      canManageSupportAssets: false,
      canCreateTacticalMarkings: true,
      canManageCampaignTacticalMarkings: false,
      canManageMissionTacticalMarkings: true,
      canManageSortieTacticalMarkings: true,
      canManageSharedTacticalMarkings: true,
      canEditMissionAor: false,
      isSuperAdmin: false,
      isCouncil: false,
    },
    forceRecordsReadOnly: false,
  },
  {
    id: 'threat_support_manager',
    label: 'Threat / Support Mgr',
    description: 'Manage Threats, Support Assets, all Marking scopes, and AOR assignment.',
    tierOverride: 'core',
    mapPermissions: {
      canViewMap: true,
      canCreateFlightPlan: true,
      canManageFlightPlans: true,
      canManageBothCoalitions: false,
      canManageThreats: true,
      canManageSupportAssets: true,
      canCreateTacticalMarkings: true,
      canManageCampaignTacticalMarkings: true,
      canManageMissionTacticalMarkings: true,
      canManageSortieTacticalMarkings: true,
      canManageSharedTacticalMarkings: true,
      canEditMissionAor: true,
      isSuperAdmin: false,
      isCouncil: false,
    },
    forceRecordsReadOnly: false,
  },
  {
    id: 'super_admin',
    label: 'Super Admin / Council',
    description: 'Full access to every map planner, scope, AOR control, and admin role.',
    tierOverride: 'core',
    mapPermissions: {
      canViewMap: true,
      canCreateFlightPlan: true,
      canManageFlightPlans: true,
      canManageBothCoalitions: true,
      canManageThreats: true,
      canManageSupportAssets: true,
      canCreateTacticalMarkings: true,
      canManageCampaignTacticalMarkings: true,
      canManageMissionTacticalMarkings: true,
      canManageSortieTacticalMarkings: true,
      canManageSharedTacticalMarkings: true,
      canViewIsr: true,
      canRequestIsr: true,
      canManageIsr: true,
      canMarkupIsr: true,
      canEditMissionAor: true,
      isSuperAdmin: true,
      isCouncil: true,
    },
    forceRecordsReadOnly: false,
  },
];

export interface DevMapPermissionToggleDef {
  key: keyof CampaignMapPermissions;
  label: string;
}

export interface DevMapPermissionGroupDef {
  groupLabel: string;
  items: DevMapPermissionToggleDef[];
}

export const DEV_MAP_PERMISSION_GROUPS: DevMapPermissionGroupDef[] = [
  {
    groupLabel: 'Flight Planner',
    items: [
      { key: 'canCreateFlightPlan', label: 'Create Flight Plans' },
      { key: 'canManageFlightPlans', label: 'Access / Edit Flight Plans' },
      { key: 'canManageBothCoalitions', label: 'Manage Both Coalitions' },
    ],
  },
  {
    groupLabel: 'Threats & Support',
    items: [
      { key: 'canManageThreats', label: 'Manage SAMs / Threats' },
      { key: 'canManageSupportAssets', label: 'Manage Support Assets' },
    ],
  },
  {
    groupLabel: 'Tactical Markings',
    items: [
      { key: 'canCreateTacticalMarkings', label: 'Create Personal Markings' },
      { key: 'canManageCampaignTacticalMarkings', label: 'Campaign Scope Markings' },
      { key: 'canManageMissionTacticalMarkings', label: 'Mission Scope Markings' },
      { key: 'canManageSortieTacticalMarkings', label: 'Sortie Scope Markings' },
      { key: 'canManageSharedTacticalMarkings', label: 'Manage Shared Markings' },
      { key: 'canEditMissionAor', label: 'Assign Marking as Mission/Obj AOR' },
    ],
  },
  {
    groupLabel: 'Admin Roles',
    items: [
      { key: 'isCouncil', label: 'Council Member' },
      { key: 'isSuperAdmin', label: 'Super Admin' },
    ],
  },
];

/**
 * Load persisted dev-only permission overrides when running under Vite dev server (`tauri:dev`).
 */
export function loadDevPermissionOverrides(): DevPermissionOverrides {
  if (!import.meta.env.DEV) {
    return DEFAULT_DEV_PERMISSION_OVERRIDES;
  }
  try {
    const raw = localStorage.getItem(DEV_PERMISSION_STORAGE_KEY);
    if (!raw) return DEFAULT_DEV_PERMISSION_OVERRIDES;
    const parsed = JSON.parse(raw) as Partial<DevPermissionOverrides>;
    return {
      enabled: Boolean(parsed.enabled),
      presetId: typeof parsed.presetId === 'string' ? parsed.presetId : 'default',
      tierOverride:
        parsed.tierOverride === 'guest' ||
        parsed.tierOverride === 'community' ||
        parsed.tierOverride === 'core' ||
        parsed.tierOverride === 'default'
          ? parsed.tierOverride
          : 'default',
      mapPermissions:
        parsed.mapPermissions && typeof parsed.mapPermissions === 'object'
          ? parsed.mapPermissions
          : {},
      forceRecordsReadOnly: Boolean(parsed.forceRecordsReadOnly),
    };
  } catch {
    return DEFAULT_DEV_PERMISSION_OVERRIDES;
  }
}

/**
 * Persist dev-only permission overrides in localStorage when running in dev mode.
 */
export function saveDevPermissionOverrides(overrides: DevPermissionOverrides): void {
  if (!import.meta.env.DEV) {
    return;
  }
  try {
    if (!overrides.enabled) {
      localStorage.removeItem(DEV_PERMISSION_STORAGE_KEY);
    } else {
      localStorage.setItem(DEV_PERMISSION_STORAGE_KEY, JSON.stringify(overrides));
    }
  } catch {
    // Ignore storage errors in dev helper
  }
}

/**
 * Merge live server CampaignMapPermissions with active dev overrides (dev mode only).
 */
export function applyDevMapPermissions(
  live: CampaignMapPermissions,
  overrides: DevPermissionOverrides
): CampaignMapPermissions {
  if (!import.meta.env.DEV || !overrides.enabled) {
    return live;
  }
  return {
    ...live,
    ...overrides.mapPermissions,
  };
}

/**
 * Return a copy of CampaignMapPayload with dev permission overrides and optional read-only marking
 * simulation applied (dev mode only).
 */
export function applyDevOverridesToMapPayload(
  payload: CampaignMapPayload,
  overrides: DevPermissionOverrides
): CampaignMapPayload {
  if (!import.meta.env.DEV || !overrides.enabled) {
    return payload;
  }
  const permissions = applyDevMapPermissions(payload.permissions, overrides);
  const tacticalMarkings = overrides.forceRecordsReadOnly
    ? (payload.tacticalMarkings || []).map((m) => ({ ...m, can_edit: false }))
    : payload.tacticalMarkings;

  return {
    ...payload,
    permissions,
    tacticalMarkings,
  };
}
