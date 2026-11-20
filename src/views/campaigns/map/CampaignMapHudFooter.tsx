import React from 'react';
import {
  ArrowsIn,
  ArrowsLeftRight,
  ArrowsOutCardinal,
  Compass,
  CrosshairSimple,
  House,
  SealQuestion,
} from '@phosphor-icons/react';
import { CampaignMapBullseye } from '../../../types';
import { formatCoordinateDdm, formatCoordinateDms, toMgrs } from './geodesy';

interface CampaignMapHudFooterProps {
  cursorCoords: { lat: number; lng: number } | null;
  coordMode: 'ddm' | 'dms';
  onToggleCoordMode: () => void;
  bullseyes: CampaignMapBullseye[];
  activeBullseyeIndex: number;
  onCycleBullseye: () => void;
  braaFormatted: string | null;
  cursorElevFt: number | null;
  unit: 'nm' | 'km';
  onToggleUnit: () => void;
  onResetPosition: () => void;
  isFocusMode: boolean;
  onToggleFocusMode: () => void;
  navaidsEnabled: boolean;
  onToggleNavaids: () => void;
  legendOpen: boolean;
  onToggleLegend: () => void;
}

/**
 * Replicates `partials/map-hud-footer.blade.php` with prefixed read-only telemetry boxes
 * (`LLDM`/`LLDMS` click-to-swap, `MGRS`, clickable cycling `BLUE`/`RED` Bullseye, `ELV`),
 * unit toggle (`NM`/`KM`), reset home, focus mode, NAVAIDs ring toggle, and Legend button.
 */
