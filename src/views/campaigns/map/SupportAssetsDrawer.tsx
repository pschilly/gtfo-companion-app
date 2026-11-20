import React, { useEffect, useState } from 'react';
import {
  ArrowUUpLeft,
  FloppyDisk,
  Lock,
  Plus,
  ShieldCheck,
} from '@phosphor-icons/react';
import { saveCampaignSupportAssets } from '../../../services/campaignMapService';
import { CampaignMapPayload, CampaignMapSupportAsset } from '../../../types';
import { FloatingToolWindow } from './FloatingToolWindow';
import { autoParseCoordinateOrLocation } from './flightPlanner/helpers';
import { SupportAssetsControllerStats } from './activeSupportAssetsLayer';

interface SupportAssetsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  zIndex: number;
  onFocus: () => void;
  apiBaseUrl: string;
  discordId?: string | null;
  token?: string | null;
  mapData: CampaignMapPayload;
  selectedAssetType: string;
  onSelectAssetType: (type: string) => void;
  stats: SupportAssetsControllerStats;
  onGetSavePayload: () => {
    supportAssets: Partial<CampaignMapSupportAsset>[];
    removedIds: number[];
  };
  onAppliedSavedAssets: (fresh: CampaignMapSupportAsset[]) => void;
  onQuickAddAt: (lat: number, lng: number) => void;
  onUndoRemoval: () => void;
  onDiscardPending: () => void;
  onCenterMap: (lat: number, lng: number, zoom?: number) => void;
  onNotify: (level: 'info' | 'success' | 'warning' | 'error', msg: string) => void;
}

/**
 * Exact 1-for-1 Member Portal Support Assets floating drawer (`support-assets-drawer.blade.php`).
 */
