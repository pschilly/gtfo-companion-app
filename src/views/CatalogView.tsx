import React, { useMemo, useState } from 'react';
import { AlertTriangle, Filter, Layers, Sparkles } from 'lucide-react';
import { AssetCard } from '../components/AssetCard';
import { useApp } from '../context/AppContext';
import { AssetCategory, RequirementLevel } from '../types';

interface CatalogViewProps {
  category: AssetCategory;
  searchQuery: string;
}

export const CatalogView: React.FC<CatalogViewProps> = ({ category, searchQuery }) => {
  const { manifest, installedAssets } = useApp();
  const [reqFilter, setReqFilter] = useState<'all' | RequirementLevel>('all');
  const [moduleFilter, setModuleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'all' | 'installed' | 'not_installed'>('all');

  const categoryAssets = useMemo(
    () =>
      manifest.assets.filter((a) => {
        if (category === 'livery') return a.category === 'livery';
        return a.category === 'mod' || a.category === 'tool';
      }),
    [manifest.assets, category]
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

  return (
    <div className="space-y-6 pb-8 max-w-7xl mx-auto">
      {/* Header & Filter Bar */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-4 border-b border-stone-800/80">
        <div>
          <h1 className="font-display text-2xl font-bold bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent">
            {category === 'livery'
              ? 'Global Task Force Overlord Liveries'
              : 'DCS Tactical Mods & Airfield Systems'}
          </h1>
          <p className="text-xs text-stone-400 mt-0.5">
            {category === 'livery'
              ? 'Synchronizes directly into Saved Games\\DCS\\Liveries\\<Aircraft>'
              : 'Synchronizes directly into Saved Games\\DCS\\Mods\\tech'}
          </p>
        </div>

        {/* Requirement Level & Status Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-stone-900 border border-stone-800 rounded-xl p-1 text-xs font-mono">
            <button
              onClick={() => setReqFilter('all')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                reqFilter === 'all'
                  ? 'bg-stone-800 text-stone-100 font-semibold'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setReqFilter('required_all')}
              className={`px-3 py-1 rounded-lg flex items-center gap-1 transition-colors ${
                reqFilter === 'required_all'
                  ? 'bg-red-600 text-white font-bold'
                  : 'text-stone-400 hover:text-red-300'
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              Required for All
            </button>
            <button
              onClick={() => setReqFilter('required_core')}
              className={`px-3 py-1 rounded-lg flex items-center gap-1 transition-colors ${
                reqFilter === 'required_core'
                  ? 'bg-amber-500 text-stone-950 font-bold'
                  : 'text-stone-400 hover:text-amber-300'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              Required for CORE
            </button>
            <button
              onClick={() => setReqFilter('optional')}
              className={`px-3 py-1 rounded-lg transition-colors ${
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
              className={`px-2.5 py-1 rounded-lg ${
                statusFilter === 'all' ? 'bg-stone-800 text-stone-100' : 'text-stone-400'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('installed')}
              className={`px-2.5 py-1 rounded-lg ${
                statusFilter === 'installed'
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'text-stone-400'
              }`}
            >
              Installed
            </button>
            <button
              onClick={() => setStatusFilter('not_installed')}
              className={`px-2.5 py-1 rounded-lg ${
                statusFilter === 'not_installed' ? 'bg-stone-800 text-stone-100' : 'text-stone-400'
              }`}
            >
              Not Installed
            </button>
          </div>
        </div>
      </div>

      {/* Aircraft / Module Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <span className="text-xs font-mono text-stone-500 flex items-center gap-1 shrink-0 mr-1">
          <Layers className="w-3.5 h-3.5 text-amber-400" /> Module:
        </span>
        {modules.map((mod) => (
          <button
            key={mod}
            onClick={() => setModuleFilter(mod)}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono whitespace-nowrap border transition-all ${
              moduleFilter === mod
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-semibold'
                : 'bg-stone-900/90 border-stone-800 text-stone-400 hover:text-stone-200 hover:border-stone-700'
            }`}
          >
            {mod}
          </button>
        ))}
      </div>

      {/* Asset Grid */}
      {filteredAssets.length === 0 ? (
        <div className="p-12 rounded-2xl bg-stone-900/80 border border-stone-800 text-center space-y-3">
          <Filter className="w-8 h-8 text-stone-500 mx-auto" />
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
  );
};
