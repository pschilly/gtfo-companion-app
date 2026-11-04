# Changelog

All notable changes to the GTFO Companion App are documented in this file.

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

