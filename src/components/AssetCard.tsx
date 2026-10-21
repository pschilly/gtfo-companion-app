import React from 'react';
import {
  ArrowCircleUp,
  ArrowSquareOut,
  CheckCircle,
  CircleNotch,
  DownloadSimple,
  FolderOpen,
  Info,
  Lock,
  Sparkle,
  Trash,
  Warning,
} from '@phosphor-icons/react';
import { useApp } from '../context/AppContext';
import { openExternalUrl } from '../services/tauriBridge';
import { AssetItem } from '../types';
import { formatBytes } from '../utils/formatters';
import { stripMarkdown } from './MarkdownViewer';

interface AssetCardProps {
  asset: AssetItem;
}

export const AssetCard: React.FC<AssetCardProps> = ({ asset }) => {
  const {
    installedAssets,
    activeDownloads,
    canAccessAsset,
    isUpdateAvailable,
    installAsset,
    uninstallAsset,
    setSelectedAsset,
    setLoginModalOpen,
  } = useApp();

  const installed = installedAssets[asset.id];
  const progress = activeDownloads[asset.id];
  const hasAccess = canAccessAsset(asset);
  const needsUpdate = isUpdateAvailable(asset);
  const isCoreRequired = asset.requiredTier === 'core';
  const isExternalTool = Boolean(asset.isExternal || asset.category === 'tool');

  const targetPathText = asset.detectionPath
    ? `Saved Games\\DCS\\${asset.detectionPath.replace(/\//g, '\\')}`
    : asset.targetFolder
    ? `Saved Games\\DCS\\${asset.targetFolder.replace(/\//g, '\\')}${
        asset.installFolderName ? `\\${asset.installFolderName}` : ''
      }`
    : isExternalTool
    ? 'External Tool // Standalone'
    : 'Saved Games\\DCS';

  return (
    <div
      className={`group rounded-2xl bg-stone-900/90 border transition-all duration-200 flex flex-col overflow-hidden ${
        asset.requirementLevel === 'required_all'
          ? 'border-red-500/40 hover:border-red-500/70 shadow-lg shadow-red-950/10'
          : isCoreRequired || asset.requirementLevel === 'required_core'
          ? 'border-amber-500/35 hover:border-amber-500/65 shadow-lg shadow-amber-950/10'
          : 'border-stone-800 hover:border-stone-700 shadow-lg shadow-black/20'
      }`}
    >
      {/* Preview Image Header */}
      <div
        onClick={() => setSelectedAsset(asset)}
        className="relative h-44 w-full bg-stone-950 overflow-hidden cursor-pointer"
      >
        <img
          src={asset.imagePreviewUrl}
          alt={asset.name}
          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 opacity-85 group-hover:opacity-100"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-stone-900 via-stone-900/25 to-transparent" />

        {/* Top Badges Header: Left (Airframe) | Center (Requirement) | Right (Access Tier) */}
        <div className="absolute top-3 inset-x-3 flex items-center justify-between pointer-events-none z-10 gap-1.5">
          {/* Left Slot: Airframe */}
          <div className="flex-1 flex justify-start min-w-0">
            {asset.aircraftOrModule &&
              !asset.aircraftOrModule.toLowerCase().includes('agnostic') && (
                <span className="px-2 py-0.5 rounded bg-stone-950/90 backdrop-blur-md border border-stone-700/80 text-[11px] font-mono font-semibold text-stone-200 shadow-sm truncate max-w-full">
                  {asset.aircraftOrModule}
                </span>
              )}
          </div>

          {/* Center Slot: Requirement Level */}
          <div className="shrink-0 flex justify-center">
            {asset.requirementLevel === 'required_all' ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-600/95 text-white font-mono font-bold text-[10px] uppercase tracking-wider shadow whitespace-nowrap">
                <Warning className="w-3 h-3" />
                REQUIRED FOR ALL
              </span>
            ) : asset.requirementLevel === 'required_core' ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/95 text-stone-950 font-mono font-bold text-[10px] uppercase tracking-wider shadow whitespace-nowrap">
                <Sparkle className="w-3 h-3" />
                REQUIRED FOR CORE
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded bg-stone-900/85 backdrop-blur-md border border-stone-700 text-[10px] font-mono uppercase text-stone-300 shadow-sm whitespace-nowrap">
                OPTIONAL
              </span>
            )}
          </div>

          {/* Right Slot: Access Tier */}
          <div className="flex-1 flex justify-end">
            {isCoreRequired ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-950/90 border border-amber-500/50 text-amber-300 font-mono font-bold text-[10px] uppercase shadow-sm whitespace-nowrap">
                CORE TIER
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-950/90 border border-stone-700 text-stone-300 font-mono text-[10px] uppercase shadow-sm whitespace-nowrap">
                COMMUNITY
              </span>
            )}
          </div>
        </div>

        {/* Bottom Overlay Status Badges */}
        <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between">
          <span className="text-[11px] font-mono text-stone-300 bg-stone-950/80 px-2 py-0.5 rounded border border-stone-800">
            {asset.version ? `Rev ${asset.version} • ` : ''}
            {isExternalTool || asset.fileSizeBytes === 0
              ? 'External Tool'
              : formatBytes(asset.fileSizeBytes)}
          </span>

          {needsUpdate ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500 text-stone-950 font-mono font-bold text-[10px] uppercase">
              <ArrowCircleUp className="w-3 h-3" />
              UPDATE AVAILABLE
            </span>
          ) : installed ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 font-mono font-semibold text-[10px] uppercase">
              <CheckCircle className="w-3 h-3" />
              INSTALLED
            </span>
          ) : null}
        </div>
      </div>

      {/* Card Content */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h3
              onClick={() => setSelectedAsset(asset)}
              className="font-display font-semibold text-sm text-stone-100 group-hover:text-amber-400 transition-colors cursor-pointer line-clamp-1"
              title={asset.name}
            >
              {asset.name}
            </h3>
          </div>
          <p className="text-xs text-stone-400 line-clamp-2 leading-relaxed">
            {stripMarkdown(asset.description)}
          </p>

          {/* Target Subdirectory Info */}
          <div className="pt-1 flex items-center gap-1.5 text-[11px] font-mono text-stone-400">
            <FolderOpen className="w-3.5 h-3.5 text-stone-500 shrink-0" />
            <span className="truncate" title={targetPathText}>
              {targetPathText}
            </span>
          </div>
        </div>

        {/* Progress Bar (When Actively Downloading/Extracting) */}
        {progress ? (
          <div className="space-y-1.5 pt-2 border-t border-stone-800/80">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-amber-300 flex items-center gap-1.5 truncate">
                <CircleNotch className="w-3.5 h-3.5 animate-spin shrink-0" />
                {progress.stage.toUpperCase()}
              </span>
              <span className="text-stone-300">{progress.percent}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-stone-950 overflow-hidden border border-stone-800">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-200"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <p className="text-[10px] font-mono text-stone-400 truncate">{progress.message}</p>
          </div>
        ) : (
          /* Action Buttons */
          <div className="pt-3 border-t border-stone-800/80 flex items-center gap-2">
            {!hasAccess ? (
              <button
                onClick={() => setLoginModalOpen(true)}
                className="flex-1 py-2 px-3 rounded-xl bg-stone-950 hover:bg-stone-800 border border-amber-500/30 text-amber-300/90 text-xs font-mono font-medium flex items-center justify-center gap-1.5 transition-colors"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>
                  {asset.requiredTier === 'core'
                    ? 'Requires CORE Role'
                    : 'Sign In to Deploy'}
                </span>
              </button>
            ) : isExternalTool ? (
              installed ? (
                <>
                  <button
                    onClick={() => setSelectedAsset(asset)}
                    className="flex-1 py-2 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 font-mono font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Installed</span>
                  </button>
                  {asset.externalUrl && (
                    <button
                      onClick={() => openExternalUrl(asset.externalUrl!)}
                      title="Open external releases page / documentation"
                      className="p-2 rounded-xl bg-stone-950 hover:bg-stone-800 border border-stone-800 text-stone-400 hover:text-amber-300 transition-colors"
                    >
                      <ArrowSquareOut className="w-4 h-4" />
                    </button>
                  )}
                </>
              ) : (
                <button
                  onClick={() => {
                    if (asset.externalUrl) {
                      openExternalUrl(asset.externalUrl);
                    } else {
                      setSelectedAsset(asset);
                    }
                  }}
                  className="flex-1 py-2 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500 border border-amber-500/50 text-amber-300 hover:text-stone-950 font-mono font-semibold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm"
                >
                  <ArrowSquareOut className="w-3.5 h-3.5" />
                  <span>External Installer</span>
                </button>
              )
            ) : needsUpdate ? (
              <button
                onClick={() => installAsset(asset)}
                className="flex-1 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-mono font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
              >
                <ArrowCircleUp className="w-4 h-4" />
                <span>Update ({asset.version})</span>
              </button>
            ) : installed ? (
              <>
                <button
                  onClick={() => setSelectedAsset(asset)}
                  className="flex-1 py-2 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 font-mono font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Installed</span>
                </button>
                <button
                  onClick={() => uninstallAsset(asset.id)}
                  title="Uninstall and clean files from DCS Saved Games"
                  className="p-2 rounded-xl bg-stone-950 hover:bg-red-500/20 border border-stone-800 hover:border-red-500/40 text-stone-400 hover:text-red-300 transition-colors"
                >
                  <Trash className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button
                onClick={() => installAsset(asset)}
                className="flex-1 py-2 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500 border border-amber-500/50 text-amber-300 hover:text-stone-950 font-mono font-semibold text-xs flex items-center justify-center gap-1.5 transition-all"
              >
                <DownloadSimple className="w-3.5 h-3.5" />
                <span>Deploy to DCS</span>
              </button>
            )}

            <button
              onClick={() => setSelectedAsset(asset)}
              title="Inspect asset details"
              className="p-2 rounded-xl bg-stone-950 hover:bg-stone-800 border border-stone-800 text-stone-400 hover:text-stone-200 transition-colors"
            >
              <Info className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
