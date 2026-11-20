import React, { useMemo, useState } from 'react';
import {
  AirplaneLanding,
  ArrowsClockwise,
  Check,
  CheckSquare,
  Crosshair,
  Eraser,
  FileCode,
  Info,
  LineSegments,
  MapPinArea,
  Path,
  PencilSimpleLine,
  Plus,
  Polygon,
  Square,
  Trash,
  X,
} from '@phosphor-icons/react';
import {
  CampaignMapPayload,
  FlightPlanDetail,
  FlightPlanRoutePoint,
} from '../../../../types';
import {
  AvionicsDrawTarget,
  JF17_DEFAULT_COLORS,
  avionicsDrawTargetsEqual,
  describeAvionicsDrawTarget,
  extractFrontLinePoints,
  getAvailableAorPresetsFromMapData,
  isAdditionalPoint,
  isFaorPointsClosed,
  isGeoLinePointsClosed,
  recalcF16DestPoints,
  recalcF16GeoLines,
} from './helpers';

interface SharedAvionicsProps {
  plan: FlightPlanDetail;
  mapData: CampaignMapPayload;
  canEdit: boolean;
  activeDrawTarget: AvionicsDrawTarget | null;
  onSetDrawTarget: (target: AvionicsDrawTarget | null) => void;
  onMutatePlan: (updater: (prev: FlightPlanDetail) => FlightPlanDetail) => void;
  onCenterMap: (lat: number, lng: number, zoom?: number) => void;
  onNotify: (level: 'info' | 'success' | 'warning' | 'error', msg: string) => void;
}

// ============================================================================
// 1. F/A-18C SA [DTC] TAB
// ============================================================================

