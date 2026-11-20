import React, { useMemo, useState } from 'react';
import {
  Crosshair,
  DownloadSimple,
  MapPin,
  Plus,
  SlidersHorizontal,
  Trash,
} from '@phosphor-icons/react';
import {
  CampaignMapAirframeCatalogItem,
  CampaignMapPayload,
  FlightPlanDetail,
} from '../../../types';
import {
  computeDestinationPoint,
  formatCoordinateDdm,
} from './geodesy';

export type AvionicsPlotTarget =
  | { kind: 'f18_flot'; num: 1 | 2 | 3 }
  | { kind: 'f18_faor'; num: 1 | 2 | 3 }
  | { kind: 'f18_cap'; num: 1 | 2 | 3 }
  | { kind: 'f18_corridor'; num: 1 | 2 }
  | { kind: 'f16_geo'; lineNum: 1 | 2 | 3 | 4 }
  | { kind: 'f16_dest' }
  | { kind: 'f14_plot'; lineNum: 1 | 2 | 3 | 4 }
  | { kind: 'jf17_airspace'; key: 'BKYA' | 'BKYB' | 'BKYC' | 'BKYD' }
  | { kind: 'generic' };

export function avionicsTargetsEqual(
  a: AvionicsPlotTarget | null,
  b: AvionicsPlotTarget | null
): boolean {
  if (!a || !b) return false;
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case 'f18_flot':
    case 'f18_faor':
    case 'f18_cap':
      return a.num === (b as typeof a).num;
    case 'f18_corridor':
      return a.num === (b as typeof a).num;
    case 'f16_geo':
    case 'f14_plot':
      return a.lineNum === (b as typeof a).lineNum;
    case 'jf17_airspace':
      return a.key === (b as typeof a).key;
    case 'f16_dest':
    case 'generic':
      return true;
  }
}

export function describeAvionicsPlotTarget(target: AvionicsPlotTarget): string {
  switch (target.kind) {
    case 'f18_flot':
      return `Plotting F/A-18C FLOT Line ${target.num} Vertex`;
    case 'f18_faor':
      return `Plotting F/A-18C FAOR Boundary ${target.num} Vertex`;
    case 'f18_cap':
      return `Click Map to Place F/A-18C CAP ${target.num} Anchor`;
    case 'f18_corridor':
      return `Plotting F/A-18C Corridor ${target.num} Centerline Vertex`;
    case 'f16_geo':
      return `Plotting F-16C GEO Line ${target.lineNum} Vertex`;
    case 'f16_dest':
      return 'Plotting F-16C DEST Point (STPT 81–99)';
    case 'f14_plot':
      return `Plotting F-14B TID Plot Line ${target.lineNum} Vertex`;
    case 'jf17_airspace':
      return `Plotting JF-17 Custom Airspace ${target.key} Vertex`;
    case 'generic':
      return 'Plotting Tactical Avionics Point';
  }
}

export const JF17_DEFAULT_COLORS: Record<'BKYA' | 'BKYB' | 'BKYC' | 'BKYD', string> = {
  BKYA: '#a020f0',
  BKYB: '#00ffff',
  BKYC: '#0000ff',
  BKYD: '#d19275',
};

export const F16_GEO_COLORS: Record<1 | 2 | 3 | 4, { label: string; hex: string }> = {
  1: { label: 'Line 1 (FLOT / Red Dashed)', hex: '#ef4444' },
  2: { label: 'Line 2 (FAOR / Emerald)', hex: '#10b981' },
  3: { label: 'Line 3 (Corridor / Cyan)', hex: '#06b6d4' },
  4: { label: 'Line 4 (Sector / Violet)', hex: '#a855f7' },
};

function roundCoord(val: number): number {
  return Number(val.toFixed(6));
}

function downsamplePoints(
  pts: Array<{ lat: number; lng: number }>,
  maxPts: number
): Array<{ lat: number; lng: number }> {
  if (pts.length <= maxPts) return pts;
  if (maxPts <= 2) return [pts[0], pts[pts.length - 1]];
  const result: Array<{ lat: number; lng: number }> = [];
  for (let i = 0; i < maxPts; i++) {
    const idx = Math.round((i * (pts.length - 1)) / (maxPts - 1));
    result.push(pts[idx]);
  }
  return result;
}

function normalizeRawPoints(raw: unknown): Array<{ lat: number; lng: number }> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{ lat: number; lng: number }> = [];
  raw.forEach((pt) => {
    if (Array.isArray(pt) && pt.length >= 2) {
      const lat = Number(pt[0]);
      const lng = Number(pt[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        out.push({ lat: roundCoord(lat), lng: roundCoord(lng) });
      }
    } else if (pt && typeof pt === 'object') {
      const obj = pt as Record<string, unknown>;
      const lat = Number(obj.lat);
      const lng = Number(obj.lng ?? obj.lon);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        out.push({ lat: roundCoord(lat), lng: roundCoord(lng) });
      }
    }
  });
  return out;
}

function extractAorPoints(aor: any): Array<{ lat: number; lng: number }> {
  if (!aor || typeof aor !== 'object') return [];
  if (
    aor.type === 'box' &&
    aor.north !== undefined &&
    aor.south !== undefined &&
    aor.east !== undefined &&
    aor.west !== undefined
  ) {
    const n = roundCoord(Number(aor.north));
    const s = roundCoord(Number(aor.south));
    const e = roundCoord(Number(aor.east));
    const w = roundCoord(Number(aor.west));
    if ([n, s, e, w].every(Number.isFinite)) {
      return [
        { lat: n, lng: w },
        { lat: n, lng: e },
        { lat: s, lng: e },
        { lat: s, lng: w },
      ];
    }
  }
  if (aor.type === 'circle' && aor.center_lat !== undefined && aor.center_lng !== undefined) {
    const cLat = Number(aor.center_lat);
    const cLng = Number(aor.center_lng);
    const rNm = Number(aor.radius_nm) || 10;
    if (Number.isFinite(cLat) && Number.isFinite(cLng)) {
      const pts: Array<{ lat: number; lng: number }> = [];
      for (let i = 0; i < 8; i++) {
        const p = computeDestinationPoint(cLat, cLng, i * 45, rNm);
        pts.push({ lat: roundCoord(p.lat), lng: roundCoord(p.lng) });
      }
      return pts;
    }
  }
  const poly = normalizeRawPoints(aor.points || aor.coordinates);
  return poly;
}

