import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowCounterClockwise,
  ArrowsClockwise,
  BoundingBox,
  Broadcast,
  Camera,
  Check,
  Circle,
  CircleHalf,
  Copy,
  Crosshair,
  Eye,
  FloppyDisk,
  MagnifyingGlassPlus,
  MapPin,
  MoonStars,
  PencilSimple,
  Plus,
  Polygon,
  ShieldWarning,
  Sliders,
  SunDim,
  Target,
  TextT,
  Trash,
  X,
} from '@phosphor-icons/react';
import {
  deleteCampaignIsrRequest,
  deleteCampaignIsrTarget,
  deleteCampaignTacticalMarking,
  invalidateCampaignIsrRequest,
  revalidateCampaignIsrRequest,
  retryCampaignIsrRequest,
  saveCampaignIsrTarget,
  saveCampaignSupportAssets,
  saveCampaignTacticalMarking,
  saveCampaignThreats,
  submitCampaignIsrRequest,
  updateCampaignIsrRequestMission,
} from '../../../services/campaignMapService';
import {
  CampaignMapIsrRequest,
  CampaignMapIsrTarget,
  CampaignMapPayload,
  CampaignMapSupportAsset,
  CampaignMapTacticalMarking,
  CampaignMapThreat,
  FlightPlanDetail,
} from '../../../types';
import { FloatingToolWindow } from './FloatingToolWindow';
import {
  formatCoordinateDdm,
  formatCoordinateDec,
  formatCoordinateDms,
  toMgrs,
} from './geodesy';
import { IsrActiveOverlayState, resolveIsrVariants } from './portalLayers';

interface SharedDrawerProps {
  apiBaseUrl: string;
  discordId?: string | null;
  token?: string | null;
  mapData: CampaignMapPayload;
  onCenterMap: (lat: number, lng: number, zoom?: number) => void;
  onNotify: (level: 'info' | 'success' | 'warning' | 'error', msg: string) => void;
  zIndex?: number;
  onFocus?: () => void;
}

/* ============================================================================
 * 1. THREAT EDITOR DRAWER (Floating Draggable Window)
 * ========================================================================== */
interface ThreatEditorDrawerProps extends SharedDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  pickedCoords: { lat: number; lng: number } | null;
  isPicking: boolean;
  onTogglePicking: () => void;
  onThreatsChange: (threats: CampaignMapThreat[]) => void;
  focusThreatIndex?: number | null;
}