export const F18SaTab: React.FC<SharedAvionicsProps> = ({
  plan,
  mapData,
  canEdit,
  activeDrawTarget,
  onSetDrawTarget,
  onMutatePlan,
  onNotify,
}) => {
  const [subTab, setSubTab] = useState<'flot' | 'faor' | 'cap' | 'corridors'>('flot');

  const sa = useMemo(
    () => ({
      flot: [],
      default_flot: 1,
      faor: [],
      default_faor: 1,
      cap_points: [],
      default_cap: 1,
      corridors: [],
      default_corridor: 1,
      ...(plan.sa_settings || {}),
    }),
    [plan.sa_settings]
  );

  const frontLinePts = useMemo(
    () => extractFrontLinePoints(mapData.frontLine, 7),
    [mapData.frontLine]
  );

  const aorPresets = useMemo(() => getAvailableAorPresetsFromMapData(mapData), [mapData]);

  const updateSa = (updater: (cur: Record<string, any>) => Record<string, any>) => {
    onMutatePlan((p) => {
      const base = {
        flot: [],
        default_flot: 1,
        faor: [],
        default_faor: 1,
        cap_points: [],
        default_cap: 1,
        corridors: [],
        default_corridor: 1,
        ...(p.sa_settings || {}),
      };
      return { ...p, sa_settings: updater(JSON.parse(JSON.stringify(base))) };
    });
  };

  return (
    <div className="space-y-3">
      {/* Active Drawing Banner */}
      {activeDrawTarget && (
        <div className="p-2.5 rounded-lg bg-emerald-950/80 border border-emerald-500/60 shadow-lg flex items-center justify-between gap-3 animate-pulse">
          <div className="flex items-center gap-2 text-emerald-300">
            <Crosshair className="size-4 text-emerald-400" weight="duotone" />
            <span className="text-xs font-bold uppercase tracking-wider">
              {describeAvionicsDrawTarget(activeDrawTarget)}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onSetDrawTarget(null)}
            className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
          >
            <Check className="size-3" weight="bold" />
            <span>Done Drawing</span>
          </button>
        </div>
      )}

      {/* Subtab Bar */}
      <div className="flex items-center justify-between border-b border-stone-800 pb-2">
        <div className="flex items-center gap-1.5 bg-stone-950 p-1 rounded-lg border border-stone-800">
          <button
            type="button"
            onClick={() => setSubTab('flot')}
            className={`px-3 py-1 rounded text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              subTab === 'flot' ? 'bg-emerald-600 text-white shadow' : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <LineSegments className="size-3.5" weight="duotone" />
            <span>FLOT</span>
            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono bg-stone-900/80 text-emerald-300">
              {1 + (sa.flot?.length || 0)}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('faor')}
            className={`px-3 py-1 rounded text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              subTab === 'faor' ? 'bg-emerald-600 text-white shadow' : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Polygon className="size-3.5" weight="duotone" />
            <span>FAOR</span>
            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono bg-stone-900/80 text-emerald-300">
              {sa.faor?.length || 0}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('cap')}
            className={`px-3 py-1 rounded text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              subTab === 'cap' ? 'bg-emerald-600 text-white shadow' : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <ArrowsClockwise className="size-3.5" weight="duotone" />
            <span>CAP</span>
            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono bg-stone-900/80 text-emerald-300">
              {sa.cap_points?.length || 0}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('corridors')}
            className={`px-3 py-1 rounded text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              subTab === 'corridors'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Path className="size-3.5" weight="duotone" />
            <span>CORRIDORS</span>
            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono bg-stone-900/80 text-emerald-300">
              {sa.corridors?.length || 0}
            </span>
          </button>
        </div>
      </div>

      {/* SUBTAB 1: FLOT */}
      {subTab === 'flot' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-stone-900 border border-stone-800 p-2.5 rounded-lg gap-3">
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                Default FLOT:
              </label>
              <select
                disabled={!canEdit}
                value={sa.default_flot ?? 1}
                onChange={(e) =>
                  updateSa((s) => ({ ...s, default_flot: Number(e.target.value) || 1 }))
                }
                className="bg-stone-950 border border-stone-700 text-stone-200 text-xs rounded px-2 py-1 font-mono focus:border-emerald-500 focus:outline-none"
              >
                <option value={1}>FLOT 1 (Campaign Front Line)</option>
                {(sa.flot || []).map((f: any, idx: number) => (
                  <option key={idx} value={idx + 2}>
                    FLOT {idx + 2}
                    {f.note ? ` - ${f.note}` : ''}
                  </option>
                ))}
                <option value={4}>None</option>
              </select>
            </div>

            {canEdit && (
              <button
                type="button"
                disabled={(sa.flot?.length || 0) >= 2}
                onClick={() =>
                  updateSa((s) => {
                    if (s.flot.length >= 2) return s;
                    const num = s.flot.length + 2;
                    s.flot.push({ name: `FLOT ${num}`, note: '', points: [] });
                    return s;
                  })
                }
                className="px-2.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="size-3" weight="bold" />
                <span>Add FLOT Line ({sa.flot?.length || 0}/2)</span>
              </button>
            )}
          </div>

          {/* Read-only FLOT 1 Master Card */}
          <div className="bg-stone-900 border border-emerald-500/40 rounded-lg p-3 space-y-2 bg-gradient-to-r from-emerald-950/20 to-transparent">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                  FLOT 1: Campaign Front Line
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Campaign Master
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-stone-800 text-stone-300">
                  Solid Green Line
                </span>
              </div>
              <span className="text-[10px] font-mono text-stone-400">
                {frontLinePts.length} points (Max 7 exported to DTC)
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {frontLinePts.length > 0 ? (
                frontLinePts.map((pt, pIdx) => (
                  <span
                    key={pIdx}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-stone-950 border border-stone-800 font-mono text-[10px] text-stone-300"
                  >
                    <span className="text-emerald-400 font-bold">PT{pIdx + 1}</span>
                    <span>
                      {pt.lat.toFixed(4)}, {pt.lng.toFixed(4)}
                    </span>
                  </span>
                ))
              ) : (
                <span className="text-[11px] text-amber-400/90 italic">
                  No Front Line defined on campaign map yet.
                </span>
              )}
            </div>
          </div>

          {/* User FLOT 2-3 */}
          <div className="space-y-2">
            {(sa.flot || []).map((flot: any, fIdx: number) => {
              const drawTgt: AvionicsDrawTarget = { kind: 'f18_flot', lineIdx: fIdx };
              const isDrawingThis = avionicsDrawTargetsEqual(activeDrawTarget, drawTgt);
              const pts: any[] = Array.isArray(flot.points) ? flot.points : [];
              return (
                <div
                  key={fIdx}
                  className="bg-stone-900 border border-stone-800 rounded-lg p-3 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-xs font-bold text-emerald-400 font-mono">
                        FLOT {fIdx + 2}
                      </span>
                      <input
                        type="text"
                        maxLength={15}
                        disabled={!canEdit}
                        value={flot.note || ''}
                        onChange={(e) =>
                          updateSa((s) => {
                            s.flot[fIdx].note = e.target.value;
                            return s;
                          })
                        }
                        placeholder="Line Note / Phase Line (max 15)"
                        className="bg-stone-950 border border-stone-700 text-stone-200 text-xs rounded px-2 py-1 flex-1 max-w-[240px]"
                      />
                      <span className="text-[10px] font-mono text-stone-400">
                        {pts.length} / 7 pts
                      </span>
                    </div>

                    {canEdit && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => onSetDrawTarget(isDrawingThis ? null : drawTgt)}
                          className={`px-2 py-1 rounded text-xs font-bold flex items-center gap-1 cursor-pointer ${
                            isDrawingThis
                              ? 'bg-amber-500 text-stone-950'
                              : 'bg-stone-800 hover:bg-stone-700 text-emerald-400 border border-emerald-500/30'
                          }`}
                        >
                          <PencilSimpleLine className="size-3.5" weight="duotone" />
                          <span>{isDrawingThis ? 'Stop Draw' : 'Draw on Map'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateSa((s) => {
                              s.flot[fIdx].points = [];
                              return s;
                            })
                          }
                          className="p-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-stone-200 cursor-pointer"
                          title="Clear vertices"
                        >
                          <Eraser className="size-3.5" weight="duotone" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (isDrawingThis) onSetDrawTarget(null);
                            updateSa((s) => {
                              s.flot.splice(fIdx, 1);
                              return s;
                            });
                          }}
                          className="p-1 rounded bg-stone-800 hover:bg-rose-900/60 text-stone-400 hover:text-rose-300 cursor-pointer"
                          title="Delete FLOT Line"
                        >
                          <Trash className="size-3.5" weight="duotone" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {pts.length === 0 ? (
                      <span className="text-[11px] text-stone-500 italic">
                        No vertices set. Click &ldquo;Draw on Map&rdquo; and select positions (max 7).
                      </span>
                    ) : (
                      pts.map((pt, pIdx) => (
                        <span
                          key={pIdx}
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-stone-950 border border-stone-800 font-mono text-[10px] text-stone-300"
                        >
                          <span className="text-emerald-400 font-bold">PT{pIdx + 1}</span>
                          <span>
                            {Number(pt.lat).toFixed(4)}, {Number(pt.lng).toFixed(4)}
                          </span>
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() =>
                                updateSa((s) => {
                                  s.flot[fIdx].points.splice(pIdx, 1);
                                  return s;
                                })
                              }
                              className="text-stone-500 hover:text-rose-400 cursor-pointer"
                            >
                              <X className="size-2.5" weight="bold" />
                            </button>
                          )}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUBTAB 2: FAOR */}
      {subTab === 'faor' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-stone-900 border border-stone-800 p-2.5 rounded-lg gap-3">
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                Default FAOR:
              </label>
              <select
                disabled={!canEdit}
                value={sa.default_faor ?? 1}
                onChange={(e) =>
                  updateSa((s) => ({ ...s, default_faor: Number(e.target.value) || 1 }))
                }
                className="bg-stone-950 border border-stone-700 text-stone-200 text-xs rounded px-2 py-1 font-mono"
              >
                {(sa.faor || []).map((f: any, idx: number) => (
                  <option key={idx} value={idx + 1}>
                    FAOR {idx + 1}
                    {f.name ? ` - ${f.name}` : ''}
                  </option>
                ))}
                <option value={4}>None</option>
              </select>
            </div>

            {canEdit && (
              <button
                type="button"
                disabled={(sa.faor?.length || 0) >= 3}
                onClick={() =>
                  updateSa((s) => {
                    if (s.faor.length >= 3) return s;
                    const num = s.faor.length + 1;
                    s.faor.push({ name: `FAOR ${num}`, note: '', points: [] });
                    return s;
                  })
                }
                className="px-2.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="size-3" weight="bold" />
                <span>Add FAOR ({sa.faor?.length || 0}/3)</span>
              </button>
            )}
          </div>

          <p className="text-[11px] text-stone-400">
            Fighter Area of Responsibility: Dashed polyline (max 3 areas, max 7 points each).
          </p>

          {(sa.faor || []).length === 0 ? (
            <div className="text-center py-6 border border-dashed border-stone-800 rounded-lg text-stone-500 text-xs">
              No FAOR boundaries configured. Click &ldquo;Add FAOR&rdquo; above to create one.
            </div>
          ) : (
            <div className="space-y-2">
              {(sa.faor || []).map((faor: any, fIdx: number) => {
                const pts: any[] = Array.isArray(faor.points) ? faor.points : [];
                const closed = isFaorPointsClosed(pts);
                const drawTgt: AvionicsDrawTarget = { kind: 'f18_faor', lineIdx: fIdx };
                const isDrawingThis = avionicsDrawTargetsEqual(activeDrawTarget, drawTgt);

                return (
                  <div
                    key={fIdx}
                    className="bg-stone-900 border border-stone-800 rounded-lg p-3 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-stone-800/80 pb-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-xs font-bold text-emerald-400 font-mono shrink-0">
                          FAOR {fIdx + 1}
                        </span>
                        <input
                          type="text"
                          maxLength={15}
                          disabled={!canEdit}
                          value={faor.name || ''}
                          onChange={(e) =>
                            updateSa((s) => {
                              s.faor[fIdx].name = e.target.value;
                              return s;
                            })
                          }
                          placeholder="Name (e.g. AOR NORTH)"
                          className="bg-stone-950 border border-stone-700 text-stone-200 text-xs rounded px-2 py-1 flex-1 max-w-[180px]"
                        />
                        <input
                          type="text"
                          maxLength={15}
                          disabled={!canEdit}
                          value={faor.note || ''}
                          onChange={(e) =>
                            updateSa((s) => {
                              s.faor[fIdx].note = e.target.value;
                              return s;
                            })
                          }
                          placeholder="Note / Source"
                          className="bg-stone-950 border border-stone-700 text-stone-200 text-xs rounded px-2 py-1 flex-1 max-w-[150px]"
                        />
                      </div>

                      {canEdit && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              updateSa((s) => {
                                s.faor[fIdx].points = [];
                                return s;
                              })
                            }
                            className="p-1.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-stone-200 cursor-pointer"
                            title="Clear vertices"
                          >
                            <Eraser className="size-3.5" weight="duotone" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (isDrawingThis) onSetDrawTarget(null);
                              updateSa((s) => {
                                s.faor.splice(fIdx, 1);
                                return s;
                              });
                            }}
                            className="p-1.5 rounded bg-stone-800 hover:bg-rose-900/60 text-stone-400 hover:text-rose-300 cursor-pointer"
                            title="Delete FAOR"
                          >
                            <Trash className="size-3.5" weight="duotone" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 bg-stone-950/50 px-2.5 py-1.5 rounded border border-stone-800/60">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-stone-800 text-stone-300">
                          Dashed Line
                        </span>
                        <span className="text-[10px] font-mono text-stone-400">
                          {pts.length} / 7 pts
                        </span>
                        {closed && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-emerald-950 border border-emerald-500/50 text-emerald-300 font-bold">
                            Closed Box
                          </span>
                        )}
                      </div>

                      {canEdit && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => onSetDrawTarget(isDrawingThis ? null : drawTgt)}
                            className={`px-2.5 py-1 rounded text-xs font-bold flex items-center gap-1 cursor-pointer ${
                              isDrawingThis
                                ? 'bg-amber-500 text-stone-950'
                                : 'bg-stone-800 hover:bg-stone-700 text-emerald-400 border border-emerald-500/30'
                            }`}
                          >
                            <PencilSimpleLine className="size-3.5" weight="duotone" />
                            <span>{isDrawingThis ? 'Stop Draw' : 'Draw on Map'}</span>
                          </button>

                          <button
                            type="button"
                            disabled={!closed && (pts.length < 3 || pts.length >= 7)}
                            onClick={() => {
                              if (closed) {
                                updateSa((s) => {
                                  s.faor[fIdx].points.pop();
                                  return s;
                                });
                              } else {
                                if (isDrawingThis) onSetDrawTarget(null);
                                updateSa((s) => {
                                  const p0 = s.faor[fIdx].points[0];
                                  s.faor[fIdx].points.push({ lat: Number(p0.lat), lng: Number(p0.lng) });
                                  return s;
                                });
                              }
                            }}
                            className={`px-2.5 py-1 rounded text-xs font-bold flex items-center gap-1 border cursor-pointer disabled:opacity-40 ${
                              closed
                                ? 'bg-emerald-950 border-emerald-500/50 text-emerald-300'
                                : 'bg-stone-800 hover:bg-stone-700 text-stone-300 border-stone-700'
                            }`}
                          >
                            {closed ? (
                              <>
                                <CheckSquare className="size-3.5 text-emerald-400" weight="duotone" />
                                <span>Closed Box</span>
                              </>
                            ) : (
                              <>
                                <Square className="size-3.5" weight="duotone" />
                                <span>Close Box</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>

                    {canEdit && aorPresets.length > 0 && (
                      <div className="flex items-center gap-2 bg-stone-950/70 p-1.5 rounded border border-stone-800/80">
                        <span className="text-[10px] text-stone-400 font-semibold shrink-0">
                          Import Pre-defined AOR:
                        </span>
                        <select
                          value=""
                          onChange={(e) => {
                            const preset = aorPresets.find((x) => x.id === e.target.value);
                            if (!preset) return;
                            updateSa((s) => {
                              s.faor[fIdx].name = preset.name.substring(0, 15);
                              s.faor[fIdx].note = preset.source.substring(0, 15);
                              s.faor[fIdx].points = preset.points.slice(0, 7);
                              return s;
                            });
                          }}
                          className="bg-stone-900 border border-stone-700 text-stone-300 text-xs rounded px-2 py-0.5 flex-1"
                        >
                          <option value="">-- Select Mission AOR or Tactical Marking --</option>
                          {aorPresets.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.source} - {p.name} ({p.points.length} pts)
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {pts.map((pt, pIdx) => (
                        <span
                          key={pIdx}
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-stone-950 border border-stone-800 font-mono text-[10px] text-stone-300"
                        >
                          <span className="text-emerald-400 font-bold">
                            {pIdx === pts.length - 1 && closed ? 'CLOSE (PT1)' : `PT${pIdx + 1}`}
                          </span>
                          <span>
                            {Number(pt.lat).toFixed(4)}, {Number(pt.lng).toFixed(4)}
                          </span>
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() =>
                                updateSa((s) => {
                                  s.faor[fIdx].points.splice(pIdx, 1);
                                  return s;
                                })
                              }
                              className="text-stone-500 hover:text-rose-400 cursor-pointer"
                            >
                              <X className="size-2.5" weight="bold" />
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 3: CAP */}
      {subTab === 'cap' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-stone-900 border border-stone-800 p-2.5 rounded-lg gap-3">
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                Default CAP Point:
              </label>
              <select
                disabled={!canEdit}
                value={sa.default_cap ?? 1}
                onChange={(e) =>
                  updateSa((s) => ({ ...s, default_cap: Number(e.target.value) || 1 }))
                }
                className="bg-stone-950 border border-stone-700 text-stone-200 text-xs rounded px-2 py-1 font-mono"
              >
                {(sa.cap_points || []).map((cp: any, idx: number) => (
                  <option key={idx} value={idx + 1}>
                    CAP {idx + 1}
                    {cp.name ? ` - ${cp.name}` : ''}
                  </option>
                ))}
                <option value={10}>None</option>
              </select>
            </div>

            {canEdit && (
              <button
                type="button"
                disabled={(sa.cap_points?.length || 0) >= 9}
                onClick={() =>
                  updateSa((s) => {
                    if (s.cap_points.length >= 9) return s;
                    const num = s.cap_points.length + 1;
                    s.cap_points.push({
                      num,
                      name: `CAP ${num}`,
                      note: '',
                      course: 0,
                      length: 20,
                      turn_direction: 'Right',
                      lat: null,
                      lng: null,
                    });
                    return s;
                  })
                }
                className="px-2.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="size-3" weight="bold" />
                <span>Add CAP Station ({sa.cap_points?.length || 0}/9)</span>
              </button>
            )}
          </div>

          <p className="text-[11px] text-stone-400">
            F/A-18 Combat Air Patrol station: 5 NM wide racetrack pathway. Anchor is top-right
            corner.
          </p>

          {(sa.cap_points || []).length === 0 ? (
            <div className="text-center py-6 border border-dashed border-stone-800 rounded-lg text-stone-500 text-xs">
              No CAP points defined. Click &ldquo;Add CAP Station&rdquo; above.
            </div>
          ) : (
            <div className="space-y-2.5">
              {(sa.cap_points || []).map((cp: any, cIdx: number) => {
                const drawTgt: AvionicsDrawTarget = { kind: 'f18_cap', capIdx: cIdx };
                const isPicking = avionicsDrawTargetsEqual(activeDrawTarget, drawTgt);
                return (
                  <div
                    key={cIdx}
                    className="bg-stone-900 border border-stone-800 rounded-lg p-3 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-stone-800 pb-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-xs font-bold text-emerald-400 font-mono">
                          CAP {cIdx + 1}
                        </span>
                        <input
                          type="text"
                          maxLength={15}
                          disabled={!canEdit}
                          value={cp.name || ''}
                          onChange={(e) =>
                            updateSa((s) => {
                              s.cap_points[cIdx].name = e.target.value;
                              return s;
                            })
                          }
                          placeholder="Station Name (e.g. BARCAP 1)"
                          className="bg-stone-950 border border-stone-700 text-stone-200 text-xs rounded px-2 py-1 flex-1 max-w-[180px]"
                        />
                        <input
                          type="text"
                          maxLength={15}
                          disabled={!canEdit}
                          value={cp.note || ''}
                          onChange={(e) =>
                            updateSa((s) => {
                              s.cap_points[cIdx].note = e.target.value;
                              return s;
                            })
                          }
                          placeholder="Notes / Flight"
                          className="bg-stone-950 border border-stone-700 text-stone-200 text-xs rounded px-2 py-1 flex-1 max-w-[160px]"
                        />
                      </div>

                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => {
                            if (isPicking) onSetDrawTarget(null);
                            updateSa((s) => {
                              s.cap_points.splice(cIdx, 1);
                              return s;
                            });
                          }}
                          className="p-1 rounded bg-stone-800 hover:bg-rose-900/60 text-stone-400 hover:text-rose-300 cursor-pointer"
                        >
                          <Trash className="size-3.5" weight="duotone" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-stone-400 uppercase">
                          Top-Right Anchor
                        </label>
                        <div className="flex items-center gap-1.5">
                          <div className="flex-1 bg-stone-950 border border-stone-800 rounded px-2 py-1 font-mono text-[11px] text-stone-300 truncate">
                            {cp.lat && cp.lng ? (
                              <span>
                                {Number(cp.lat).toFixed(4)}, {Number(cp.lng).toFixed(4)}
                              </span>
                            ) : (
                              <span className="text-stone-500 italic">Not set</span>
                            )}
                          </div>
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => onSetDrawTarget(isPicking ? null : drawTgt)}
                              className={`px-2 py-1 rounded text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer ${
                                isPicking
                                  ? 'bg-amber-500 text-stone-950'
                                  : 'bg-stone-800 hover:bg-stone-700 text-emerald-400 border border-emerald-500/30'
                              }`}
                            >
                              <Crosshair className="size-3.5" weight="duotone" />
                              <span>{isPicking ? 'Cancel' : 'Pick'}</span>
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-stone-400 uppercase">
                          Course (0 - 359°)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={359}
                          disabled={!canEdit}
                          value={cp.course ?? 0}
                          onChange={(e) =>
                            updateSa((s) => {
                              s.cap_points[cIdx].course = Number(e.target.value) || 0;
                              return s;
                            })
                          }
                          className="w-full bg-stone-950 border border-stone-700 text-stone-200 text-xs rounded px-2 py-1 font-mono"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-stone-400 uppercase">
                          Length (NM)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={200}
                          disabled={!canEdit}
                          value={cp.length ?? cp.length_nm ?? 20}
                          onChange={(e) =>
                            updateSa((s) => {
                              const val = Number(e.target.value) || 20;
                              s.cap_points[cIdx].length = val;
                              s.cap_points[cIdx].length_nm = val;
                              return s;
                            })
                          }
                          className="w-full bg-stone-950 border border-stone-700 text-stone-200 text-xs rounded px-2 py-1 font-mono"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-stone-400 uppercase">
                          Turn Direction
                        </label>
                        <select
                          disabled={!canEdit}
                          value={cp.turn_direction || 'Right'}
                          onChange={(e) =>
                            updateSa((s) => {
                              s.cap_points[cIdx].turn_direction = e.target.value;
                              return s;
                            })
                          }
                          className="w-full bg-stone-950 border border-stone-700 text-stone-200 text-xs rounded px-2 py-1 font-mono"
                        >
                          <option value="Right">Right Turn</option>
                          <option value="Left">Left Turn</option>
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 4: CORRIDORS */}
      {subTab === 'corridors' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-stone-900 border border-stone-800 p-2.5 rounded-lg gap-3">
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                Default Corridor:
              </label>
              <select
                disabled={!canEdit}
                value={sa.default_corridor ?? 1}
                onChange={(e) =>
                  updateSa((s) => ({ ...s, default_corridor: Number(e.target.value) || 1 }))
                }
                className="bg-stone-950 border border-stone-700 text-stone-200 text-xs rounded px-2 py-1 font-mono"
              >
                {(sa.corridors || []).map((c: any, idx: number) => (
                  <option key={idx} value={idx + 1}>
                    Corridor {idx + 1}
                    {c.name ? ` - ${c.name}` : ''}
                  </option>
                ))}
                <option value={8}>None</option>
              </select>
            </div>

            {canEdit && (
              <button
                type="button"
                disabled={(sa.corridors?.length || 0) >= 7}
                onClick={() =>
                  updateSa((s) => {
                    if (s.corridors.length >= 7) return s;
                    const num = s.corridors.length + 1;
                    s.corridors.push({ name: `CORR ${num}`, note: '', points: [] });
                    return s;
                  })
                }
                className="px-2.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="size-3" weight="bold" />
                <span>Add Corridor ({sa.corridors?.length || 0}/7)</span>
              </button>
            )}
          </div>

          <p className="text-[11px] text-stone-400">
            Flight Corridors: Up to 7 corridors (max 14 pts each), rendered with ±5 NM dashed rails
            (10 NM total width).
          </p>

          {(sa.corridors || []).length === 0 ? (
            <div className="text-center py-6 border border-dashed border-stone-800 rounded-lg text-stone-500 text-xs">
              No Corridors configured. Click &ldquo;Add Corridor&rdquo; above.
            </div>
          ) : (
            <div className="space-y-2">
              {(sa.corridors || []).map((corr: any, cIdx: number) => {
                const pts: any[] = Array.isArray(corr.points) ? corr.points : [];
                const drawTgt: AvionicsDrawTarget = { kind: 'f18_corridor', lineIdx: cIdx };
                const isDrawingThis = avionicsDrawTargetsEqual(activeDrawTarget, drawTgt);

                return (
                  <div
                    key={cIdx}
                    className="bg-stone-900 border border-stone-800 rounded-lg p-3 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-xs font-bold text-emerald-400 font-mono">
                          CORR {cIdx + 1}
                        </span>
                        <input
                          type="text"
                          maxLength={15}
                          disabled={!canEdit}
                          value={corr.name || ''}
                          onChange={(e) =>
                            updateSa((s) => {
                              s.corridors[cIdx].name = e.target.value;
                              return s;
                            })
                          }
                          placeholder="Name"
                          className="bg-stone-950 border border-stone-700 text-stone-200 text-xs rounded px-2 py-1 flex-1 max-w-[150px]"
                        />
                        <input
                          type="text"
                          maxLength={15}
                          disabled={!canEdit}
                          value={corr.note || ''}
                          onChange={(e) =>
                            updateSa((s) => {
                              s.corridors[cIdx].note = e.target.value;
                              return s;
                            })
                          }
                          placeholder="Note (INGRESS)"
                          className="bg-stone-950 border border-stone-700 text-stone-200 text-xs rounded px-2 py-1 flex-1 max-w-[130px]"
                        />
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-stone-800 text-stone-300">
                          10 NM Width
                        </span>
                        <span className="text-[10px] font-mono text-stone-400">
                          {pts.length} / 14 pts
                        </span>
                      </div>

                      {canEdit && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => onSetDrawTarget(isDrawingThis ? null : drawTgt)}
                            className={`px-2 py-1 rounded text-xs font-bold flex items-center gap-1 cursor-pointer ${
                              isDrawingThis
                                ? 'bg-amber-500 text-stone-950'
                                : 'bg-stone-800 hover:bg-stone-700 text-emerald-400 border border-emerald-500/30'
                            }`}
                          >
                            <PencilSimpleLine className="size-3.5" weight="duotone" />
                            <span>{isDrawingThis ? 'Stop Draw' : 'Draw on Map'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updateSa((s) => {
                                s.corridors[cIdx].points = [];
                                return s;
                              })
                            }
                            className="p-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-stone-200 cursor-pointer"
                          >
                            <Eraser className="size-3.5" weight="duotone" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (isDrawingThis) onSetDrawTarget(null);
                              updateSa((s) => {
                                s.corridors.splice(cIdx, 1);
                                return s;
                              });
                            }}
                            className="p-1 rounded bg-stone-800 hover:bg-rose-900/60 text-stone-400 hover:text-rose-300 cursor-pointer"
                          >
                            <Trash className="size-3.5" weight="duotone" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {pts.map((pt, pIdx) => (
                        <span
                          key={pIdx}
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-stone-950 border border-stone-800 font-mono text-[10px] text-stone-300"
                        >
                          <span className="text-emerald-400 font-bold">PT{pIdx + 1}</span>
                          <span>
                            {Number(pt.lat).toFixed(4)}, {Number(pt.lng).toFixed(4)}
                          </span>
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() =>
                                updateSa((s) => {
                                  s.corridors[cIdx].points.splice(pIdx, 1);
                                  return s;
                                })
                              }
                              className="text-stone-500 hover:text-rose-400 cursor-pointer"
                            >
                              <X className="size-2.5" weight="bold" />
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 2. F-16C GEO LINES [DTC] TAB (STPT 31-55)
// ============================================================================

export const F16GeoLinesTab: React.FC<SharedAvionicsProps> = ({
  plan,
  mapData,
  canEdit,
  activeDrawTarget,
  onSetDrawTarget,
  onMutatePlan,
  onNotify,
}) => {
  const lines = useMemo(() => recalcF16GeoLines(plan.geo_lines_settings), [plan.geo_lines_settings]);
  const aorPresets = useMemo(() => getAvailableAorPresetsFromMapData(mapData), [mapData]);
  const totalPts = lines[1].length + lines[2].length + lines[3].length + lines[4].length;

  const commitGeoLines = (nextLines: Record<number, any[]>) => {
    onMutatePlan((p) => ({
      ...p,
      geo_lines_settings: recalcF16GeoLines(nextLines),
    }));
  };

  const handleImportFrontLine = () => {
    const flPts = extractFrontLinePoints(mapData.frontLine, 25);
    if (flPts.length === 0) {
      onNotify('warning', 'No Front Line coordinates available in campaign.');
      return;
    }
    const otherCount = lines[2].length + lines[3].length + lines[4].length;
    const maxAllowed = 25 - otherCount;
    if (maxAllowed <= 0) {
      onNotify('warning', 'All 25 Geo Line points are already used by Lines 2-4.');
      return;
    }
    const next = { ...lines };
    next[1] = flPts.slice(0, maxAllowed).map((pt, idx) => ({
      name: `FLOT ${idx + 1}`,
      lat: pt.lat,
      lng: pt.lng,
      line: 1,
    }));
    commitGeoLines(next);
  };

  const lineStyles: Record<number, { border: string; dot: string; text: string }> = {
    1: {
      border: 'border-red-500/50 shadow-md shadow-red-950/20',
      dot: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]',
      text: 'text-red-400',
    },
    2: {
      border: 'border-emerald-500/40 shadow-md shadow-emerald-950/20',
      dot: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]',
      text: 'text-emerald-400',
    },
    3: {
      border: 'border-cyan-500/40 shadow-md shadow-cyan-950/20',
      dot: 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]',
      text: 'text-cyan-400',
    },
    4: {
      border: 'border-purple-500/40 shadow-md shadow-purple-950/20',
      dot: 'bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)]',
      text: 'text-purple-400',
    },
  };

  return (
    <div className="space-y-3">
      <div className="p-3 rounded-lg bg-stone-900/90 border border-stone-800 space-y-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded bg-teal-950/80 text-teal-400 border border-teal-800/60">
              <Polygon className="size-5" weight="duotone" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-stone-200">F-16 Geo Lines (STPT 31–55)</h3>
              <p className="text-[10px] text-stone-400">
                Tactical boundary lines for DTC upload (up to 4 lines, 25 points maximum combined)
              </p>
            </div>
          </div>
          <span
            className={`text-xs font-mono font-bold px-2.5 py-1 rounded border ${
              totalPts >= 25
                ? 'bg-red-950/80 text-red-300 border-red-800'
                : 'bg-teal-950/60 text-teal-300 border-teal-800/40'
            }`}
          >
            {totalPts} / 25 Pts
          </span>
        </div>

        <div className="p-2.5 rounded bg-stone-950/70 border border-stone-800 text-[11px] text-stone-300 flex items-start gap-2">
          <Info className="size-4 text-amber-400 shrink-0 mt-0.5" weight="duotone" />
          <div>
            <strong className="text-stone-200">
              Line 1 is always the Campaign Front Line (FLOT).
            </strong>
            <span className="text-stone-400">
              {' '}
              Lines 2 through 4 can be drawn or loaded from AOR presets. Each point occupies a
              steerpoint slot between 31 and 55.
            </span>
          </div>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <button
              type="button"
              onClick={handleImportFrontLine}
              className="px-2.5 py-1.5 rounded text-xs font-bold bg-red-950/80 hover:bg-red-900/80 text-red-300 border border-red-800/60 flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowsClockwise className="size-3.5" weight="duotone" />
              <span>Import Mission Front Line into Line 1</span>
            </button>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {([1, 2, 3, 4] as const).map((lNum) => {
          const pts = lines[lNum] || [];
          const closed = isGeoLinePointsClosed(pts);
          const drawTgt: AvionicsDrawTarget = { kind: 'f16_geo', lineNum: lNum };
          const isDrawingThis = avionicsDrawTargetsEqual(activeDrawTarget, drawTgt);
          const st = lineStyles[lNum];

          return (
            <div key={lNum} className={`p-3 rounded-lg bg-stone-900/90 border space-y-2.5 ${st.border}`}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full shrink-0 ${st.dot}`} />
                  <span className="text-xs font-bold text-stone-200">
                    {lNum === 1 ? 'Line 1 (Front Line / FLOT)' : `Line ${lNum}`}
                  </span>
                  <span className="text-[10px] font-mono text-stone-400">({pts.length} pts)</span>
                  {closed && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-teal-950 border border-teal-500/50 text-teal-300 font-bold">
                      Closed Loop
                    </span>
                  )}
                </div>

                {canEdit && (
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                    {lNum > 1 && aorPresets.length > 0 && (
                      <select
                        value=""
                        onChange={(e) => {
                          const preset = aorPresets.find((x) => x.id === e.target.value);
                          if (!preset) return;
                          const other = ([1, 2, 3, 4] as const)
                            .filter((n) => n !== lNum)
                            .reduce((acc, n) => acc + lines[n].length, 0);
                          const maxAllowed = 25 - other;
                          if (maxAllowed <= 0) {
                            onNotify('warning', 'All 25 Geo Line points are already allocated');
                            return;
                          }
                          const next = { ...lines };
                          next[lNum] = preset.points.slice(0, maxAllowed).map((pt, idx) => ({
                            name: pt.name || `${preset.name} ${idx + 1}`,
                            lat: pt.lat,
                            lng: pt.lng,
                            line: lNum,
                          }));
                          commitGeoLines(next);
                        }}
                        className="bg-stone-950 border border-stone-700 rounded px-2 py-1 text-[11px] text-stone-200"
                      >
                        <option value="">Load AOR Preset...</option>
                        {aorPresets.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.points.length} pts)
                          </option>
                        ))}
                      </select>
                    )}

                    <button
                      type="button"
                      onClick={() => onSetDrawTarget(isDrawingThis ? null : drawTgt)}
                      className={`px-2 py-1 rounded text-xs font-bold flex items-center gap-1 cursor-pointer ${
                        isDrawingThis
                          ? 'bg-amber-500 text-stone-950'
                          : 'bg-stone-800 hover:bg-stone-700 text-teal-400 border border-teal-500/30'
                      }`}
                    >
                      <PencilSimpleLine className="size-3.5" weight="duotone" />
                      <span>{isDrawingThis ? 'Stop Draw' : 'Draw on Map'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={!closed && (pts.length < 2 || totalPts >= 25)}
                      onClick={() => {
                        const next = { ...lines };
                        if (closed) {
                          next[lNum] = next[lNum].slice(0, -1);
                        } else {
                          const p0 = pts[0];
                          next[lNum] = [
                            ...next[lNum],
                            {
                              name: `${(p0.name || `L${lNum} P1`).replace(/\s*\(Close\)$/, '')} (Close)`,
                              lat: Number(p0.lat),
                              lng: Number(p0.lng),
                              line: lNum,
                            },
                          ];
                          if (isDrawingThis) onSetDrawTarget(null);
                        }
                        commitGeoLines(next);
                      }}
                      className={`px-2 py-1 rounded text-xs font-bold flex items-center gap-1 border cursor-pointer disabled:opacity-40 ${
                        closed
                          ? 'bg-teal-950/80 border-teal-500/50 text-teal-300'
                          : 'bg-stone-800 hover:bg-stone-700 text-stone-300 border-stone-700'
                      }`}
                    >
                      {closed ? (
                        <>
                          <CheckSquare className="size-3.5 text-teal-400" weight="duotone" />
                          <span>Closed Loop</span>
                        </>
                      ) : (
                        <>
                          <Polygon className="size-3.5 text-stone-400" weight="duotone" />
                          <span>Close Loop</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const next = { ...lines, [lNum]: [] };
                        commitGeoLines(next);
                      }}
                      className="p-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-stone-200 cursor-pointer"
                      title="Clear line points"
                    >
                      <Eraser className="size-3.5" weight="duotone" />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {pts.length === 0 ? (
                  <span className="text-[11px] text-stone-500 italic">
                    No points in this line. Click &ldquo;Draw on Map&rdquo; or load a preset above.
                  </span>
                ) : (
                  pts.map((pt, pIdx) => (
                    <div
                      key={pIdx}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-stone-950 border border-stone-800 font-mono text-[10px] text-stone-300"
                    >
                      <span className={`font-bold ${st.text}`}>
                        STPT {pt.stpt || 31 + pIdx}
                      </span>
                      <span className="text-stone-400 truncate max-w-[85px]">
                        {pt.name || `Pt ${pIdx + 1}`}
                      </span>
                      <span className="text-stone-500">
                        {Number(pt.lat).toFixed(3)}, {Number(pt.lng).toFixed(3)}
                      </span>
                      {canEdit && (
                        <>
                          <div className="flex items-center gap-0.5 ml-1 border-l border-stone-800 pl-1">
                            {([1, 2, 3, 4] as const)
                              .filter((t) => t !== lNum)
                              .map((targetLine) => (
                                <button
                                  key={targetLine}
                                  type="button"
                                  onClick={() => {
                                    const next = { ...lines };
                                    const copy = [...next[lNum]];
                                    const [moved] = copy.splice(pIdx, 1);
                                    next[lNum] = copy;
                                    moved.line = targetLine;
                                    next[targetLine] = [...next[targetLine], moved];
                                    commitGeoLines(next);
                                  }}
                                  className="px-1 py-0.2 rounded text-[8px] font-bold text-stone-500 hover:text-stone-100 hover:bg-stone-800 cursor-pointer"
                                  title={`Move to Line ${targetLine}`}
                                >
                                  L{targetLine}
                                </button>
                              ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const next = {
                                ...lines,
                                [lNum]: pts.filter((_, i) => i !== pIdx),
                              };
                              commitGeoLines(next);
                            }}
                            className="text-stone-500 hover:text-red-400 ml-0.5 cursor-pointer"
                          >
                            <X className="size-2.5" weight="bold" />
                          </button>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================================
// 3. F-16C DEST PTS [DTC] TAB (STPT 81-99)
// ============================================================================

export const F16DestPtsTab: React.FC<SharedAvionicsProps> = ({
  plan,
  mapData,
  canEdit,
  activeDrawTarget,
  onSetDrawTarget,
  onMutatePlan,
  onCenterMap,
  onNotify,
}) => {
  const destList = useMemo(() => {
    const raw = plan.dest_points_settings;
    const arr = Array.isArray(raw)
      ? raw
      : Array.isArray((raw as any)?.points)
        ? (raw as any).points
        : [];
    return recalcF16DestPoints(arr);
  }, [plan.dest_points_settings]);

  const drawTgt: AvionicsDrawTarget = { kind: 'f16_dest' };
  const isDrawing = avionicsDrawTargetsEqual(activeDrawTarget, drawTgt);

  const commitDest = (list: any[]) => {
    onMutatePlan((p) => ({ ...p, dest_points_settings: recalcF16DestPoints(list) }));
  };

  const handlePopulateFromDiverts = () => {
    const candidates: string[] = [];
    if (plan.destination_airfield) candidates.push(plan.destination_airfield);
    (plan.diverts || []).forEach((d) => {
      const n = typeof d === 'string' ? d : d?.name || d?.icao || '';
      if (n && !candidates.includes(n)) candidates.push(n);
    });

    const next = [...destList];
    let added = 0;
    candidates.forEach((c) => {
      if (next.length >= 19) return;
      const q = c.trim().toLowerCase();
      const ab = (mapData.airbases || []).find(
        (a) =>
          a.name.trim().toLowerCase() === q ||
          (a.icao || '').trim().toLowerCase() === q ||
          (a.code || '').trim().toLowerCase() === q
      );
      if (ab && Number.isFinite(Number(ab.lat)) && Number.isFinite(Number(ab.lng))) {
        const exists = next.some(
          (dp) =>
            Math.abs(Number(dp.lat) - Number(ab.lat)) < 0.0001 &&
            Math.abs(Number(dp.lng) - Number(ab.lng)) < 0.0001
        );
        if (!exists) {
          const stpt = 81 + next.length;
          next.push({
            stpt,
            name: ab.name,
            lat: Number(ab.lat),
            lng: Number(ab.lng),
            elev: ab.elevation ? Math.round(Number(ab.elevation)) : 0,
            note: (ab.icao || ab.code || `D${stpt}`).substring(0, 6).toUpperCase(),
          });
          added++;
        }
      }
    });

    if (added > 0) {
      commitDest(next);
    } else if (candidates.length === 0) {
      onNotify('warning', 'No destination or divert airfields designated in the flight plan');
    } else {
      onNotify('info', 'All designated destination & divert airfields are already in the list');
    }
  };

  return (
    <div className="space-y-3">
      <div className="p-3 rounded-lg bg-stone-900/90 border border-stone-800 space-y-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded bg-indigo-950/80 text-indigo-400 border border-indigo-800/60">
              <AirplaneLanding className="size-5" weight="duotone" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-stone-200">
                F-16 Destination Points (STPT 81–99)
              </h3>
              <p className="text-[10px] text-stone-400">
                Destination &amp; divert airfields for DTC upload (up to 19 steerpoints)
              </p>
            </div>
          </div>
          <span
            className={`text-xs font-mono font-bold px-2.5 py-1 rounded border ${
              destList.length >= 19
                ? 'bg-red-950/80 text-red-300 border-red-800'
                : 'bg-indigo-950/60 text-indigo-300 border-indigo-800/40'
            }`}
          >
            {destList.length} / 19 Pts
          </span>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <button
              type="button"
              onClick={() => onSetDrawTarget(isDrawing ? null : drawTgt)}
              className={`px-2.5 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                isDrawing
                  ? 'bg-amber-500 text-stone-950'
                  : 'bg-indigo-950/80 hover:bg-indigo-900/80 text-indigo-300 border border-indigo-800/60'
              }`}
            >
              <PencilSimpleLine className="size-3.5" weight="duotone" />
              <span>{isDrawing ? 'Stop Placing on Map' : 'Place on Map'}</span>
            </button>

            <button
              type="button"
              onClick={handlePopulateFromDiverts}
              className="px-2.5 py-1.5 rounded text-xs font-bold bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowsClockwise className="size-3.5" weight="duotone" />
              <span>Populate from Destination &amp; Diverts</span>
            </button>

            <button
              type="button"
              onClick={() => commitDest([])}
              className="px-2.5 py-1.5 rounded text-xs font-bold bg-stone-800 hover:bg-rose-950 text-stone-400 hover:text-rose-300 border border-stone-700 flex items-center gap-1.5 ml-auto cursor-pointer"
            >
              <Eraser className="size-3.5" weight="duotone" />
              <span>Clear All</span>
            </button>
          </div>
        )}
      </div>

      <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
        {destList.length === 0 ? (
          <div className="text-center p-6 text-stone-500 italic text-xs bg-stone-900/50 rounded-lg border border-stone-800">
            No Destination Points defined. Click &ldquo;Populate from Destination &amp; Diverts&rdquo;
            or &ldquo;Place on Map&rdquo; above.
          </div>
        ) : (
          destList.map((pt, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2 rounded-lg bg-stone-900/90 border border-stone-800 text-xs gap-2.5 hover:border-stone-700"
            >
              <span className="w-6 h-6 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono font-bold text-[10px] flex items-center justify-center shrink-0">
                {pt.stpt || 81 + idx}
              </span>

              <input
                type="text"
                disabled={!canEdit}
                value={pt.name || ''}
                onChange={(e) => {
                  const next = [...destList];
                  next[idx] = { ...pt, name: e.target.value };
                  commitDest(next);
                }}
                placeholder="Airfield / Point Name"
                className="flex-1 min-w-0 bg-stone-950 border border-stone-800 rounded px-2 py-1 text-xs text-stone-100"
              />

              <input
                type="text"
                maxLength={6}
                disabled={!canEdit}
                value={pt.note || ''}
                onChange={(e) => {
                  const next = [...destList];
                  next[idx] = { ...pt, note: e.target.value.toUpperCase() };
                  commitDest(next);
                }}
                placeholder="D81"
                className="w-24 shrink-0 bg-stone-950 border border-stone-800 rounded px-2 py-1 text-xs font-mono text-amber-300 uppercase"
              />

              <div className="w-20 shrink-0 flex items-center gap-1">
                <input
                  type="number"
                  disabled={!canEdit}
                  value={pt.elev ?? 0}
                  onChange={(e) => {
                    const next = [...destList];
                    next[idx] = { ...pt, elev: Number(e.target.value) || 0 };
                    commitDest(next);
                  }}
                  className="w-full bg-stone-950 border border-stone-800 rounded px-1.5 py-1 text-xs font-mono text-stone-200 text-right"
                />
                <span className="text-[10px] text-stone-500 font-mono">ft</span>
              </div>

              <span className="hidden sm:block text-[10px] font-mono text-stone-400 shrink-0">
                {Number(pt.lat).toFixed(3)}, {Number(pt.lng).toFixed(3)}
              </span>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => onCenterMap(Number(pt.lat), Number(pt.lng), 11)}
                  className="p-1 rounded hover:bg-stone-800 text-indigo-400 hover:text-indigo-300 cursor-pointer"
                  title="Pan on map"
                >
                  <MapPinArea className="size-4" weight="duotone" />
                </button>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => commitDest(destList.filter((_, i) => i !== idx))}
                    className="p-1 rounded hover:bg-stone-800 text-stone-400 hover:text-red-400 font-bold text-sm cursor-pointer"
                    title="Remove destination point"
                  >
                    &times;
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// ============================================================================
// 4. F-14 PLOT LINES [DTC] TAB (Max 4 lines, max 9 pts/line)
// ============================================================================

export const F14PlotLinesTab: React.FC<SharedAvionicsProps> = ({
  plan,
  mapData,
  canEdit,
  activeDrawTarget,
  onSetDrawTarget,
  onMutatePlan,
  onNotify,
}) => {
  const plotLines = useMemo(() => {
    const raw = (plan.f14_plot_lines_settings || {}) as Record<string, any>;
    const out: Record<1 | 2 | 3 | 4, { closed: boolean; points: any[] }> = {
      1: { closed: false, points: [] },
      2: { closed: false, points: [] },
      3: { closed: false, points: [] },
      4: { closed: false, points: [] },
    };
    ([1, 2, 3, 4] as const).forEach((l) => {
      const ex = raw[l] ?? raw[String(l)];
      if (Array.isArray(ex)) out[l] = { closed: false, points: ex };
      else if (ex && typeof ex === 'object') {
        out[l] = { closed: Boolean(ex.closed), points: Array.isArray(ex.points) ? ex.points : [] };
      }
    });
    return out;
  }, [plan.f14_plot_lines_settings]);

  const aorPresets = useMemo(() => getAvailableAorPresetsFromMapData(mapData), [mapData]);

  const commitF14Plot = (next: Record<number, { closed: boolean; points: any[] }>) => {
    onMutatePlan((p) => ({ ...p, f14_plot_lines_settings: next }));
  };

  const handleImportFrontLine = () => {
    const flPts = extractFrontLinePoints(mapData.frontLine, 9);
    if (flPts.length === 0) {
      onNotify('warning', 'No Front Line coordinates available in campaign');
      return;
    }
    const next = {
      ...plotLines,
      1: {
        ...plotLines[1],
        points: flPts.map((pt, idx) => ({
          name: `L1 P${idx + 1}`,
          lat: pt.lat,
          lng: pt.lng,
          elev: 0,
          line: 1,
        })),
      },
    };
    commitF14Plot(next);
  };

  const lineStyles: Record<number, { border: string; dot: string; text: string }> = {
    1: { border: 'border-red-500/50', dot: 'bg-red-500', text: 'text-red-400' },
    2: { border: 'border-emerald-500/40', dot: 'bg-emerald-500', text: 'text-emerald-400' },
    3: { border: 'border-cyan-500/40', dot: 'bg-cyan-500', text: 'text-cyan-400' },
    4: { border: 'border-purple-500/40', dot: 'bg-purple-500', text: 'text-purple-400' },
  };

  return (
    <div className="space-y-3">
      <div className="p-3 rounded-lg bg-stone-900/90 border border-stone-800 space-y-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded bg-teal-950/80 text-teal-400 border border-teal-800/60">
              <Polygon className="size-5" weight="duotone" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-stone-100 flex items-center gap-2">
                <span>F-14 TID Plot Lines</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  Max 4 Lines &bull; 9 Pts/Line
                </span>
              </h4>
              <p className="text-[11px] text-stone-400 mt-0.5">
                Lines rendered on F-14 TID avionics display (max 4 lines, 9 points each).
              </p>
            </div>
          </div>

          {canEdit && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleImportFrontLine}
                className="px-2.5 py-1 rounded bg-stone-800 hover:bg-stone-700 text-teal-400 border border-teal-500/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowsClockwise className="size-3.5" weight="duotone" />
                <span>Import FLOT into Line 1</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Clear all points from all 4 Plot Lines?')) {
                    commitF14Plot({
                      1: { closed: false, points: [] },
                      2: { closed: false, points: [] },
                      3: { closed: false, points: [] },
                      4: { closed: false, points: [] },
                    });
                  }
                }}
                className="px-2.5 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-red-400 border border-stone-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Trash className="size-3.5" weight="duotone" />
                <span>Clear All</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {([1, 2, 3, 4] as const).map((lNum) => {
          const lineObj = plotLines[lNum];
          const drawTgt: AvionicsDrawTarget = { kind: 'f14_plot', lineNum: lNum };
          const isDrawing = avionicsDrawTargetsEqual(activeDrawTarget, drawTgt);
          const st = lineStyles[lNum];

          return (
            <div key={lNum} className={`p-3 rounded-lg bg-stone-900/90 border space-y-2.5 ${st.border}`}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full shrink-0 ${st.dot}`} />
                  <span className="text-xs font-bold text-stone-200">Line {lNum}</span>
                  <span className="text-[10px] font-mono text-stone-400">
                    ({lineObj.points.length} / 9 pts)
                  </span>
                </div>

                {canEdit && (
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                    <label className="flex items-center gap-1.5 text-[11px] text-stone-300 font-mono bg-stone-950 px-2 py-1 rounded border border-stone-800 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={lineObj.closed}
                        onChange={(e) =>
                          commitF14Plot({
                            ...plotLines,
                            [lNum]: { ...lineObj, closed: e.target.checked },
                          })
                        }
                        className="rounded border-stone-700 bg-stone-900 text-teal-500 size-3"
                      />
                      <span>Closed Loop</span>
                    </label>

                    {lNum > 1 && aorPresets.length > 0 && (
                      <select
                        value=""
                        onChange={(e) => {
                          const preset = aorPresets.find((x) => x.id === e.target.value);
                          if (!preset) return;
                          const pts = preset.points.slice(0, 9).map((pt, idx) => ({
                            name: pt.name || `L${lNum} P${idx + 1}`,
                            lat: pt.lat,
                            lng: pt.lng,
                            elev: 0,
                            line: lNum,
                          }));
                          commitF14Plot({ ...plotLines, [lNum]: { ...lineObj, points: pts } });
                        }}
                        className="bg-stone-950 border border-stone-700 rounded px-2 py-1 text-[11px] text-stone-200"
                      >
                        <option value="">Load AOR Preset...</option>
                        {aorPresets.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({Math.min(p.points.length, 9)} pts)
                          </option>
                        ))}
                      </select>
                    )}

                    <button
                      type="button"
                      onClick={() => onSetDrawTarget(isDrawing ? null : drawTgt)}
                      className={`px-2 py-1 rounded text-xs font-bold flex items-center gap-1 cursor-pointer ${
                        isDrawing
                          ? 'bg-amber-500 text-stone-950'
                          : 'bg-stone-800 hover:bg-stone-700 text-teal-400 border border-teal-500/30'
                      }`}
                    >
                      <PencilSimpleLine className="size-3.5" weight="duotone" />
                      <span>{isDrawing ? 'Stop Draw' : 'Draw on Map'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        commitF14Plot({ ...plotLines, [lNum]: { ...lineObj, points: [] } })
                      }
                      className="p-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-stone-200 cursor-pointer"
                    >
                      <Eraser className="size-3.5" weight="duotone" />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {lineObj.points.length === 0 ? (
                  <span className="text-[11px] text-stone-500 italic">
                    No points in this plot line. Click &ldquo;Draw on Map&rdquo; or load a preset
                    above.
                  </span>
                ) : (
                  lineObj.points.map((pt, pIdx) => (
                    <div
                      key={pIdx}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-stone-950 border border-stone-800 font-mono text-[10px] text-stone-300"
                    >
                      <span className={`font-bold ${st.text}`}>
                        {pt.name || `L${lNum} P${pIdx + 1}`}
                      </span>
                      <span className="text-stone-500">
                        {Number(pt.lat).toFixed(3)}, {Number(pt.lng).toFixed(3)}
                      </span>
                      <div className="flex items-center gap-0.5 ml-1 border-l border-stone-800 pl-1">
                        <input
                          type="number"
                          disabled={!canEdit}
                          value={pt.elev ?? 0}
                          onChange={(e) => {
                            const nextPts = [...lineObj.points];
                            nextPts[pIdx] = { ...pt, elev: Number(e.target.value) || 0 };
                            commitF14Plot({ ...plotLines, [lNum]: { ...lineObj, points: nextPts } });
                          }}
                          className="w-12 bg-stone-900 border border-stone-700 rounded px-1 py-0 text-[10px] font-mono text-stone-200 text-right"
                        />
                        <span className="text-[9px] text-stone-500">ft</span>
                      </div>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() =>
                            commitF14Plot({
                              ...plotLines,
                              [lNum]: {
                                ...lineObj,
                                points: lineObj.points.filter((_, i) => i !== pIdx),
                              },
                            })
                          }
                          className="text-stone-500 hover:text-red-400 ml-0.5 cursor-pointer"
                        >
                          <X className="size-2.5" weight="bold" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================================
// 5. F-14 ADDITIONAL PTS [X / 40] TAB
// ============================================================================

interface F14AdditionalPtsTabProps {
  plan: FlightPlanDetail;
  canEdit: boolean;
  onAddAdditionalAtCenter: () => void;
  onUpdatePoint: (globalIndex: number, patch: Partial<FlightPlanRoutePoint>) => void;
  onDeletePoint: (globalIndex: number) => void;
  onCenterMap: (lat: number, lng: number, zoom?: number) => void;
}

export const F14AdditionalPtsTab: React.FC<F14AdditionalPtsTabProps> = ({
  plan,
  canEdit,
  onAddAdditionalAtCenter,
  onUpdatePoint,
  onDeletePoint,
  onCenterMap,
}) => {
  const additionalPts = useMemo(
    () =>
      (plan.route_points || [])
        .map((wp, globalIndex) => ({ wp, globalIndex }))
        .filter(({ wp }) => isAdditionalPoint(wp)),
    [plan.route_points]
  );

  return (
    <div className="space-y-3">
      <div className="p-3 rounded-lg bg-stone-900/90 border border-stone-800 space-y-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded bg-purple-950/80 text-purple-400 border border-purple-800/60">
              <Crosshair className="size-5" weight="duotone" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-stone-100 flex items-center gap-2">
                <span>F-14 Additional Points</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  {additionalPts.length} / 40 Pts &bull; Max 40 / Plan
                </span>
              </h4>
              <p className="text-[11px] text-stone-400 mt-0.5">
                Additional Waypoints &amp; Designation Points for F-14 avionics.
              </p>
            </div>
          </div>

          {canEdit && (
            <button
              type="button"
              disabled={additionalPts.length >= 40}
              onClick={onAddAdditionalAtCenter}
              className="px-2.5 py-1 rounded bg-stone-800 hover:bg-stone-700 text-purple-400 disabled:opacity-50 border border-purple-500/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="size-3.5" weight="bold" />
              <span>Add Additional Point</span>
            </button>
          )}
        </div>

        <div className="p-2.5 rounded bg-stone-950/80 border border-stone-800 space-y-2 text-xs">
          <div className="flex items-center gap-1.5 text-purple-400 font-bold uppercase tracking-wider text-[10px]">
            <Info className="size-3.5 shrink-0" weight="duotone" />
            <span>Point Name Suffix Conventions</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] font-mono">
            <div className="p-2 rounded bg-stone-900/70 border border-stone-800/60 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-amber-300 font-bold">X##</span>
                <span className="text-stone-400 font-sans text-[10px]">Special Points</span>
              </div>
              <div className="text-stone-400 text-[10px]">FP, IP, HB, DP, HA, ST</div>
              <div className="text-stone-500 text-[10px] italic">
                Example: DHAFRAXHB = DHAFRA as Home Base
              </div>
            </div>
            <div className="p-2 rounded bg-stone-900/70 border border-stone-800/60 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-cyan-300 font-bold">XB / X##B</span>
                <span className="text-stone-400 font-sans text-[10px]">Bullseye Ref</span>
              </div>
              <div className="flex items-center justify-between pt-0.5">
                <span className="text-cyan-300 font-bold">XD / X##D</span>
                <span className="text-stone-400 font-sans text-[10px]">Destination</span>
              </div>
            </div>
            <div className="p-2 rounded bg-stone-900/70 border border-stone-800/60 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-purple-300 font-bold">XL / X##L</span>
                <span className="text-stone-400 font-sans text-[10px]">LANTIRN (max 20)</span>
              </div>
              <div className="text-stone-400 text-[10px]">Targeting pod designation targets</div>
            </div>
            <div className="p-2 rounded bg-stone-900/70 border border-stone-800/60 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-emerald-300 font-bold">X#1 - X#3</span>
                <span className="text-stone-400 font-sans text-[10px]">Priority 1 - 3</span>
              </div>
              <div className="flex items-center justify-between pt-0.5">
                <span className="text-emerald-300 font-bold">X#4 - X#7</span>
                <span className="text-stone-400 font-sans text-[10px]">Generic</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {additionalPts.length === 0 ? (
          <div className="text-center p-6 text-stone-500 italic text-xs bg-stone-900/50 rounded-lg border border-stone-800 space-y-1">
            <div>No additional points defined.</div>
            <div className="text-[11px] text-stone-400">
              Click &ldquo;Add Additional Point&rdquo; above or right-click anywhere on the map
              and choose &ldquo;Add Additional Point&rdquo;.
            </div>
          </div>
        ) : (
          additionalPts.map(({ wp, globalIndex }) => (
            <div
              key={globalIndex}
              className="p-2.5 rounded-lg bg-stone-900/80 border border-stone-800 hover:border-purple-500/30 transition-all flex items-center justify-between gap-3 flex-wrap"
            >
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-stone-950 border border-stone-800 text-purple-300 font-mono">
                  Plan {wp.sequence || 1}
                </span>

                <div className="flex items-center gap-1">
                  <label className="text-[10px] text-stone-500 font-bold uppercase">Name:</label>
                  <input
                    type="text"
                    maxLength={10}
                    disabled={!canEdit}
                    value={wp.name || ''}
                    onChange={(e) =>
                      onUpdatePoint(globalIndex, {
                        name: e.target.value.toUpperCase().trim(),
                      })
                    }
                    className="w-28 bg-stone-950 border border-stone-800 rounded px-2 py-1 text-xs font-mono font-bold text-stone-100 uppercase"
                    placeholder="AP1"
                  />
                </div>

                <div className="flex items-center gap-1">
                  <label className="text-[10px] text-stone-500 font-bold uppercase">Elev:</label>
                  <input
                    type="number"
                    disabled={!canEdit}
                    value={wp.alt ?? 0}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 0;
                      onUpdatePoint(globalIndex, { alt: val, elev: val });
                    }}
                    className="w-20 bg-stone-950 border border-stone-800 rounded px-2 py-1 text-xs font-mono text-stone-200 text-right"
                  />
                  <span className="text-[10px] text-stone-500 font-mono">ft</span>
                </div>

                <div className="hidden sm:block text-[10px] font-mono text-stone-400">
                  {Number(wp.lat).toFixed(4)}, {Number(wp.lng).toFixed(4)}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => onCenterMap(Number(wp.lat), Number(wp.lng), 11)}
                  className="p-1.5 rounded hover:bg-stone-800 text-purple-400 hover:text-purple-300 cursor-pointer"
                  title="Pan to point on map"
                >
                  <Crosshair className="size-4" weight="duotone" />
                </button>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Delete additional point ${wp.name}?`)) {
                        onDeletePoint(globalIndex);
                      }
                    }}
                    className="p-1.5 rounded hover:bg-stone-800 text-stone-400 hover:text-red-400 cursor-pointer"
                    title="Delete additional point"
                  >
                    <Trash className="size-4" weight="duotone" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// ============================================================================
// 6. JF-17 CUSTOM AIRSPACE TAB (BKYA-BKYD)
// ============================================================================

interface Jf17AirspaceTabProps extends SharedAvionicsProps {
  onExportJf17Lua?: () => void;
}

export const Jf17AirspaceTab: React.FC<Jf17AirspaceTabProps> = ({
  plan,
  mapData,
  canEdit,
  activeDrawTarget,
  onSetDrawTarget,
  onMutatePlan,
  onExportJf17Lua,
  onNotify,
}) => {
  const airspace = useMemo(() => {
    const raw = (plan.jf17_airspace_settings || {}) as Record<string, any>;
    const out: Record<'BKYA' | 'BKYB' | 'BKYC' | 'BKYD', { color: string; closed: boolean; points: any[] }> = {
      BKYA: { color: JF17_DEFAULT_COLORS.BKYA, closed: false, points: [] },
      BKYB: { color: JF17_DEFAULT_COLORS.BKYB, closed: false, points: [] },
      BKYC: { color: JF17_DEFAULT_COLORS.BKYC, closed: false, points: [] },
      BKYD: { color: JF17_DEFAULT_COLORS.BKYD, closed: false, points: [] },
    };
    (['BKYA', 'BKYB', 'BKYC', 'BKYD'] as const).forEach((k) => {
      const ex = raw[k] ?? raw[k.toLowerCase()];
      if (Array.isArray(ex)) out[k].points = ex;
      else if (ex && typeof ex === 'object') {
        out[k] = {
          color: ex.color || JF17_DEFAULT_COLORS[k],
          closed: Boolean(ex.closed),
          points: Array.isArray(ex.points) ? ex.points : [],
        };
      }
    });
    return out;
  }, [plan.jf17_airspace_settings]);

  const aorPresets = useMemo(() => getAvailableAorPresetsFromMapData(mapData), [mapData]);
  const totalPts =
    airspace.BKYA.points.length +
    airspace.BKYB.points.length +
    airspace.BKYC.points.length +
    airspace.BKYD.points.length;

  const commitJf17 = (next: typeof airspace) => {
    onMutatePlan((p) => ({ ...p, jf17_airspace_settings: next }));
  };

  const handleImportFrontLine = () => {
    const flPts = extractFrontLinePoints(mapData.frontLine, 25);
    if (flPts.length === 0) {
      onNotify('warning', 'No Front Line coordinates available in campaign');
      return;
    }
    commitJf17({
      ...airspace,
      BKYA: {
        ...airspace.BKYA,
        points: flPts.map((pt, idx) => ({
          name: `FLOT ${idx + 1}`,
          lat: pt.lat,
          lng: pt.lng,
          line: 'BKYA',
        })),
      },
    });
  };

  return (
    <div className="space-y-3">
      <div className="p-3 rounded-lg bg-stone-900/90 border border-stone-800 space-y-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/60">
              <Polygon className="size-5" weight="duotone" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-stone-200">
                JF-17 Custom Airspace (BKYA–BKYD)
              </h3>
              <p className="text-[10px] text-stone-400">
                Boundary &amp; operational airspace lines for JF-17 avionics (4 lines total)
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold px-2.5 py-1 rounded border bg-cyan-950/60 text-cyan-300 border-cyan-800/40">
            {totalPts} Pts Total
          </span>
        </div>

        <div className="p-2.5 rounded bg-stone-950/70 border border-stone-800 text-[11px] text-stone-300 flex items-start gap-2">
          <Info className="size-4 text-cyan-400 shrink-0 mt-0.5" weight="duotone" />
          <div>
            <strong className="text-stone-200">
              Line 1 (BKYA) is predefined as the Campaign Front Line (FLOT).
            </strong>
            <span className="text-stone-400">
              {' '}
              Lines 2 through 4 (BKYB, BKYC, BKYD) can be drawn or loaded from presets. Closed loops
              require 3 or more points.
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
          {canEdit && (
            <button
              type="button"
              onClick={handleImportFrontLine}
              className="px-2.5 py-1.5 rounded text-xs font-bold bg-rose-950/80 hover:bg-rose-900/80 text-rose-300 border border-rose-800/60 flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowsClockwise className="size-3.5" weight="duotone" />
              <span>Import Mission Front Line into BKYA</span>
            </button>
          )}

          {onExportJf17Lua && (
            <button
              type="button"
              onClick={onExportJf17Lua}
              className="px-2.5 py-1.5 rounded text-xs font-bold bg-cyan-950/80 hover:bg-cyan-900/80 text-cyan-300 border border-cyan-700/60 flex items-center gap-1.5 cursor-pointer"
            >
              <FileCode className="size-3.5 text-cyan-400" weight="duotone" />
              <span>Install / Export Custom Airspace (.lua)</span>
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {(['BKYA', 'BKYB', 'BKYC', 'BKYD'] as const).map((lineKey) => {
          const cfg = airspace[lineKey];
          const closed = cfg.closed && cfg.points.length >= 3;
          const drawTgt: AvionicsDrawTarget = { kind: 'jf17_airspace', key: lineKey };
          const isDrawing = avionicsDrawTargetsEqual(activeDrawTarget, drawTgt);

          return (
            <div
              key={lineKey}
              style={{ borderColor: `${cfg.color}60` }}
              className="p-3 rounded-lg bg-stone-900/90 border space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/20"
                    style={{
                      backgroundColor: cfg.color,
                      boxShadow: `0 0 8px ${cfg.color}80`,
                    }}
                  />
                  <span className="text-xs font-bold text-stone-200">
                    {lineKey === 'BKYA'
                      ? 'Line 1 (BKYA - Front Line / FLOT)'
                      : lineKey === 'BKYB'
                        ? 'Line 2 (BKYB)'
                        : lineKey === 'BKYC'
                          ? 'Line 3 (BKYC)'
                          : 'Line 4 (BKYD)'}
                  </span>
                  <span className="text-[10px] font-mono text-stone-400">
                    ({cfg.points.length} pts)
                  </span>
                  {closed && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-cyan-950 border border-cyan-500/50 text-cyan-300 font-bold">
                      Closed Loop
                    </span>
                  )}
                </div>

                {canEdit && (
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                    <div
                      className="flex items-center gap-1 bg-stone-950 border border-stone-800 rounded px-1.5 py-0.5"
                      title="Change line color"
                    >
                      <input
                        type="color"
                        value={cfg.color}
                        onChange={(e) =>
                          commitJf17({
                            ...airspace,
                            [lineKey]: { ...cfg, color: e.target.value },
                          })
                        }
                        className="w-4 h-4 rounded cursor-pointer bg-transparent border-0 p-0"
                      />
                      <span className="text-[9px] font-mono text-stone-400 uppercase">
                        {cfg.color}
                      </span>
                    </div>

                    {aorPresets.length > 0 && (
                      <select
                        value=""
                        onChange={(e) => {
                          const preset = aorPresets.find((x) => x.id === e.target.value);
                          if (!preset) return;
                          commitJf17({
                            ...airspace,
                            [lineKey]: {
                              ...cfg,
                              points: preset.points.map((pt, idx) => ({
                                name: pt.name || `${preset.name} ${idx + 1}`,
                                lat: pt.lat,
                                lng: pt.lng,
                                line: lineKey,
                              })),
                            },
                          });
                        }}
                        className="bg-stone-950 border border-stone-700 rounded px-2 py-1 text-[11px] text-stone-200"
                      >
                        <option value="">Load Preset...</option>
                        {aorPresets.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.points.length} pts)
                          </option>
                        ))}
                      </select>
                    )}

                    <button
                      type="button"
                      onClick={() => onSetDrawTarget(isDrawing ? null : drawTgt)}
                      className={`px-2 py-1 rounded text-xs font-bold flex items-center gap-1 cursor-pointer ${
                        isDrawing
                          ? 'bg-amber-500 text-stone-950'
                          : 'bg-stone-800 hover:bg-stone-700 text-cyan-400 border border-cyan-500/30'
                      }`}
                    >
                      <PencilSimpleLine className="size-3.5" weight="duotone" />
                      <span>{isDrawing ? 'Stop Draw' : 'Draw on Map'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={cfg.points.length < 3}
                      onClick={() =>
                        commitJf17({
                          ...airspace,
                          [lineKey]: { ...cfg, closed: !cfg.closed },
                        })
                      }
                      className={`px-2 py-1 rounded text-xs font-bold flex items-center gap-1 border cursor-pointer disabled:opacity-40 ${
                        closed
                          ? 'bg-cyan-950/80 border-cyan-500/50 text-cyan-300'
                          : 'bg-stone-800 hover:bg-stone-700 text-stone-300 border-stone-700'
                      }`}
                    >
                      {closed ? (
                        <>
                          <CheckSquare className="size-3.5 text-cyan-400" weight="duotone" />
                          <span>Closed Loop</span>
                        </>
                      ) : (
                        <>
                          <Polygon className="size-3.5 text-stone-400" weight="duotone" />
                          <span>Close Loop</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        commitJf17({ ...airspace, [lineKey]: { ...cfg, points: [] } })
                      }
                      className="p-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-stone-200 cursor-pointer"
                    >
                      <Eraser className="size-3.5" weight="duotone" />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {cfg.points.length === 0 ? (
                  <span className="text-[11px] text-stone-500 italic">
                    No points in this line. Click &ldquo;Draw on Map&rdquo; or load a preset above.
                  </span>
                ) : (
                  cfg.points.map((pt, pIdx) => (
                    <div
                      key={pIdx}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-stone-950 border border-stone-800 font-mono text-[10px] text-stone-300"
                    >
                      <span className="font-bold text-cyan-400">P{pIdx + 1}</span>
                      <span className="text-stone-400 truncate max-w-[85px]">
                        {pt.name || `Pt ${pIdx + 1}`}
                      </span>
                      <span className="text-stone-500">
                        {Number(pt.lat).toFixed(3)}, {Number(pt.lng).toFixed(3)}
                      </span>
                      {canEdit && (
                        <>
                          <div className="flex items-center gap-0.5 ml-1 border-l border-stone-800 pl-1">
                            {(['BKYA', 'BKYB', 'BKYC', 'BKYD'] as const)
                              .filter((k) => k !== lineKey)
                              .map((targetKey) => (
                                <button
                                  key={targetKey}
                                  type="button"
                                  onClick={() => {
                                    const copy = [...cfg.points];
                                    const [moved] = copy.splice(pIdx, 1);
                                    moved.line = targetKey;
                                    commitJf17({
                                      ...airspace,
                                      [lineKey]: { ...cfg, points: copy },
                                      [targetKey]: {
                                        ...airspace[targetKey],
                                        points: [...airspace[targetKey].points, moved],
                                      },
                                    });
                                  }}
                                  className="px-1 py-0.2 rounded text-[8px] font-bold text-stone-500 hover:text-stone-100 hover:bg-stone-800 uppercase cursor-pointer"
                                >
                                  {targetKey.slice(-1)}
                                </button>
                              ))}
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              commitJf17({
                                ...airspace,
                                [lineKey]: {
                                  ...cfg,
                                  points: cfg.points.filter((_, i) => i !== pIdx),
                                },
                              })
                            }
                            className="text-stone-500 hover:text-red-400 ml-0.5 cursor-pointer"
                          >
                            <X className="size-2.5" weight="bold" />
                          </button>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
