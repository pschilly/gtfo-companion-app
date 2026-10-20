/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DISCORD_CLIENT_ID?: string;
  readonly VITE_DISCORD_GUILD_ID?: string;
  readonly VITE_DISCORD_COMMUNITY_ROLE_ID?: string;
  readonly VITE_DISCORD_CORE_ROLE_ID?: string;
  readonly VITE_OAUTH_REDIRECT_PORT?: string;
  readonly VITE_PORTAL_BASE_URL?: string;
  readonly VITE_MANIFEST_URL?: string;
  readonly VITE_KB_URL?: string;
  readonly VITE_CDN_LOGO_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
