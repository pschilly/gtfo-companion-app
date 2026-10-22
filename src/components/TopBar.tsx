import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Airplane,
  AirplaneTilt,
  ArrowCircleUp,
  ArrowRight,
  ArrowSquareOut,
  ArrowsClockwise,
  Certificate,
  CheckCircle,
  Compass,
  Cpu,
  MagnifyingGlass,
  Medal,
  Package,
  PaintBrush,
  Sparkle,
  X,
} from '@phosphor-icons/react';
import { useApp } from '../context/AppContext';
import { NotificationCenterDropdown } from './NotificationCenterDropdown';
import { AssetItem, FlightPlanSummary, MemberAward, MemberCertificate, QualifiedAirframe } from '../types';

interface TopBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

type SearchCategoryFilter = 'all' | 'flight_plans' | 'certificates' | 'liveries' | 'mods' | 'awards';

export const TopBar: React.FC<TopBarProps> = ({ searchQuery, onSearchChange }) => {
  const {
    activeTab,
    manifest,
    isSyncingManifest,
    lastSyncedAt,
    syncManifest,
    outdatedAssets,
    updateAllOutdated,
    setActiveTab,
    appUpdate,
    setIsUpdateModalOpen,
    memberFlightPlans,
    activeSortieFlightPlans,
    filedFlightPlans,
    memberProfile,
    setSelectedAsset,
    setSelectedFlightPlanId,
    setHighlightedCertId,
  } = useApp();

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<SearchCategoryFilter>('all');
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const q = searchQuery.trim().toLowerCase();

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 1. Matching Flight Plans (deduplicated across member, active sortie, and filed lists)
  const matchingFlightPlans = useMemo<FlightPlanSummary[]>(() => {
    if (!q) return [];
    const map = new Map<string, FlightPlanSummary>();
    [...memberFlightPlans, ...activeSortieFlightPlans, ...filedFlightPlans].forEach((plan) => {
      const key = String(plan.id || plan.identifier);
      if (map.has(key)) return;
      const match =
        plan.identifier?.toLowerCase().includes(q) ||
        plan.callsign?.toLowerCase().includes(q) ||
        plan.name?.toLowerCase().includes(q) ||
        plan.departure_airfield?.toLowerCase().includes(q) ||
        plan.destination_airfield?.toLowerCase().includes(q) ||
        plan.airframe?.name?.toLowerCase().includes(q) ||
        plan.airframe?.abbreviation?.toLowerCase().includes(q) ||
        plan.remarks?.toLowerCase().includes(q) ||
        plan.description?.toLowerCase().includes(q);
      if (match) {
        map.set(key, plan);
      }
    });
    return Array.from(map.values()).slice(0, 5);
  }, [q, memberFlightPlans, activeSortieFlightPlans, filedFlightPlans]);

  // 2. Matching Certificates & Qualifications
  const matchingCertificates = useMemo<MemberCertificate[]>(() => {
    if (!q) return [];
    const certs = memberProfile?.certificates || [];
    return certs
      .filter((cert) => {
        return (
          cert.code?.toLowerCase().includes(q) ||
          cert.name?.toLowerCase().includes(q) ||
          cert.airframe?.toLowerCase().includes(q) ||
          cert.description?.toLowerCase().includes(q) ||
          cert.awardedRole?.toLowerCase().includes(q) ||
          cert.status?.toLowerCase().includes(q)
        );
      })
      .slice(0, 5);
  }, [q, memberProfile?.certificates]);

  // 3. Matching Awards & Commendations
  const matchingAwards = useMemo<MemberAward[]>(() => {
    if (!q) return [];
    const awards = memberProfile?.awards || [];
    return awards
      .filter((award) => {
        return (
          award.name?.toLowerCase().includes(q) ||
          award.category?.toLowerCase().includes(q) ||
          award.description?.toLowerCase().includes(q) ||
          award.citation?.toLowerCase().includes(q)
        );
      })
      .slice(0, 4);
  }, [q, memberProfile?.awards]);

  // 4. Matching Liveries
  const matchingLiveries = useMemo<AssetItem[]>(() => {
    if (!q) return [];
    return manifest.assets
      .filter((asset) => {
        if (asset.category !== 'livery') return false;
        return (
          asset.name?.toLowerCase().includes(q) ||
          asset.aircraftOrModule?.toLowerCase().includes(q) ||
          asset.author?.toLowerCase().includes(q) ||
          asset.tags?.some((t) => t.toLowerCase().includes(q)) ||
          asset.description?.toLowerCase().includes(q)
        );
      })
      .slice(0, 5);
  }, [q, manifest.assets]);

  // 5. Matching Technical Mods
  const matchingMods = useMemo<AssetItem[]>(() => {
    if (!q) return [];
    return manifest.assets
      .filter((asset) => {
        if (asset.category !== 'mod') return false;
        return (
          asset.name?.toLowerCase().includes(q) ||
          asset.author?.toLowerCase().includes(q) ||
          asset.tags?.some((t) => t.toLowerCase().includes(q)) ||
          asset.description?.toLowerCase().includes(q)
        );
      })
      .slice(0, 4);
  }, [q, manifest.assets]);

  // 6. Matching Airframes
  const matchingAirframes = useMemo<QualifiedAirframe[]>(() => {
    if (!q) return [];
    const airframes = memberProfile?.qualifiedAirframes || [];
    return airframes
      .filter((af) => {
        return (
          af.name?.toLowerCase().includes(q) ||
          af.abbreviation?.toLowerCase().includes(q) ||
          af.dcsEntity?.toLowerCase().includes(q)
        );
      })
      .slice(0, 3);
  }, [q, memberProfile?.qualifiedAirframes]);

  const totalMatchesCount =
    matchingFlightPlans.length +
    matchingCertificates.length +
    matchingAwards.length +
    matchingLiveries.length +
    matchingMods.length +
    matchingAirframes.length;

  const handleSelectFlightPlan = (plan: FlightPlanSummary) => {
    setSelectedFlightPlanId(plan.id || plan.identifier);
    setActiveTab('atc');
    setIsSearchOpen(false);
    onSearchChange('');
  };

  const handleSelectCertificate = (cert: MemberCertificate) => {
    setHighlightedCertId(cert.id);
    setActiveTab('qualifications');
    setIsSearchOpen(false);
    onSearchChange('');
  };

  const handleSelectAward = () => {
    setActiveTab('awards');
    setIsSearchOpen(false);
    onSearchChange('');
  };

  const handleSelectAirframe = () => {
    setActiveTab('airframes');
    setIsSearchOpen(false);
    onSearchChange('');
  };

  const handleSelectAsset = (asset: AssetItem) => {
    setSelectedAsset(asset);
    setIsSearchOpen(false);
    onSearchChange('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsSearchOpen(false);
      onSearchChange('');
      searchInputRef.current?.blur();
    }
  };

  return (
    <header className="relative z-40 h-16 bg-stone-950/95 backdrop-blur-md border-b border-stone-800/80 px-6 flex items-center justify-between gap-4 shrink-0">
      {/* Global Omnisearch Search Bar */}
      <div ref={searchContainerRef} className="relative flex-1 max-w-xl">
        <MagnifyingGlass className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onFocus={() => {
            if (q) setIsSearchOpen(true);
          }}
          onChange={(e) => {
            onSearchChange(e.target.value);
            if (e.target.value.trim()) {
              setIsSearchOpen(true);
            } else {
              setIsSearchOpen(false);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search flight plans, certificates, liveries, mods, airframes..."
          className="w-full pl-10 pr-10 py-2 rounded-xl bg-stone-900/90 border border-stone-800 text-sm text-stone-100 placeholder:text-stone-500 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30 transition-all font-sans"
        />
        {searchQuery ? (
          <button
            onClick={() => {
              onSearchChange('');
              setIsSearchOpen(false);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-stone-400 hover:text-stone-200 p-1"
            title="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-stone-600 border border-stone-800 bg-stone-950 px-1.5 py-0.5 rounded">
            ESC
          </span>
        )}

        {/* Global Omnisearch Results Dropdown */}
        {isSearchOpen && q && (
          <div className="absolute left-0 top-full mt-2 w-full min-w-[340px] sm:min-w-[560px] max-w-2xl bg-stone-950/98 backdrop-blur-xl border border-stone-800 rounded-2xl shadow-2xl shadow-stone-950/90 overflow-hidden z-50 divide-y divide-stone-800/80 animate-in fade-in zoom-in-95 duration-100">
            {/* Filter Tabs Header */}
            <div className="p-2.5 bg-stone-900/95 border-b border-stone-800 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-none font-mono">
                <button
                  onClick={() => setCategoryFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs transition-colors flex items-center gap-1.5 ${
                    categoryFilter === 'all'
                      ? 'bg-amber-500 text-stone-950 font-bold'
                      : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800'
                  }`}
                >
                  <span>All</span>
                  <span className="text-[10px] opacity-75">({totalMatchesCount})</span>
                </button>
                {matchingFlightPlans.length > 0 && (
                  <button
                    onClick={() => setCategoryFilter('flight_plans')}
                    className={`px-2.5 py-1 rounded-lg text-xs transition-colors flex items-center gap-1.5 ${
                      categoryFilter === 'flight_plans'
                        ? 'bg-amber-500 text-stone-950 font-bold'
                        : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800'
                    }`}
                  >
                    <Compass className="w-3 h-3" />
                    <span>Flight Plans</span>
                    <span className="text-[10px] opacity-75">({matchingFlightPlans.length})</span>
                  </button>
                )}
                {matchingCertificates.length > 0 && (
                  <button
                    onClick={() => setCategoryFilter('certificates')}
                    className={`px-2.5 py-1 rounded-lg text-xs transition-colors flex items-center gap-1.5 ${
                      categoryFilter === 'certificates'
                        ? 'bg-amber-500 text-stone-950 font-bold'
                        : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800'
                    }`}
                  >
                    <Certificate className="w-3 h-3" />
                    <span>Certs</span>
                    <span className="text-[10px] opacity-75">({matchingCertificates.length})</span>
                  </button>
                )}
                {matchingLiveries.length > 0 && (
                  <button
                    onClick={() => setCategoryFilter('liveries')}
                    className={`px-2.5 py-1 rounded-lg text-xs transition-colors flex items-center gap-1.5 ${
                      categoryFilter === 'liveries'
                        ? 'bg-amber-500 text-stone-950 font-bold'
                        : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800'
                    }`}
                  >
                    <PaintBrush className="w-3 h-3" />
                    <span>Liveries</span>
                    <span className="text-[10px] opacity-75">({matchingLiveries.length})</span>
                  </button>
                )}
                {matchingMods.length > 0 && (
                  <button
                    onClick={() => setCategoryFilter('mods')}
                    className={`px-2.5 py-1 rounded-lg text-xs transition-colors flex items-center gap-1.5 ${
                      categoryFilter === 'mods'
                        ? 'bg-amber-500 text-stone-950 font-bold'
                        : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800'
                    }`}
                  >
                    <Cpu className="w-3 h-3" />
                    <span>Mods</span>
                    <span className="text-[10px] opacity-75">({matchingMods.length})</span>
                  </button>
                )}
              </div>
              <span className="text-[10px] font-mono text-stone-500 shrink-0 hidden sm:inline">
                {totalMatchesCount} result{totalMatchesCount === 1 ? '' : 's'}
              </span>
            </div>

            {/* Scrollable Results List */}
            <div className="max-h-[460px] overflow-y-auto divide-y divide-stone-800/80 bg-stone-950/90">
              {totalMatchesCount === 0 ? (
                <div className="py-10 px-6 text-center space-y-2">
                  <MagnifyingGlass className="w-8 h-8 text-stone-600 mx-auto" />
                  <p className="text-sm font-semibold text-stone-300">
                    No results found for &ldquo;{searchQuery}&rdquo;
                  </p>
                  <p className="text-xs text-stone-500 max-w-sm mx-auto">
                    Try searching by callsign (e.g. CHEVY, TARCAP), FP ID (e.g. FP-B7K9Q), certificate code (e.g. TQC), airframe (e.g. F/A-18C, F-16C), or livery/mod name.
                  </p>
                </div>
              ) : (
                <>
                  {/* Category: Flight Plans */}
                  {(categoryFilter === 'all' || categoryFilter === 'flight_plans') &&
                    matchingFlightPlans.length > 0 && (
                      <div className="p-2 space-y-1">
                        <div className="px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400/90 flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <Compass className="w-3.5 h-3.5 text-amber-400" />
                            <span>Flight Plans</span>
                          </span>
                          <span className="text-stone-500">{matchingFlightPlans.length} match{matchingFlightPlans.length === 1 ? '' : 'es'}</span>
                        </div>
                        {matchingFlightPlans.map((plan) => (
                          <div
                            key={plan.id || plan.identifier}
                            onClick={() => handleSelectFlightPlan(plan)}
                            className="group p-2.5 rounded-xl hover:bg-stone-900/90 cursor-pointer transition-all flex items-center justify-between gap-3 border border-transparent hover:border-amber-500/30"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-400 group-hover:scale-105 transition-transform">
                                <AirplaneTilt className="w-5 h-5" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs font-bold text-amber-300 bg-stone-900 px-1.5 py-0.5 rounded border border-stone-800">
                                    #{plan.identifier}
                                  </span>
                                  <h4 className="text-sm font-semibold text-stone-100 truncate group-hover:text-amber-300 transition-colors">
                                    {plan.callsign} {plan.name && plan.name !== plan.callsign ? `(${plan.name})` : ''}
                                  </h4>
                                  {plan.is_filed ? (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                      FILED
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono text-stone-500 bg-stone-900 border border-stone-800">
                                      DRAFT
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-stone-400 truncate mt-0.5 font-mono">
                                  {plan.airframe?.name || 'Aircraft'} • {plan.departure_airfield || 'DEP'} ➔ {plan.destination_airfield || 'ARR'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-stone-500 group-hover:text-amber-400 font-mono shrink-0">
                              <span className="hidden sm:inline text-[11px]">Open in ATC</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                  {/* Category: Certificates & Qualifications */}
                  {(categoryFilter === 'all' || categoryFilter === 'certificates') &&
                    matchingCertificates.length > 0 && (
                      <div className="p-2 space-y-1">
                        <div className="px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400/90 flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <Certificate className="w-3.5 h-3.5 text-amber-400" />
                            <span>Certifications &amp; Credentials</span>
                          </span>
                          <span className="text-stone-500">{matchingCertificates.length} match{matchingCertificates.length === 1 ? '' : 'es'}</span>
                        </div>
                        {matchingCertificates.map((cert) => (
                          <div
                            key={cert.id}
                            onClick={() => handleSelectCertificate(cert)}
                            className="group p-2.5 rounded-xl hover:bg-stone-900/90 cursor-pointer transition-all flex items-center justify-between gap-3 border border-transparent hover:border-amber-500/30"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-400 group-hover:scale-105 transition-transform">
                                <Certificate className="w-5 h-5" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs font-bold text-amber-300 bg-stone-900 px-1.5 py-0.5 rounded border border-stone-800">
                                    {cert.code}
                                  </span>
                                  <h4 className="text-sm font-semibold text-stone-100 truncate group-hover:text-amber-300 transition-colors">
                                    {cert.name}
                                  </h4>
                                  {cert.isIssued && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                      <CheckCircle className="w-2.5 h-2.5" />
                                      <span>ISSUED</span>
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-stone-400 truncate mt-0.5">
                                  {cert.airframe} • +{cert.xpValue || 0} XP {cert.awardedRole ? `• Role: ${cert.awardedRole}` : ''}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-stone-500 group-hover:text-amber-400 font-mono shrink-0">
                              <span className="hidden sm:inline text-[11px]">View Dossier</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                  {/* Category: Liveries & Skins */}
                  {(categoryFilter === 'all' || categoryFilter === 'liveries') &&
                    matchingLiveries.length > 0 && (
                      <div className="p-2 space-y-1">
                        <div className="px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400/90 flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <PaintBrush className="w-3.5 h-3.5 text-amber-400" />
                            <span>Liveries &amp; Aircraft Skins</span>
                          </span>
                          <span className="text-stone-500">{matchingLiveries.length} match{matchingLiveries.length === 1 ? '' : 'es'}</span>
                        </div>
                        {matchingLiveries.map((asset) => (
                          <div
                            key={asset.id}
                            onClick={() => handleSelectAsset(asset)}
                            className="group p-2.5 rounded-xl hover:bg-stone-900/90 cursor-pointer transition-all flex items-center justify-between gap-3 border border-transparent hover:border-amber-500/30"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {asset.imagePreviewUrl ? (
                                <img
                                  src={asset.imagePreviewUrl}
                                  alt={asset.name}
                                  className="w-9 h-9 rounded-xl object-cover border border-stone-800 shrink-0"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-xl bg-stone-900 border border-stone-800 flex items-center justify-center shrink-0 text-amber-400">
                                  <PaintBrush className="w-5 h-5" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-semibold text-stone-100 truncate group-hover:text-amber-300 transition-colors">
                                    {asset.name}
                                  </h4>
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-stone-900 border border-stone-800 text-stone-400">
                                    {asset.aircraftOrModule || 'Livery'}
                                  </span>
                                </div>
                                <p className="text-xs text-stone-400 truncate mt-0.5">
                                  {asset.author ? `by ${asset.author}` : ''} {asset.tags?.length ? `• ${asset.tags.join(', ')}` : ''}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-stone-500 group-hover:text-amber-400 font-mono shrink-0">
                              <span className="hidden sm:inline text-[11px]">Inspect</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                  {/* Category: Technical Mods */}
                  {(categoryFilter === 'all' || categoryFilter === 'mods') &&
                    matchingMods.length > 0 && (
                      <div className="p-2 space-y-1">
                        <div className="px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400/90 flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <Cpu className="w-3.5 h-3.5 text-amber-400" />
                            <span>Technical Mods &amp; Utilities</span>
                          </span>
                          <span className="text-stone-500">{matchingMods.length} match{matchingMods.length === 1 ? '' : 'es'}</span>
                        </div>
                        {matchingMods.map((mod) => (
                          <div
                            key={mod.id}
                            onClick={() => handleSelectAsset(mod)}
                            className="group p-2.5 rounded-xl hover:bg-stone-900/90 cursor-pointer transition-all flex items-center justify-between gap-3 border border-transparent hover:border-amber-500/30"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center shrink-0 text-cyan-400">
                                <Package className="w-5 h-5" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-semibold text-stone-100 truncate group-hover:text-amber-300 transition-colors">
                                    {mod.name}
                                  </h4>
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-stone-900 border border-stone-800 text-cyan-400">
                                    v{mod.version}
                                  </span>
                                </div>
                                <p className="text-xs text-stone-400 truncate mt-0.5">
                                  {mod.description || 'DCS technical modification package'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-stone-500 group-hover:text-amber-400 font-mono shrink-0">
                              <span className="hidden sm:inline text-[11px]">Inspect</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                  {/* Category: Awards & Medals */}
                  {(categoryFilter === 'all' || categoryFilter === 'awards') &&
                    matchingAwards.length > 0 && (
                      <div className="p-2 space-y-1">
                        <div className="px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400/90 flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <Medal className="w-3.5 h-3.5 text-amber-400" />
                            <span>Awards &amp; Decorations</span>
                          </span>
                          <span className="text-stone-500">{matchingAwards.length} match{matchingAwards.length === 1 ? '' : 'es'}</span>
                        </div>
                        {matchingAwards.map((award) => (
                          <div
                            key={award.id}
                            onClick={handleSelectAward}
                            className="group p-2.5 rounded-xl hover:bg-stone-900/90 cursor-pointer transition-all flex items-center justify-between gap-3 border border-transparent hover:border-amber-500/30"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-400">
                                <Medal className="w-5 h-5" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-semibold text-stone-100 truncate group-hover:text-amber-300 transition-colors">
                                    {award.name}
                                  </h4>
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-stone-900 border border-stone-800 text-amber-400">
                                    {award.issueCount}x Awarded
                                  </span>
                                </div>
                                <p className="text-xs text-stone-400 truncate mt-0.5">
                                  {award.category} • +{award.xpValue || 0} XP
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-stone-500 group-hover:text-amber-400 font-mono shrink-0">
                              <span className="hidden sm:inline text-[11px]">View Awards</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                  {/* Category: Airframes */}
                  {categoryFilter === 'all' && matchingAirframes.length > 0 && (
                    <div className="p-2 space-y-1">
                      <div className="px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400/90 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Airplane className="w-3.5 h-3.5 text-amber-400" />
                          <span>Qualified Airframes</span>
                        </span>
                        <span className="text-stone-500">{matchingAirframes.length} match{matchingAirframes.length === 1 ? '' : 'es'}</span>
                      </div>
                      {matchingAirframes.map((af) => (
                        <div
                          key={af.name}
                          onClick={handleSelectAirframe}
                          className="group p-2.5 rounded-xl hover:bg-stone-900/90 cursor-pointer transition-all flex items-center justify-between gap-3 border border-transparent hover:border-amber-500/30"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-stone-900 border border-stone-800 flex items-center justify-center shrink-0 text-stone-300">
                              <Airplane className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-sm font-semibold text-stone-100 truncate group-hover:text-amber-300 transition-colors">
                                {af.name} ({af.abbreviation})
                              </h4>
                              <p className="text-xs text-stone-400 truncate mt-0.5 font-mono">
                                DCS Entity: {af.dcsEntity}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-stone-500 group-hover:text-amber-400 font-mono shrink-0">
                            <span className="hidden sm:inline text-[11px]">View Fleet</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Dropdown Footer */}
            <div className="p-2.5 bg-stone-900/95 border-t border-stone-800 text-[11px] font-mono text-stone-500 flex items-center justify-between">
              <span>Click any result to open its workbench or details</span>
              <span className="hidden sm:inline text-stone-600">Press ESC to dismiss</span>
            </div>
          </div>
        )}
      </div>

      {/* Right Action Controls */}
      <div className="flex items-center gap-3">
        {/* App Update Available Alert Button */}
        {appUpdate?.available && (
          <button
            onClick={() => setIsUpdateModalOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-mono font-bold transition-all shadow-md shadow-amber-500/20"
          >
            <Sparkle className="w-3.5 h-3.5 text-stone-950" />
            <span>APP v{appUpdate.version} READY</span>
          </button>
        )}

        {/* Outdated Assets Alert Button */}
        {outdatedAssets.length > 0 && (
          <button
            onClick={() => {
              setActiveTab('library');
              updateAllOutdated();
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 text-xs font-mono font-semibold transition-all"
          >
            <ArrowCircleUp className="w-4 h-4 text-amber-400 animate-bounce" />
            <span>{outdatedAssets.length} UPDATE(S) AVAILABLE</span>
          </button>
        )}

        {/* Flight Plans & ATC Navigation Button */}
        <button
          onClick={() => setActiveTab('atc')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-mono font-semibold transition-all ${
            activeTab === 'atc'
              ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 shadow-sm shadow-amber-500/10'
              : 'bg-stone-900/90 hover:bg-stone-800 border-stone-800 text-stone-300 hover:text-amber-400'
          }`}
          title="Air Traffic Control & Flight Plans"
        >
          <Compass className="w-4 h-4 text-amber-400" />
          <span className="hidden sm:inline">ATC DISPATCH</span>
          {memberFlightPlans && memberFlightPlans.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-stone-950 font-bold text-[10px]">
              {memberFlightPlans.length}
            </span>
          )}
        </button>

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
            <ArrowsClockwise
              className={`w-4 h-4 ${isSyncingManifest ? 'animate-spin text-amber-400' : ''}`}
            />
          </button>
        </div>

        {/* Tactical In-App & OS Notification Center */}
        <NotificationCenterDropdown />
      </div>
    </header>
  );
};
