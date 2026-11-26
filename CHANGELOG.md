# Changelog

All notable changes to the GTFO Companion App are documented in this file.

## [0.0.17] - 2026-11-25
- **Typography & Readability**:
  - Replaced `Inter`, `Lexend`, and `JetBrains Mono` with `Barlow Semi Condensed` (headings/display), `IBM Plex Sans` (UI/body), and `IBM Plex Mono` (telemetry, coordinates, and technical data) across the app and PDF kneeboard generator.
  - Bumped unreadable sub-12px micro-text across views, components, modals, tactical map drawers, and Leaflet popups while preserving compact fixed-pixel map pin markers.
  - Removed unnecessary monospace styling from buttons, tabs, form labels, status badges, and prose while retaining monospace and tabular numerals for operational flight data.

## [0.0.16] - 2026-11-20
- **Build/Release**:
  - Inject CARTO_KEY into CI builds (fixes map API-key overlay).
  - Release now ships the installer only (no portable exe).

## [0.0.15] - 2026-11-20
- **S2 Operations - Campaign Map**:
  - Added flight planning tool.
  - Added threats & assets (Support Assets & Threats (Enemy IRs)) to the map.
  - Added coordinate converter.
- **General App Changes**:
  - Overall Style changes for screen widths.

## [0.0.14] - 2026-11-20
- **S2 Operations - Campaign Map**:
  - Added flight planning tool.
  - Added threats & assets (Support Assets & Threats (Enemy IRs)) to the map.
  - Added coordinate converter.
- **General App Changes**:
  - Overall Style changes for screen widths.

## [0.0.13] - 2026-11-18

### Added
- **S2 Operations — Campaigns & Theater Command (`CampaignsView`)**:
  - Active-only campaign hub with live updating breadcrumbs (`S2 - Operations > Campaigns > [Campaign] > [Section]`) and expandable sidebar sub-navigation (`Overview`, `Campaign Lore`, `Missions`, `Intel Reports`, `Airframes`).
  - **Campaign Overview (`CampaignOverviewTab`)**: Full-width campaign briefing container, operational progress tracker, theater resource pools, transaction ledger, pending supply orders manifest, and section quick-jump cards.
  - **Campaign Lore (`CampaignLoreTab`)**: Multi-chapter theater lore reader with paginated chapters, cover imagery, comms intercept audio, and embedded video briefings.
  - **Campaign Missions & Two-Pane Mission Dossier (`CampaignMissionsTab`, `CampaignMissionModal`)**: Active and completed mission grouping, actual objective names, priority/point/resource rewards, SMEAC operational orders, flight & package rosters, frequency ladder, sortie schedule strips, and a full-window portaled dossier modal with soft backdrop blur.
  - **Unified Intelligence & Sortie AAR Feed (`CampaignIntelTab`)**: Aggregated standalone S2 intel dispatches alongside filed Sortie After Action Reports (`AAR & BDA`), Friendly vs. Estimated Enemy Losses, debrief narratives, BDA reconnaissance media galleries, relevance/recency aging window (`Current & Relevant`, `Last 14 Days`, `Full Archive`), pagination (`6 / 12 / 24 / 48` per page), and staged media loading.
  - **Theater Airframes Inventory (`CampaignAirframesTab`)**: Squadron-grouped tracked airframe inventory with airbase breakdowns.
- **Customizable Home Dashboard & Pinned Campaign Widget**:
  - Added modular home dashboard widgets with `PinnedCampaignWidget` and synchronized pin/unpin controls across Home and Campaigns.

### Changed & Fixed
- **Cross-View Sortie & Mission Navigation**:
  - Opening a sortie event from a mission page or Mission Dossier preserves origin context (`calendarReturnContext`) so closing the Event Calendar modal returns directly to the originating mission dossier tab or Missions view, while providing a **Stay on Calendar** option and automatic campaign roster refresh after RSVP updates.
- **UI & Layout Refinements**:
  - Added collapsible sidebar mode (`Sidebar`), updated top-bar telemetry/navigation controls (`TopBar`), fixed mission sortie list indentation, and unified full-viewport lightbox/modal backdrop blur portals.
- **Release Packaging**:
  - Enhanced `scripts/generate-updater-json.js` to fall back to `CHANGELOG.md` release notes automatically when building `latest.json`.

---

## [0.0.12] - 2026-11-04

### Added
- **Training Sortie Completion & AAR Workbench**:
  - Enabled sortie conclusion and attendance recording for instructors and authorized leads (`can_complete`) in `EventCalendarView`.
  - Added an interactive debrief form and attendance checklist (🟢 Present / 🔴 Absent No-Show) with "Mark All Present" and "Mark All Absent" batch controls.
  - Submits completion and debrief notes to the member portal API and triggers Discord AAR publication.
- **Sortie Debrief & Attendance Badges**:
  - Added tailored "Training Debrief & Attendance Record" summary card omitting combat loss metrics.
  - Added dynamic `+100 XP` attendance award badge for training attendees (preserving `+500 XP` for campaign operations).
- **Service Record Integration**:
  - Added support for `'training-sortie'` service records in the member dossier with graduation cap icon and tactical amber styling.

### Fixed
- **Flight Planning & ATC**:
  - Resolved flight planning adjustments and waypoint sync in `AtcView`.
  - Fixed squadron navigation link reference in `SquadronsView`.
- **Calendar RSVP & Callsigns**:
  - Enhanced multi-squadron callsign conflict resolution and attendee roster groupings across campaign and training events.

---

## [0.0.11] - 2026-11-03

### Added
- **Task Force Roster & Personnel**:
  - Integrated S1 Personnel Roster with pilot grades, flight hours, and qualification status.
  - Added squadron rosters and visual ribbon rack layout in pilot dossier.
- **Qualifications LMS**:
  - Integrated S3 Training & Qualifications syllabus catalog in `QualificationsZoneView`.

---

## [0.0.10] - 2026-10-28

### Added
- Tactical flight planner and kneeboard generator.
- Discord Rich Presence integration and DCS liveries asset installer.

