import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowCircleUp,
  ArrowsClockwise,
  CheckCircle,
  CircleNotch,
  Folder,
  FolderOpen,
  Funnel,
  Package,
  PaintBrush,
  ShieldCheck,
  Sparkle,
  Stack,
  Trash,
  Warning,
} from '@phosphor-icons/react';
import { AssetCard } from '../components/AssetCard';
import { useApp } from '../context/AppContext';
import { RequirementLevel } from '../types';
import { formatShortDate } from '../utils/formatters';

export type AssetManagerSubTab = 'library' | 'liveries' | 'mods';

interface AssetManagerViewProps {
  searchQuery: string;
  initialSubTab?: AssetManagerSubTab;
}

export const AssetManagerView: React.FC<AssetManagerViewProps> = ({
  searchQuery,
  initialSubTab = 'library',
}) => {
  const {
    activeTab,
    setActiveTab,
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
  } = useApp();

  const [subTab, setSubTab] = useState<AssetManagerSubTab>(() => {
    if (activeTab === 'liveries') return 'liveries';
    if (activeTab === 'mods') return 'mods';
    if (activeTab === 'library') return 'library';
    return initialSubTab;
  });

  // Sync subTab when activeTab changes externally (e.g. from TopBar search, HomeView, or Checklist)
  useEffect(() => {
    if (activeTab === 'liveries') setSubTab('liveries');
    else if (activeTab === 'mods') setSubTab('mods');
    else if (activeTab === 'library') setSubTab('library');
  }, [activeTab]);

  const handleSelectSubTab = (next: AssetManagerSubTab) => {
    setSubTab(next);
    setActiveTab(next);
  };

  // Catalog Filters
  const [reqFilter, setReqFilter] = useState<'all' | RequirementLevel>('all');
  const [moduleFilter, setModuleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'all' | 'installed' | 'not_installed'>('all');

  // Reset module filter when switching between Liveries and Mods tabs
  useEffect(() => {
    setModuleFilter('ALL');
  }, [subTab]);

  // Library verification state
  const installedList = Object.values(installedAssets);
  const [isVerifyingAll, setIsVerifyingAll] = useState(false);
  const [verifyAllFeedback, setVerifyAllFeedback] = useState<string | null>(null);

  const liveryCount = useMemo(
    () => manifest.assets.filter((a) => a.category === 'livery').length,
    [manifest.assets]
  );
  const modCount = useMemo(
    () => manifest.assets.filter((a) => a.category === 'mod' || a.category === 'tool').length,
    [manifest.assets]
  );

  const activeCategory = subTab === 'liveries' ? 'livery' : 'mod';

  const categoryAssets = useMemo(
    () =>
      manifest.assets.filter((a) => {
        if (activeCategory === 'livery') return a.category === 'livery';
        return a.category === 'mod' || a.category === 'tool';
      }),
    [manifest.assets, activeCategory]
  );

  const modules = useMemo(() => {
    const set = new Set<string>();
    categoryAssets.forEach((a) => {
      if (a.aircraftOrModule && !a.aircraftOrModule.toLowerCase().includes('agnostic')) {
        set.add(a.aircraftOrModule);
      }
    });
    return ['ALL', ...Array.from(set)];
  }, [categoryAssets]);

  const filteredAssets = useMemo(() => {
    return categoryAssets.filter((asset) => {
      if (reqFilter !== 'all' && asset.requirementLevel !== reqFilter) return false;
      if (moduleFilter !== 'ALL' && asset.aircraftOrModule !== moduleFilter) return false;

      const isInstalled = Boolean(installedAssets[asset.id]);
      if (statusFilter === 'installed' && !isInstalled) return false;
      if (statusFilter === 'not_installed' && isInstalled) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = asset.name.toLowerCase().includes(q);
        const matchDesc = asset.description.toLowerCase().includes(q);
        const matchMod = asset.aircraftOrModule.toLowerCase().includes(q);
        const matchTags = asset.tags?.some((t) => t.toLowerCase().includes(q));
        if (!matchName && !matchDesc && !matchMod && !matchTags) return false;
      }

      return true;
    });
  }, [categoryAssets, reqFilter, moduleFilter, statusFilter, installedAssets, searchQuery]);

  const filteredInstalledList = useMemo(() => {
    if (!searchQuery.trim()) return installedList;
    const q = searchQuery.toLowerCase();
    return installedList.filter(
      (record) =>
        record.name.toLowerCase().includes(q) ||
        record.aircraftOrModule?.toLowerCase().includes(q) ||
        record.installedPath?.toLowerCase().includes(q)
    );
  }, [installedList, searchQuery]);

  const handleVerifyAll = async () => {
    if (installedList.length === 0 || isVerifyingAll) return;
    setIsVerifyingAll(true);
    setVerifyAllFeedback(null);
    let totalIssuesFound = 0;

    for (const record of installedList) {
      const ok = await verifyAsset(record.assetId);
      if (!ok) {
        totalIssuesFound++;
        break;
      }
    }

    setIsVerifyingAll(false);
    if (totalIssuesFound === 0) {
      setVerifyAllFeedback(`All ${installedList.length} packages verified! No file issues found.`);
      setTimeout(() => setVerifyAllFeedback(null), 4000);
    }
  };

  const tabs: {
    id: AssetManagerSubTab;
    label: string;
    icon: React.ReactNode;
    badge?: React.ReactNode;
  }[] = [
    {
      id: 'library',
      label: 'Library',
      icon: <Folder className="w-4 h-4" />,
      badge:
        outdatedAssets.length > 0 ? (
          <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-stone-950 text-[10px] font-mono font-bold">
            {outdatedAssets.length} update{outdatedAssets.length === 1 ? '' : 's'}
          </span>
        ) : (
          <span className="px-1.5 py-0.2 rounded-full bg-stone-800 text-stone-300 text-[10px] font-mono">
            {installedList.length}
          </span>
        ),
    },
    {
      id: 'liveries',
      label: 'Airframe Liveries',
      icon: <PaintBrush className="w-4 h-4" />,
      badge: (
        <span className="px-1.5 py-0.2 rounded-full bg-stone-800 text-stone-300 text-[10px] font-mono">
          {liveryCount}
        </span>
      ),
    },
    {
      id: 'mods',
      label: 'Mods',
      icon: <Package className="w-4 h-4" />,
      badge: (
        <span className="px-1.5 py-0.2 rounded-full bg-stone-800 text-stone-300 text-[10px] font-mono">
          {modCount}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6 pb-8 max-w-7xl mx-auto">
      {/* Top Header & Sub-Tab Navigation */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-stone-800/80">
        <div>
          <h1 className="font-display text-2xl font-bold bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent">
            Asset Manager
          </h1>
          <p className="text-xs text-stone-400 mt-0.5">
            {subTab === 'library'
              ? 'Manage, verify, and update all GTFO assets installed in your local DCS environment.'
              : subTab === 'liveries'
              ? 'Synchronizes directly into Saved Games\\DCS\\Liveries\\<Aircraft>'
              : 'Synchronizes directly into Saved Games\\DCS\\Mods\\tech'}
          </p>
        </div>

        {/* Sub-Tab Pills */}
        <div className="flex flex-wrap items-center gap-2 p-1 rounded-2xl bg-stone-900/90 border border-stone-800 shadow-sm w-fit">
          {tabs.map((tab) => {
            const isActive = subTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleSelectSubTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono transition-all cursor-pointer ${
                  isActive
                    ? 'bg-amber-500 text-stone-950 font-bold shadow-md shadow-amber-500/20'
                    : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/80'
                }`}
              >
                <span className={isActive ? 'text-stone-950' : 'text-amber-400'}>{tab.icon}</span>
                <span>{tab.label}</span>
                {tab.badge}
              </button>
            );
          })}
        </div>
      </div>

      {/* ============================================================ */}
      {/* TAB 1: INSTALLED LIBRARY                                     */}
      {/* ============================================================ */}
      {subTab === 'library' && (
        <div className="space-y-5">
          {/* Library Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs font-mono text-stone-400">
              Showing <strong className="text-stone-200">{filteredInstalledList.length}</strong>{' '}
              installed package{filteredInstalledList.length === 1 ? '' : 's'}
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={rescanLocalAssets}
                className="px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-200 font-mono text-xs flex items-center gap-2 transition-colors cursor-pointer"
              >
                <ArrowsClockwise className="w-3.5 h-3.5 text-amber-400" />
                Rescan DCS Folder
              </button>

              {installedList.length > 0 && (
                <button
                  onClick={handleVerifyAll}
                  disabled={isVerifyingAll || Boolean(verifyingAssetId)}
                  className="px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-200 font-mono text-xs flex items-center gap-2 transition-colors disabled:opacity-60 cursor-pointer"
                  title="Verify local file integrity for all installed packages"
                >
                  {isVerifyingAll ? (
                    <CircleNotch className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  )}
                  <span>{isVerifyingAll ? 'Verifying All...' : 'Verify All'}</span>
                </button>
              )}

              {outdatedAssets.length > 0 && (
                <button
                  onClick={updateAllOutdated}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-mono font-bold text-xs flex items-center gap-2 shadow cursor-pointer"
                >
                  <ArrowCircleUp className="w-4 h-4" />
                  Update All ({outdatedAssets.length})
                </button>
              )}
            </div>
          </div>

          {verifyAllFeedback && (
            <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-mono text-xs flex items-center gap-2 animate-fadeIn">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{verifyAllFeedback}</span>
            </div>
          )}

          {installedList.length === 0 ? (
            <div className="p-12 rounded-2xl bg-stone-900/85 border border-stone-800 text-center space-y-4">
              <Folder className="w-10 h-10 text-stone-500 mx-auto" />
              <div className="space-y-1">
                <h3 className="font-display text-base font-semibold text-stone-100">
                  No Assets Installed Yet
                </h3>
                <p className="text-xs text-stone-400 max-w-md mx-auto">
                  Deploy squadron liveries or mods from the catalog tabs above and they will be
                  tracked here for one-click updates and clean uninstallation.
                </p>
              </div>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => handleSelectSubTab('liveries')}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-display font-bold text-xs cursor-pointer"
                >
                  Browse Liveries
                </button>
                <button
                  onClick={() => handleSelectSubTab('mods')}
                  className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-display font-semibold text-xs cursor-pointer"
                >
                  Browse Mods
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredInstalledList.map((record) => {
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
                              <ArrowCircleUp className="w-3 h-3" />
                              UPDATE AVAILABLE: v{remoteItem.version}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-mono text-[10px]">
                              <CheckCircle className="w-3 h-3" />
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
                              <Warning className="w-3 h-3 text-amber-400" />
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
                            className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-mono font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                          >
                            <ArrowCircleUp className="w-3.5 h-3.5" />
                            Update to v{remoteItem.version}
                          </button>
                        )}

                        <button
                          onClick={() => verifyAsset(record.assetId)}
                          disabled={isVerifying || Boolean(progress)}
                          title="Verify all package files and checksums on disk"
                          className="px-3 py-2 rounded-xl bg-stone-950 hover:bg-stone-800 border border-stone-800 text-stone-300 font-mono text-xs flex items-center gap-1.5 disabled:opacity-60 cursor-pointer"
                        >
                          {isVerifying ? (
                            <CircleNotch className="w-3.5 h-3.5 text-amber-400 animate-spin" />
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
                            className={`px-3 py-2 rounded-xl font-mono text-xs flex items-center gap-1.5 disabled:opacity-60 cursor-pointer ${
                              verifyRes && !verifyRes.valid
                                ? 'bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold shadow'
                                : 'bg-stone-950 hover:bg-stone-800 border border-stone-800 text-stone-300'
                            }`}
                          >
                            <ArrowsClockwise className="w-3.5 h-3.5" />
                            Repair
                          </button>
                        )}

                        <button
                          onClick={() => uninstallAsset(record.assetId)}
                          disabled={Boolean(progress)}
                          className="px-3 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 text-red-300 font-mono text-xs flex items-center gap-1.5 disabled:opacity-60 cursor-pointer"
                        >
                          <Trash className="w-3.5 h-3.5" />
                          Uninstall
                        </button>
                      </div>
                    </div>

                    {progress && (
                      <div className="pt-2 border-t border-stone-800/80 space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="text-amber-300 flex items-center gap-1.5 truncate">
                            <CircleNotch className="w-3.5 h-3.5 animate-spin shrink-0" />
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
      )}

      {/* ============================================================ */}
      {/* TAB 2 & 3: LIVERIES / MODS CATALOG                           */}
      {/* ============================================================ */}
      {(subTab === 'liveries' || subTab === 'mods') && (
        <div className="space-y-5">
          {/* Funnel Filter Bar */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            {/* Aircraft / Module Funnel Chips */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <span className="text-xs font-mono text-stone-500 flex items-center gap-1 shrink-0 mr-1">
                <Stack className="w-3.5 h-3.5 text-amber-400" /> Module:
              </span>
              {modules.map((mod) => (
                <button
                  key={mod}
                  onClick={() => setModuleFilter(mod)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono whitespace-nowrap border transition-all cursor-pointer ${
                    moduleFilter === mod
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-semibold'
                      : 'bg-stone-900/90 border-stone-800 text-stone-400 hover:text-stone-200 hover:border-stone-700'
                  }`}
                >
                  {mod}
                </button>
              ))}
            </div>

            {/* Requirement Level & Status Funnel Pills */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <div className="flex items-center bg-stone-900 border border-stone-800 rounded-xl p-1 text-xs font-mono">
                <button
                  onClick={() => setReqFilter('all')}
                  className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                    reqFilter === 'all'
                      ? 'bg-stone-800 text-stone-100 font-semibold'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setReqFilter('required_all')}
                  className={`px-3 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer ${
                    reqFilter === 'required_all'
                      ? 'bg-red-600 text-white font-bold'
                      : 'text-stone-400 hover:text-red-300'
                  }`}
                >
                  <Warning className="w-3 h-3" />
                  Required for All
                </button>
                <button
                  onClick={() => setReqFilter('required_core')}
                  className={`px-3 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer ${
                    reqFilter === 'required_core'
                      ? 'bg-amber-500 text-stone-950 font-bold'
                      : 'text-stone-400 hover:text-amber-300'
                  }`}
                >
                  <Sparkle className="w-3 h-3" />
                  Required for CORE
                </button>
                <button
                  onClick={() => setReqFilter('optional')}
                  className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                    reqFilter === 'optional'
                      ? 'bg-stone-800 text-amber-300 font-semibold'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  Optional
                </button>
              </div>

              <div className="flex items-center bg-stone-900 border border-stone-800 rounded-xl p-1 text-xs font-mono">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-2.5 py-1 rounded-lg cursor-pointer ${
                    statusFilter === 'all' ? 'bg-stone-800 text-stone-100' : 'text-stone-400'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setStatusFilter('installed')}
                  className={`px-2.5 py-1 rounded-lg cursor-pointer ${
                    statusFilter === 'installed'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'text-stone-400'
                  }`}
                >
                  Installed
                </button>
                <button
                  onClick={() => setStatusFilter('not_installed')}
                  className={`px-2.5 py-1 rounded-lg cursor-pointer ${
                    statusFilter === 'not_installed'
                      ? 'bg-stone-800 text-stone-100'
                      : 'text-stone-400'
                  }`}
                >
                  Not Installed
                </button>
              </div>
            </div>
          </div>

          {/* Asset Grid */}
          {filteredAssets.length === 0 ? (
            <div className="p-12 rounded-2xl bg-stone-900/80 border border-stone-800 text-center space-y-3">
              <Funnel className="w-8 h-8 text-stone-500 mx-auto" />
              <h3 className="font-display text-base font-semibold text-stone-200">
                No matching packages found
              </h3>
              <p className="text-xs text-stone-400 max-w-md mx-auto">
                Try clearing your search filter or switching the requirement level filter above.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredAssets.map((asset) => (
                <AssetCard key={asset.id} asset={asset} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