export function appendPointToAvionicsTarget(
  plan: FlightPlanDetail,
  target: AvionicsPlotTarget,
  lat: number,
  lng: number
): FlightPlanDetail {
  const cleanLat = roundCoord(lat);
  const cleanLng = roundCoord(lng);

  if (
    target.kind === 'f18_flot' ||
    target.kind === 'f18_faor' ||
    target.kind === 'f18_cap' ||
    target.kind === 'f18_corridor'
  ) {
    const sa = { ...(plan.sa_settings || {}) } as Record<string, any>;

    if (target.kind === 'f18_cap') {
      const caps = Array.isArray(sa.cap_points) ? [...sa.cap_points] : [];
      const existingIdx = caps.findIndex((c: any) => Number(c?.num) === target.num);
      const nextCap = {
        ...(existingIdx >= 0 ? caps[existingIdx] : {}),
        num: target.num,
        lat: cleanLat,
        lng: cleanLng,
        course: existingIdx >= 0 ? Number(caps[existingIdx]?.course ?? 0) : 0,
        length_nm: existingIdx >= 0 ? Number(caps[existingIdx]?.length_nm ?? 20) : 20,
        turn_direction:
          existingIdx >= 0 ? String(caps[existingIdx]?.turn_direction || 'Right') : 'Right',
        altitude: existingIdx >= 0 ? Number(caps[existingIdx]?.altitude ?? 25000) : 25000,
      };
      if (existingIdx >= 0) {
        caps[existingIdx] = nextCap;
      } else {
        caps.push(nextCap);
      }
      return { ...plan, sa_settings: { ...sa, cap_points: caps } };
    }

    const arrayKey =
      target.kind === 'f18_flot'
        ? 'flot'
        : target.kind === 'f18_faor'
          ? 'faor'
          : 'corridors';
    const maxPts = target.kind === 'f18_corridor' ? 4 : 6;
    const list = Array.isArray(sa[arrayKey]) ? [...sa[arrayKey]] : [];
    const idx = list.findIndex((item: any) => Number(item?.num) === target.num);
    const existingPts = idx >= 0 && Array.isArray(list[idx]?.points) ? [...list[idx].points] : [];
    if (existingPts.length >= maxPts) {
      return plan;
    }
    existingPts.push({ lat: cleanLat, lng: cleanLng });
    const updatedItem = { num: target.num, points: existingPts };
    if (idx >= 0) {
      list[idx] = updatedItem;
    } else {
      list.push(updatedItem);
    }
    return { ...plan, sa_settings: { ...sa, [arrayKey]: list } };
  }

  if (target.kind === 'f16_geo') {
    const geo = { ...(plan.geo_lines_settings || {}) } as Record<string, any>;
    const lines = { ...(geo.lines || {}) } as Record<string, any[]>;
    [1, 2, 3, 4].forEach((n) => {
      if (!lines[n] && Array.isArray(geo[n])) {
        lines[n] = geo[n];
      }
    });
    const current = Array.isArray(lines[target.lineNum]) ? [...lines[target.lineNum]] : [];
    if (current.length >= 6) return plan;
    current.push({ lat: cleanLat, lng: cleanLng });
    lines[target.lineNum] = current;
    return { ...plan, geo_lines_settings: { ...geo, lines } };
  }

  if (target.kind === 'f16_dest') {
    const rawDest = plan.dest_points_settings;
    const currentList = Array.isArray(rawDest)
      ? [...rawDest]
      : Array.isArray((rawDest as any)?.points)
        ? [...(rawDest as any).points]
        : [];
    if (currentList.length >= 19) return plan;
    const nextStpt = 81 + currentList.length;
    currentList.push({
      stpt: nextStpt,
      text: `D${nextStpt}`,
      lat: cleanLat,
      lng: cleanLng,
      elev: 0,
    });
    return { ...plan, dest_points_settings: currentList };
  }

  if (target.kind === 'f14_plot') {
    const f14 = { ...(plan.f14_plot_lines_settings || {}) } as Record<string, any>;
    const existing = f14[target.lineNum] || f14[String(target.lineNum)];
    const existingPts = Array.isArray(existing)
      ? [...existing]
      : Array.isArray(existing?.points)
        ? [...existing.points]
        : [];
    if (existingPts.length >= 8) return plan;
    existingPts.push({ lat: cleanLat, lng: cleanLng });
    return {
      ...plan,
      f14_plot_lines_settings: {
        ...f14,
        [target.lineNum]: {
          closed: Boolean(existing?.closed),
          points: existingPts,
        },
      },
    };
  }

  if (target.kind === 'jf17_airspace') {
    const jf17 = { ...(plan.jf17_airspace_settings || {}) } as Record<string, any>;
    const existing = jf17[target.key] || jf17[target.key.toLowerCase()];
    const existingPts = Array.isArray(existing)
      ? [...existing]
      : Array.isArray(existing?.points)
        ? [...existing.points]
        : [];
    if (existingPts.length >= 10) return plan;
    existingPts.push({ lat: cleanLat, lng: cleanLng });
    return {
      ...plan,
      jf17_airspace_settings: {
        ...jf17,
        [target.key]: {
          color: existing?.color || JF17_DEFAULT_COLORS[target.key],
          closed: Boolean(existing?.closed),
          points: existingPts,
        },
      },
    };
  }

  const sa = { ...(plan.sa_settings || {}) } as Record<string, any>;
  const existingPts = Array.isArray(sa.points) ? [...sa.points] : [];
  existingPts.push({
    name: `AV ${existingPts.length + 1}`,
    lat: cleanLat,
    lng: cleanLng,
  });
  return { ...plan, sa_settings: { ...sa, points: existingPts } };
}