export const ThreatEditorDrawer: React.FC<ThreatEditorDrawerProps> = ({
  isOpen,
  onClose,
  zIndex = 1140,
  onFocus,
  apiBaseUrl,
  discordId,
  token,
  mapData,
  pickedCoords,
  isPicking,
  onTogglePicking,
  onThreatsChange,
  onCenterMap,
  onNotify,
  focusThreatIndex,
}) => {
  const [draftThreats, setDraftThreats] = useState<CampaignMapThreat[]>(mapData.threats);
  const [removedIds, setRemovedIds] = useState<number[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setDraftThreats(mapData.threats);
    setRemovedIds([]);
  }, [mapData.threats]);

  useEffect(() => {
    if (focusThreatIndex !== undefined && focusThreatIndex !== null) {
      setSelectedIndex(focusThreatIndex);
    }
  }, [focusThreatIndex]);

  useEffect(() => {
    if (!pickedCoords || !isOpen) return;
    if (selectedIndex !== null && draftThreats[selectedIndex]) {
      setDraftThreats((prev) =>
        prev.map((t, idx) =>
          idx === selectedIndex ? { ...t, lat: pickedCoords.lat, lng: pickedCoords.lng } : t
        )
      );
    } else {
      const defaultSam = mapData.samSystems[0];
      const newThreat: CampaignMapThreat = {
        type: 'sam',
        sam_system_id: defaultSam?.id ?? null,
        sam_name: defaultSam?.name ?? 'SAM Site',
        range: defaultSam?.max_range ?? 20,
        range_m: (defaultSam?.max_range ?? 20) * 1852,
        color: defaultSam?.color ?? '#ef4444',
        title: `SAM-${draftThreats.length + 1}`,
        lat: pickedCoords.lat,
        lng: pickedCoords.lng,
        is_visible: true,
      };
      setDraftThreats((prev) => {
        const next = [...prev, newThreat];
        setSelectedIndex(next.length - 1);
        return next;
      });
    }
  }, [pickedCoords, isOpen]);

  const selectedThreat = selectedIndex !== null ? draftThreats[selectedIndex] : null;

  const handleAddThreat = () => {
    const defaultSam = mapData.samSystems[0];
    const nextItem: CampaignMapThreat = {
      type: 'sam',
      sam_system_id: defaultSam?.id ?? null,
      sam_name: defaultSam?.name ?? 'SAM Site',
      range: defaultSam?.max_range ?? 20,
      range_m: (defaultSam?.max_range ?? 20) * 1852,
      color: defaultSam?.color ?? '#ef4444',
      title: `THREAT-${draftThreats.length + 1}`,
      lat: mapData.campaign.center.lat,
      lng: mapData.campaign.center.lng,
      is_visible: true,
    };
    setDraftThreats((prev) => {
      const next = [...prev, nextItem];
      setSelectedIndex(next.length - 1);
      return next;
    });
  };

  const handleRemove = (idx: number) => {
    const target = draftThreats[idx];
    if (target?.id) {
      setRemovedIds((prev) => [...prev, target.id!]);
    }
    setDraftThreats((prev) => prev.filter((_, i) => i !== idx));
    setSelectedIndex(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const saved = await saveCampaignThreats(
        apiBaseUrl,
        mapData.campaign.id,
        draftThreats,
        removedIds,
        { discordId, token }
      );
      onThreatsChange(saved);
      setRemovedIds([]);
      onNotify('success', `Saved ${saved.length} campaign threat sites.`);
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to save threats.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <FloatingToolWindow
      title={`Threat Manager (${draftThreats.length})`}
      icon={<ShieldWarning className="w-4 h-4 text-red-400" weight="duotone" />}
      isOpen={isOpen}
      onClose={onClose}
      initialPos={{ x: 80, y: 90 }}
      widthClass="w-[390px] max-w-[92vw]"
      zIndex={zIndex}
      onFocus={onFocus}
    >
      <div className="p-3.5 space-y-3 overflow-y-auto text-xs">
        {!mapData.permissions.canManageThreats && (
          <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/50 text-amber-300 text-[11px]">
            Read-only: You need Threat Manager permission on the portal to commit changes.
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <button
            onClick={onTogglePicking}
            disabled={!mapData.permissions.canManageThreats}
            className={`flex-1 py-1.5 px-2.5 rounded-lg border font-semibold flex items-center justify-center gap-1 cursor-pointer ${
              isPicking
                ? 'bg-red-500/25 border-red-500 text-red-200'
                : 'bg-stone-900 border-stone-700 text-stone-200'
            } disabled:opacity-40`}
          >
            <MapPin className="w-3.5 h-3.5" />
            {isPicking ? 'Click Map to Place' : 'Place on Map'}
          </button>
          <button
            onClick={handleAddThreat}
            disabled={!mapData.permissions.canManageThreats}
            className="px-2.5 py-1.5 rounded-lg bg-stone-900 border border-stone-700 text-stone-200 hover:border-amber-500/50 font-semibold flex items-center gap-1 disabled:opacity-40 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !mapData.permissions.canManageThreats}
            className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-emerald-300 font-bold flex items-center gap-1 disabled:opacity-40 cursor-pointer"
          >
            <FloppyDisk className="w-3.5 h-3.5" /> Save
          </button>
        </div>

        {selectedThreat && (
          <div className="bg-stone-900/80 border border-red-900/50 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-red-300 uppercase">
                Editing #{selectedIndex! + 1}
              </span>
              <button
                onClick={() => setSelectedIndex(null)}
                className="text-[11px] text-stone-400 hover:text-stone-200 cursor-pointer"
              >
                Done
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-stone-400 uppercase mb-0.5">Title</label>
                <input
                  type="text"
                  value={selectedThreat.title || ''}
                  onChange={(e) =>
                    setDraftThreats((prev) =>
                      prev.map((t, i) => (i === selectedIndex ? { ...t, title: e.target.value } : t))
                    )
                  }
                  className="w-full px-2 py-1 rounded bg-stone-950 border border-stone-800 text-stone-100"
                />
              </div>
              <div>
                <label className="block text-[10px] text-stone-400 uppercase mb-0.5">Type</label>
                <select
                  value={selectedThreat.type}
                  onChange={(e) =>
                    setDraftThreats((prev) =>
                      prev.map((t, i) => (i === selectedIndex ? { ...t, type: e.target.value } : t))
                    )
                  }
                  className="w-full px-2 py-1 rounded bg-stone-950 border border-stone-800 text-stone-100"
                >
                  {mapData.threatTypes.map((tt) => (
                    <option key={tt.value} value={tt.value}>
                      {tt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="block text-[10px] text-stone-400 uppercase mb-0.5">
                  SAM System Template
                </label>
                <select
                  value={selectedThreat.sam_system_id ?? ''}
                  onChange={(e) => {
                    const samId = e.target.value ? Number(e.target.value) : null;
                    const sam = mapData.samSystems.find((s) => s.id === samId);
                    setDraftThreats((prev) =>
                      prev.map((t, i) =>
                        i === selectedIndex
                          ? {
                              ...t,
                              sam_system_id: samId,
                              sam_name: sam?.name ?? null,
                              range: sam?.max_range ?? 0,
                              range_m: (sam?.max_range ?? 0) * 1852,
                              color: sam?.color ?? t.color,
                            }
                          : t
                      )
                    );
                  }}
                  className="w-full px-2 py-1 rounded bg-stone-950 border border-stone-800 text-stone-100"
                >
                  <option value="">-- Generic / Non-SAM --</option>
                  {mapData.samSystems.map((sam) => (
                    <option key={sam.id} value={sam.id}>
                      {sam.name} ({sam.max_range} NM)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-stone-400 uppercase mb-0.5">
                  HDG (°)
                </label>
                <input
                  type="number"
                  min={0}
                  max={360}
                  value={selectedThreat.heading ?? ''}
                  placeholder="0-360"
                  onChange={(e) =>
                    setDraftThreats((prev) =>
                      prev.map((t, i) =>
                        i === selectedIndex
                          ? {
                              ...t,
                              heading: e.target.value === '' ? null : Number(e.target.value),
                            }
                          : t
                      )
                    )
                  }
                  className="w-full px-2 py-1 rounded bg-stone-950 border border-stone-800 text-stone-100 font-mono"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] text-stone-400 uppercase mb-0.5">
                Intel Notes
              </label>
              <textarea
                rows={2}
                value={selectedThreat.description || ''}
                onChange={(e) =>
                  setDraftThreats((prev) =>
                    prev.map((t, i) =>
                      i === selectedIndex ? { ...t, description: e.target.value } : t
                    )
                  )
                }
                className="w-full px-2 py-1 rounded bg-stone-950 border border-stone-800 text-stone-100"
              />
            </div>
          </div>
        )}

        <div className="space-y-1.5 max-h-[340px] overflow-y-auto pr-1">
          {draftThreats.map((t, idx) => (
            <div
              key={`${t.id ?? 'new'}-${idx}`}
              onClick={() => setSelectedIndex(idx)}
              className={`cursor-pointer rounded-lg border px-2.5 py-2 flex items-center justify-between gap-2 transition ${
                selectedIndex === idx
                  ? 'bg-red-950/30 border-red-500/60'
                  : 'bg-stone-900/60 border-stone-800 hover:border-stone-700'
              }`}
            >
              <div className="min-w-0">
                <div className="font-semibold text-stone-100 truncate">
                  {t.title || t.sam_name || t.type.toUpperCase()}
                </div>
                <div className="text-[10px] font-mono text-stone-400 truncate">
                  {t.sam_name ? `${t.sam_name} (${t.range} NM)` : t.type.toUpperCase()} ·{' '}
                  {formatCoordinateDdm(t.lat, t.lng)}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => onCenterMap(t.lat, t.lng, 11)}
                  className="p-1 text-stone-400 hover:text-amber-300 cursor-pointer"
                  title="Center Map"
                >
                  <Crosshair className="w-3.5 h-3.5" />
                </button>
                {mapData.permissions.canManageThreats && (
                  <button
                    onClick={() => handleRemove(idx)}
                    className="p-1 text-stone-400 hover:text-red-400 cursor-pointer"
                    title="Delete Threat"
                  >
                    <Trash className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </FloatingToolWindow>
  );
};

/* ============================================================================
 * 2. SUPPORT ASSETS DRAWER (Floating Draggable Window)
 * ========================================================================== */
interface SupportAssetsDrawerProps extends SharedDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  pickedCoords: { lat: number; lng: number } | null;
  isPicking: boolean;
  onTogglePicking: () => void;
  onAssetsChange: (assets: CampaignMapSupportAsset[]) => void;
  focusAssetIndex?: number | null;
}

export const SupportAssetsDrawer: React.FC<SupportAssetsDrawerProps> = ({
  isOpen,
  onClose,
  zIndex = 1140,
  onFocus,
  apiBaseUrl,
  discordId,
  token,
  mapData,
  pickedCoords,
  isPicking,
  onTogglePicking,
  onAssetsChange,
  onCenterMap,
  onNotify,
  focusAssetIndex,
}) => {
  const [draftAssets, setDraftAssets] = useState<CampaignMapSupportAsset[]>(mapData.supportAssets);
  const [removedIds, setRemovedIds] = useState<number[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setDraftAssets(mapData.supportAssets);
    setRemovedIds([]);
  }, [mapData.supportAssets]);

  useEffect(() => {
    if (focusAssetIndex !== undefined && focusAssetIndex !== null) {
      setSelectedIndex(focusAssetIndex);
    }
  }, [focusAssetIndex]);

  useEffect(() => {
    if (!pickedCoords || !isOpen) return;
    if (selectedIndex !== null && draftAssets[selectedIndex]) {
      setDraftAssets((prev) =>
        prev.map((a, idx) =>
          idx === selectedIndex ? { ...a, lat: pickedCoords.lat, lng: pickedCoords.lng } : a
        )
      );
    } else {
      const nextAsset: CampaignMapSupportAsset = {
        type: 'tanker',
        title: `TEXACO ${draftAssets.length + 1}-1`,
        aircraft_type: 'KC-135',
        lat: pickedCoords.lat,
        lng: pickedCoords.lng,
        heading: 90,
        leg_length: 25,
        altitude: 22000,
        speed: 310,
        tacan_channel: '41Y',
        radio_freq: '251.000',
      };
      setDraftAssets((prev) => {
        const next = [...prev, nextAsset];
        setSelectedIndex(next.length - 1);
        return next;
      });
    }
  }, [pickedCoords, isOpen]);

  const selectedAsset = selectedIndex !== null ? draftAssets[selectedIndex] : null;

  const handleAdd = () => {
    const nextAsset: CampaignMapSupportAsset = {
      type: 'tanker',
      title: `SHELL ${draftAssets.length + 1}-1`,
      aircraft_type: 'KC-135 MPRS',
      lat: mapData.campaign.center.lat,
      lng: mapData.campaign.center.lng,
      heading: 90,
      leg_length: 25,
      altitude: 21000,
      speed: 305,
      tacan_channel: '42Y',
      radio_freq: '252.000',
    };
    setDraftAssets((prev) => {
      const next = [...prev, nextAsset];
      setSelectedIndex(next.length - 1);
      return next;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const saved = await saveCampaignSupportAssets(
        apiBaseUrl,
        mapData.campaign.id,
        draftAssets,
        removedIds,
        { discordId, token }
      );
      onAssetsChange(saved);
      setRemovedIds([]);
      onNotify('success', `Saved ${saved.length} support assets.`);
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to save support assets.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <FloatingToolWindow
      title={`Support Assets (${draftAssets.length})`}
      icon={<Broadcast className="w-4 h-4 text-sky-400" weight="duotone" />}
      isOpen={isOpen}
      onClose={onClose}
      initialPos={{ x: 95, y: 95 }}
      widthClass="w-[390px] max-w-[92vw]"
      zIndex={zIndex}
      onFocus={onFocus}
    >
      <div className="p-3.5 space-y-3 overflow-y-auto text-xs">
        <div className="flex items-center gap-1.5">
          <button
            onClick={onTogglePicking}
            disabled={!mapData.permissions.canManageSupportAssets}
            className={`flex-1 py-1.5 px-2.5 rounded-lg border font-semibold flex items-center justify-center gap-1 cursor-pointer ${
              isPicking
                ? 'bg-emerald-500/25 border-emerald-500 text-emerald-200'
                : 'bg-stone-900 border-stone-700 text-stone-200'
            } disabled:opacity-40`}
          >
            <MapPin className="w-3.5 h-3.5" />
            {isPicking ? 'Click Orbit Anchor' : 'Place Anchor'}
          </button>
          <button
            onClick={handleAdd}
            disabled={!mapData.permissions.canManageSupportAssets}
            className="px-2.5 py-1.5 rounded-lg bg-stone-900 border border-stone-700 text-stone-200 font-semibold flex items-center gap-1 disabled:opacity-40 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !mapData.permissions.canManageSupportAssets}
            className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-emerald-300 font-bold flex items-center gap-1 disabled:opacity-40 cursor-pointer"
          >
            <FloppyDisk className="w-3.5 h-3.5" /> Save
          </button>
        </div>

        {selectedAsset && (
          <div className="bg-stone-900/80 border border-sky-900/50 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-sky-300 uppercase">
                Editing {selectedAsset.title || `Asset #${selectedIndex! + 1}`}
              </span>
              <button
                onClick={() => setSelectedIndex(null)}
                className="text-[11px] text-stone-400 hover:text-stone-200 cursor-pointer"
              >
                Done
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Callsign"
                value={selectedAsset.title || ''}
                onChange={(e) =>
                  setDraftAssets((prev) =>
                    prev.map((a, i) => (i === selectedIndex ? { ...a, title: e.target.value } : a))
                  )
                }
                className="px-2 py-1 rounded bg-stone-950 border border-stone-800 text-stone-100"
              />
              <select
                value={selectedAsset.type}
                onChange={(e) =>
                  setDraftAssets((prev) =>
                    prev.map((a, i) => (i === selectedIndex ? { ...a, type: e.target.value } : a))
                  )
                }
                className="px-2 py-1 rounded bg-stone-950 border border-stone-800 text-stone-100"
              >
                {mapData.supportAssetTypes.map((st) => (
                  <option key={st.value} value={st.value}>
                    {st.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              <div>
                <label className="text-[9px] text-stone-500 block">HDG (°T)</label>
                <input
                  type="number"
                  value={selectedAsset.heading ?? 0}
                  onChange={(e) =>
                    setDraftAssets((prev) =>
                      prev.map((a, i) =>
                        i === selectedIndex ? { ...a, heading: Number(e.target.value) } : a
                      )
                    )
                  }
                  className="w-full px-2 py-1 rounded bg-stone-950 border border-stone-800 font-mono text-stone-100"
                />
              </div>
              <div>
                <label className="text-[9px] text-stone-500 block">Leg (NM)</label>
                <input
                  type="number"
                  value={selectedAsset.leg_length ?? 20}
                  onChange={(e) =>
                    setDraftAssets((prev) =>
                      prev.map((a, i) =>
                        i === selectedIndex ? { ...a, leg_length: Number(e.target.value) } : a
                      )
                    )
                  }
                  className="w-full px-2 py-1 rounded bg-stone-950 border border-stone-800 font-mono text-stone-100"
                />
              </div>
              <div>
                <label className="text-[9px] text-stone-500 block">Alt (ft)</label>
                <input
                  type="number"
                  value={selectedAsset.altitude ?? 22000}
                  onChange={(e) =>
                    setDraftAssets((prev) =>
                      prev.map((a, i) =>
                        i === selectedIndex ? { ...a, altitude: Number(e.target.value) } : a
                      )
                    )
                  }
                  className="w-full px-2 py-1 rounded bg-stone-950 border border-stone-800 font-mono text-stone-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="TACAN (e.g. 41Y)"
                value={selectedAsset.tacan_channel || ''}
                onChange={(e) =>
                  setDraftAssets((prev) =>
                    prev.map((a, i) =>
                      i === selectedIndex ? { ...a, tacan_channel: e.target.value } : a
                    )
                  )
                }
                className="px-2 py-1 rounded bg-stone-950 border border-stone-800 font-mono text-stone-100"
              />
              <input
                type="text"
                placeholder="Freq (e.g. 251.000)"
                value={selectedAsset.radio_freq || ''}
                onChange={(e) =>
                  setDraftAssets((prev) =>
                    prev.map((a, i) =>
                      i === selectedIndex ? { ...a, radio_freq: e.target.value } : a
                    )
                  )
                }
                className="px-2 py-1 rounded bg-stone-950 border border-stone-800 font-mono text-stone-100"
              />
            </div>
          </div>
        )}

        <div className="space-y-1.5 max-h-[340px] overflow-y-auto pr-1">
          {draftAssets.map((a, idx) => (
            <div
              key={`${a.id ?? 'new'}-${idx}`}
              onClick={() => setSelectedIndex(idx)}
              className={`cursor-pointer rounded-lg border px-2.5 py-2 flex items-center justify-between gap-2 transition ${
                selectedIndex === idx
                  ? 'bg-sky-950/30 border-sky-500/60'
                  : 'bg-stone-900/60 border-stone-800 hover:border-stone-700'
              }`}
            >
              <div className="min-w-0">
                <div className="font-semibold text-stone-100 truncate">
                  {a.title || a.type.toUpperCase()}
                </div>
                <div className="text-[10px] font-mono text-stone-400 truncate">
                  {a.type.toUpperCase()} · {a.tacan_channel || 'No TCN'} ·{' '}
                  {a.radio_freq || 'No Freq'}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => onCenterMap(a.lat, a.lng, 11)}
                  className="p-1 text-stone-400 hover:text-amber-300 cursor-pointer"
                >
                  <Crosshair className="w-3.5 h-3.5" />
                </button>
                {mapData.permissions.canManageSupportAssets && (
                  <button
                    onClick={() => {
                      if (a.id) setRemovedIds((prev) => [...prev, a.id!]);
                      setDraftAssets((prev) => prev.filter((_, i) => i !== idx));
                      setSelectedIndex(null);
                    }}
                    className="p-1 text-stone-400 hover:text-red-400 cursor-pointer"
                  >
                    <Trash className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </FloatingToolWindow>
  );
};

/* ============================================================================
 * 3. TACTICAL MARKINGS DRAWER (Floating Draggable Window)
 * ========================================================================== */
interface TacticalMarkingsDrawerProps extends SharedDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  draftPoints: Array<{ lat: number; lng: number }>;
  onClearDraftPoints: () => void;
  onUndoDraftPoint: () => void;
  isDrawing: boolean;
  onToggleDrawing: () => void;
  onMarkingsChange: (markings: CampaignMapTacticalMarking[]) => void;
}

export const TacticalMarkingsDrawer: React.FC<TacticalMarkingsDrawerProps> = ({
  isOpen,
  onClose,
  zIndex = 1140,
  onFocus,
  apiBaseUrl,
  discordId,
  token,
  mapData,
  draftPoints,
  onClearDraftPoints,
  onUndoDraftPoint,
  isDrawing,
  onToggleDrawing,
  onMarkingsChange,
  onCenterMap,
  onNotify,
}) => {
  const [shape, setShape] = useState<'marker' | 'text' | 'circle' | 'polyline' | 'polygon' | 'arrow'>('marker');
  const [visibility, setVisibility] = useState<'personal' | 'campaign' | 'mission' | 'sortie'>('personal');
  const [missionId, setMissionId] = useState<number | ''>('');
  const [label, setLabel] = useState('');
  const [color, setColor] = useState('#f59e0b');
  const [radiusNm, setRadiusNm] = useState(5);
  const [selectedIconKey, setSelectedIconKey] = useState<string>('');
  const [isBusy, setIsBusy] = useState(false);

  const isMultiPoint = shape === 'polyline' || shape === 'polygon' || shape === 'arrow';

  const handleSaveMarking = async () => {
    if (draftPoints.length === 0) {
      onNotify('warning', 'Click on the map first to place geometry points.');
      return;
    }
    if (isMultiPoint && draftPoints.length < 2) {
      onNotify('warning', 'Lines, arrows, and polygons need at least 2 points.');
      return;
    }

    setIsBusy(true);
    try {
      const geometry: Record<string, any> = isMultiPoint
        ? {
            type: shape === 'polygon' ? 'Polygon' : 'LineString',
            coordinates:
              shape === 'polygon'
                ? [
                    [
                      ...draftPoints.map((p) => [p.lng, p.lat]),
                      [draftPoints[0].lng, draftPoints[0].lat],
                    ],
                  ]
                : draftPoints.map((p) => [p.lng, p.lat]),
          }
        : {
            type: 'Point',
            coordinates: [draftPoints[0].lng, draftPoints[0].lat],
          };

      const iconObj = mapData.tacticalIcons.find(
        (ic) => (ic.key || ic.id || ic.name) === selectedIconKey
      );

      const saved = await saveCampaignTacticalMarking(
        apiBaseUrl,
        mapData.campaign.id,
        {
          marking_type: shape === 'marker' ? 'icon' : 'drawing',
          visibility,
          mission_id: visibility === 'mission' && missionId ? Number(missionId) : null,
          geometry,
          properties: {
            shape,
            label: label.trim() || shape.toUpperCase(),
            color,
            radius_m: shape === 'circle' ? radiusNm * 1852 : undefined,
            icon_key: iconObj ? iconObj.key || iconObj.id || iconObj.name : undefined,
            icon_svg: iconObj?.svg,
            icon_url: iconObj?.url,
          },
        },
        { discordId, token }
      );
      onMarkingsChange(saved);
      onClearDraftPoints();
      setLabel('');
      onNotify('success', 'Tactical marking saved to campaign overlay.');
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to save tactical marking.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleDelete = async (markingId: number) => {
    setIsBusy(true);
    try {
      const next = await deleteCampaignTacticalMarking(
        apiBaseUrl,
        mapData.campaign.id,
        markingId,
        { discordId, token }
      );
      onMarkingsChange(next);
      onNotify('info', 'Tactical marking removed.');
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to delete tactical marking.');
    } finally {
      setIsBusy(false);
    }
  };

  const getMarkingFocus = (m: CampaignMapTacticalMarking): { lat: number; lng: number } | null => {
    const coords = m.geometry?.coordinates;
    if (!coords) return null;
    if (m.geometry.type === 'Point' && Array.isArray(coords) && coords.length >= 2) {
      return { lat: Number(coords[1]), lng: Number(coords[0]) };
    }
    if (m.geometry.type === 'LineString' && Array.isArray(coords[0])) {
      return { lat: Number(coords[0][1]), lng: Number(coords[0][0]) };
    }
    if (m.geometry.type === 'Polygon' && Array.isArray(coords[0]?.[0])) {
      return { lat: Number(coords[0][0][1]), lng: Number(coords[0][0][0]) };
    }
    return null;
  };

  return (
    <FloatingToolWindow
      title={`Tactical Markings (${mapData.tacticalMarkings.length})`}
      icon={<PencilSimple className="w-4 h-4 text-amber-400" weight="duotone" />}
      isOpen={isOpen}
      onClose={onClose}
      initialPos={{ x: 110, y: 105 }}
      widthClass="w-[390px] max-w-[92vw]"
      zIndex={zIndex}
      onFocus={onFocus}
    >
      <div className="p-3.5 space-y-3 overflow-y-auto text-xs">
        <div className="grid grid-cols-3 gap-1.5">
          {(
            [
              { id: 'marker', label: 'Icon Pin', Icon: MapPin },
              { id: 'text', label: 'Text Callout', Icon: TextT },
              { id: 'circle', label: 'Ring / Zone', Icon: Circle },
              { id: 'polyline', label: 'Phase Line', Icon: PencilSimple },
              { id: 'arrow', label: 'Axis Arrow', Icon: Crosshair },
              { id: 'polygon', label: 'ROZ / AO', Icon: Polygon },
            ] as const
          ).map(({ id, label: lbl, Icon }) => (
            <button
              key={id}
              onClick={() => {
                setShape(id);
                onClearDraftPoints();
              }}
              className={`py-1.5 px-2 rounded-lg border text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer ${
                shape === id
                  ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                  : 'bg-stone-900 border-stone-800 text-stone-300'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {lbl}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] uppercase text-stone-400 font-semibold mb-1">
              Label / Text
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="FEBA / ROZ / IP..."
              className="w-full px-2.5 py-1.5 rounded bg-stone-950 border border-stone-800 text-stone-100"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase text-stone-400 font-semibold mb-1">
              Visibility Scope
            </label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as any)}
              className="w-full px-2 py-1.5 rounded bg-stone-950 border border-stone-800 text-stone-100"
            >
              <option value="personal">Personal Only</option>
              {mapData.permissions.canManageCampaignTacticalMarkings && (
                <option value="campaign">Shared Campaign</option>
              )}
              {mapData.permissions.canManageMissionTacticalMarkings && (
                <option value="mission">Shared Mission</option>
              )}
              {mapData.permissions.canManageSortieTacticalMarkings && (
                <option value="sortie">Shared Sortie</option>
              )}
            </select>
          </div>
        </div>

        {visibility === 'mission' && (
          <select
            value={missionId}
            onChange={(e) => setMissionId(e.target.value ? Number(e.target.value) : '')}
            className="w-full px-2.5 py-1.5 rounded bg-stone-950 border border-stone-800 text-stone-100"
          >
            <option value="">-- Scope to Specific Mission --</option>
            {mapData.missions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        )}

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase text-stone-400 font-semibold">Color</span>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-8 h-7 rounded bg-stone-950 border border-stone-800 cursor-pointer"
            />
          </div>
          {shape === 'circle' && (
            <div className="flex items-center gap-1.5 flex-1">
              <span className="text-[10px] uppercase text-stone-400 font-semibold">Radius (NM)</span>
              <input
                type="number"
                min={0.5}
                step={0.5}
                value={radiusNm}
                onChange={(e) => setRadiusNm(Number(e.target.value) || 1)}
                className="w-20 px-2 py-1 rounded bg-stone-950 border border-stone-800 font-mono text-stone-100"
              />
            </div>
          )}
          {shape === 'marker' && mapData.tacticalIcons.length > 0 && (
            <select
              value={selectedIconKey}
              onChange={(e) => setSelectedIconKey(e.target.value)}
              className="flex-1 min-w-0 px-2 py-1 rounded bg-stone-950 border border-stone-800 text-[11px] text-stone-100"
            >
              <option value="">Standard Pin</option>
              {mapData.tacticalIcons.map((ic, idx) => {
                const k = ic.key || ic.id || ic.name || `icon-${idx}`;
                return (
                  <option key={k} value={k}>
                    {ic.label || ic.name || k}
                  </option>
                );
              })}
            </select>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={onToggleDrawing}
            className={`flex-1 py-1.5 px-2.5 rounded-lg border font-semibold flex items-center justify-center gap-1 cursor-pointer ${
              isDrawing
                ? 'bg-amber-500/25 border-amber-500 text-amber-200'
                : 'bg-stone-900 border-stone-700 text-stone-200'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            {isDrawing ? `Plotting (${draftPoints.length} pts)` : 'Click Map to Plot'}
          </button>
          {draftPoints.length > 0 && (
            <button
              onClick={onUndoDraftPoint}
              className="px-2 py-1.5 rounded-lg bg-stone-900 border border-stone-800 text-stone-300 cursor-pointer"
              title="Undo point"
            >
              Undo
            </button>
          )}
          <button
            onClick={handleSaveMarking}
            disabled={isBusy || draftPoints.length === 0}
            className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-emerald-300 font-bold disabled:opacity-40 cursor-pointer"
          >
            Save
          </button>
        </div>

        <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1 pt-1 border-t border-stone-800/70">
          {mapData.tacticalMarkings.map((m) => {
            const focus = getMarkingFocus(m);
            return (
              <div
                key={m.id}
                className="bg-stone-900/60 border border-stone-800 rounded-lg px-2.5 py-2 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-stone-100 truncate">
                    {m.properties?.label || m.marking_type}
                  </div>
                  <div className="text-[10px] text-stone-400 truncate">
                    {String(m.visibility).toUpperCase()} · {m.creator_name || 'Member'}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {focus && (
                    <button
                      onClick={() => onCenterMap(focus.lat, focus.lng, 11)}
                      className="p-1 text-stone-400 hover:text-amber-300 cursor-pointer"
                    >
                      <Crosshair className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {m.can_edit && (
                    <button
                      onClick={() => handleDelete(m.id)}
                      className="p-1 text-stone-400 hover:text-red-400 cursor-pointer"
                    >
                      <Trash className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </FloatingToolWindow>
  );
};

/* ============================================================================
 * 4. ISR RECON TOOL DRAWER (Floating Window + Live Preview + Map Overlay Controls)
 * ========================================================================== */
interface IsrToolDrawerProps extends SharedDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  pickedCoords: { lat: number; lng: number } | null;
  isPicking: boolean;
  onTogglePicking: () => void;
  onIsrUpdated: (requests: CampaignMapIsrRequest[], balance: number) => void;
  onOpenLightbox: (req: CampaignMapIsrRequest) => void;
  onPreviewChange: (center: { lat: number; lng: number } | null, kmSizes: number[]) => void;
  activeOverlays: Record<number, IsrActiveOverlayState>;
  onToggleOverlay: (req: CampaignMapIsrRequest, url: string) => void;
  onUpdateOverlayStyle: (
    requestId: number,
    patch: Partial<Pick<IsrActiveOverlayState, 'opacity' | 'filter'>>
  ) => void;
}

export const IsrToolDrawer: React.FC<IsrToolDrawerProps> = ({
  isOpen,
  onClose,
  zIndex = 1150,
  onFocus,
  apiBaseUrl,
  discordId,
  token,
  mapData,
  pickedCoords,
  isPicking,
  onTogglePicking,
  onIsrUpdated,
  onOpenLightbox,
  onPreviewChange,
  activeOverlays,
  onToggleOverlay,
  onUpdateOverlayStyle,
  onCenterMap,
  onNotify,
}) => {
  const [lat, setLat] = useState(mapData.campaign.center.lat);
  const [lng, setLng] = useState(mapData.campaign.center.lng);
  const [selectedKmSizes, setSelectedKmSizes] = useState<number[]>([2.5]);
  const [sensor, setSensor] = useState<'eo' | 'whot' | 'bhot'>('eo');
  const [missionId, setMissionId] = useState<number | ''>('');
  const [isBusy, setIsBusy] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [actionBusyId, setActionBusyId] = useState<number | null>(null);

  const onPreviewChangeRef = useRef(onPreviewChange);
  onPreviewChangeRef.current = onPreviewChange;

  const handleUpdateMission = async (isrId: number, nextMissionId: number | null) => {
    setActionBusyId(isrId);
    try {
      const requests = await updateCampaignIsrRequestMission(
        apiBaseUrl,
        mapData.campaign.id,
        isrId,
        nextMissionId,
        { discordId, token }
      );
      onIsrUpdated(requests, mapData.campaign.isrCreditsBalance);
      onNotify('success', nextMissionId ? 'ISR scan linked to mission.' : 'ISR mission link cleared.');
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to update ISR mission assignment.');
    } finally {
      setActionBusyId(null);
    }
  };

  const handleRetryIsr = async (isrId: number) => {
    setActionBusyId(isrId);
    try {
      const requests = await retryCampaignIsrRequest(apiBaseUrl, mapData.campaign.id, isrId, {
        discordId,
        token,
      });
      onIsrUpdated(requests, mapData.campaign.isrCreditsBalance);
      onNotify('success', 'ISR scan re-queued for capture.');
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to retry ISR tasking.');
    } finally {
      setActionBusyId(null);
    }
  };

  const handleToggleInvalidateIsr = async (req: CampaignMapIsrRequest) => {
    setActionBusyId(req.id);
    const expired = Boolean(req.is_expired || req.status === 'expired');
    try {
      const requests = expired
        ? await revalidateCampaignIsrRequest(apiBaseUrl, mapData.campaign.id, req.id, {
            discordId,
            token,
          })
        : await invalidateCampaignIsrRequest(apiBaseUrl, mapData.campaign.id, req.id, {
            discordId,
            token,
          });
      onIsrUpdated(requests, mapData.campaign.isrCreditsBalance);
      onNotify('info', expired ? 'ISR intel revalidated.' : 'ISR intel marked expired.');
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to update ISR validity.');
    } finally {
      setActionBusyId(null);
    }
  };

  const handleDeleteIsr = async (isrId: number) => {
    if (confirmDeleteId !== isrId) {
      setConfirmDeleteId(isrId);
      return;
    }
    setActionBusyId(isrId);
    try {
      const res = await deleteCampaignIsrRequest(apiBaseUrl, mapData.campaign.id, isrId, {
        discordId,
        token,
      });
      onIsrUpdated(res.isrRequests, res.isrCreditsBalance);
      setConfirmDeleteId(null);
      onNotify('info', 'ISR scan deleted (credits refunded if pending/failed).');
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to delete ISR request.');
    } finally {
      setActionBusyId(null);
    }
  };

  useEffect(() => {
    if (pickedCoords && isOpen) {
      setLat(pickedCoords.lat);
      setLng(pickedCoords.lng);
    }
  }, [pickedCoords, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      onPreviewChangeRef.current(null, []);
      return;
    }
    onPreviewChangeRef.current({ lat, lng }, selectedKmSizes);
  }, [isOpen, lat, lng, selectedKmSizes]);

  const toggleKm = (k: number) => {
    setSelectedKmSizes((prev) =>
      prev.includes(k)
        ? prev.length > 1
          ? prev.filter((x) => x !== k)
          : prev
        : [...prev, k]
    );
  };

  const handleSubmit = async () => {
    setIsBusy(true);
    try {
      const res = await submitCampaignIsrRequest(
        apiBaseUrl,
        mapData.campaign.id,
        {
          lat,
          lon: lng,
          km_size: selectedKmSizes[0] || 2.5,
          km_sizes: selectedKmSizes,
          sensor,
          mission_id: missionId ? Number(missionId) : null,
        },
        { discordId, token }
      );
      onIsrUpdated(res.isrRequests, res.isrCreditsBalance);
      onNotify('success', 'ISR reconnaissance scan queued.');
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to queue ISR request.');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <FloatingToolWindow
      title="ISR Satellite Recon"
      subtitle={`Credits: ${mapData.campaign.isrCreditsBalance} ISR`}
      icon={<Camera className="w-4 h-4 text-cyan-400" weight="duotone" />}
      isOpen={isOpen}
      onClose={onClose}
      initialPos={{ x: 460, y: 160 }}
      widthClass="w-[410px] max-w-[94vw]"
      zIndex={zIndex}
      onFocus={onFocus}
    >
      <div className="p-3.5 space-y-3 overflow-y-auto text-xs">
        {mapData.permissions.canRequestIsr ? (
          <div className="bg-stone-900/70 border border-cyan-900/50 rounded-lg p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase text-cyan-300">
                Queue New Recon Pass (16:9 Live Preview)
              </span>
              <button
                onClick={onTogglePicking}
                className={`px-2 py-0.5 rounded border text-[11px] font-semibold flex items-center gap-1 cursor-pointer ${
                  isPicking
                    ? 'bg-cyan-500/25 border-cyan-500 text-cyan-200'
                    : 'bg-stone-950 border-stone-700 text-stone-300'
                }`}
              >
                <MapPin className="w-3 h-3" />
                {isPicking ? 'Click Target Box' : 'Pick Target'}
              </button>
            </div>

            <div className="text-[11px] font-mono text-stone-300 bg-stone-950/70 px-2.5 py-1.5 rounded border border-stone-800 flex justify-between">
              <span>{formatCoordinateDdm(lat, lng)}</span>
              <span className="text-amber-300">{toMgrs(lat, lng, 5)}</span>
            </div>

            <div>
              <label className="block text-[10px] text-stone-400 uppercase mb-1">
                FOV Widths (Multi-Box Preview)
              </label>
              <div className="grid grid-cols-4 gap-1">
                {[1, 2.5, 5, 10].map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => toggleKm(k)}
                    className={`py-1 rounded border text-[11px] font-mono font-bold cursor-pointer ${
                      selectedKmSizes.includes(k)
                        ? 'bg-cyan-500/25 border-cyan-500 text-cyan-200'
                        : 'bg-stone-950 border-stone-800 text-stone-400'
                    }`}
                  >
                    {k} km
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-stone-400 uppercase mb-0.5">
                  Sensor Mode
                </label>
                <select
                  value={sensor}
                  onChange={(e) => setSensor(e.target.value as any)}
                  className="w-full px-2 py-1 rounded bg-stone-950 border border-stone-800 text-stone-100"
                >
                  <option value="eo">EO Optical</option>
                  <option value="whot">WHOT (White Hot)</option>
                  <option value="bhot">BHOT (Black Hot)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-stone-400 uppercase mb-0.5">
                  Mission Tag
                </label>
                <select
                  value={missionId}
                  onChange={(e) => setMissionId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-2 py-1 rounded bg-stone-950 border border-stone-800 text-stone-100"
                >
                  <option value="">-- Optional --</option>
                  {mapData.missions.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={isBusy}
              className="w-full py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-200 font-bold uppercase tracking-wider cursor-pointer"
            >
              Submit ISR Tasking
            </button>
          </div>
        ) : (
          <div className="p-2.5 rounded-lg bg-stone-900 border border-stone-800 text-stone-400 text-[11px]">
            Viewing campaign ISR intelligence feed (Request permission required to queue scans).
          </div>
        )}

        <div className="space-y-1.5 max-h-[340px] overflow-y-auto pr-1">
          {mapData.isrRequests.map((req) => {
            const variants = resolveIsrVariants(req);
            const firstUrl = variants[0]?.url || '';
            const ov = activeOverlays[req.id];
            return (
              <div
                key={req.id}
                className="bg-stone-900/60 border border-stone-800 rounded-lg p-2.5 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-stone-100 truncate">
                    {req.sensor_label || req.sensor.toUpperCase()} · {req.km_size}km Box
                  </div>
                  <span className="px-1.5 py-0.5 rounded bg-stone-950 border border-stone-700 text-[10px] font-bold uppercase text-cyan-300">
                    {req.status_label || req.status}
                  </span>
                </div>
                <div className="text-[10px] font-mono text-stone-400 flex justify-between">
                  <span>{formatCoordinateDdm(req.lat, req.lon)}</span>
                  <span className="text-amber-300">{req.targets.length} Targets</span>
                </div>

                {(mapData.permissions.canManageIsr || mapData.permissions.canRequestIsr) && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-stone-500 uppercase font-semibold shrink-0">
                      Mission
                    </span>
                    <select
                      disabled={actionBusyId === req.id}
                      value={req.mission_id ?? ''}
                      onChange={(e) =>
                        void handleUpdateMission(
                          req.id,
                          e.target.value ? Number(e.target.value) : null
                        )
                      }
                      className="flex-1 min-w-0 px-2 py-0.5 rounded bg-stone-950 border border-stone-800 text-[11px] text-stone-200"
                    >
                      <option value="">-- Unassigned --</option>
                      {mapData.missions.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={() => onCenterMap(req.lat, req.lon, 13)}
                    className="px-2 py-1 rounded bg-stone-950 border border-stone-800 text-stone-300 hover:text-amber-300 text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <Crosshair className="w-3 h-3" /> Center
                  </button>
                  {firstUrl && (
                    <>
                      <button
                        onClick={() => onToggleOverlay(req, firstUrl)}
                        className={`px-2 py-1 rounded border text-[11px] font-semibold cursor-pointer ${
                          ov
                            ? 'bg-rose-950/70 border-rose-700 text-rose-200'
                            : 'bg-sky-950/70 border-sky-700 text-sky-200'
                        }`}
                      >
                        {ov ? 'Hide Map Overlay' : 'Project Overlay'}
                      </button>
                      <button
                        onClick={() => onOpenLightbox(req)}
                        className="px-2.5 py-1 rounded bg-cyan-500/20 border border-cyan-500/50 text-cyan-200 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3 h-3" /> Recon Viewer
                      </button>
                    </>
                  )}
                  {(mapData.permissions.canManageIsr || mapData.permissions.canRequestIsr) &&
                    ['failed', 'expired', 'completed'].includes(req.status) && (
                      <button
                        type="button"
                        disabled={actionBusyId === req.id}
                        onClick={() => void handleRetryIsr(req.id)}
                        className="px-2 py-1 rounded bg-stone-950 border border-stone-800 text-amber-300 hover:border-amber-500/50 text-[11px] flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        title="Retry / Re-run Capture"
                      >
                        <ArrowsClockwise className="w-3 h-3" /> Retry
                      </button>
                    )}
                  {mapData.permissions.canManageIsr && (
                    <>
                      <button
                        type="button"
                        disabled={actionBusyId === req.id}
                        onClick={() => void handleToggleInvalidateIsr(req)}
                        className="px-2 py-1 rounded bg-stone-950 border border-stone-800 text-stone-300 hover:text-amber-300 text-[11px] cursor-pointer disabled:opacity-50"
                      >
                        {req.is_expired || req.status === 'expired' ? 'Revalidate' : 'Invalidate'}
                      </button>
                      <button
                        type="button"
                        disabled={actionBusyId === req.id}
                        onClick={() => void handleDeleteIsr(req.id)}
                        className={`px-2 py-1 rounded border text-[11px] flex items-center gap-1 cursor-pointer disabled:opacity-50 ${
                          confirmDeleteId === req.id
                            ? 'bg-red-500/30 border-red-500 text-red-200 font-bold'
                            : 'bg-stone-950 border-stone-800 text-stone-400 hover:text-red-400 hover:border-red-500/40'
                        }`}
                      >
                        <Trash className="w-3 h-3" />
                        {confirmDeleteId === req.id ? 'Confirm?' : 'Delete'}
                      </button>
                    </>
                  )}
                </div>
                {ov && (
                  <div className="pt-2 border-t border-stone-800 flex items-center gap-2 text-[10px] font-mono">
                    <span className="text-stone-400">Opacity</span>
                    <input
                      type="range"
                      min={0.15}
                      max={1}
                      step={0.05}
                      value={ov.opacity}
                      onChange={(e) =>
                        onUpdateOverlayStyle(req.id, { opacity: Number(e.target.value) })
                      }
                      className="flex-1 accent-cyan-400 cursor-pointer"
                    />
                    <select
                      value={ov.filter}
                      onChange={(e) =>
                        onUpdateOverlayStyle(req.id, { filter: e.target.value as any })
                      }
                      className="px-1.5 py-0.5 rounded bg-stone-950 border border-stone-800 text-cyan-300"
                    >
                      <option value="eo">EO</option>
                      <option value="nvg">NVG</option>
                      <option value="whot">WHOT</option>
                      <option value="night">NIGHT</option>
                    </select>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </FloatingToolWindow>
  );
};

/* ============================================================================
 * 5. GLOBAL ISR LIGHTBOX MODAL (Full Portal Replication with Shaders, Optical Zoom Crop HUD & Vector Tether)
 * ========================================================================== */
interface IsrReconLightboxModalProps {
  isrRequest: CampaignMapIsrRequest | null;
  onClose: () => void;
  campaignIdOrSlug: string | number;
  apiBaseUrl: string;
  discordId?: string | null;
  token?: string | null;
  canMarkup: boolean;
  isrTargetTypes?: Record<string, string> | Array<{ value: string; label: string }>;
  activePlan?: FlightPlanDetail | null;
  onIsrUpdated: (requests: CampaignMapIsrRequest[]) => void;
  onAddTargetToFlightPlan?: (target: { label: string; notes?: string; lat: number; lon: number }) => void;
  onNotify?: (level: 'info' | 'success' | 'warning' | 'error', msg: string) => void;
}

const DEFAULT_ISR_TARGET_TYPES: Array<{ value: string; label: string }> = [
  { value: 'sam site', label: 'SAM Site' },
  { value: 'radar', label: 'Radar / C2' },
  { value: 'armor', label: 'Armored Vehicle' },
  { value: 'artillery', label: 'Artillery Battery' },
  { value: 'command post', label: 'Command Post' },
  { value: 'hvt', label: 'HVT (High Value Target)' },
  { value: 'aircraft', label: 'Aircraft' },
  { value: 'warehouse', label: 'Warehouse' },
  { value: 'fuel', label: 'Fuel Storage' },
  { value: 'ammunition', label: 'Ammunition Depot' },
  { value: 'naval', label: 'Naval Vessel' },
  { value: 'infantry', label: 'Infantry / Personnel' },
  { value: 'unknown', label: 'Unknown Target' },
];

export const IsrReconLightboxModal: React.FC<IsrReconLightboxModalProps> = ({
  isrRequest,
  onClose,
  campaignIdOrSlug,
  apiBaseUrl,
  discordId,
  token,
  canMarkup,
  isrTargetTypes,
  activePlan,
  onIsrUpdated,
  onAddTargetToFlightPlan,
  onNotify,
}) => {
  const [activeVariantIdx, setActiveVariantIdx] = useState(0);
  const [activeFilter, setActiveFilter] = useState<'none' | 'whot' | 'bhot' | 'nvg' | 'ironbow'>('none');
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [nightBoost, setNightBoost] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [markupMode, setMarkupMode] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawBox, setDrawBox] = useState<{
    x_min: number;
    y_min: number;
    x_max: number;
    y_max: number;
  } | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<{
    target?: CampaignMapIsrTarget;
    lat: number;
    lon: number;
    bbox: { x_min: number; y_min: number; x_max: number; y_max: number };
    label: string;
    notes: string;
  } | null>(null);
  const [hoveredTarget, setHoveredTarget] = useState<CampaignMapIsrTarget | null>(null);
  const [copiedFmt, setCopiedFmt] = useState<string | null>(null);
  const [savingTarget, setSavingTarget] = useState(false);
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState(false);

  const anchorRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dotRef = useRef<HTMLDivElement | null>(null);

  const targetTypeOptions = useMemo<Array<{ value: string; label: string }>>(() => {
    if (!isrTargetTypes) return DEFAULT_ISR_TARGET_TYPES;
    if (Array.isArray(isrTargetTypes)) {
      return isrTargetTypes.length > 0 ? isrTargetTypes : DEFAULT_ISR_TARGET_TYPES;
    }
    const entries = Object.entries(isrTargetTypes).map(([value, label]) => ({
      value,
      label: String(label),
    }));
    return entries.length > 0 ? entries : DEFAULT_ISR_TARGET_TYPES;
  }, [isrTargetTypes]);

  useEffect(() => {
    setActiveVariantIdx(0);
    setActiveFilter('none');
    setBrightness(100);
    setContrast(100);
    setNightBoost(false);
    setShowControls(false);
    setZoom(1);
    setMarkupMode(false);
    setDrawBox(null);
    setSelectedTarget(null);
    setHoveredTarget(null);
    setConfirmDeleteTarget(false);
  }, [isrRequest?.id]);

  useEffect(() => {
    setConfirmDeleteTarget(false);
  }, [selectedTarget?.target?.id, selectedTarget?.lat, selectedTarget?.lon]);

  if (!isrRequest) return null;

  const handleSaveTarget = async () => {
    if (!selectedTarget || !canMarkup) return;
    setSavingTarget(true);
    try {
      const res = await saveCampaignIsrTarget(
        apiBaseUrl,
        campaignIdOrSlug,
        isrRequest.id,
        {
          id: selectedTarget.target?.id,
          label: selectedTarget.label || 'unknown',
          notes: selectedTarget.notes || null,
          lat: selectedTarget.lat,
          lon: selectedTarget.lon,
          bbox: selectedTarget.bbox,
        },
        { discordId, token }
      );
      onIsrUpdated(res.isrRequests);
      setSelectedTarget(null);
      setMarkupMode(false);
      onNotify?.('success', 'ISR target annotation saved to campaign database.');
    } catch (err: any) {
      onNotify?.('error', err?.message || 'Failed to save ISR target markup.');
    } finally {
      setSavingTarget(false);
    }
  };

  const handleDeleteTarget = async () => {
    if (!selectedTarget?.target?.id || !canMarkup) return;
    if (!confirmDeleteTarget) {
      setConfirmDeleteTarget(true);
      return;
    }
    setSavingTarget(true);
    try {
      const requests = await deleteCampaignIsrTarget(
        apiBaseUrl,
        campaignIdOrSlug,
        selectedTarget.target.id,
        { discordId, token }
      );
      onIsrUpdated(requests);
      setSelectedTarget(null);
      setConfirmDeleteTarget(false);
      onNotify?.('info', 'ISR target markup deleted.');
    } catch (err: any) {
      onNotify?.('error', err?.message || 'Failed to delete ISR target.');
    } finally {
      setSavingTarget(false);
    }
  };

  const variants = resolveIsrVariants(isrRequest);
  const imageUrl = variants[activeVariantIdx]?.url || isrRequest.image_url || '';
  const isVideo = /\.(mp4|webm|mov|m4v|ogg)(\?.*)?$/i.test(imageUrl);

  const parseBbox = (raw: any) => {
    if (!raw) return null;
    const obj = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : raw;
    if (!obj || typeof obj !== 'object') return null;
    const x_min = Number(obj.x_min);
    const y_min = Number(obj.y_min);
    const x_max = Number(obj.x_max);
    const y_max = Number(obj.y_max);
    if (![x_min, y_min, x_max, y_max].every(Number.isFinite)) return null;
    return { x_min, y_min, x_max, y_max };
  };

  const calculateGeoFromBbox = (bbox: { x_min: number; y_min: number; x_max: number; y_max: number }) => {
    const cLat = isrRequest.lat;
    const cLon = isrRequest.lon;
    const heightKm = isrRequest.km_size || 2.5;
    const widthKm = heightKm * (16 / 9);
    const dxKm = ((bbox.x_min + bbox.x_max) / 2 - 0.5) * widthKm;
    const dyKm = (0.5 - (bbox.y_min + bbox.y_max) / 2) * heightKm;
    const latRad = (cLat * Math.PI) / 180;
    const a = 6378137.0;
    const e2 = 0.00669437999014;
    const sinL = Math.sin(latRad);
    const cosL = Math.cos(latRad);
    const denom = Math.sqrt(1 - e2 * sinL * sinL);
    const kmPerLat = ((Math.PI / 180) * ((a * (1 - e2)) / (denom * denom * denom))) / 1000;
    const kmPerLon = ((Math.PI / 180) * ((a * cosL) / denom)) / 1000;
    return {
      lat: Number((cLat + dyKm / kmPerLat).toFixed(6)),
      lon: Number((cLon + dxKm / kmPerLon).toFixed(6)),
    };
  };

  const filterCss = (() => {
    let b = brightness || 100;
    let c = contrast || 100;
    if (nightBoost) {
      b *= 30;
      c *= 2.2;
    }
    if (activeFilter === 'nvg') {
      const nb = nightBoost ? Math.round(b) : Math.round(b * 20);
      const nc = nightBoost ? Math.round(c) : Math.round(c * 2.2);
      return `brightness(${nb}%) contrast(${nc}%) grayscale(20%) sepia(100%) hue-rotate(85deg) saturate(380%)`;
    }
    if (activeFilter === 'whot') {
      return `brightness(${Math.round(nightBoost ? b : b * 1.2)}%) contrast(${Math.round(
        c * 1.6
      )}%) grayscale(100%)`;
    }
    if (activeFilter === 'bhot') {
      return `brightness(${Math.round(nightBoost ? b : b * 1.15)}%) contrast(${Math.round(
        c * 1.6
      )}%) grayscale(100%) invert(100%)`;
    }
    if (activeFilter === 'ironbow') {
      return `brightness(${Math.round(nightBoost ? b : b * 1.1)}%) contrast(${Math.round(
        c * 1.6
      )}%) sepia(100%) hue-rotate(280deg) saturate(350%)`;
    }
    return `brightness(${Math.round(b)}%) contrast(${Math.round(c)}%)`;
  })();

  const getCropStyle = (bbox: { x_min: number; y_min: number; x_max: number; y_max: number }): React.CSSProperties => {
    const w = Math.max(0.02, bbox.x_max - bbox.x_min);
    const h = Math.max(0.02, bbox.y_max - bbox.y_min);
    const scale = Math.min(8, Math.max(1.5, 1 / Math.max(w, h)));
    return {
      backgroundImage: `url(${imageUrl})`,
      backgroundSize: `${(scale * 100).toFixed(2)}%`,
      backgroundPosition: `${(((bbox.x_min + bbox.x_max) / 2) * 100).toFixed(2)}% ${(
        ((bbox.y_min + bbox.y_max) / 2) *
        100
      ).toFixed(2)}%`,
      backgroundRepeat: 'no-repeat',
      filter: filterCss,
    };
  };

  const getMagText = (bbox: { x_min: number; y_min: number; x_max: number; y_max: number }) => {
    const w = Math.max(0.02, bbox.x_max - bbox.x_min);
    const h = Math.max(0.02, bbox.y_max - bbox.y_min);
    return `${Math.min(8, Math.max(1.5, 1 / Math.max(w, h))).toFixed(1)}x MAG`;
  };

  const getTether = () => {
    if (!hoveredTarget || !imgRef.current || !anchorRef.current) return null;
    const bbox = parseBbox(hoveredTarget.bbox);
    if (!bbox) return null;
    const iR = imgRef.current.getBoundingClientRect();
    const aR = anchorRef.current.getBoundingClientRect();
    const x1 = Math.round(iR.left + ((bbox.x_min + bbox.x_max) / 2) * iR.width - aR.left);
    const y1 = Math.round(iR.top + ((bbox.y_min + bbox.y_max) / 2) * iR.height - aR.top);
    let x2 = Math.round(aR.width + 37);
    let y2 = 21;
    if (dotRef.current) {
      const dR = dotRef.current.getBoundingClientRect();
      x2 = Math.round(dR.left + dR.width / 2 - aR.left);
      y2 = Math.round(dR.top + dR.height / 2 - aR.top);
    }
    return { x1, y1, x2, y2 };
  };

  const copyCoord = (k: string, val: string) => {
    navigator.clipboard?.writeText(val);
    setCopiedFmt(k);
    setTimeout(() => setCopiedFmt(null), 1400);
  };

  const hoveredBbox = hoveredTarget ? parseBbox(hoveredTarget.bbox) : null;
  const tether = getTether();

  return (
    <div
      className="fixed inset-0 !m-0 z-[2100] bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-6 select-none"
      onClick={onClose}
    >
      <div
        ref={anchorRef}
        className="relative max-w-5xl w-full flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative w-full bg-stone-950/95 border border-stone-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
          {/* Header Bar */}
          <div className="flex flex-wrap items-center justify-between px-4 py-3 bg-stone-900/90 border-b border-stone-800 gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
              <span className="text-xs font-bold text-white uppercase tracking-wider font-mono truncate">
                ISR Image Capture ({isrRequest.km_size} km)
              </span>
              <span className="px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800/80 text-[10px] font-mono font-bold">
                {isrRequest.targets.length} Targets
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!isVideo && (
                <>
                  <button
                    type="button"
                    onClick={() => setMarkupMode((m) => !m)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono border flex items-center gap-1 cursor-pointer ${
                      markupMode
                        ? 'bg-amber-950 text-amber-300 border-amber-600 font-bold'
                        : 'bg-stone-900 text-stone-300 border-stone-700'
                    }`}
                  >
                    <BoundingBox className="w-3.5 h-3.5" weight="bold" />
                    <span>
                      {canMarkup
                        ? markupMode
                          ? 'Markup Active'
                          : '+ Markup Target'
                        : markupMode
                          ? 'Box Inspect Active'
                          : '+ Inspect Box'}
                    </span>
                  </button>

                  {variants.length > 1 && (
                    <div className="flex items-center gap-1 bg-stone-950 p-1 rounded-lg border border-stone-800">
                      {variants.map((v, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setActiveVariantIdx(idx)}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono border cursor-pointer ${
                            activeVariantIdx === idx
                              ? 'bg-cyan-950 text-cyan-300 border-cyan-700 font-bold'
                              : 'bg-stone-900 text-stone-400 border-stone-800'
                          }`}
                        >
                          {v.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Sensor Shader Bar */}
                  <div className="flex items-center gap-1 bg-stone-950 p-1 rounded-lg border border-stone-800">
                    {(
                      [
                        ['none', 'EO'],
                        ['whot', 'WHOT'],
                        ['bhot', 'BHOT'],
                        ['nvg', 'NVG'],
                        ['ironbow', 'HEAT'],
                      ] as const
                    ).map(([id, lbl]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setActiveFilter(id)}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono border cursor-pointer ${
                          activeFilter === id
                            ? 'bg-cyan-950 text-cyan-300 border-cyan-700 font-bold'
                            : 'bg-stone-900 text-stone-400 border-stone-800'
                        }`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const next = !nightBoost;
                      setNightBoost(next);
                      if (next && activeFilter === 'none') setActiveFilter('nvg');
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-mono border flex items-center gap-1 cursor-pointer ${
                      nightBoost
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-500 font-bold'
                        : 'bg-stone-950 text-stone-400 border-stone-800'
                    }`}
                  >
                    <MoonStars className="w-3.5 h-3.5" weight="duotone" />
                    <span>Night Boost {nightBoost ? '30x' : ''}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowControls((s) => !s)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-mono border flex items-center gap-1 cursor-pointer ${
                      showControls
                        ? 'bg-cyan-950 text-cyan-300 border-cyan-600 font-bold'
                        : 'bg-stone-950 text-stone-400 border-stone-800'
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5 text-cyan-400" weight="duotone" />
                    <span>Adjust</span>
                  </button>

                  <div className="flex items-center gap-1 bg-stone-950 border border-stone-800 rounded-lg p-0.5">
                    <button
                      type="button"
                      onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                      className="px-2 py-0.5 text-xs text-stone-400 hover:text-white cursor-pointer"
                    >
                      -
                    </button>
                    <span className="text-[10px] font-mono text-cyan-400 px-1">
                      {Math.round(zoom * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                      className="px-2 py-0.5 text-xs text-stone-400 hover:text-white cursor-pointer"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoom(1)}
                      className="px-1.5 py-0.5 text-[10px] font-mono text-stone-400 hover:text-white cursor-pointer"
                    >
                      1:1
                    </button>
                  </div>
                </>
              )}

              <button
                onClick={onClose}
                className="p-1.5 rounded-lg bg-stone-900 text-stone-400 hover:text-white border border-stone-700/60 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Secondary Gain / Contrast Slider Bar */}
          {showControls && !isVideo && (
            <div className="px-4 py-2.5 bg-stone-900/95 border-b border-stone-800 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <SunDim className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[11px] text-stone-400">Gain:</span>
                  <input
                    type="range"
                    min={20}
                    max={400}
                    step={5}
                    value={brightness}
                    onChange={(e) => setBrightness(Number(e.target.value))}
                    className="w-24 accent-cyan-400 cursor-pointer"
                  />
                  <span className="text-[11px] text-cyan-300 w-10 text-right">{brightness}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <CircleHalf className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-[11px] text-stone-400">Contrast:</span>
                  <input
                    type="range"
                    min={50}
                    max={350}
                    step={5}
                    value={contrast}
                    onChange={(e) => setContrast(Number(e.target.value))}
                    className="w-24 accent-cyan-400 cursor-pointer"
                  />
                  <span className="text-[11px] text-cyan-300 w-10 text-right">{contrast}%</span>
                </div>
                <div className="flex items-center gap-1 pl-2 border-l border-stone-800">
                  <button
                    type="button"
                    onClick={() => {
                      setBrightness(100);
                      setContrast(100);
                      setNightBoost(false);
                    }}
                    className="px-2 py-0.5 rounded text-[10px] bg-stone-950 border border-stone-800 text-stone-300 cursor-pointer"
                  >
                    Day
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBrightness(100);
                      setContrast(110);
                      setNightBoost(true);
                      setActiveFilter('nvg');
                    }}
                    className="px-2 py-0.5 rounded text-[10px] bg-emerald-950/70 border border-emerald-800 text-emerald-300 cursor-pointer"
                  >
                    Night NVG
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBrightness(100);
                      setContrast(120);
                      setNightBoost(true);
                      setActiveFilter('whot');
                    }}
                    className="px-2 py-0.5 rounded text-[10px] bg-cyan-950/70 border border-cyan-800 text-cyan-300 cursor-pointer"
                  >
                    Night WHOT
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setBrightness(100);
                  setContrast(100);
                  setNightBoost(false);
                  setActiveFilter('none');
                }}
                className="px-2 py-1 rounded text-[10px] text-stone-400 hover:text-rose-300 border border-stone-800 flex items-center gap-1 cursor-pointer"
              >
                <ArrowCounterClockwise className="w-3 h-3" /> Reset
              </button>
            </div>
          )}

          {/* Image / Video Viewport */}
          <div className="flex-1 overflow-auto p-3 flex items-center justify-center bg-black/60 min-h-[300px]">
            {!imageUrl ? (
              <div className="p-10 text-center text-stone-400 text-xs">
                Imagery not yet uploaded for this ISR tasking.
              </div>
            ) : isVideo ? (
              <video
                src={imageUrl}
                controls
                autoPlay
                className="max-h-[78vh] max-w-full rounded-lg border border-stone-800"
              />
            ) : (
              <div
                className="relative inline-block max-h-[78vh] w-auto origin-center transition-transform duration-150"
                style={{ transform: `scale(${zoom})` }}
              >
                <img
                  ref={imgRef}
                  src={imageUrl}
                  alt="ISR Capture"
                  style={{ filter: filterCss, transition: 'filter 0.2s ease' }}
                  className="max-h-[78vh] w-auto object-contain rounded-lg shadow-xl block"
                />

                <div
                  className={`absolute inset-0 overflow-hidden rounded-lg ${
                    markupMode ? 'cursor-crosshair' : ''
                  }`}
                  onMouseDown={(e) => {
                    if (!markupMode) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
                    setDrawStart({ x, y });
                    setDrawBox({ x_min: x, y_min: y, x_max: x, y_max: y });
                  }}
                  onMouseMove={(e) => {
                    if (!markupMode || !drawStart) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
                    setDrawBox({
                      x_min: Math.min(drawStart.x, x),
                      y_min: Math.min(drawStart.y, y),
                      x_max: Math.max(drawStart.x, x),
                      y_max: Math.max(drawStart.y, y),
                    });
                  }}
                  onMouseUp={() => {
                    if (!markupMode || !drawStart || !drawBox) return;
                    setDrawStart(null);
                    if (drawBox.x_max - drawBox.x_min >= 0.01 && drawBox.y_max - drawBox.y_min >= 0.01) {
                      const geo = calculateGeoFromBbox(drawBox);
                      setSelectedTarget({
                        lat: geo.lat,
                        lon: geo.lon,
                        bbox: drawBox,
                        label: canMarkup ? targetTypeOptions[0]?.value || 'unknown' : 'Target Box Crop',
                        notes: '',
                      });
                    }
                    setDrawBox(null);
                  }}
                >
                  {isrRequest.targets.map((t) => {
                    const bbox = parseBbox(t.bbox);
                    if (!bbox) return null;
                    return (
                      <div
                        key={t.id}
                        onMouseEnter={() => setHoveredTarget(t)}
                        onMouseLeave={() => setHoveredTarget(null)}
                        onClick={() => {
                          const geo = calculateGeoFromBbox(bbox);
                          setSelectedTarget({
                            target: t,
                            lat: t.lat || geo.lat,
                            lon: t.lon || geo.lon,
                            bbox,
                            label: t.label || 'unknown',
                            notes: t.notes || '',
                          });
                        }}
                        style={{
                          left: `${bbox.x_min * 100}%`,
                          top: `${bbox.y_min * 100}%`,
                          width: `${(bbox.x_max - bbox.x_min) * 100}%`,
                          height: `${(bbox.y_max - bbox.y_min) * 100}%`,
                        }}
                        className="absolute border-2 border-cyan-400 bg-cyan-400/15 hover:border-amber-400 hover:bg-amber-400/25 cursor-pointer z-20 transition-all"
                      />
                    );
                  })}

                  {drawBox && (
                    <div
                      style={{
                        left: `${drawBox.x_min * 100}%`,
                        top: `${drawBox.y_min * 100}%`,
                        width: `${(drawBox.x_max - drawBox.x_min) * 100}%`,
                        height: `${(drawBox.y_max - drawBox.y_min) * 100}%`,
                      }}
                      className="absolute border-2 border-dashed border-cyan-400 bg-cyan-400/25 pointer-events-none z-30"
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Target Coordinate & Optical Crop Modal */}
          {selectedTarget && (
            <div
              className="absolute inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={() => setSelectedTarget(null)}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="bg-stone-900 border border-stone-700 rounded-xl shadow-2xl p-4 w-full max-w-sm space-y-3 font-mono text-stone-200"
              >
                <div className="flex items-center justify-between border-b border-stone-800 pb-2">
                  <span className="text-xs font-bold text-cyan-400 uppercase flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-amber-400" weight="duotone" />
                    <span>
                      {selectedTarget.target?.label_text ||
                        targetTypeOptions.find((opt) => opt.value === selectedTarget.label)?.label ||
                        selectedTarget.label}
                    </span>
                  </span>
                  <button
                    onClick={() => setSelectedTarget(null)}
                    className="text-stone-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <div className="flex items-center justify-between px-2.5 py-1 bg-stone-950 rounded-t-lg border border-stone-800 text-[10px]">
                    <span className="text-amber-400 font-bold flex items-center gap-1">
                      <MagnifyingGlassPlus className="w-3.5 h-3.5" weight="duotone" /> Target
                      Optical Zoom
                    </span>
                    <span className="text-cyan-400 font-bold">
                      {getMagText(selectedTarget.bbox)}
                    </span>
                  </div>
                  <div className="relative w-full h-44 rounded-b-lg overflow-hidden border border-t-0 border-stone-800 bg-black">
                    <div className="w-full h-full" style={getCropStyle(selectedTarget.bbox)} />
                    <div
                      style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
                      className="absolute w-10 h-10 border border-dashed border-amber-400/80 rounded flex items-center justify-center pointer-events-none"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    </div>
                  </div>
                </div>

                <div className="bg-stone-950 p-2.5 rounded-lg border border-stone-800 space-y-1 text-xs">
                  {(
                    [
                      ['MGRS', toMgrs(selectedTarget.lat, selectedTarget.lon, 5)],
                      ['LL', formatCoordinateDec(selectedTarget.lat, selectedTarget.lon, 5)],
                      ['LLDM', formatCoordinateDdm(selectedTarget.lat, selectedTarget.lon)],
                      ['LLDMS', formatCoordinateDms(selectedTarget.lat, selectedTarget.lon)],
                    ] as const
                  ).map(([fmt, val]) => (
                    <div
                      key={fmt}
                      className="flex items-center justify-between bg-stone-900/90 px-2 py-1 rounded border border-stone-800"
                    >
                      <span className="text-[10px] text-stone-500 font-bold w-12">{fmt}</span>
                      <span className="text-cyan-300 font-bold truncate flex-1 text-right mr-2 select-all">
                        {val}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyCoord(fmt, val)}
                        className="text-stone-400 hover:text-cyan-300 cursor-pointer"
                      >
                        {copiedFmt === fmt ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>

                {canMarkup ? (
                  <div className="space-y-2 pt-1 font-sans">
                    <div>
                      <label className="block text-[10px] uppercase text-stone-400 font-bold mb-1">
                        Target Classification
                      </label>
                      <select
                        value={selectedTarget.label}
                        onChange={(e) =>
                          setSelectedTarget((prev) =>
                            prev ? { ...prev, label: e.target.value } : prev
                          )
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg bg-stone-950 border border-stone-700 text-xs text-stone-100"
                      >
                        {targetTypeOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase text-stone-400 font-bold mb-1">
                        BDA / Target Notes
                      </label>
                      <textarea
                        rows={2}
                        value={selectedTarget.notes}
                        onChange={(e) =>
                          setSelectedTarget((prev) =>
                            prev ? { ...prev, notes: e.target.value } : prev
                          )
                        }
                        placeholder="SA-10 radar oriented north, revetments, collateral warning..."
                        className="w-full px-2.5 py-1.5 rounded-lg bg-stone-950 border border-stone-700 text-xs text-stone-100"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={savingTarget}
                        onClick={() => void handleSaveTarget()}
                        className="flex-1 py-1.5 rounded-lg bg-cyan-500/25 hover:bg-cyan-500/35 border border-cyan-500/60 text-cyan-200 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <FloppyDisk className="w-3.5 h-3.5" />
                        {selectedTarget.target?.id ? 'Update Target' : 'Save Target'}
                      </button>
                      {selectedTarget.target?.id && (
                        <button
                          type="button"
                          disabled={savingTarget}
                          onClick={() => void handleDeleteTarget()}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50 ${
                            confirmDeleteTarget
                              ? 'bg-red-500/35 border-red-500 text-red-100'
                              : 'bg-stone-950 border-stone-700 text-stone-300 hover:text-red-300 hover:border-red-500/50'
                          }`}
                        >
                          <Trash className="w-3.5 h-3.5" />
                          {confirmDeleteTarget ? 'Confirm?' : 'Delete'}
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  selectedTarget.notes && (
                    <p className="text-xs text-stone-300 bg-stone-950 p-2 rounded border border-stone-800">
                      {selectedTarget.notes}
                    </p>
                  )
                )}

                {activePlan && activePlan.can_edit && onAddTargetToFlightPlan && (
                  <button
                    type="button"
                    onClick={() => {
                      const displayLabel =
                        selectedTarget.target?.label_text ||
                        targetTypeOptions.find((opt) => opt.value === selectedTarget.label)?.label ||
                        selectedTarget.label;
                      onAddTargetToFlightPlan({
                        label: displayLabel,
                        notes: selectedTarget.notes,
                        lat: selectedTarget.lat,
                        lon: selectedTarget.lon,
                      });
                    }}
                    className="w-full py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 font-sans font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Push to Flight Plan (TGT)
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Dynamic Curved Vector Tether + Side Optical Zoom HUD (Desktop XL+) */}
        {hoveredTarget && hoveredBbox && tether && (
          <svg className="hidden xl:block absolute inset-0 w-full h-full pointer-events-none z-[60] overflow-visible">
            <path
              d={`M ${tether.x1} ${tether.y1} C ${
                tether.x1 + Math.max(30, (tether.x2 - tether.x1) * 0.45)
              } ${tether.y1}, ${tether.x2 - 35} ${tether.y2}, ${tether.x2} ${tether.y2}`}
              stroke="#fbbf24"
              strokeWidth="1.6"
              fill="none"
            />
            <circle cx={tether.x1} cy={tether.y1} r="4" fill="#fbbf24" fillOpacity="0.4" />
          </svg>
        )}

        {hoveredTarget && hoveredBbox && (
          <div className="hidden xl:block absolute top-0 left-[calc(100%+1rem)] w-72 bg-stone-950/95 border border-stone-800 rounded-2xl shadow-2xl overflow-hidden pointer-events-none z-50 font-mono">
            <div className="flex items-center justify-between px-3.5 py-2.5 bg-stone-900/90 border-b border-stone-800">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  ref={dotRef}
                  className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24]"
                />
                <span className="text-xs font-bold text-white uppercase truncate">
                  {hoveredTarget.label_text || hoveredTarget.label}
                </span>
              </div>
              <span className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 text-[10px] font-bold">
                {getMagText(hoveredBbox)}
              </span>
            </div>
            <div className="p-3 space-y-2">
              <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-amber-500/50 bg-black">
                <div className="w-full h-full" style={getCropStyle(hoveredBbox)} />
                <div
                  style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
                  className="absolute w-9 h-9 border border-dashed border-amber-400/80 rounded flex items-center justify-center"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                </div>
              </div>
              <div className="text-[11px] space-y-1">
                <div className="flex justify-between bg-stone-900 px-2 py-1 rounded border border-stone-800">
                  <span className="text-stone-500">MGRS</span>
                  <span className="text-amber-300 font-bold">
                    {toMgrs(hoveredTarget.lat, hoveredTarget.lon, 5)}
                  </span>
                </div>
                <div className="flex justify-between bg-stone-900 px-2 py-1 rounded border border-stone-800">
                  <span className="text-stone-500">LL</span>
                  <span className="text-cyan-300 font-bold">
                    {formatCoordinateDec(hoveredTarget.lat, hoveredTarget.lon, 5)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
