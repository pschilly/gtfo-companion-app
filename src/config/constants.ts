import { AppSettings } from '../types';

export const STATIC_CONFIG = {
  appVersion: '0.0.5',
  appTitle: 'Companion App',
  shortName: 'GTFO',
  fullName: 'GLOBAL TASK FORCE OVERLORD',
  companionSubtitle: 'Companion App',
  logoUrl: import.meta.env.VITE_CDN_LOGO_URL || 'https://cdn.globaltaskforceoverlord.org/GTFO-Logo.png',
  kbUrl: import.meta.env.VITE_KB_URL || 'https://kb.globaltaskforceoverlord.org',
  portalBaseUrl: import.meta.env.VITE_PORTAL_BASE_URL || 'https://members.globaltaskforceoverlord.org/api/v1/companion',
  manifestUrl: import.meta.env.VITE_MANIFEST_URL || 'https://members.globaltaskforceoverlord.org/api/v1/companion/manifest',
  discordClientId: import.meta.env.VITE_DISCORD_CLIENT_ID || '',
  discordGuildId: import.meta.env.VITE_DISCORD_GUILD_ID || '',
  communityRoleId: import.meta.env.VITE_DISCORD_COMMUNITY_ROLE_ID || '',
  coreRoleId: import.meta.env.VITE_DISCORD_CORE_ROLE_ID || '',
  oauthRedirectPort: Number(import.meta.env.VITE_OAUTH_REDIRECT_PORT) || 54321,
} as const;

export const DEFAULT_SETTINGS: AppSettings = {
  dcsSavedGamesPath: '',
  autoDetectDcsPath: true,
  autoSyncOnStartup: true,
  verifyFileHash: true,
  memberPortalApiUrl: import.meta.env.VITE_PORTAL_BASE_URL || 'https://members.globaltaskforceoverlord.org/api/v1/companion',
  hasConfirmedDcsPath: false,
};