export const CampaignMapHudFooter: React.FC<CampaignMapHudFooterProps> = ({
  cursorCoords,
  coordMode,
  onToggleCoordMode,
  bullseyes,
  activeBullseyeIndex,
  onCycleBullseye,
  braaFormatted,
  cursorElevFt,
  unit,
  onToggleUnit,
  onResetPosition,
  isFocusMode,
  onToggleFocusMode,
  navaidsEnabled,
  onToggleNavaids,
  legendOpen,
  onToggleLegend,
}) => {
  const activeBe = bullseyes[activeBullseyeIndex] || bullseyes[0] || null;
  const beName = (activeBe?.name || 'B/E').toUpperCase();
  const isBlueBe = beName === 'BLUE';
  const isRedBe = beName === 'RED';

  const llValue = cursorCoords
    ? coordMode === 'ddm'
      ? formatCoordinateDdm(cursorCoords.lat, cursorCoords.lng)
      : formatCoordinateDms(cursorCoords.lat, cursorCoords.lng)
    : '--';
  const mgrsValue = cursorCoords ? toMgrs(cursorCoords.lat, cursorCoords.lng, 5) : '--';
  const elevValue =
    cursorElevFt !== null
      ? unit === 'km'
        ? `${Math.round(cursorElevFt * 0.3048)} m`
        : `${cursorElevFt.toLocaleString()} ft`
      : '---';

  return (
    <div className="px-3 py-2 bg-[#110f0d] border-t border-stone-800 flex flex-wrap justify-between items-center gap-3 select-none">
      {/* Left Prefixed Read-Only Coordinates Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onToggleCoordMode}
          title={coordMode === 'ddm' ? 'Click to swap to LLDMS' : 'Click to swap to LLDM'}
          className="flex items-center bg-stone-900 border border-stone-700/80 rounded-lg overflow-hidden shadow-sm hover:border-stone-500 transition cursor-pointer"
        >
          <span
            className={`px-2.5 py-1.5 bg-stone-950/70 border-r border-stone-800 font-semibold text-xs ${
              coordMode === 'ddm' ? 'text-emerald-400' : 'text-sky-400'
            }`}
          >
            {coordMode === 'ddm' ? 'LLDM' : 'LLDMS'}
          </span>
          <span className="px-2.5 py-1.5 text-xs font-mono text-stone-200 min-w-[175px] text-left">
            {llValue}
          </span>
        </button>

        <div className="flex items-center bg-stone-900 border border-stone-700/80 rounded-lg overflow-hidden shadow-sm">
          <span className="px-2.5 py-1.5 bg-stone-950/70 border-r border-stone-800 font-semibold text-xs text-amber-400">
            MGRS
          </span>
          <span className="px-2.5 py-1.5 text-xs font-mono text-stone-200 min-w-[155px]">
            {mgrsValue}
          </span>
        </div>

        {bullseyes.length > 0 && (
          <button
            type="button"
            onClick={onCycleBullseye}
            title={
              bullseyes.length > 1
                ? `Click to cycle Bullseye (${beName} active, ${bullseyes.length} available)`
                : `Active Bullseye: ${beName}`
            }
            className="flex items-center bg-stone-900 border border-stone-700/80 rounded-lg overflow-hidden shadow-sm hover:border-stone-500 transition cursor-pointer"
          >
            <span
              className={`px-2.5 py-1.5 bg-stone-950/70 border-r border-stone-800 font-bold text-xs flex items-center gap-1 ${
                isBlueBe ? 'text-sky-400' : isRedBe ? 'text-rose-500' : 'text-amber-400'
              }`}
            >
              <CrosshairSimple className="w-3.5 h-3.5" weight="bold" />
              <span className="text-[10px] tracking-tight">{beName}</span>
            </span>
            <span className="px-2.5 py-1.5 text-xs font-mono text-stone-200 min-w-[115px] text-left">
              {braaFormatted || '--'}
            </span>
          </button>
        )}

        <div className="flex items-center bg-stone-900 border border-stone-700/80 rounded-lg overflow-hidden shadow-sm">
          <span className="px-2.5 py-1.5 bg-stone-950/70 border-r border-stone-800 font-semibold text-xs text-stone-400">
            ELV
          </span>
          <span className="px-2.5 py-1.5 text-xs font-mono text-stone-200 min-w-[75px]">
            {elevValue}
          </span>
        </div>
      </div>

      {/* Right Control Buttons */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleUnit}
          title="Change Units (Alt + U)"
          className="px-2.5 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-700 text-xs font-semibold text-stone-200 flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowsLeftRight className="w-3.5 h-3.5 text-stone-400" weight="duotone" />
          <span className="font-mono uppercase">{unit}</span>
        </button>

        <button
          type="button"
          onClick={onResetPosition}
          title="Return to Default Position"
          className="p-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 cursor-pointer"
        >
          <House className="w-4 h-4" weight="duotone" />
        </button>

        <button
          type="button"
          onClick={onToggleFocusMode}
          title="Toggle Focus Mode (Alt + Enter)"
          className={`p-2 rounded-lg border cursor-pointer transition ${
            isFocusMode
              ? 'bg-sky-500/20 border-sky-500/70 text-sky-300'
              : 'bg-stone-900 hover:bg-stone-800 border-stone-700 text-stone-300'
          }`}
        >
          {isFocusMode ? (
            <ArrowsIn className="w-4 h-4" weight="duotone" />
          ) : (
            <ArrowsOutCardinal className="w-4 h-4" weight="duotone" />
          )}
        </button>

        <button
          type="button"
          onClick={onToggleNavaids}
          title="Toggle NAVAIDs Layer"
          className={`p-2 rounded-lg border cursor-pointer transition ${
            navaidsEnabled
              ? 'bg-sky-500/20 border-sky-500/80 text-sky-300 ring-1 ring-sky-500/70 shadow-[0_0_8px_rgba(14,165,233,0.3)]'
              : 'bg-stone-900 hover:bg-stone-800 border-stone-700 text-stone-300'
          }`}
        >
          <Compass className="w-4 h-4" weight="duotone" />
        </button>

        <button
          type="button"
          onClick={onToggleLegend}
          title="Legend"
          className={`p-2 rounded-lg border cursor-pointer transition ${
            legendOpen
              ? 'bg-sky-500/20 border-sky-500/70 text-sky-300'
              : 'bg-stone-900 hover:bg-stone-800 border-stone-700 text-stone-300'
          }`}
        >
          <SealQuestion className="w-4 h-4" weight="duotone" />
        </button>
      </div>
    </div>
  );
};