interface AirframeAvionicsPanelProps {
  activePlan: FlightPlanDetail;
  selectedAirframe: CampaignMapAirframeCatalogItem | null;
  mapData: CampaignMapPayload;
  canEdit: boolean;
  onMutatePlan: (updater: (prev: FlightPlanDetail) => FlightPlanDetail) => void;
  activePlotTarget: AvionicsPlotTarget | null;
  onSetPlotTarget: (target: AvionicsPlotTarget | null) => void;
  onCenterMap: (lat: number, lng: number, zoom?: number) => void;
  onNotify: (level: 'info' | 'success' | 'warning' | 'error', msg: string) => void;
}

export const AirframeAvionicsPanel: React.FC<AirframeAvionicsPanelProps> = ({
  activePlan,
  selectedAirframe,
  mapData,
  canEdit,
  onMutatePlan,
  activePlotTarget,
  onSetPlotTarget,
  onCenterMap,
  onNotify,
}) => {
  const airframeType = useMemo<'f18' | 'f16' | 'f14' | 'jf17' | 'generic'>(() => {
    const name = `${selectedAirframe?.name || ''} ${selectedAirframe?.abbreviation || ''} ${
      activePlan.airframe?.name || activePlan.airframe?.abbreviation || ''
    }`.toLowerCase();
    if (activePlan.is_f18 || selectedAirframe?.is_f18 || name.includes('18') || name.includes('hornet')) {
      return 'f18';
    }
    if (activePlan.is_f16 || selectedAirframe?.is_f16 || name.includes('16') || name.includes('viper')) {
      return 'f16';
    }
    if (activePlan.is_f14 || selectedAirframe?.is_f14 || name.includes('14') || name.includes('tomcat')) {
      return 'f14';
    }
    if (activePlan.is_jf17 || selectedAirframe?.is_jf17 || name.includes('jf-17') || name.includes('jf17')) {
      return 'jf17';
    }
    return 'generic';
  }, [activePlan, selectedAirframe]);

  // Sub-tab selections
  const [f18Section, setF18Section] = useState<'flot' | 'faor' | 'cap' | 'corridors'>('flot');
  const [f18SlotNum, setF18SlotNum] = useState<1 | 2 | 3>(1);
  const [f16Section, setF16Section] = useState<'geo' | 'dest'>('geo');
  const [f16LineNum, setF16LineNum] = useState<1 | 2 | 3 | 4>(1);
  const [f14LineNum, setF14LineNum] = useState<1 | 2 | 3 | 4>(1);
  const [jf17Key, setJf17Key] = useState<'BKYA' | 'BKYB' | 'BKYC' | 'BKYD'>('BKYA');
  const [selectedPresetKey, setSelectedPresetKey] = useState<string>('');

  // Build available campaign geometry presets
  const geometryPresets = useMemo(() => {
    const presets: Array<{
      id: string;
      label: string;
      points: Array<{ lat: number; lng: number }>;
      closed: boolean;
    }> = [];

    (mapData.frontLine || []).forEach((fl, idx) => {
      const pts = normalizeRawPoints(fl.points);
      if (pts.length >= 2) {
        presets.push({
          id: `front-${idx}`,
          label: `Front Line: ${fl.label || fl.name || fl.group_name || `#${idx + 1}`}`,
          points: pts,
          closed: false,
        });
      }
    });

    (mapData.polygonGroups || []).forEach((pg, idx) => {
      const pts = normalizeRawPoints(pg.points);
      if (pts.length >= 3) {
        presets.push({
          id: `poly-${idx}`,
          label: `Zone Polygon: ${pg.label || pg.name || pg.group_name || `#${idx + 1}`}`,
          points: pts,
          closed: true,
        });
      }
    });

    (mapData.missions || []).forEach((m) => {
      const pts = extractAorPoints(m.aor);
      if (pts.length >= 2) {
        presets.push({
          id: `mission-${m.id}`,
          label: `Mission AOR: ${m.name}`,
          points: pts,
          closed: true,
        });
      }
    });

    return presets;
  }, [mapData.frontLine, mapData.polygonGroups, mapData.missions]);

  const togglePlotTarget = (target: AvionicsPlotTarget) => {
    if (avionicsTargetsEqual(activePlotTarget, target)) {
      onSetPlotTarget(null);
    } else {
      onSetPlotTarget(target);
    }
  };

  const handleImportPreset = () => {
    const preset = geometryPresets.find((p) => p.id === selectedPresetKey);
    if (!preset) {
      onNotify('info', 'Select a campaign front line, polygon zone, or mission AOR first.');
      return;
    }

    if (airframeType === 'f18') {
      if (f18Section === 'cap') {
        const mid = preset.points[0];
        onMutatePlan((p) => {
          const sa = { ...(p.sa_settings || {}) } as Record<string, any>;
          const caps = Array.isArray(sa.cap_points) ? [...sa.cap_points] : [];
          const idx = caps.findIndex((c: any) => Number(c?.num) === f18SlotNum);
          const item = {
            ...(idx >= 0 ? caps[idx] : {}),
            num: f18SlotNum,
            lat: mid.lat,
            lng: mid.lng,
            course: idx >= 0 ? Number(caps[idx]?.course ?? 0) : 0,
            length_nm: idx >= 0 ? Number(caps[idx]?.length_nm ?? 20) : 20,
            turn_direction: idx >= 0 ? String(caps[idx]?.turn_direction || 'Right') : 'Right',
            altitude: idx >= 0 ? Number(caps[idx]?.altitude ?? 25000) : 25000,
          };
          if (idx >= 0) caps[idx] = item;
          else caps.push(item);
          return { ...p, sa_settings: { ...sa, cap_points: caps } };
        });
        onNotify('success', `Centered CAP ${f18SlotNum} on ${preset.label}.`);
        return;
      }

      const slotNum: number = f18Section === 'corridors' ? Math.min(2, f18SlotNum) : f18SlotNum;
      const maxPts = f18Section === 'corridors' ? 4 : 6;
      const pts = downsamplePoints(
        preset.closed && f18Section !== 'corridors' ? [...preset.points, preset.points[0]] : preset.points,
        maxPts
      );
      onMutatePlan((p) => {
        const sa = { ...(p.sa_settings || {}) } as Record<string, any>;
        const arr = Array.isArray(sa[f18Section]) ? [...sa[f18Section]] : [];
        const idx = arr.findIndex((x: any) => Number(x?.num) === slotNum);
        const item = { num: slotNum, points: pts };
        if (idx >= 0) arr[idx] = item;
        else arr.push(item);
        return { ...p, sa_settings: { ...sa, [f18Section]: arr } };
      });
      onNotify('success', `Imported ${pts.length} vertices from ${preset.label}.`);
      return;
    }

    if (airframeType === 'f16') {
      if (f16Section === 'dest') {
        const pts = downsamplePoints(preset.points, 19);
        onMutatePlan((p) => ({
          ...p,
          dest_points_settings: pts.map((pt, idx) => ({
            stpt: 81 + idx,
            text: `P${81 + idx}`,
            lat: pt.lat,
            lng: pt.lng,
            elev: 0,
          })),
        }));
        onNotify('success', `Imported ${pts.length} DEST points from ${preset.label}.`);
        return;
      }

      const pts = downsamplePoints(
        preset.closed ? [...preset.points, preset.points[0]] : preset.points,
        6
      );
      onMutatePlan((p) => {
        const geo = { ...(p.geo_lines_settings || {}) } as Record<string, any>;
        const lines = { ...(geo.lines || {}) };
        lines[f16LineNum] = pts;
        return { ...p, geo_lines_settings: { ...geo, lines } };
      });
      onNotify('success', `Imported ${pts.length} vertices into GEO Line ${f16LineNum}.`);
      return;
    }

    if (airframeType === 'f14') {
      const pts = downsamplePoints(preset.points, 8);
      onMutatePlan((p) => ({
        ...p,
        f14_plot_lines_settings: {
          ...(p.f14_plot_lines_settings || {}),
          [f14LineNum]: { closed: preset.closed, points: pts },
        },
      }));
      onNotify('success', `Imported ${pts.length} vertices into TID Plot Line ${f14LineNum}.`);
      return;
    }

    if (airframeType === 'jf17') {
      const pts = downsamplePoints(preset.points, 10);
      onMutatePlan((p) => {
        const prev = (p.jf17_airspace_settings || {}) as Record<string, any>;
        const cur = prev[jf17Key] || {};
        return {
          ...p,
          jf17_airspace_settings: {
            ...prev,
            [jf17Key]: {
              color: cur.color || JF17_DEFAULT_COLORS[jf17Key],
              closed: preset.closed,
              points: pts,
            },
          },
        };
      });
      onNotify('success', `Imported ${pts.length} vertices into JF-17 ${jf17Key}.`);
      return;
    }

    const pts = downsamplePoints(preset.points, 12);
    onMutatePlan((p) => ({
      ...p,
      sa_settings: {
        ...(p.sa_settings || {}),
        points: pts.map((pt, idx) => ({ name: `AV ${idx + 1}`, ...pt })),
      },
    }));
    onNotify('success', `Imported ${pts.length} points from ${preset.label}.`);
  };

  // Render reusable vertex editor
  const renderVertexRows = (
    points: Array<{ lat: number; lng: number }>,
    onRemove: (idx: number) => void,
    maxLabel?: string
  ) => {
    if (points.length === 0) {
      return (
        <div className="p-3 text-center text-stone-400 bg-stone-900/40 rounded-lg border border-stone-800 text-[11px]">
          No vertices defined yet{maxLabel ? ` (${maxLabel})` : ''}. Enable{' '}
          <span className="text-amber-300 font-semibold">Plot on Map</span> or import a campaign
          preset.
        </div>
      );
    }

    return (
      <div className="space-y-1 max-h-56 overflow-y-auto pr-0.5">
        {points.map((pt, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between gap-2 bg-stone-900/70 border border-stone-800 rounded-lg px-2.5 py-1.5"
          >
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-stone-200">Vertex #{idx + 1}</div>
              <div className="text-[10px] font-mono text-stone-400">
                {formatCoordinateDdm(Number(pt.lat), Number(pt.lng))}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => onCenterMap(Number(pt.lat), Number(pt.lng), 11)}
                className="p-1 text-stone-400 hover:text-amber-300 cursor-pointer"
                title="Center Map on Vertex"
              >
                <Crosshair className="w-3.5 h-3.5" />
              </button>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => onRemove(idx)}
                  className="p-1 text-stone-400 hover:text-red-400 cursor-pointer"
                  title="Remove Vertex"
                >
                  <Trash className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Header + Airframe badge */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold text-[11px] text-amber-300 flex items-center gap-1.5">
          <SlidersHorizontal className="w-4 h-4" />
          {airframeType === 'f18'
            ? 'F/A-18C Situational Awareness (SA)'
            : airframeType === 'f16'
              ? 'F-16C GEO Lines & DEST Points'
              : airframeType === 'f14'
                ? 'F-14B TID Plot Lines'
                : airframeType === 'jf17'
                  ? 'JF-17 Custom Airspace (BKYA–BKYD)'
                  : 'Tactical Avionics Overlay'}
        </span>
        <span className="text-[10px] text-stone-400 font-mono uppercase px-1.5 py-0.5 rounded bg-stone-900 border border-stone-800">
          Drag vertices on map
        </span>
      </div>

      {/* Campaign Geometry Preset Importer */}
      {canEdit && geometryPresets.length > 0 && (
        <div className="bg-stone-900/60 border border-stone-800 rounded-lg p-2 flex items-center gap-1.5">
          <select
            value={selectedPresetKey}
            onChange={(e) => setSelectedPresetKey(e.target.value)}
            className="flex-1 min-w-0 px-2 py-1 rounded bg-stone-950 border border-stone-800 text-[11px] text-stone-200"
          >
            <option value="">-- Pull Campaign Frontline / Zone / AOR --</option>
            {geometryPresets.map((pr) => (
              <option key={pr.id} value={pr.id}>
                {pr.label} ({pr.points.length} pts)
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleImportPreset}
            disabled={!selectedPresetKey}
            className="px-2.5 py-1 rounded bg-sky-500/20 hover:bg-sky-500/30 disabled:opacity-40 border border-sky-500/50 text-sky-300 text-[10px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <DownloadSimple className="w-3 h-3" />
            Import
          </button>
        </div>
      )}

      {/* F/A-18C SA EDITOR */}
      {airframeType === 'f18' && (
        <div className="space-y-2.5">
          <div className="grid grid-cols-4 gap-1 bg-stone-900/70 p-1 rounded-lg border border-stone-800">
            {(
              [
                ['flot', 'FLOT (1–3)'],
                ['faor', 'FAOR (1–3)'],
                ['cap', 'CAP (1–3)'],
                ['corridors', 'Corridors'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setF18Section(key)}
                className={`py-1 rounded text-[10px] font-bold transition cursor-pointer ${
                  f18Section === key
                    ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/50'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              {(f18Section === 'corridors' ? ([1, 2] as const) : ([1, 2, 3] as const)).map(
                (num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setF18SlotNum(num as 1 | 2 | 3)}
                    className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold border cursor-pointer ${
                      (f18Section === 'corridors' ? Math.min(2, f18SlotNum) : f18SlotNum) === num
                        ? 'bg-emerald-500/25 border-emerald-500/60 text-emerald-200'
                        : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    #{num}
                  </button>
                )
              )}
            </div>

            {canEdit && (
              <div className="flex items-center gap-1.5">
                {(() => {
                  const slot =
                    f18Section === 'corridors' ? (Math.min(2, f18SlotNum) as 1 | 2) : f18SlotNum;
                  const target: AvionicsPlotTarget =
                    f18Section === 'flot'
                      ? { kind: 'f18_flot', num: slot as 1 | 2 | 3 }
                      : f18Section === 'faor'
                        ? { kind: 'f18_faor', num: slot as 1 | 2 | 3 }
                        : f18Section === 'cap'
                          ? { kind: 'f18_cap', num: slot as 1 | 2 | 3 }
                          : { kind: 'f18_corridor', num: slot as 1 | 2 };
                  const isActive = avionicsTargetsEqual(activePlotTarget, target);
                  return (
                    <button
                      type="button"
                      onClick={() => togglePlotTarget(target)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border flex items-center gap-1 cursor-pointer ${
                        isActive
                          ? 'bg-amber-500/25 border-amber-500 text-amber-200'
                          : 'bg-stone-900 border-stone-700 text-stone-200'
                      }`}
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      {isActive ? 'Plotting...' : 'Plot on Map'}
                    </button>
                  );
                })()}

                <button
                  type="button"
                  onClick={() => {
                    onMutatePlan((p) => {
                      const sa = { ...(p.sa_settings || {}) } as Record<string, any>;
                      const key = f18Section === 'cap' ? 'cap_points' : f18Section;
                      const slot = f18Section === 'corridors' ? Math.min(2, f18SlotNum) : f18SlotNum;
                      const arr = Array.isArray(sa[key]) ? sa[key] : [];
                      return {
                        ...p,
                        sa_settings: {
                          ...sa,
                          [key]: arr.filter((item: any) => Number(item?.num) !== slot),
                        },
                      };
                    });
                  }}
                  className="px-2 py-1 rounded-lg bg-stone-900 border border-stone-800 text-stone-400 hover:text-red-400 text-[10px] cursor-pointer"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {f18Section === 'cap' ? (
            (() => {
              const caps = Array.isArray(activePlan.sa_settings?.cap_points)
                ? activePlan.sa_settings!.cap_points
                : [];
              const cap = caps.find((c: any) => Number(c?.num) === f18SlotNum);
              if (!cap) {
                return (
                  <div className="p-3 text-center text-stone-400 bg-stone-900/40 rounded-lg border border-stone-800 text-[11px]">
                    No CAP #{f18SlotNum} racetrack placed. Click{' '}
                    <span className="text-amber-300">Plot on Map</span> to set anchor.
                  </div>
                );
              }
              const updateCap = (patch: Record<string, any>) => {
                onMutatePlan((p) => {
                  const sa = { ...(p.sa_settings || {}) } as Record<string, any>;
                  const nextCaps = (Array.isArray(sa.cap_points) ? sa.cap_points : []).map((c: any) =>
                    Number(c?.num) === f18SlotNum ? { ...c, ...patch } : c
                  );
                  return { ...p, sa_settings: { ...sa, cap_points: nextCaps } };
                });
              };
              return (
                <div className="bg-stone-900/70 border border-stone-800 rounded-lg p-2.5 space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-mono text-stone-300">
                    <span>Anchor: {formatCoordinateDdm(Number(cap.lat), Number(cap.lng))}</span>
                    <button
                      type="button"
                      onClick={() => onCenterMap(Number(cap.lat), Number(cap.lng), 10)}
                      className="text-amber-300 hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <Crosshair className="w-3 h-3" /> Center
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <label className="block text-[9px] uppercase text-stone-400 mb-0.5">
                        Inbound Course (°)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={359}
                        disabled={!canEdit}
                        value={Number(cap.course ?? 0)}
                        onChange={(e) => updateCap({ course: Number(e.target.value) })}
                        className="w-full px-2 py-1 rounded bg-stone-950 border border-stone-800 font-mono text-stone-100"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] uppercase text-stone-400 mb-0.5">
                        Leg Length (NM)
                      </label>
                      <input
                        type="number"
                        min={5}
                        max={60}
                        disabled={!canEdit}
                        value={Number(cap.length_nm ?? 20)}
                        onChange={(e) => updateCap({ length_nm: Number(e.target.value) })}
                        className="w-full px-2 py-1 rounded bg-stone-950 border border-stone-800 font-mono text-stone-100"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] uppercase text-stone-400 mb-0.5">
                        Turn Direction
                      </label>
                      <select
                        disabled={!canEdit}
                        value={String(cap.turn_direction || 'Right')}
                        onChange={(e) => updateCap({ turn_direction: e.target.value })}
                        className="w-full px-2 py-1 rounded bg-stone-950 border border-stone-800 text-stone-100"
                      >
                        <option value="Right">Right (Clockwise)</option>
                        <option value="Left">Left (CCW)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] uppercase text-stone-400 mb-0.5">
                        CAP Altitude (ft)
                      </label>
                      <input
                        type="number"
                        step={1000}
                        disabled={!canEdit}
                        value={Number(cap.altitude ?? 25000)}
                        onChange={(e) => updateCap({ altitude: Number(e.target.value) })}
                        className="w-full px-2 py-1 rounded bg-stone-950 border border-stone-800 font-mono text-stone-100"
                      />
                    </div>
                  </div>
                </div>
              );
            })()
          ) : (
            (() => {
              const slot = f18Section === 'corridors' ? Math.min(2, f18SlotNum) : f18SlotNum;
              const arr = Array.isArray(activePlan.sa_settings?.[f18Section])
                ? activePlan.sa_settings![f18Section]
                : [];
              const found = arr.find((x: any) => Number(x?.num) === slot);
              const pts = Array.isArray(found?.points) ? found.points : [];
              return renderVertexRows(
                pts,
                (removeIdx) => {
                  onMutatePlan((p) => {
                    const sa = { ...(p.sa_settings || {}) } as Record<string, any>;
                    const nextArr = (Array.isArray(sa[f18Section]) ? sa[f18Section] : []).map(
                      (item: any) =>
                        Number(item?.num) === slot
                          ? {
                              ...item,
                              points: (item.points || []).filter(
                                (_: any, idx: number) => idx !== removeIdx
                              ),
                            }
                          : item
                    );
                    return { ...p, sa_settings: { ...sa, [f18Section]: nextArr } };
                  });
                },
                f18Section === 'corridors' ? 'max 4 vertices' : 'max 6 vertices'
              );
            })()
          )}
        </div>
      )}

      {/* F-16C GEO & DEST EDITOR */}
      {airframeType === 'f16' && (
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-1 bg-stone-900/70 p-1 rounded-lg border border-stone-800">
            <button
              type="button"
              onClick={() => setF16Section('geo')}
              className={`py-1 rounded text-[10px] font-bold transition cursor-pointer ${
                f16Section === 'geo'
                  ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/50'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              GEO Lines (1–4)
            </button>
            <button
              type="button"
              onClick={() => setF16Section('dest')}
              className={`py-1 rounded text-[10px] font-bold transition cursor-pointer ${
                f16Section === 'dest'
                  ? 'bg-amber-500/25 text-amber-300 border border-amber-500/50'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              DEST Pts (STPT 81–99)
            </button>
          </div>

          {f16Section === 'geo' ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  {([1, 2, 3, 4] as const).map((lineNum) => (
                    <button
                      key={lineNum}
                      type="button"
                      onClick={() => setF16LineNum(lineNum)}
                      className={`px-2 py-1 rounded text-[11px] font-mono font-bold border flex items-center gap-1 cursor-pointer ${
                        f16LineNum === lineNum
                          ? 'bg-stone-800 border-stone-500 text-white'
                          : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: F16_GEO_COLORS[lineNum].hex }}
                      />
                      L{lineNum}
                    </button>
                  ))}
                </div>

                {canEdit && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => togglePlotTarget({ kind: 'f16_geo', lineNum: f16LineNum })}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border flex items-center gap-1 cursor-pointer ${
                        avionicsTargetsEqual(activePlotTarget, {
                          kind: 'f16_geo',
                          lineNum: f16LineNum,
                        })
                          ? 'bg-amber-500/25 border-amber-500 text-amber-200'
                          : 'bg-stone-900 border-stone-700 text-stone-200'
                      }`}
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      {avionicsTargetsEqual(activePlotTarget, {
                        kind: 'f16_geo',
                        lineNum: f16LineNum,
                      })
                        ? 'Plotting...'
                        : 'Plot on Map'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onMutatePlan((p) => {
                          const geo = { ...(p.geo_lines_settings || {}) } as Record<string, any>;
                          const lines = { ...(geo.lines || {}) };
                          lines[f16LineNum] = [];
                          return { ...p, geo_lines_settings: { ...geo, lines } };
                        })
                      }
                      className="px-2 py-1 rounded-lg bg-stone-900 border border-stone-800 text-stone-400 hover:text-red-400 text-[10px] cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              <div className="text-[10px] text-stone-400 font-mono">
                {F16_GEO_COLORS[f16LineNum].label}
              </div>

              {(() => {
                const geo = (activePlan.geo_lines_settings || {}) as Record<string, any>;
                const pts = geo.lines?.[f16LineNum] || geo[f16LineNum] || [];
                return renderVertexRows(
                  Array.isArray(pts) ? pts : [],
                  (removeIdx) => {
                    onMutatePlan((p) => {
                      const prevGeo = { ...(p.geo_lines_settings || {}) } as Record<string, any>;
                      const lines = { ...(prevGeo.lines || {}) };
                      const existing = Array.isArray(lines[f16LineNum])
                        ? lines[f16LineNum]
                        : Array.isArray(prevGeo[f16LineNum])
                          ? prevGeo[f16LineNum]
                          : [];
                      lines[f16LineNum] = existing.filter((_: any, idx: number) => idx !== removeIdx);
                      return { ...p, geo_lines_settings: { ...prevGeo, lines } };
                    });
                  },
                  'max 6 vertices'
                );
              })()}
            </>
          ) : (
            (() => {
              const rawDest = activePlan.dest_points_settings;
              const destList = Array.isArray(rawDest)
                ? rawDest
                : Array.isArray((rawDest as any)?.points)
                  ? (rawDest as any).points
                  : [];

              return (
                <div className="space-y-2">
                  {canEdit && (
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => togglePlotTarget({ kind: 'f16_dest' })}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border flex items-center gap-1 cursor-pointer ${
                          avionicsTargetsEqual(activePlotTarget, { kind: 'f16_dest' })
                            ? 'bg-amber-500/25 border-amber-500 text-amber-200'
                            : 'bg-stone-900 border-stone-700 text-stone-200'
                        }`}
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        {avionicsTargetsEqual(activePlotTarget, { kind: 'f16_dest' })
                          ? 'Click Map to Add STPT...'
                          : 'Plot DEST on Map'}
                      </button>
                      {destList.length > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            onMutatePlan((p) => ({ ...p, dest_points_settings: [] }))
                          }
                          className="px-2 py-1 rounded-lg bg-stone-900 border border-stone-800 text-stone-400 hover:text-red-400 text-[10px] cursor-pointer"
                        >
                          Clear All
                        </button>
                      )}
                    </div>
                  )}

                  {destList.length === 0 ? (
                    <div className="p-3 text-center text-stone-400 bg-stone-900/40 rounded-lg border border-stone-800 text-[11px]">
                      No F-16 DEST Points (STPT 81–99) defined yet.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-60 overflow-y-auto pr-0.5">
                      {destList.map((pt: any, idx: number) => (
                        <div
                          key={idx}
                          className="bg-stone-900/70 border border-stone-800 rounded-lg p-2 space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="text-[10px] font-mono font-bold text-amber-300">
                              STPT {pt.stpt || 81 + idx}
                            </span>
                            <input
                              type="text"
                              maxLength={4}
                              disabled={!canEdit}
                              value={String(pt.text || '')}
                              onChange={(e) => {
                                onMutatePlan((p) => {
                                  const next = [...destList];
                                  next[idx] = { ...pt, text: e.target.value.toUpperCase() };
                                  return { ...p, dest_points_settings: next };
                                });
                              }}
                              placeholder="TAG"
                              className="w-20 px-1.5 py-0.5 rounded bg-stone-950 border border-stone-800 font-mono text-[11px] uppercase text-stone-100"
                            />
                            <input
                              type="number"
                              disabled={!canEdit}
                              value={Number(pt.elev ?? 0)}
                              onChange={(e) => {
                                onMutatePlan((p) => {
                                  const next = [...destList];
                                  next[idx] = { ...pt, elev: Number(e.target.value) };
                                  return { ...p, dest_points_settings: next };
                                });
                              }}
                              title="Elevation (ft)"
                              className="w-20 px-1.5 py-0.5 rounded bg-stone-950 border border-stone-800 font-mono text-[11px] text-stone-200"
                            />
                            <button
                              type="button"
                              onClick={() => onCenterMap(Number(pt.lat), Number(pt.lng), 11)}
                              className="p-1 text-stone-400 hover:text-amber-300 cursor-pointer"
                            >
                              <Crosshair className="w-3.5 h-3.5" />
                            </button>
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() =>
                                  onMutatePlan((p) => ({
                                    ...p,
                                    dest_points_settings: destList.filter(
                                      (_: any, i: number) => i !== idx
                                    ),
                                  }))
                                }
                                className="p-1 text-stone-400 hover:text-red-400 cursor-pointer"
                              >
                                <Trash className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          <div className="text-[10px] font-mono text-stone-400">
                            {formatCoordinateDdm(Number(pt.lat), Number(pt.lng))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()
          )}
        </div>
      )}

      {/* F-14B TID PLOT EDITOR */}
      {airframeType === 'f14' && (
        <div className="space-y-2.5">
          {(() => {
            const f14 = (activePlan.f14_plot_lines_settings || {}) as Record<string, any>;
            const rawLine = f14[f14LineNum] || f14[String(f14LineNum)];
            const pts = Array.isArray(rawLine)
              ? rawLine
              : Array.isArray(rawLine?.points)
                ? rawLine.points
                : [];
            const closed = Boolean(rawLine?.closed);
            const colors: Record<number, string> = {
              1: '#ef4444',
              2: '#10b981',
              3: '#06b6d4',
              4: '#a855f7',
            };

            return (
              <>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    {([1, 2, 3, 4] as const).map((lineNum) => (
                      <button
                        key={lineNum}
                        type="button"
                        onClick={() => setF14LineNum(lineNum)}
                        className={`px-2 py-1 rounded text-[11px] font-mono font-bold border flex items-center gap-1 cursor-pointer ${
                          f14LineNum === lineNum
                            ? 'bg-stone-800 border-stone-500 text-white'
                            : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200'
                        }`}
                      >
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: colors[lineNum] }}
                        />
                        TID {lineNum}
                      </button>
                    ))}
                  </div>

                  {canEdit && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => togglePlotTarget({ kind: 'f14_plot', lineNum: f14LineNum })}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border flex items-center gap-1 cursor-pointer ${
                          avionicsTargetsEqual(activePlotTarget, {
                            kind: 'f14_plot',
                            lineNum: f14LineNum,
                          })
                            ? 'bg-amber-500/25 border-amber-500 text-amber-200'
                            : 'bg-stone-900 border-stone-700 text-stone-200'
                        }`}
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        {avionicsTargetsEqual(activePlotTarget, {
                          kind: 'f14_plot',
                          lineNum: f14LineNum,
                        })
                          ? 'Plotting...'
                          : 'Plot on Map'}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onMutatePlan((p) => ({
                            ...p,
                            f14_plot_lines_settings: {
                              ...(p.f14_plot_lines_settings || {}),
                              [f14LineNum]: { closed: false, points: [] },
                            },
                          }))
                        }
                        className="px-2 py-1 rounded-lg bg-stone-900 border border-stone-800 text-stone-400 hover:text-red-400 text-[10px] cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>

                {canEdit && (
                  <label className="inline-flex items-center gap-2 text-[11px] text-stone-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={closed}
                      onChange={(e) =>
                        onMutatePlan((p) => ({
                          ...p,
                          f14_plot_lines_settings: {
                            ...(p.f14_plot_lines_settings || {}),
                            [f14LineNum]: { closed: e.target.checked, points: pts },
                          },
                        }))
                      }
                      className="rounded border-stone-700 bg-stone-950 text-amber-500"
                    />
                    Close Loop (Connect Last Vertex Back to First)
                  </label>
                )}

                {renderVertexRows(
                  pts,
                  (removeIdx) => {
                    onMutatePlan((p) => ({
                      ...p,
                      f14_plot_lines_settings: {
                        ...(p.f14_plot_lines_settings || {}),
                        [f14LineNum]: {
                          closed,
                          points: pts.filter((_: any, idx: number) => idx !== removeIdx),
                        },
                      },
                    }));
                  },
                  'max 8 vertices'
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* JF-17 AIRSPACE EDITOR */}
      {airframeType === 'jf17' && (
        <div className="space-y-2.5">
          {(() => {
            const jf17 = (activePlan.jf17_airspace_settings || {}) as Record<string, any>;
            const cfg = jf17[jf17Key] || jf17[jf17Key.toLowerCase()];
            const pts = Array.isArray(cfg) ? cfg : Array.isArray(cfg?.points) ? cfg.points : [];
            const color = cfg?.color || JF17_DEFAULT_COLORS[jf17Key];
            const closed = Boolean(cfg?.closed);

            return (
              <>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    {(['BKYA', 'BKYB', 'BKYC', 'BKYD'] as const).map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setJf17Key(key)}
                        className={`px-2 py-1 rounded text-[10px] font-mono font-bold border flex items-center gap-1 cursor-pointer ${
                          jf17Key === key
                            ? 'bg-stone-800 border-stone-500 text-white'
                            : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200'
                        }`}
                      >
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{
                            backgroundColor:
                              jf17[key]?.color || JF17_DEFAULT_COLORS[key],
                          }}
                        />
                        {key}
                      </button>
                    ))}
                  </div>

                  {canEdit && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => togglePlotTarget({ kind: 'jf17_airspace', key: jf17Key })}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border flex items-center gap-1 cursor-pointer ${
                          avionicsTargetsEqual(activePlotTarget, {
                            kind: 'jf17_airspace',
                            key: jf17Key,
                          })
                            ? 'bg-amber-500/25 border-amber-500 text-amber-200'
                            : 'bg-stone-900 border-stone-700 text-stone-200'
                        }`}
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        {avionicsTargetsEqual(activePlotTarget, {
                          kind: 'jf17_airspace',
                          key: jf17Key,
                        })
                          ? 'Plotting...'
                          : 'Plot on Map'}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onMutatePlan((p) => ({
                            ...p,
                            jf17_airspace_settings: {
                              ...(p.jf17_airspace_settings || {}),
                              [jf17Key]: { color, closed, points: [] },
                            },
                          }))
                        }
                        className="px-2 py-1 rounded-lg bg-stone-900 border border-stone-800 text-stone-400 hover:text-red-400 text-[10px] cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>

                {canEdit && (
                  <div className="flex items-center justify-between gap-3 bg-stone-900/50 px-2.5 py-1.5 rounded-lg border border-stone-800">
                    <label className="inline-flex items-center gap-2 text-[11px] text-stone-300 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={closed}
                        onChange={(e) =>
                          onMutatePlan((p) => ({
                            ...p,
                            jf17_airspace_settings: {
                              ...(p.jf17_airspace_settings || {}),
                              [jf17Key]: { color, closed: e.target.checked, points: pts },
                            },
                          }))
                        }
                        className="rounded border-stone-700 bg-stone-950 text-amber-500"
                      />
                      Closed Filled Polygon
                    </label>
                    <label className="inline-flex items-center gap-1.5 text-[10px] text-stone-400">
                      Color
                      <input
                        type="color"
                        value={color}
                        onChange={(e) =>
                          onMutatePlan((p) => ({
                            ...p,
                            jf17_airspace_settings: {
                              ...(p.jf17_airspace_settings || {}),
                              [jf17Key]: { color: e.target.value, closed, points: pts },
                            },
                          }))
                        }
                        className="w-6 h-5 rounded bg-transparent border border-stone-700 cursor-pointer"
                      />
                    </label>
                  </div>
                )}

                {renderVertexRows(
                  pts,
                  (removeIdx) => {
                    onMutatePlan((p) => ({
                      ...p,
                      jf17_airspace_settings: {
                        ...(p.jf17_airspace_settings || {}),
                        [jf17Key]: {
                          color,
                          closed,
                          points: pts.filter((_: any, idx: number) => idx !== removeIdx),
                        },
                      },
                    }));
                  },
                  'max 10 vertices'
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* GENERIC FALLBACK */}
      {airframeType === 'generic' && (
        <div className="space-y-2">
          {canEdit && (
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => togglePlotTarget({ kind: 'generic' })}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border flex items-center gap-1 cursor-pointer ${
                  avionicsTargetsEqual(activePlotTarget, { kind: 'generic' })
                    ? 'bg-amber-500/25 border-amber-500 text-amber-200'
                    : 'bg-stone-900 border-stone-700 text-stone-200'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                {avionicsTargetsEqual(activePlotTarget, { kind: 'generic' })
                  ? 'Click Map...'
                  : 'Plot Point'}
              </button>
              <button
                type="button"
                onClick={() =>
                  onMutatePlan((p) => ({
                    ...p,
                    sa_settings: { ...(p.sa_settings || {}), points: [] },
                  }))
                }
                className="px-2 py-1 rounded-lg bg-stone-900 border border-stone-800 text-stone-400 hover:text-red-400 text-[10px] cursor-pointer"
              >
                Clear All
              </button>
            </div>
          )}

          {(() => {
            const pts = Array.isArray(activePlan.sa_settings?.points)
              ? activePlan.sa_settings!.points
              : [];
            return renderVertexRows(pts, (removeIdx) => {
              onMutatePlan((p) => ({
                ...p,
                sa_settings: {
                  ...(p.sa_settings || {}),
                  points: pts.filter((_: any, idx: number) => idx !== removeIdx),
                },
              }));
            });
          })()}
        </div>
      )}
    </div>
  );
};
