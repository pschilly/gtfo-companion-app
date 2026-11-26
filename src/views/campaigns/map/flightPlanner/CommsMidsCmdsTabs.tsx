import React, { useMemo, useState } from 'react';
import {
  ArrowsClockwise,
  Broadcast,
  Buildings,
  Copy,
  DotsSixVertical,
  Gauge,
  ShieldCheck,
  ShieldWarning,
  WarningCircle,
} from '@phosphor-icons/react';
import {
  pullCampaignAirfieldComms,
  pullCampaignDefaultComms,
  pullCampaignDefaultMids,
} from '../../../../services/campaignMapService';
import {
  CampaignMapAirframeCatalogItem,
  CampaignMapPayload,
  FlightPlanCommsEntry,
  FlightPlanDetail,
} from '../../../../types';
import {
  getDefaultCmdsConfig,
  getRadioBandsSummary,
  isF14BUAirframe,
  isF16Airframe,
  isF18Airframe,
  isJf17Airframe,
  validateRadioFrequency,
} from './helpers';

// ============================================================================
// COMMS TAB
// ============================================================================

interface CommsTabProps {
  plan: FlightPlanDetail;
  mapData: CampaignMapPayload;
  selectedAirframe: CampaignMapAirframeCatalogItem | null;
  canEdit: boolean;
  apiBaseUrl: string;
  discordId?: string | null;
  token?: string | null;
  onMutatePlan: (updater: (prev: FlightPlanDetail) => FlightPlanDetail) => void;
  onNotify: (level: 'info' | 'success' | 'warning' | 'error', msg: string) => void;
}

