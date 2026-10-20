import React from 'react';
import { ArrowUpCircle, RefreshCw, Search } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface TopBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export const TopBar: React.FC<TopBarProps> = ({ searchQuery, onSearchChange }) => {
  const {
    manifest,
    isSyncingManifest,
    lastSyncedAt,
    syncManifest,
    outdatedAssets,
    updateAllOutdated,
    setActiveTab,
  } = useApp();

  return (
    <header className="h-16 bg-stone-950/85 backdrop-blur-md border-b border-stone-800/80 px-6 flex items-center justify-between gap-4 shrink-0">
      {/* Search Bar */}
      <div className="relative flex-1 max-w-md">
        <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search liveries, aircraft (F-16C, F/A-18C), mods, or tags..."
          className="w-full pl-10 pr-4 py-2 rounded-xl bg-stone-900/90 border border-stone-800 text-sm text-stone-100 placeholder:text-stone-500 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30 transition-all"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-stone-400 hover:text-stone-200"
          >
            ESC
          </button>
        )}
      </div>

      {/* Right Action Controls */}
      <div className="flex items-center gap-3">
        {/* Outdated Assets Alert Button */}
        {outdatedAssets.length > 0 && (
          <button
            onClick={() => {
              setActiveTab('library');
              updateAllOutdated();
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 text-xs font-mono font-semibold transition-all"
          >
            <ArrowUpCircle className="w-4 h-4 text-amber-400 animate-bounce" />
            <span>{outdatedAssets.length} UPDATE(S) AVAILABLE</span>
          </button>
        )}

        {/* Manifest Version & Sync Button */}
        <div className="flex items-center gap-2 bg-stone-900/90 border border-stone-800 rounded-xl px-3 py-1.5">
          <div className="text-right hidden sm:block">
            <div className="text-[10px] font-mono uppercase text-stone-400">
              MANIFEST v{manifest.manifestVersion}
            </div>
            <div className="text-[10px] font-mono text-stone-500">
              {lastSyncedAt ? `Synced ${lastSyncedAt}` : 'Portal Manifest'}
            </div>
          </div>
          <button
            onClick={syncManifest}
            disabled={isSyncingManifest}
            title="Sync remote manifest from Member Portal / CDN"
            className="p-1.5 rounded-lg bg-stone-800/80 hover:bg-stone-700 text-stone-300 hover:text-amber-400 transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={`w-4 h-4 ${isSyncingManifest ? 'animate-spin text-amber-400' : ''}`}
            />
          </button>
        </div>
      </div>
    </header>
  );
};
