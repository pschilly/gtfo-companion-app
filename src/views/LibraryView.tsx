import React from 'react';
import {
  AlertTriangle,
  ArrowUpCircle,
  CheckCircle2,
  FolderCheck,
  FolderOpen,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatShortDate } from '../utils/formatters';

export const LibraryView: React.FC = () => {
  const {
    manifest,
    installedAssets,
    activeDownloads,
    rescanLocalAssets,
    outdatedAssets,
    installAsset,
    uninstallAsset,
    verifyAsset,
    verifyingAssetId,
    lastVerifyResults,
    updateAllOutdated,
    setSelectedAsset,
    setActiveTab,
  } = useApp();

  const installedList = Object.values(installedAssets);

  return (
    <div className="space-y-6 pb-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-800/80">
        <div>
          <h1 className="font-display text-2xl font-bold bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent">
            Installed Library // Local DCS Packages
          </h1>
          <p className="text-xs text-stone-400 mt-0.5">
            Automatically detects existing liveries and mods in your DCS Saved Games directory,
            verifies file checksums, and manages updates.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={rescanLocalAssets}
            className="px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-200 font-mono text-xs flex items-center gap-2 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
            Rescan Local DCS Folder
          </button>

          {outdatedAssets.length > 0 && (
            <button
              onClick={updateAllOutdated}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-mono font-bold text-xs flex items-center gap-2 shadow"
            >
              <ArrowUpCircle className="w-4 h-4" />
              Update All ({outdatedAssets.length})
            </button>
          )}
        </div>
      </div>

      {installedList.length === 0 ? (
        <div className="p-12 rounded-2xl bg-stone-900/85 border border-stone-800 text-center space-y-4">
          <FolderCheck className="w-10 h-10 text-stone-500 mx-auto" />
          <div className="space-y-1">
            <h3 className="font-display text-base font-semibold text-stone-100">
              No Assets Installed Yet
            </h3>
            <p className="text-xs text-stone-400 max-w-md mx-auto">
              Deploy squadron liveries or mods from the catalog and they will be tracked here for
              one-click updates and clean uninstallation.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => setActiveTab('liveries')}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-display font-bold text-xs"
            >
              Browse Liveries
            </button>
            <button
              onClick={() => setActiveTab('mods')}
              className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-display font-semibold text-xs"
            >
              Browse Mods
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {installedList.map((record) => {
            const remoteItem = manifest.assets.find((a) => a.id === record.assetId);
            const hasUpdate =
              remoteItem && remoteItem.version !== record.installedVersion;
            const isVerifying = verifyingAssetId === record.assetId;
            const verifyRes = lastVerifyResults[record.assetId];
            const progress = activeDownloads[record.assetId];
            const issueCount = verifyRes
              ? (verifyRes.missingFiles?.length || 0) + (verifyRes.modifiedFiles?.length || 0)
              : 0;

            return (
              <div
                key={record.assetId}
                className={`p-4 rounded-xl bg-stone-900/90 border transition-all flex flex-col gap-3 ${
                  verifyRes && !verifyRes.valid
                    ? 'border-amber-500/60'
                    : 'border-stone-800 hover:border-stone-700'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {record.aircraftOrModule &&
                        !record.aircraftOrModule.toLowerCase().includes('agnostic') && (
                          <span className="px-2 py-0.5 rounded bg-stone-950 border border-stone-800 text-[11px] font-mono text-amber-300">
                            {record.aircraftOrModule}
                          </span>
                        )}
                      <h3
                        onClick={() => remoteItem && setSelectedAsset(remoteItem)}
                        className="font-display font-semibold text-sm text-stone-100 hover:text-amber-400 cursor-pointer"
                      >
                        {record.name}
                      </h3>
                      {hasUpdate ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500 text-stone-950 font-mono font-bold text-[10px]">
                          <ArrowUpCircle className="w-3 h-3" />
                          UPDATE AVAILABLE: v{remoteItem.version}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-mono text-[10px]">
                          <CheckCircle2 className="w-3 h-3" />
                          v{record.installedVersion} (CURRENT)
                        </span>
                      )}

                      {verifyRes && verifyRes.valid && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 font-mono font-bold text-[10px]">
                          <ShieldCheck className="w-3 h-3" />
                          VERIFIED ({verifyRes.checkedCount || record.extractedFiles.length} FILES)
                        </span>
                      )}

                      {verifyRes && !verifyRes.valid && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/50 text-amber-300 font-mono font-bold text-[10px]">
                          <AlertTriangle className="w-3 h-3 text-amber-400" />
                          INTEGRITY ISSUE ({issueCount} FILE{issueCount === 1 ? '' : 'S'})
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-stone-400">
                      <span className="flex items-center gap-1.5 truncate">
                        <FolderOpen className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                        {record.installedPath}
                      </span>
                      <span>• Installed {formatShortDate(record.installedAt)}</span>
                      <span>• {record.extractedFiles.length} tracked files</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {hasUpdate && remoteItem && (
                      <button
                        onClick={() => installAsset(remoteItem)}
                        className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-mono font-bold text-xs flex items-center gap-1.5"
                      >
                        <ArrowUpCircle className="w-3.5 h-3.5" />
                        Update to v{remoteItem.version}
                      </button>
                    )}

                    <button
                      onClick={() => verifyAsset(record.assetId)}
                      disabled={isVerifying || Boolean(progress)}
                      title="Verify all package files and checksums on disk"
                      className="px-3 py-2 rounded-xl bg-stone-950 hover:bg-stone-800 border border-stone-800 text-stone-300 font-mono text-xs flex items-center gap-1.5 disabled:opacity-60"
                    >
                      {isVerifying ? (
                        <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                      ) : (
                        <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                      )}
                      {isVerifying ? 'Verifying...' : 'Verify'}
                    </button>

                    {remoteItem && (
                      <button
                        onClick={() => installAsset(remoteItem)}
                        disabled={Boolean(progress)}
                        title="Reinstall / Repair asset files"
                        className={`px-3 py-2 rounded-xl font-mono text-xs flex items-center gap-1.5 disabled:opacity-60 ${
                          verifyRes && !verifyRes.valid
                            ? 'bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold shadow'
                            : 'bg-stone-950 hover:bg-stone-800 border border-stone-800 text-stone-300'
                        }`}
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Repair
                      </button>
                    )}

                    <button
                      onClick={() => uninstallAsset(record.assetId)}
                      disabled={Boolean(progress)}
                      className="px-3 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 text-red-300 font-mono text-xs flex items-center gap-1.5 disabled:opacity-60"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Uninstall
                    </button>
                  </div>
                </div>

                {progress && (
                  <div className="pt-2 border-t border-stone-800/80 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-amber-300 flex items-center gap-1.5 truncate">
                        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                        {progress.message}
                      </span>
                      <span className="text-stone-300 shrink-0">{progress.percent}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-stone-950 overflow-hidden border border-stone-800">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-200"
                        style={{ width: `${progress.percent}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