export const CommsTab: React.FC<CommsTabProps> = ({
  plan,
  mapData,
  selectedAirframe,
  canEdit,
  apiBaseUrl,
  discordId,
  token,
  onMutatePlan,
  onNotify,
}) => {
  const radios = useMemo(() => {
    const cfgRadios = selectedAirframe?.radios_config?.radios;
    if (cfgRadios && typeof cfgRadios === 'object' && Object.keys(cfgRadios).length > 0) {
      return Object.values(cfgRadios) as Array<Record<string, any>>;
    }
    return [
      { key: 'comm1', name: 'COMM 1', designation: 'COMM 1', preset_count: 20, bands: [] },
      { key: 'comm2', name: 'COMM 2', designation: 'COMM 2', preset_count: 20, bands: [] },
    ];
  }, [selectedAirframe]);

  const [activeRadioKey, setActiveRadioKey] = useState<string>(radios[0]?.key || 'comm1');
  const [isBusy, setIsBusy] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const activeRadio = useMemo(
    () => radios.find((r) => r.key === activeRadioKey) || radios[0],
    [radios, activeRadioKey]
  );

  const commsMap = useMemo(() => {
    const ladder =
      plan.comms_ladder_by_radio ||
      (plan.comms_ladder && !Array.isArray(plan.comms_ladder) ? plan.comms_ladder : {}) ||
      {};
    return {
      ...ladder,
      ...(Array.isArray(plan.comm1) && plan.comm1.length > 0 ? { comm1: plan.comm1 } : {}),
      ...(Array.isArray(plan.comm2) && plan.comm2.length > 0 ? { comm2: plan.comm2 } : {}),
    } as Record<string, FlightPlanCommsEntry[]>;
  }, [plan.comms_ladder_by_radio, plan.comms_ladder, plan.comm1, plan.comm2]);

  const channels: FlightPlanCommsEntry[] = useMemo(() => {
    const count = Number(activeRadio?.preset_count || 20);
    const existing = Array.isArray(commsMap[activeRadio.key]) ? [...commsMap[activeRadio.key]] : [];
    const defMod = activeRadio?.bands?.[0]?.modulation === 'FM' ? 'FM' : 'AM';
    const defBand = activeRadio?.bands?.[0]?.type || 'UHF';
    while (existing.length < count) {
      existing.push({
        channel: existing.length + 1,
        name: '',
        frequency: '',
        modulation: defMod,
        band: defBand,
        notes: '',
        source: '',
      });
    }
    return existing.slice(0, count);
  }, [activeRadio, commsMap]);

  const setRadioChannels = (radioKey: string, nextList: FlightPlanCommsEntry[]) => {
    onMutatePlan((prev) => {
      const nextMap: Record<string, FlightPlanCommsEntry[]> = {
        ...commsMap,
        [radioKey]: nextList,
      };
      return {
        ...prev,
        comms_ladder_by_radio: nextMap,
        comms_ladder: nextMap,
        ...(radioKey === 'comm1' ? { comm1: nextList } : {}),
        ...(radioKey === 'comm2' ? { comm2: nextList } : {}),
      };
    });
  };

  const handlePullDefaults = async () => {
    setIsBusy(true);
    try {
      const defaults = await pullCampaignDefaultComms(
        apiBaseUrl,
        mapData.campaign.id,
        {
          airframe_id: plan.airframe_id,
          mission_id: plan.mission_id,
          departure_airfield: plan.departure_airfield,
          destination_airfield: plan.destination_airfield,
          diverts: plan.diverts,
        },
        { discordId, token }
      );
      onMutatePlan((prev) => {
        const merged = { ...commsMap, ...defaults };
        return {
          ...prev,
          comms_ladder_by_radio: merged,
          comms_ladder: merged,
          comm1: Array.isArray(defaults.comm1) ? defaults.comm1 : prev.comm1,
          comm2: Array.isArray(defaults.comm2) ? defaults.comm2 : prev.comm2,
        };
      });
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to pull default comms.');
    } finally {
      setIsBusy(false);
    }
  };

  const handlePullAirfields = async () => {
    setIsBusy(true);
    try {
      const depAb = (mapData.airbases || []).find(
        (ab) => ab.name.trim().toLowerCase() === (plan.departure_airfield || '').trim().toLowerCase()
      );
      const freqs = await pullCampaignAirfieldComms(
        apiBaseUrl,
        mapData.campaign.id,
        {
          radio_key: activeRadio.key,
          airframe_id: plan.airframe_id,
          airbase_id: depAb?.id ?? null,
          departure_airfield: plan.departure_airfield,
          destination_airfield: plan.destination_airfield,
          diverts: plan.diverts,
          include_dcs: false,
        },
        { discordId, token }
      );
      if (!freqs || freqs.length === 0) {
        onNotify('warning', 'No airfield frequencies found.');
        return;
      }

      const next = channels.map((c) => ({ ...c }));
      let inserted = 0;
      freqs.forEach((item) => {
        const cleanFreq = String(item.frequency || '').trim();
        if (!cleanFreq || next.some((ch) => String(ch.frequency || '').trim() === cleanFreq)) {
          return;
        }
        const emptySlot = next.find((ch) => !ch.frequency || String(ch.frequency).trim() === '');
        if (emptySlot) {
          emptySlot.name = String(item.name || item.label || '').substring(0, 15);
          emptySlot.frequency = cleanFreq;
          emptySlot.modulation = item.modulation || 'AM';
          emptySlot.band = item.band || 'UHF';
          emptySlot.notes = item.notes || '';
          emptySlot.source = item.source || 'Airfield';
          inserted++;
        }
      });
      setRadioChannels(activeRadio.key, next);
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to pull airfield frequencies.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleCopyLadder = () => {
    if (radios.length < 2) return;
    const r1 = radios[0].key;
    const r2 = radios[1].key;
    const src = commsMap[r1] || channels;
    const count2 = Number(radios[1].preset_count || 20);
    const cloned = JSON.parse(JSON.stringify(src)).slice(0, count2);
    setRadioChannels(r2, cloned);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 bg-stone-900/90 p-2.5 rounded-lg border border-stone-800">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            {radios.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setActiveRadioKey(r.key)}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer ${
                  activeRadio.key === r.key
                    ? 'bg-amber-500 text-stone-950 ring-1 ring-amber-400'
                    : 'bg-stone-800 text-stone-300 hover:text-white hover:bg-stone-700'
                }`}
              >
                <span>{r.name}</span>
                <span className="text-[11px] opacity-75 font-mono">({r.designation})</span>
              </button>
            ))}
          </div>

          {canEdit && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                disabled={isBusy}
                onClick={() => void handlePullDefaults()}
                className="px-2.5 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold border border-stone-700 flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <ArrowsClockwise className="size-3.5 text-amber-400" weight="duotone" />
                <span>Pull Defaults</span>
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => void handlePullAirfields()}
                className="px-2.5 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold border border-stone-700 flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Buildings className="size-3.5 text-emerald-400" weight="duotone" />
                <span>Pull Airfields</span>
              </button>
              {radios.length >= 2 && (
                <button
                  type="button"
                  onClick={handleCopyLadder}
                  className="px-2.5 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold border border-stone-700 flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="size-3.5 text-sky-400" weight="duotone" />
                  <span>Copy Ladder</span>
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-2.5 py-1.5 rounded bg-stone-950/90 border border-stone-800/80 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-amber-400 font-mono">
              {activeRadio.name} [{activeRadio.designation}]
            </span>
            <span className="text-stone-600">&bull;</span>
            <span className="text-stone-300">{getRadioBandsSummary(activeRadio)}</span>
          </div>
          <span className="text-[11px] font-mono tabular-nums text-stone-500 shrink-0 ml-2">
            {activeRadio.preset_count || 20} Presets
          </span>
        </div>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-12 gap-1.5 px-2 py-1 bg-stone-950 text-[11px] font-bold text-stone-400 uppercase rounded border border-stone-800 items-center">
        <span className="col-span-1 text-center">CH</span>
        <span className="col-span-4">Preset / Net Name</span>
        <span className="col-span-3">Freq (MHz)</span>
        <span className="col-span-2 text-center">Mod</span>
        <span className="col-span-2">Notes</span>
      </div>

      {/* Channel Rows */}
      <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
        {channels.map((ch, idx) => {
          const valRes = validateRadioFrequency(
            activeRadio,
            ch.frequency || '',
            ch.modulation || 'AM'
          );
          return (
            <div
              key={`${activeRadio.key}-${idx}`}
              onDragOver={(e) => {
                if (draggedIdx === null || draggedIdx === idx) return;
                e.preventDefault();
                setDragOverIdx(idx);
              }}
              onDragLeave={() => {
                if (dragOverIdx === idx) setDragOverIdx(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const from = draggedIdx;
                setDraggedIdx(null);
                setDragOverIdx(null);
                if (from === null || from === idx) return;
                const next = [...channels];
                const [moved] = next.splice(from, 1);
                next.splice(idx, 0, moved);
                next.forEach((item, i) => {
                  item.channel = i + 1;
                });
                setRadioChannels(activeRadio.key, next);
              }}
              className={`grid grid-cols-12 gap-1.5 p-1 rounded bg-stone-900/80 border items-center text-xs transition-all duration-150 ${
                dragOverIdx === idx
                  ? 'border-amber-400 bg-amber-950/40 ring-1 ring-amber-400'
                  : !valRes.valid
                    ? 'border-amber-500/60 bg-amber-950/10'
                    : 'border-stone-800 hover:border-stone-700'
              } ${draggedIdx === idx ? 'opacity-30' : ''}`}
            >
              <div
                draggable={canEdit}
                onDragStart={(e) => {
                  setDraggedIdx(idx);
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', String(idx));
                }}
                onDragEnd={() => {
                  setDraggedIdx(null);
                  setDragOverIdx(null);
                }}
                className="col-span-1 flex items-center justify-center gap-0.5 cursor-grab active:cursor-grabbing text-stone-500 hover:text-amber-400 select-none py-0.5 rounded group"
                title="Drag to reorder channels"
              >
                <DotsSixVertical className="size-3 opacity-40 group-hover:opacity-100 shrink-0" weight="bold" />
                <span className="font-mono font-bold text-amber-400 text-xs">
                  {ch.channel ?? idx + 1}
                </span>
              </div>

              <input
                type="text"
                disabled={!canEdit}
                maxLength={15}
                value={ch.name || ch.label || ''}
                onChange={(e) => {
                  const next = [...channels];
                  next[idx] = { ...ch, name: e.target.value, label: e.target.value };
                  setRadioChannels(activeRadio.key, next);
                }}
                placeholder="Preset Name"
                className="col-span-4 rounded border border-stone-700 bg-stone-950 text-stone-100 text-xs py-1 px-1.5 focus:border-amber-400 focus:outline-none disabled:opacity-60"
              />

              <div className="col-span-3">
                <input
                  type="text"
                  disabled={!canEdit}
                  value={ch.frequency || ''}
                  onChange={(e) => {
                    const next = [...channels];
                    next[idx] = { ...ch, frequency: e.target.value };
                    setRadioChannels(activeRadio.key, next);
                  }}
                  placeholder="e.g. 225.000"
                  className={`w-full rounded bg-stone-950 text-amber-300 font-mono text-xs py-1 px-1.5 focus:outline-none disabled:opacity-60 ${
                    !valRes.valid
                      ? 'border border-amber-500 ring-1 ring-amber-500/50 bg-amber-950/30'
                      : 'border border-stone-700 focus:border-amber-400'
                  }`}
                />
                {!valRes.valid && valRes.error && (
                  <div
                    className="text-[11px] text-amber-400 font-semibold mt-0.5 leading-tight truncate"
                    title={valRes.error}
                  >
                    ⚠️ {valRes.error}
                  </div>
                )}
              </div>

              <select
                disabled={!canEdit}
                value={(ch.modulation || 'AM').toUpperCase()}
                onChange={(e) => {
                  const next = [...channels];
                  next[idx] = { ...ch, modulation: e.target.value };
                  setRadioChannels(activeRadio.key, next);
                }}
                className="col-span-2 rounded border border-stone-700 bg-stone-950 text-stone-300 text-xs py-1 px-1 text-center focus:border-amber-400 focus:outline-none disabled:opacity-60"
              >
                <option value="AM">AM</option>
                <option value="FM">FM</option>
              </select>

              <input
                type="text"
                disabled={!canEdit}
                value={ch.notes || ''}
                onChange={(e) => {
                  const next = [...channels];
                  next[idx] = { ...ch, notes: e.target.value };
                  setRadioChannels(activeRadio.key, next);
                }}
                placeholder="Notes"
                className="col-span-2 rounded border border-stone-700 bg-stone-950 text-stone-400 text-xs py-1 px-1.5 focus:border-amber-400 focus:outline-none disabled:opacity-60"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================================
// MIDS TAB
// ============================================================================

interface MidsTabProps {
  plan: FlightPlanDetail;
  mapData: CampaignMapPayload;
  selectedAirframe: CampaignMapAirframeCatalogItem | null;
  canEdit: boolean;
  apiBaseUrl: string;
  discordId?: string | null;
  token?: string | null;
  onMutatePlan: (updater: (prev: FlightPlanDetail) => FlightPlanDetail) => void;
  onNotify: (level: 'info' | 'success' | 'warning' | 'error', msg: string) => void;
}

export const MidsTab: React.FC<MidsTabProps> = ({
  plan,
  mapData,
  selectedAirframe,
  canEdit,
  apiBaseUrl,
  discordId,
  token,
  onMutatePlan,
  onNotify,
}) => {
  const [isBusy, setIsBusy] = useState(false);
  const mids = plan.mids_settings || {};
  const isJf17 = isJf17Airframe(plan, selectedAirframe);

  const handlePullDefaults = async () => {
    setIsBusy(true);
    try {
      const defaults = await pullCampaignDefaultMids(
        apiBaseUrl,
        mapData.campaign.id,
        plan.airframe_id,
        { discordId, token }
      );
      onMutatePlan((prev) => ({
        ...prev,
        mids_settings: { ...(prev.mids_settings || {}), ...defaults },
      }));
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to pull default MIDS settings.');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between bg-stone-900/90 p-2.5 rounded-lg border border-cyan-900/40">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-cyan-950 text-cyan-400 border border-cyan-800/50">
            <Broadcast className="size-5" weight="duotone" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>Link 16 / MIDS Datalink &amp; Voice Nets</span>
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-semibold">
                {isJf17 ? 'JF-17' : 'F/A-18C'}
              </span>
            </h4>
            <p className="text-xs text-stone-400 mt-0.5">
              Configure MIDS Vocal Nets A &amp; B for Link 16 tactical datalink and voice comms.
            </p>
          </div>
        </div>

        {canEdit && (
          <button
            type="button"
            disabled={isBusy}
            onClick={() => void handlePullDefaults()}
            className="px-2.5 py-1.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold border border-stone-700 flex items-center gap-1 shrink-0 cursor-pointer disabled:opacity-50"
          >
            <ArrowsClockwise className="size-3.5 text-cyan-400" weight="duotone" />
            <span>Pull Defaults</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* MIDS A Card */}
        <div className="bg-stone-900/90 p-3 rounded-lg border border-stone-800 space-y-2.5">
          <div className="flex items-center justify-between border-b border-stone-800 pb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
              <span className="font-bold text-stone-100 text-xs uppercase tracking-wider">
                MIDS A (Voice 1 / Net A)
              </span>
            </div>
            <span className="text-[11px] font-mono font-bold text-cyan-400 px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-800">
              CH {mids.mids_a_channel || '44'}
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-400 uppercase mb-1">
              MIDS Channel / Net #
            </label>
            <input
              type="text"
              disabled={!canEdit}
              value={String(mids.mids_a_channel ?? '')}
              onChange={(e) =>
                onMutatePlan((p) => ({
                  ...p,
                  mids_settings: { ...(p.mids_settings || {}), mids_a_channel: e.target.value },
                }))
              }
              placeholder="e.g. 44"
              className="w-full rounded border border-stone-700 bg-stone-950 text-cyan-300 font-mono font-bold text-xs py-1.5 px-2 focus:border-cyan-400 focus:outline-none disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-400 uppercase mb-1">
              Preset / Net Label
            </label>
            <input
              type="text"
              disabled={!canEdit}
              maxLength={20}
              value={String(mids.mids_a_name ?? '')}
              onChange={(e) =>
                onMutatePlan((p) => ({
                  ...p,
                  mids_settings: { ...(p.mids_settings || {}), mids_a_name: e.target.value },
                }))
              }
              placeholder="e.g. 449th TFS Interflight"
              className="w-full rounded border border-stone-700 bg-stone-950 text-stone-100 text-xs py-1.5 px-2 focus:border-cyan-400 focus:outline-none disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-400 uppercase mb-1">
              Purpose / Notes
            </label>
            <input
              type="text"
              disabled={!canEdit}
              value={String(mids.mids_a_notes ?? '')}
              onChange={(e) =>
                onMutatePlan((p) => ({
                  ...p,
                  mids_settings: { ...(p.mids_settings || {}), mids_a_notes: e.target.value },
                }))
              }
              placeholder="e.g. Interflight Datalink"
              className="w-full rounded border border-stone-700 bg-stone-950 text-stone-400 text-xs py-1.5 px-2 focus:border-cyan-400 focus:outline-none disabled:opacity-60"
            />
          </div>
        </div>

        {/* MIDS B Card */}
        <div className="bg-stone-900/90 p-3 rounded-lg border border-stone-800 space-y-2.5">
          <div className="flex items-center justify-between border-b border-stone-800 pb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span className="font-bold text-stone-100 text-xs uppercase tracking-wider">
                MIDS B (Voice 2 / Net B)
              </span>
            </div>
            <span className="text-[11px] font-mono font-bold text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-800">
              CH {mids.mids_b_channel || '49'}
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-400 uppercase mb-1">
              MIDS Channel / Net #
            </label>
            <input
              type="text"
              disabled={!canEdit}
              value={String(mids.mids_b_channel ?? '')}
              onChange={(e) =>
                onMutatePlan((p) => ({
                  ...p,
                  mids_settings: { ...(p.mids_settings || {}), mids_b_channel: e.target.value },
                }))
              }
              placeholder="e.g. 49"
              className="w-full rounded border border-stone-700 bg-stone-950 text-emerald-300 font-mono font-bold text-xs py-1.5 px-2 focus:border-emerald-400 focus:outline-none disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-400 uppercase mb-1">
              Preset / Net Label
            </label>
            <input
              type="text"
              disabled={!canEdit}
              maxLength={20}
              value={String(mids.mids_b_name ?? '')}
              onChange={(e) =>
                onMutatePlan((p) => ({
                  ...p,
                  mids_settings: { ...(p.mids_settings || {}), mids_b_name: e.target.value },
                }))
              }
              placeholder="e.g. Package Tactical Net"
              className="w-full rounded border border-stone-700 bg-stone-950 text-stone-100 text-xs py-1.5 px-2 focus:border-emerald-400 focus:outline-none disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-400 uppercase mb-1">
              Purpose / Notes
            </label>
            <input
              type="text"
              disabled={!canEdit}
              value={String(mids.mids_b_notes ?? '')}
              onChange={(e) =>
                onMutatePlan((p) => ({
                  ...p,
                  mids_settings: { ...(p.mids_settings || {}), mids_b_notes: e.target.value },
                }))
              }
              placeholder="e.g. Package Tactical"
              className="w-full rounded border border-stone-700 bg-stone-950 text-stone-400 text-xs py-1.5 px-2 focus:border-emerald-400 focus:outline-none disabled:opacity-60"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// CMDS TAB (F-16C, F/A-18C, F-14B(U))
// ============================================================================

interface CmdsTabProps {
  plan: FlightPlanDetail;
  selectedAirframe: CampaignMapAirframeCatalogItem | null;
  canEdit: boolean;
  onMutatePlan: (updater: (prev: FlightPlanDetail) => FlightPlanDetail) => void;
  onNotify: (level: 'info' | 'success' | 'warning' | 'error', msg: string) => void;
}

export const CmdsTab: React.FC<CmdsTabProps> = ({
  plan,
  selectedAirframe,
  canEdit,
  onMutatePlan,
  onNotify,
}) => {
  const cmds = useMemo(() => {
    const raw = plan.cmds_settings;
    if (raw && !Array.isArray(raw) && raw.programs && Object.keys(raw.programs).length > 0) {
      return raw as Record<string, any>;
    }
    return getDefaultCmdsConfig(plan, selectedAirframe);
  }, [plan, selectedAirframe]);

  const progKeys = useMemo(() => (cmds?.programs ? Object.keys(cmds.programs) : []), [cmds]);
  const [activeProg, setActiveProg] = useState<string>(progKeys[0] || 'MAN1');

  const resolvedActiveProg = progKeys.includes(activeProg) ? activeProg : progKeys[0] || '';

  const isF16 = cmds?.type === 'F_16C' || isF16Airframe(plan, selectedAirframe);
  const isF14 = cmds?.type === 'F_14BU' || isF14BUAirframe(plan, selectedAirframe);
  const isF18 = cmds?.type === 'FA_18C' || (!isF16 && !isF14 && isF18Airframe(plan, selectedAirframe));

  const handleLoadDefaults = () => {
    const def = getDefaultCmdsConfig(plan, selectedAirframe);
    if (!def) {
      onNotify('warning', 'No default CMDS configuration available for this airframe.');
      return;
    }
    onMutatePlan((p) => ({ ...p, cmds_settings: def }));
    const keys = Object.keys(def.programs || {});
    if (keys.length > 0) setActiveProg(keys[0]);
  };

  const updateCmds = (updater: (cur: Record<string, any>) => Record<string, any>) => {
    const base = cmds ? JSON.parse(JSON.stringify(cmds)) : {};
    onMutatePlan((p) => ({ ...p, cmds_settings: updater(base) }));
  };

  if (!cmds || !cmds.programs || progKeys.length === 0) {
    return (
      <div className="bg-stone-900/90 p-6 rounded-lg border border-stone-800 text-center space-y-3">
        <WarningCircle className="size-8 text-rose-400 mx-auto" weight="duotone" />
        <p className="text-xs text-stone-300">No CMDS programs configured yet for this airframe.</p>
        {canEdit && (
          <button
            type="button"
            onClick={handleLoadDefaults}
            className="px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-colors shadow cursor-pointer"
          >
            Load Default CMDS Configuration
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header Banner */}
      <div className="flex items-center justify-between bg-stone-900/90 p-2.5 rounded-lg border border-rose-900/40">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-rose-950 text-rose-400 border border-rose-800/50">
            <ShieldCheck className="size-5" weight="duotone" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>Countermeasure Dispenser System (CMDS)</span>
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-semibold">
                {isF16 ? 'F-16C Viper' : isF14 ? 'F-14B(U) Tomcat' : 'F/A-18C Hornet'}
              </span>
            </h4>
            <p className="text-xs text-stone-400 mt-0.5">
              Configure manual/automatic dispenser programs, burst/salvo intervals, threat response,
              and bingo reserves.
            </p>
          </div>
        </div>

        {canEdit && (
          <button
            type="button"
            onClick={handleLoadDefaults}
            className="px-2.5 py-1.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold border border-stone-700 flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <ArrowsClockwise className="size-3.5 text-rose-400" weight="duotone" />
            <span>Pull Defaults</span>
          </button>
        )}
      </div>

      {/* ==================== F-16C CMDS EDITOR ==================== */}
      {isF16 && (
        <div className="space-y-3">
          {cmds.bingo && (
            <div className="bg-stone-900/90 p-3 rounded-lg border border-stone-800 space-y-2.5">
              <div className="flex items-center justify-between border-b border-stone-800 pb-1.5">
                <span className="font-bold text-stone-200 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Gauge className="size-4 text-amber-400" weight="duotone" />
                  <span>Bingo Reserves &amp; System Controls</span>
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-stone-400 uppercase mb-1">
                    Chaff Bingo
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={120}
                    disabled={!canEdit}
                    value={cmds.bingo.ChaffNum ?? 10}
                    onChange={(e) =>
                      updateCmds((c) => ({
                        ...c,
                        bingo: { ...c.bingo, ChaffNum: Number(e.target.value) || 0 },
                      }))
                    }
                    className="w-full rounded border border-stone-700 bg-stone-950 text-cyan-300 font-mono text-xs py-1 px-2 focus:border-rose-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-400 uppercase mb-1">
                    Flares Bingo
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={120}
                    disabled={!canEdit}
                    value={cmds.bingo.FlaresNum ?? 10}
                    onChange={(e) =>
                      updateCmds((c) => ({
                        ...c,
                        bingo: { ...c.bingo, FlaresNum: Number(e.target.value) || 0 },
                      }))
                    }
                    className="w-full rounded border border-stone-700 bg-stone-950 text-amber-300 font-mono text-xs py-1 px-2 focus:border-rose-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-400 uppercase mb-1">
                    Prog Delay (s)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    max={10}
                    disabled={!canEdit}
                    value={cmds.delay_between_programs ?? 2}
                    onChange={(e) =>
                      updateCmds((c) => ({
                        ...c,
                        delay_between_programs: Number(e.target.value) || 0,
                      }))
                    }
                    className="w-full rounded border border-stone-700 bg-stone-950 text-stone-200 font-mono text-xs py-1 px-2 focus:border-rose-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-stone-800/80 text-xs">
                {(['BINGO', 'FDBK', 'REQCTR'] as const).map((flag) => (
                  <label
                    key={flag}
                    className="flex items-center gap-2 cursor-pointer select-none text-stone-300"
                  >
                    <input
                      type="checkbox"
                      disabled={!canEdit}
                      checked={Boolean(cmds.bingo[flag])}
                      onChange={(e) =>
                        updateCmds((c) => ({
                          ...c,
                          bingo: { ...c.bingo, [flag]: e.target.checked },
                        }))
                      }
                      className="rounded border-stone-700 bg-stone-950 text-rose-500"
                    />
                    <span>
                      {flag === 'BINGO'
                        ? 'BINGO Voice'
                        : flag === 'FDBK'
                          ? 'FDBK Audio'
                          : 'REQCTR Disp'}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-stone-400 uppercase mb-1.5">
              Select Program to Edit
            </label>
            <div className="grid grid-cols-5 gap-1 select-none">
              {progKeys.map((pKey) => (
                <button
                  key={pKey}
                  type="button"
                  onClick={() => setActiveProg(pKey)}
                  className={`py-1 px-1.5 text-center text-xs font-mono font-bold rounded border transition-colors cursor-pointer ${
                    resolvedActiveProg === pKey
                      ? 'bg-rose-950/80 border-rose-500 text-rose-300 ring-1 ring-rose-500/50'
                      : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200 hover:bg-stone-800'
                  }`}
                >
                  {pKey}
                </button>
              ))}
            </div>
          </div>

          {cmds.programs[resolvedActiveProg] && (
            <div className="bg-stone-900/90 p-3 rounded-lg border border-stone-800 space-y-3">
              <div className="flex items-center gap-2 border-b border-stone-800 pb-2">
                <span className="px-2 py-0.5 rounded bg-rose-950 border border-rose-800 text-rose-300 font-mono font-bold text-xs">
                  {resolvedActiveProg}
                </span>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={cmds.programs[resolvedActiveProg].label || ''}
                  onChange={(e) =>
                    updateCmds((c) => {
                      c.programs[resolvedActiveProg].label = e.target.value;
                      return c;
                    })
                  }
                  placeholder="Program Description"
                  className="flex-1 rounded border border-stone-700 bg-stone-950 text-stone-200 text-xs py-1 px-2 focus:border-rose-400 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <div className="grid grid-cols-5 gap-1.5 text-[11px] font-bold text-stone-400 uppercase px-1">
                  <span>Dispenser</span>
                  <span className="text-center">Burst Qty</span>
                  <span className="text-center">Burst Int (s)</span>
                  <span className="text-center">Salvo Qty</span>
                  <span className="text-center">Salvo Int (s)</span>
                </div>
                {(['chaff', 'flare', 'other1', 'other2'] as const).map((disp) => {
                  const row = cmds.programs[resolvedActiveProg][disp];
                  if (!row) return null;
                  return (
                    <div
                      key={disp}
                      className="grid grid-cols-5 gap-1.5 items-center p-1.5 rounded bg-stone-950/60 border border-stone-800/80"
                    >
                      <span
                        className={`text-xs font-semibold capitalize ${
                          disp === 'chaff'
                            ? 'text-cyan-400'
                            : disp === 'flare'
                              ? 'text-amber-400'
                              : 'text-stone-400'
                        }`}
                      >
                        {disp}
                      </span>
                      {(['burst_qty', 'burst_interval', 'salvo_qty', 'salvo_interval'] as const).map(
                        (field) => (
                          <input
                            key={field}
                            type="number"
                            step={field.includes('interval') ? '0.01' : '1'}
                            min={0}
                            max={field.includes('interval') ? 10 : 99}
                            disabled={!canEdit}
                            value={row[field] ?? 0}
                            onChange={(e) =>
                              updateCmds((c) => {
                                c.programs[resolvedActiveProg][disp][field] =
                                  Number(e.target.value) || 0;
                                return c;
                              })
                            }
                            className="rounded border border-stone-700 bg-stone-900 text-stone-200 font-mono text-xs py-1 px-1 text-center focus:border-rose-400 focus:outline-none"
                          />
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== F/A-18C CMDS EDITOR ==================== */}
      {isF18 && (
        <div className="space-y-3">
          <div className="bg-stone-900/90 p-3 rounded-lg border border-stone-800 flex items-center justify-between">
            <div>
              <span className="font-bold text-stone-200 text-xs uppercase tracking-wider">
                Delay Between Programs
              </span>
              <p className="text-xs text-stone-400">
                Delay interval in seconds before repeating sequence (0-10s)
              </p>
            </div>
            <div className="w-24">
              <input
                type="number"
                step="0.1"
                min={0}
                max={10}
                disabled={!canEdit}
                value={cmds.delay_between_programs ?? 0}
                onChange={(e) =>
                  updateCmds((c) => ({
                    ...c,
                    delay_between_programs: Number(e.target.value) || 0,
                  }))
                }
                className="w-full rounded border border-stone-700 bg-stone-950 text-stone-200 font-mono text-xs py-1 px-2 text-center focus:border-rose-400 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-400 uppercase mb-1.5">
              Select Program to Edit
            </label>
            <div className="grid grid-cols-5 gap-1 select-none">
              {progKeys.map((pKey) => (
                <button
                  key={pKey}
                  type="button"
                  onClick={() => setActiveProg(pKey)}
                  className={`py-1 px-1.5 text-center text-xs font-mono font-bold rounded border transition-colors cursor-pointer ${
                    resolvedActiveProg === pKey
                      ? 'bg-rose-950/80 border-rose-500 text-rose-300 ring-1 ring-rose-500/50'
                      : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200 hover:bg-stone-800'
                  }`}
                >
                  {pKey}
                </button>
              ))}
            </div>
          </div>

          {cmds.programs[resolvedActiveProg] && (
            <div className="bg-stone-900/90 p-3 rounded-lg border border-stone-800 space-y-3">
              <div className="flex items-center gap-2 border-b border-stone-800 pb-2">
                <span className="px-2 py-0.5 rounded bg-rose-950 border border-rose-800 text-rose-300 font-mono font-bold text-xs">
                  {resolvedActiveProg}
                </span>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={cmds.programs[resolvedActiveProg].label || ''}
                  onChange={(e) =>
                    updateCmds((c) => {
                      c.programs[resolvedActiveProg].label = e.target.value;
                      return c;
                    })
                  }
                  placeholder="Program Description"
                  className="flex-1 rounded border border-stone-700 bg-stone-950 text-stone-200 text-xs py-1 px-2 focus:border-rose-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-2.5 rounded bg-stone-950/60 border border-stone-800 space-y-2">
                  <div className="flex items-center gap-1.5 border-b border-stone-800/80 pb-1">
                    <span className="size-2 rounded-full bg-cyan-400" />
                    <span className="text-xs font-bold text-cyan-300 uppercase">
                      Chaff Parameters
                    </span>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-400 uppercase mb-1">
                      Burst Quantity
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={30}
                      disabled={!canEdit}
                      value={cmds.programs[resolvedActiveProg].chaff?.quantity ?? 1}
                      onChange={(e) =>
                        updateCmds((c) => {
                          c.programs[resolvedActiveProg].chaff = {
                            ...c.programs[resolvedActiveProg].chaff,
                            quantity: Number(e.target.value) || 0,
                          };
                          return c;
                        })
                      }
                      className="w-full rounded border border-stone-700 bg-stone-900 text-cyan-300 font-mono text-xs py-1 px-2 focus:border-rose-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-400 uppercase mb-1">
                      Interval (Seconds)
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      min={0}
                      max={10}
                      disabled={!canEdit}
                      value={cmds.programs[resolvedActiveProg].chaff?.interval ?? 1.0}
                      onChange={(e) =>
                        updateCmds((c) => {
                          c.programs[resolvedActiveProg].chaff = {
                            ...c.programs[resolvedActiveProg].chaff,
                            interval: Number(e.target.value) || 0,
                          };
                          return c;
                        })
                      }
                      className="w-full rounded border border-stone-700 bg-stone-900 text-stone-200 font-mono text-xs py-1 px-2 focus:border-rose-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-400 uppercase mb-1">
                      Repeat Count
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      disabled={!canEdit}
                      value={cmds.programs[resolvedActiveProg].chaff?.repeat ?? 10}
                      onChange={(e) =>
                        updateCmds((c) => {
                          c.programs[resolvedActiveProg].chaff = {
                            ...c.programs[resolvedActiveProg].chaff,
                            repeat: Number(e.target.value) || 1,
                          };
                          return c;
                        })
                      }
                      className="w-full rounded border border-stone-700 bg-stone-900 text-stone-200 font-mono text-xs py-1 px-2 focus:border-rose-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="p-2.5 rounded bg-stone-950/60 border border-stone-800 space-y-2">
                  <div className="flex items-center gap-1.5 border-b border-stone-800/80 pb-1">
                    <span className="size-2 rounded-full bg-amber-400" />
                    <span className="text-xs font-bold text-amber-300 uppercase">
                      Flare Parameters
                    </span>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-400 uppercase mb-1">
                      Burst Quantity
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={30}
                      disabled={!canEdit}
                      value={cmds.programs[resolvedActiveProg].flare?.quantity ?? 1}
                      onChange={(e) =>
                        updateCmds((c) => {
                          c.programs[resolvedActiveProg].flare = {
                            ...c.programs[resolvedActiveProg].flare,
                            quantity: Number(e.target.value) || 0,
                          };
                          return c;
                        })
                      }
                      className="w-full rounded border border-stone-700 bg-stone-900 text-amber-300 font-mono text-xs py-1 px-2 focus:border-rose-400 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== F-14B(U) CMDS EDITOR ==================== */}
      {isF14 && (
        <div className="space-y-3">
          {cmds.bingo && (
            <div className="bg-stone-900/90 p-3 rounded-lg border border-stone-800 space-y-2.5">
              <div className="flex items-center justify-between border-b border-stone-800 pb-1.5">
                <span className="font-bold text-stone-200 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldWarning className="size-4 text-amber-400" weight="duotone" />
                  <span>Bingo Reserves &amp; Auto Threat Matrix</span>
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-400 uppercase mb-1">
                    Chaff Low Bingo
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={120}
                    disabled={!canEdit}
                    value={cmds.bingo.ChaffNum ?? 10}
                    onChange={(e) =>
                      updateCmds((c) => ({
                        ...c,
                        bingo: { ...c.bingo, ChaffNum: Number(e.target.value) || 0 },
                      }))
                    }
                    className="w-full rounded border border-stone-700 bg-stone-950 text-cyan-300 font-mono text-xs py-1 px-2 focus:border-rose-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-400 uppercase mb-1">
                    Flares Low Bingo
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={120}
                    disabled={!canEdit}
                    value={cmds.bingo.FlaresNum ?? 10}
                    onChange={(e) =>
                      updateCmds((c) => ({
                        ...c,
                        bingo: { ...c.bingo, FlaresNum: Number(e.target.value) || 0 },
                      }))
                    }
                    className="w-full rounded border border-stone-700 bg-stone-950 text-amber-300 font-mono text-xs py-1 px-2 focus:border-rose-400 focus:outline-none"
                  />
                </div>
              </div>

              {cmds.auto_programs && (
                <div className="pt-2 border-t border-stone-800/80 space-y-1.5">
                  <span className="block text-xs font-bold text-stone-400 uppercase">
                    Automated RWR Threat Response Matrix
                  </span>
                  <div className="grid grid-cols-3 gap-1.5 text-[11px] font-bold text-stone-400 uppercase px-1">
                    <span>Threat Class</span>
                    <span className="text-center">Assigned Prog</span>
                    <span className="text-center">Threshold</span>
                  </div>
                  {(['AAA', 'Aircraft', 'Naval', 'SAM', 'Unknown'] as const).map((th) => {
                    const row = cmds.auto_programs[th];
                    if (!row) return null;
                    return (
                      <div
                        key={th}
                        className="grid grid-cols-3 gap-1.5 items-center p-1 rounded bg-stone-950/60 border border-stone-800/80"
                      >
                        <span className="text-xs font-semibold text-stone-300">{th}</span>
                        <select
                          disabled={!canEdit}
                          value={row.program ?? 1}
                          onChange={(e) =>
                            updateCmds((c) => {
                              c.auto_programs[th].program = Number(e.target.value);
                              return c;
                            })
                          }
                          className="rounded border border-stone-700 bg-stone-900 text-stone-200 text-xs py-1 px-1 text-center focus:border-rose-400 focus:outline-none"
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                            <option key={n} value={n}>
                              PROG {n}
                            </option>
                          ))}
                        </select>
                        <select
                          disabled={!canEdit}
                          value={row.threshold ?? 2}
                          onChange={(e) =>
                            updateCmds((c) => {
                              c.auto_programs[th].threshold = Number(e.target.value);
                              return c;
                            })
                          }
                          className="rounded border border-stone-700 bg-stone-900 text-stone-200 text-xs py-1 px-1 text-center focus:border-rose-400 focus:outline-none"
                        >
                          <option value={1}>1 (Low)</option>
                          <option value={2}>2 (Medium)</option>
                          <option value={3}>3 (High)</option>
                        </select>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-stone-400 uppercase mb-1.5">
              Select Program to Edit
            </label>
            <div className="grid grid-cols-4 gap-1 select-none">
              {progKeys.map((pKey) => (
                <button
                  key={pKey}
                  type="button"
                  onClick={() => setActiveProg(pKey)}
                  className={`py-1 px-1.5 text-center text-xs font-mono font-bold rounded border transition-colors cursor-pointer ${
                    resolvedActiveProg === pKey
                      ? 'bg-rose-950/80 border-rose-500 text-rose-300 ring-1 ring-rose-500/50'
                      : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200 hover:bg-stone-800'
                  }`}
                >
                  {pKey}
                </button>
              ))}
            </div>
          </div>

          {cmds.programs[resolvedActiveProg] && (
            <div className="bg-stone-900/90 p-3 rounded-lg border border-stone-800 space-y-3">
              <div className="flex items-center justify-between border-b border-stone-800 pb-2 gap-2">
                <div className="flex items-center gap-2 flex-1">
                  <span className="px-2 py-0.5 rounded bg-rose-950 border border-rose-800 text-rose-300 font-mono font-bold text-xs">
                    {resolvedActiveProg}
                  </span>
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={cmds.programs[resolvedActiveProg].label || ''}
                    onChange={(e) =>
                      updateCmds((c) => {
                        c.programs[resolvedActiveProg].label = e.target.value;
                        return c;
                      })
                    }
                    placeholder="Program Description"
                    className="flex-1 rounded border border-stone-700 bg-stone-950 text-stone-200 text-xs py-1 px-2 focus:border-rose-400 focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-stone-400 uppercase">Priority:</span>
                  <select
                    disabled={!canEdit}
                    value={cmds.programs[resolvedActiveProg].priority ?? 0}
                    onChange={(e) =>
                      updateCmds((c) => {
                        c.programs[resolvedActiveProg].priority = Number(e.target.value);
                        return c;
                      })
                    }
                    className="rounded border border-stone-700 bg-stone-950 text-rose-300 text-xs py-1 px-1.5 focus:border-rose-400 focus:outline-none"
                  >
                    <option value={0}>None (0)</option>
                    <option value={1}>Chaff (1)</option>
                    <option value={2}>Flare (2)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="grid grid-cols-5 gap-1.5 text-[11px] font-bold text-stone-400 uppercase px-1">
                  <span>Dispenser</span>
                  <span className="text-center">Burst Qty</span>
                  <span className="text-center">Burst Int (s)</span>
                  <span className="text-center">Salvo Qty</span>
                  <span className="text-center">Salvo Int (s)</span>
                </div>
                {(['chaff', 'flare', 'other1', 'other2'] as const).map((disp) => {
                  const row = cmds.programs[resolvedActiveProg][disp];
                  if (!row) return null;
                  return (
                    <div
                      key={disp}
                      className="grid grid-cols-5 gap-1.5 items-center p-1.5 rounded bg-stone-950/60 border border-stone-800/80"
                    >
                      <span
                        className={`text-xs font-semibold capitalize ${
                          disp === 'chaff'
                            ? 'text-cyan-400'
                            : disp === 'flare'
                              ? 'text-amber-400'
                              : 'text-stone-400'
                        }`}
                      >
                        {disp}
                      </span>
                      {(['burst_qty', 'burst_interval', 'salvo_qty', 'salvo_interval'] as const).map(
                        (field) => (
                          <input
                            key={field}
                            type="number"
                            step={field.includes('interval') ? '0.01' : '1'}
                            min={0}
                            max={field.includes('interval') ? 10 : 99}
                            disabled={!canEdit}
                            value={row[field] ?? 0}
                            onChange={(e) =>
                              updateCmds((c) => {
                                c.programs[resolvedActiveProg][disp][field] =
                                  Number(e.target.value) || 0;
                                return c;
                              })
                            }
                            className="rounded border border-stone-700 bg-stone-900 text-stone-200 font-mono text-xs py-1 px-1 text-center focus:border-rose-400 focus:outline-none"
                          />
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
