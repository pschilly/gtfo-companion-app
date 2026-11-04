import React, { useMemo, useState } from 'react';
import {
  AirplaneTilt,
  Broadcast,
  CheckCircle,
  Compass,
  Funnel,
  MagnifyingGlass,
  Radio,
  ShieldCheck,
  Sparkle,
  UsersFour,
  X,
} from '@phosphor-icons/react';
import { useApp } from '../context/AppContext';
import { SquadronDetail } from '../types';
import { KNOWN_AIRFRAME_NAMES } from '../services/taskforceService';

export const SquadronsView: React.FC = () => {
  const {
    squadronsList,
    taskForceRoster,
    isLoadingTaskforce,
    refreshTaskforceData,
    memberProfile,
    navigateToRoster,
  } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [inspectedSquadron, setInspectedSquadron] = useState<SquadronDetail | null>(null);

  // Compute members count per squadron (prioritizes live roster, falls back to pilotsCount)
  const getSquadronMemberCount = (sq: SquadronDetail): number => {
    if (taskForceRoster && taskForceRoster.length > 0) {
      const sqName = sq.name.toLowerCase();
      const sqCode = sq.code.toLowerCase();
      const sqAbbr = sq.abbreviation.toLowerCase();

      const matchedMembers = taskForceRoster.filter((m) => {
        if (!m.squadron) return false;
        const s = m.squadron.toLowerCase();
        return (
          s === sqName ||
          s === sqCode ||
          s === sqAbbr ||
          (sq.slug && s.includes(sq.slug)) ||
          (sqName.includes('507') && s.includes('507')) ||
          (sqName.includes('449') && s.includes('449')) ||
          (sqName.includes('19th') && s.includes('19')) ||
          (sqName.includes('141') && s.includes('141')) ||
          (sqName.includes('777') && s.includes('777')) ||
          (sqName.includes('479') && s.includes('479')) ||
          (sqName.includes('62') && s.includes('62')) ||
          (sqName.includes('42') && s.includes('42'))
        );
      });

      if (matchedMembers.length > 0) return matchedMembers.length;
    }
    return sq.pilotsCount ?? 0;
  };

  const handleOpenRoster = (sq: SquadronDetail) => {
    navigateToRoster(sq.name);
  };

  const filteredSquadrons = useMemo(() => {
    if (!searchQuery.trim()) return squadronsList;
    const q = searchQuery.toLowerCase();
    return squadronsList.filter((sq) => {
      const callsignMatch =
        Array.isArray(sq.callsigns) &&
        sq.callsigns.some((c: any) => {
          if (typeof c === 'string') return c.toLowerCase().includes(q);
          const cs = String(c?.callsign || c?.name || '');
          const purp = String(c?.purpose || c?.tasking || '');
          const af = String(c?.airframe || c?.plane || '');
          return (
            cs.toLowerCase().includes(q) ||
            purp.toLowerCase().includes(q) ||
            af.toLowerCase().includes(q)
          );
        });

      return (
        sq.name.toLowerCase().includes(q) ||
        sq.code.toLowerCase().includes(q) ||
        sq.abbreviation.toLowerCase().includes(q) ||
        (sq.nickname && sq.nickname.toLowerCase().includes(q)) ||
        (sq.primaryAirframe && sq.primaryAirframe.toLowerCase().includes(q)) ||
        sq.role.toLowerCase().includes(q) ||
        callsignMatch
      );
    });
  }, [squadronsList, searchQuery]);

  const userSquadronName =
    memberProfile.squadronAssignment?.name || memberProfile.squadronAssignment?.code;

  // Distinct airframes across squadrons
  const uniqueAirframesCount = useMemo(() => {
    const set = new Set<string>();
    squadronsList.forEach((sq) => {
      if (sq.primaryAirframe) set.add(sq.primaryAirframe);
      if (Array.isArray(sq.airframes)) {
        sq.airframes.forEach((af) => {
          if (af.name) set.add(af.name);
        });
      }
    });
    return set.size;
  }, [squadronsList]);

  // Total designated tactical callsigns across squadrons
  const totalCallsignsCount = useMemo(() => {
    let count = 0;
    squadronsList.forEach((sq) => {
      if (Array.isArray(sq.callsigns)) {
        count += sq.callsigns.length;
      }
    });
    return count;
  }, [squadronsList]);

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-800/80">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="px-2.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono text-[11px] font-bold tracking-wider">
              S1 // PERSONNEL
            </span>
            <h1 className="font-display text-2xl font-bold bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent">
              Task Force Squadrons
            </h1>
          </div>
          <p className="text-xs text-stone-400 mt-1">
            Operational tactical aviation units within Global Task Force Overlord.
          </p>
        </div>

        <button
          onClick={() => refreshTaskforceData()}
          disabled={isLoadingTaskforce}
          className="px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-300 hover:text-amber-300 font-mono text-xs flex items-center gap-2 transition-colors self-start sm:self-auto shrink-0 shadow-sm disabled:opacity-50"
        >
          <Compass className={`w-3.5 h-3.5 text-amber-400 ${isLoadingTaskforce ? 'animate-spin' : ''}`} />
          <span>{isLoadingTaskforce ? 'Refreshing...' : 'Refresh Squadrons'}</span>
        </button>
      </div>

      {/* Search and Count Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl bg-stone-900/80 border border-stone-800">
        <div className="flex items-center gap-2 text-xs font-mono text-stone-400">
          <Funnel className="w-3.5 h-3.5 text-amber-400 ml-1.5" />
          <span>
            Showing <strong className="text-stone-200">{filteredSquadrons.length}</strong> of{' '}
            <strong className="text-stone-200">{squadronsList.length}</strong> Task Force Squadrons
          </span>
        </div>

        <div className="relative w-full sm:w-80">
          <MagnifyingGlass className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, airframe, callsign, role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-1.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-200 text-xs font-mono placeholder:text-stone-600 focus:outline-none focus:border-amber-500/60"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Squadron Grid */}
      {filteredSquadrons.length === 0 ? (
        <div className="p-12 rounded-2xl bg-stone-900/60 border border-stone-800 text-center space-y-3">
          <AirplaneTilt className="w-10 h-10 text-stone-600 mx-auto" />
          <h3 className="font-display font-semibold text-stone-300">No Squadrons Match Your Search</h3>
          <p className="text-xs text-stone-500">
            Try adjusting your search query or clear the filter to view all squadrons.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredSquadrons.map((sq) => {
            const isUserSquadron =
              userSquadronName &&
              (userSquadronName.toLowerCase() === sq.name.toLowerCase() ||
                userSquadronName.toLowerCase() === sq.code.toLowerCase());

            return (
              <div
                key={sq.id || sq.code}
                className={`relative rounded-2xl bg-stone-900/90 border transition-all flex flex-col justify-between overflow-hidden shadow-lg group hover:border-amber-500/60 hover:shadow-amber-500/5 ${
                  isUserSquadron
                    ? 'border-emerald-500/50 ring-1 ring-emerald-500/30'
                    : 'border-stone-800'
                }`}
              >
                {/* Header Strip with Badges */}
                <div className="p-5 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <span className="px-2.5 py-0.5 rounded-md bg-stone-950 border border-stone-800 font-mono text-[11px] font-bold text-amber-300">
                      {sq.abbreviation || sq.code}
                    </span>

                    {isUserSquadron && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 text-emerald-400" />
                        <span>YOUR SQUADRON</span>
                      </span>
                    )}
                  </div>

                  {/* Emblem & Identity */}
                  <div className="mt-4 flex items-center gap-4">
                    <div className="w-36 h-36 flex items-center justify-center overflow-hidden">
                      {sq.emblemUrl ? (
                        <img
                          src={sq.emblemUrl}
                          alt={sq.name}
                          onError={(e) => {
                            const target = e.currentTarget;
                            if (target.src !== 'https://cdn.globaltaskforceoverlord.org/GTFO-Logo.png') {
                              target.src = 'https://cdn.globaltaskforceoverlord.org/GTFO-Logo.png';
                            }
                          }}
                          className="max-h-full max-w-full object-contain filter drop-shadow-md"
                          loading="lazy"
                        />
                      ) : (
                        <AirplaneTilt className="w-9 h-9 text-stone-600" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h2 className="font-display font-bold text-stone-100 text-base leading-tight group-hover:text-amber-200 transition-colors">
                        {sq.name}
                      </h2>
                      {sq.nickname && (
                        <p className="text-xs font-mono text-amber-400 font-semibold mt-0.5">
                          "{sq.nickname}"
                        </p>
                      )}
                      <p className="text-[11px] font-mono text-stone-400 mt-1 line-clamp-1">
                        {sq.role}
                      </p>
                    </div>
                  </div>

                  {/* Operational Billets & Callsigns */}
                  <div className="mt-4 pt-3 border-t border-stone-800/80 space-y-2 text-xs font-mono">
                    {sq.primaryAirframe && (
                      <div className="flex items-center justify-between text-stone-400">
                        <span className="text-stone-500 flex items-center gap-1.5">
                          <AirplaneTilt className="w-3.5 h-3.5 text-stone-500" />
                          <span>Primary:</span>
                        </span>
                        <span className="text-stone-200 font-semibold truncate max-w-[170px]">
                          {sq.primaryAirframe}
                        </span>
                      </div>
                    )}

                    {sq.callsigns && sq.callsigns.length > 0 && (
                      <div className="flex items-center justify-between text-stone-400">
                        <span className="text-stone-500 flex items-center gap-1.5">
                          <Radio className="w-3.5 h-3.5 text-stone-500" />
                          <span>Callsign:</span>
                        </span>
                        <span className="text-amber-300 font-semibold truncate max-w-[170px]">
                          {sq.callsigns
                            .map((c: any) =>
                              typeof c === 'string' ? c : c?.callsign || c?.name || ''
                            )
                            .filter(Boolean)
                            .join(' / ')}
                        </span>
                      </div>
                    )}

                    {sq.frequencies && sq.frequencies.length > 0 && (
                      <div className="flex items-center justify-between text-stone-400">
                        <span className="text-stone-500 flex items-center gap-1.5">
                          <Broadcast className="w-3.5 h-3.5 text-stone-500" />
                          <span>Tac Comms:</span>
                        </span>
                        <span className="text-stone-300">
                          {sq.frequencies[0].frequency} {sq.frequencies[0].modulation || 'AM'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Airframe Tags */}
                  {sq.airframes && sq.airframes.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {sq.airframes.slice(0, 3).map((af) => (
                        <span
                          key={af.id}
                          className="px-2 py-0.5 rounded bg-stone-950 border border-stone-800/80 text-[10px] font-mono text-stone-400"
                        >
                          {af.abbreviation || af.name}
                        </span>
                      ))}
                      {sq.airframes.length > 3 && (
                        <span className="px-1.5 py-0.5 rounded bg-stone-950 text-[10px] font-mono text-stone-500">
                          +{sq.airframes.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Action Footer */}
                <div className="p-4 pt-3 bg-stone-950/50 border-t border-stone-800/60 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setInspectedSquadron(sq)}
                    className="flex-1 py-1.5 px-3 rounded-xl bg-stone-800/80 hover:bg-stone-700/80 text-stone-200 font-mono text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Compass className="w-3.5 h-3.5 text-amber-400" />
                    <span>View Squadron Specs</span>
                  </button>

                  <button
                    onClick={() => handleOpenRoster(sq)}
                    className="py-1.5 px-3 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-800 hover:border-amber-500/50 text-stone-300 hover:text-amber-300 font-mono text-xs flex items-center gap-2 transition-all shrink-0 shadow-sm group"
                    title={`View ${sq.name} Task Force Roster (${getSquadronMemberCount(sq)} aviators)`}
                  >
                    <UsersFour className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                    <span>Roster</span>
                    <span className="px-1.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-bold">
                      {getSquadronMemberCount(sq)}
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Squadron Detail Modal */}
      {inspectedSquadron && (
        <div
          onClick={() => setInspectedSquadron(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-stone-900 border border-stone-700/80 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl cursor-default"
          >
            {/* Modal Header */}
            <div className="p-6 pb-4 border-b border-stone-800 flex items-start justify-between gap-4 bg-stone-950/50">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-stone-950 border border-stone-800 flex items-center justify-center p-2 shrink-0">
                  {inspectedSquadron.emblemUrl ? (
                    <img
                      src={inspectedSquadron.emblemUrl}
                      alt={inspectedSquadron.name}
                      onError={(e) => {
                        const target = e.currentTarget;
                        if (target.src !== 'https://cdn.globaltaskforceoverlord.org/GTFO-Logo.png') {
                          target.src = 'https://cdn.globaltaskforceoverlord.org/GTFO-Logo.png';
                        }
                      }}
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <AirplaneTilt className="w-8 h-8 text-stone-500" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-stone-900 border border-stone-700 text-amber-400 font-mono text-xs font-bold">
                      {inspectedSquadron.abbreviation || inspectedSquadron.code}
                    </span>
                  </div>
                  <h2 className="font-display font-bold text-xl text-stone-100 mt-1">
                    {inspectedSquadron.name}
                  </h2>
                  {inspectedSquadron.nickname && (
                    <p className="text-xs font-mono text-amber-400 font-semibold">
                      "{inspectedSquadron.nickname}"
                    </p>
                  )}
                </div>
              </div>

              <button
                onClick={() => setInspectedSquadron(null)}
                className="p-1.5 rounded-lg bg-stone-800 text-stone-400 hover:text-stone-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs text-stone-300 leading-relaxed">
              {/* Mission & Role */}
              <div className="space-y-1.5">
                <h4 className="text-[11px] font-mono uppercase text-stone-400 font-bold tracking-wider">
                  Operational Mission &amp; Role
                </h4>
                <p className="p-3 rounded-xl bg-stone-950/80 border border-stone-800 text-stone-300 font-sans">
                  {inspectedSquadron.role}
                </p>
              </div>

              {/* Description / History */}
              {inspectedSquadron.description && (
                <div className="space-y-1.5">
                  <h4 className="text-[11px] font-mono uppercase text-stone-400 font-bold tracking-wider">
                    Squadron Overview &amp; Doctrine
                  </h4>
                  <div
                    className="p-4 rounded-xl bg-stone-950/80 border border-stone-800 text-stone-300 prose prose-invert prose-xs max-w-none leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: inspectedSquadron.description }}
                  />
                </div>
              )}

              {/* Primary Airframe & Operated Airframes */}
              <div className="space-y-1.5">
                <h4 className="text-[11px] font-mono uppercase text-stone-400 font-bold tracking-wider">
                  Assigned Airframes
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {inspectedSquadron.airframes && inspectedSquadron.airframes.length > 0 ? (
                    inspectedSquadron.airframes.map((af) => (
                      <div
                        key={af.id}
                        className="p-3 rounded-xl bg-stone-950 border border-stone-800 flex items-center justify-between"
                      >
                        <span className="font-semibold text-stone-200">{af.name}</span>
                        {af.abbreviation && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-stone-900 border border-stone-800 text-stone-400">
                            {af.abbreviation}
                          </span>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 text-stone-400">
                      {inspectedSquadron.primaryAirframe || 'Multi-Role Airframes'}
                    </div>
                  )}
                </div>
              </div>

              {/* Radio Callsigns */}
              {inspectedSquadron.callsigns && inspectedSquadron.callsigns.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[11px] font-mono uppercase text-stone-400 font-bold tracking-wider">
                    Designated Tactical Callsigns
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {inspectedSquadron.callsigns.map((item: any, idx) => {
                      let callsignName = 'Callsign';
                      let tasking: string | null = null;
                      let plane: string | null = null;

                      if (typeof item === 'string') {
                        callsignName = item;
                      } else if (item && typeof item === 'object') {
                        if (typeof item.callsign === 'string') {
                          callsignName = item.callsign;
                        } else if (typeof item.name === 'string') {
                          callsignName = item.name;
                        } else if (item.callsign && typeof item.callsign === 'object') {
                          callsignName = item.callsign.name || item.callsign.callsign || 'Callsign';
                        }

                        if (typeof item.purpose === 'string') {
                          tasking = item.purpose;
                        } else if (typeof item.tasking === 'string') {
                          tasking = item.tasking;
                        } else if (typeof item.role === 'string') {
                          tasking = item.role;
                        }

                        const rawPlane = item.airframe ?? item.plane ?? item.airframe_name;
                        if (typeof rawPlane === 'string') {
                          plane = rawPlane;
                        } else if (rawPlane && typeof rawPlane === 'object') {
                          plane = rawPlane.name || rawPlane.abbreviation || null;
                        }
                      }

                      if (plane) {
                        const planeStr = String(plane).trim();
                        if (/^\d+$/.test(planeStr)) {
                          const num = Number(planeStr);
                          plane =
                            KNOWN_AIRFRAME_NAMES[num] ||
                            inspectedSquadron.airframes?.find((af) => String(af.id) === planeStr)?.name ||
                            inspectedSquadron.primaryAirframe ||
                            planeStr;
                        } else if (KNOWN_AIRFRAME_NAMES[planeStr]) {
                          plane = KNOWN_AIRFRAME_NAMES[planeStr];
                        }
                      } else if (inspectedSquadron.primaryAirframe) {
                        plane = inspectedSquadron.primaryAirframe;
                      }

                      return (
                        <div
                          key={idx}
                          className="p-3 rounded-xl bg-stone-950 border border-stone-800 flex flex-col justify-between gap-1.5 shadow-sm"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-sm font-bold text-amber-300">
                              {callsignName}
                            </span>
                            {tasking && (
                              <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-[10px] font-mono font-bold text-amber-400 uppercase">
                                {tasking}
                              </span>
                            )}
                          </div>

                          {plane && (
                            <div className="text-[11px] font-mono text-stone-400 flex items-center gap-1.5 pt-0.5 border-t border-stone-900">
                              <AirplaneTilt className="w-3 h-3 text-stone-500 shrink-0" />
                              <span className="truncate">{plane}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Frequencies */}
              {inspectedSquadron.frequencies && inspectedSquadron.frequencies.length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="text-[11px] font-mono uppercase text-stone-400 font-bold tracking-wider">
                    Assigned Squadron Frequencies
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {inspectedSquadron.frequencies.map((freq, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl bg-stone-950 border border-stone-800 flex items-center justify-between"
                      >
                        <span className="text-stone-300 font-mono text-xs font-semibold">
                          {freq.name || `Channel ${idx + 1}`}
                        </span>
                        <span className="text-amber-400 font-mono text-xs font-bold">
                          {freq.frequency} {freq.modulation || 'AM'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-stone-950/80 border-t border-stone-800 flex items-center justify-between gap-3">
              <button
                onClick={() => {
                  const targetSq = inspectedSquadron;
                  setInspectedSquadron(null);
                  handleOpenRoster(targetSq);
                }}
                className="px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-700 hover:border-amber-500/50 text-stone-200 hover:text-amber-300 font-mono text-xs font-bold flex items-center gap-2 transition-all shadow-sm"
              >
                <UsersFour className="w-4 h-4 text-amber-400" />
                <span>View Squadron Roster</span>
                <span className="px-1.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px]">
                  {getSquadronMemberCount(inspectedSquadron)}
                </span>
              </button>

              <button
                onClick={() => setInspectedSquadron(null)}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-display font-bold text-xs shadow transition-colors"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