export const SupportAssetsDrawer: React.FC<SupportAssetsDrawerProps> = ({
  isOpen,
  onClose,
  zIndex,
  onFocus,
  apiBaseUrl,
  discordId,
  token,
  mapData,
  selectedAssetType,
  onSelectAssetType,
  stats,
  onGetSavePayload,
  onAppliedSavedAssets,
  onQuickAddAt,
  onUndoRemoval,
  onDiscardPending,
  onCenterMap,
  onNotify,
}) => {
  const canEdit = mapData.permissions.canManageSupportAssets;
  const assetTypes = mapData.supportAssetTypes || [];
  const [coordInput, setCoordInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (assetTypes.length > 0 && !assetTypes.some((t) => t.value === selectedAssetType)) {
      const tanker = assetTypes.find((t) => t.value === 'tanker');
      onSelectAssetType(tanker ? tanker.value : assetTypes[0].value);
    }
  }, [assetTypes, selectedAssetType, onSelectAssetType]);

  const handleQuickAdd = () => {
    if (!canEdit) return;
    const raw = coordInput.trim();
    if (!raw) return;

    const parsed = autoParseCoordinateOrLocation(
      raw,
      mapData.airbases || [],
      mapData.navaids || []
    );
    if (!parsed || !Number.isFinite(parsed.lat) || !Number.isFinite(parsed.lng)) {
      onNotify(
        'error',
        'Could not parse coordinates. Enter MGRS, DDM, DMS, Lat/Lon, or Airfield name.'
      );
      return;
    }

    onQuickAddAt(parsed.lat, parsed.lng);
    onCenterMap(parsed.lat, parsed.lng, 10);
    setCoordInput('');
    onNotify('success', 'Support asset placed at coordinates.');
  };

  const handleSave = async () => {
    if (!canEdit || isSaving) return;
    const payload = onGetSavePayload();
    setIsSaving(true);
    try {
      const fresh = await saveCampaignSupportAssets(
        apiBaseUrl,
        mapData.campaign.id,
        payload.supportAssets,
        payload.removedIds,
        { discordId, token }
      );
      onAppliedSavedAssets(fresh);
      onNotify('success', 'Support assets saved to campaign map.');
    } catch (err: any) {
      onNotify('error', err?.message || 'Failed to save support assets.');
    } finally {
      setIsSaving(false);
    }
  };

  const headerActions = canEdit ? (
    <button
      type="button"
      onClick={handleSave}
      disabled={isSaving}
      title="Save Support Assets"
      className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-[11px] font-bold flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
    >
      <FloppyDisk className="w-3.5 h-3.5" weight="duotone" />
      <span>{isSaving ? 'Saving...' : 'Save'}</span>
    </button>
  ) : undefined;

  return (
    <FloatingToolWindow
      title="Support Assets"
      titleClassName="text-sky-400"
      icon={<ShieldCheck className="w-4 h-4 text-sky-400" weight="duotone" />}
      headerActions={headerActions}
      isOpen={isOpen}
      onClose={onClose}
      initialPos={{
        x: typeof window !== 'undefined' ? Math.min(500, Math.max(24, window.innerWidth - 380)) : 500,
        y: 120,
      }}
      widthClass="w-[340px] max-w-[94vw]"
      maxHeightClass="max-h-[85vh]"
      zIndex={zIndex}
      onFocus={onFocus}
    >
      <div className="p-3 text-xs text-stone-200 bg-stone-800/80 overflow-y-auto space-y-3">
        {!canEdit && (
          <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-700/50 text-amber-300 flex items-center gap-2 text-[11px]">
            <Lock className="w-4 h-4 shrink-0 text-amber-400" weight="duotone" />
            <span>Read-only: Support Asset management permission required to edit or place assets.</span>
          </div>
        )}

        {/* Asset Type Selection */}
        <div
          className={`bg-stone-900/90 p-2.5 rounded-lg border border-stone-800 space-y-1.5 ${
            !canEdit ? 'opacity-50 pointer-events-none' : ''
          }`}
        >
          <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider">
            Asset Type to Place
          </label>
          <select
            value={selectedAssetType}
            onChange={(e) => onSelectAssetType(e.target.value)}
            disabled={!canEdit}
            className="w-full rounded-md border border-stone-700 bg-stone-950 text-stone-200 text-xs px-2.5 py-1.5 focus:border-sky-400 focus:ring-1 focus:ring-sky-400 focus:outline-none"
          >
            {assetTypes.map((saType) => (
              <option key={saType.value} value={saType.value}>
                {saType.label}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-stone-500 italic">
            Newly placed assets will default to this type.
          </p>
        </div>

        {/* Coordinate Quick Add */}
        <div
          className={`bg-stone-900/90 p-2.5 rounded-lg border border-stone-800 space-y-2 ${
            !canEdit ? 'opacity-50 pointer-events-none' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-sky-500" />
              <span>Quick Add by Coordinates</span>
            </label>
            <span className="text-[9px] text-stone-500 font-mono">
              MGRS &bull; DDM &bull; DMS &bull; Lat/Lon
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <input
                type="text"
                value={coordInput}
                onChange={(e) => setCoordInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleQuickAdd();
                  }
                }}
                disabled={!canEdit}
                placeholder="Paste coords (e.g. 36S YE 67795 22013, 35°29.86'N...)"
                className="w-full bg-stone-950 border border-stone-700 rounded-md px-2.5 py-1.5 text-xs text-stone-100 font-mono placeholder:text-stone-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:outline-none pr-6"
              />
              {coordInput && (
                <button
                  type="button"
                  onClick={() => setCoordInput('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300 text-xs cursor-pointer"
                  title="Clear"
                >
                  &times;
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={handleQuickAdd}
              disabled={!canEdit}
              className="px-2.5 py-1.5 rounded-md bg-sky-900/90 hover:bg-sky-800 text-sky-100 border border-sky-700/80 text-xs font-bold transition-colors flex items-center gap-1 shrink-0 cursor-pointer shadow-sm"
              title="Add Support Asset at Coordinates"
            >
              <Plus className="w-3.5 h-3.5" weight="bold" />
              <span>Add</span>
            </button>
          </div>
          <p className="text-[10px] text-stone-500 italic">
            Press Enter to place asset at coordinates, or click map directly.
          </p>
        </div>

        {/* Instructions */}
        <p className="text-xs text-stone-400 leading-relaxed">
          Click map to add SAM Sites, AWACS, or Tankers. Drag to reposition and click to configure
          radar heading, frequencies, or orbits.
        </p>

        {/* Stats Overview Cards */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-stone-900/90 border border-stone-800 rounded-lg p-2 flex flex-col items-center justify-center">
            <span className="text-[10px] uppercase font-bold text-stone-400">Confirmed</span>
            <span className="font-mono text-emerald-400 font-bold text-base mt-0.5">
              {stats.confirmedCount}
            </span>
          </div>
          <div className="bg-stone-900/90 border border-stone-800 rounded-lg p-2 flex flex-col items-center justify-center">
            <span className="text-[10px] uppercase font-bold text-stone-400">Pending</span>
            <span className="font-mono text-amber-400 font-bold text-base mt-0.5">
              {stats.pendingCount}
            </span>
          </div>
          <div className="bg-stone-900/90 border border-stone-800 rounded-lg p-2 flex flex-col items-center justify-center">
            <span className="text-[10px] uppercase font-bold text-stone-400">Removal</span>
            <span className="font-mono text-red-400 font-bold text-base mt-0.5">
              {stats.removedCount}
            </span>
          </div>
        </div>

        {/* Pending Removal / Undo & Discard Action Bar */}
        {canEdit && (
          <div className="flex items-center justify-between pt-1 border-t border-stone-800/80">
            {stats.undoCount > 0 ? (
              <button
                type="button"
                onClick={onUndoRemoval}
                className="px-2 py-1 rounded bg-stone-700 hover:bg-stone-600 text-stone-200 text-xs font-bold border border-stone-600 transition-colors flex items-center gap-1 cursor-pointer"
                title="Undo Last Removal"
              >
                <ArrowUUpLeft className="w-3 h-3 text-amber-300" weight="bold" />
                <span>Undo Removal</span>
              </button>
            ) : (
              <div />
            )}

            <button
              type="button"
              onClick={onDiscardPending}
              className="text-xs text-red-400 hover:text-red-300 font-medium transition-colors cursor-pointer"
            >
              Discard Pending
            </button>
          </div>
        )}
      </div>
    </FloatingToolWindow>
  );
};
