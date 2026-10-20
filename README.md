# GTFO Companion App // Portable DCS Community Launcher & Mod Manager

A portable Windows 11 desktop application built with **Tauri v2**, **React**, **TypeScript**, **Tailwind CSS**, and **Rust** for deploying GTFO Tactical Wing liveries and mods directly into local `Saved Games\DCS` or `Saved Games\DCS.openbeta` directories.

---

## Environment Configuration & Discord Setup

1. Copy `.env.example` to `.env` and provide your Discord application and guild configuration:
   ```bash
   cp .env.example .env
   ```

2. Open the [Discord Developer Portal](https://discord.com/developers/applications).
3. Under **OAuth2 -> Redirects**, add:
   ```text
   http://127.0.0.1:54321/callback
   ```
4. Ensure **Public Client** is enabled so PKCE authentication works without embedding a client secret in the distributed `.exe`.
5. Once logged in via the app, open the **Inspect Roles / Switch Tier** modal (or **System Settings**) to view your detected Discord Role IDs and click your **CORE** role ID to designate it for CORE tier clearance.

---

## Development & Portable Windows `.exe` Build

### 1. Install Frontend Dependencies & Run UI Dev Server
```bash
npm install
npm run dev
```

### 2. Run Native Tauri v2 Desktop App (Requires Rust Toolchain)
If Rust is not yet installed on your machine, install it via [rustup.rs](https://rustup.rs/) (`winget install Rustlang.Rustup`), then run:
```bash
npm run tauri:dev
```

### 3. Build Standalone Portable `.exe`
```bash
npm run tauri:build
```
The standalone portable Windows executable will be output to:
`src-tauri/target/release/gtfo-companion-app.exe`
