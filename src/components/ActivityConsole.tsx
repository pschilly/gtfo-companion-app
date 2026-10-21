import React, { useState } from 'react';
import {
  CaretDown,
  CaretUp,
  CircleNotch,
  Terminal,
  Trash,
} from '@phosphor-icons/react';
import { useApp } from '../context/AppContext';

export const ActivityConsole: React.FC = () => {
  const { logs, clearLogs, activeDownloads } = useApp();
  const [expanded, setExpanded] = useState(false);

  const activeList = Object.values(activeDownloads);
  const latestLog = logs[0];

  return (
    <div className="bg-stone-950 border-t border-stone-800/90 shrink-0 select-none">
      {/* Status Bar Header */}
      <div
        onClick={() => setExpanded((prev) => !prev)}
        className="h-9 px-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-stone-900/60 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold text-amber-400 shrink-0">
            <Terminal className="w-3.5 h-3.5" />
            TELEMETRY LOG
          </span>

          {activeList.length > 0 ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-mono text-emerald-300 truncate">
              <CircleNotch className="w-3.5 h-3.5 animate-spin text-amber-400" />
              {activeList[0].message} ({activeList[0].percent}%)
            </span>
          ) : latestLog ? (
            <span className="text-xs font-mono text-stone-400 truncate">
              <span className="text-stone-600">[{latestLog.timestamp}]</span>{' '}
              <span className="text-amber-400/90">[{latestLog.source}]</span> {latestLog.message}
            </span>
          ) : (
            <span className="text-xs font-mono text-stone-500">System nominal. Standing by.</span>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[10px] font-mono text-stone-500">{logs.length} EVENTS</span>
          {expanded ? (
            <CaretDown className="w-4 h-4 text-stone-400" />
          ) : (
            <CaretUp className="w-4 h-4 text-stone-400" />
          )}
        </div>
      </div>

      {/* Expandable Log Drawer */}
      {expanded && (
        <div className="h-44 border-t border-stone-800/80 bg-stone-950 flex flex-col">
          <div className="px-4 py-1.5 border-b border-stone-900 flex items-center justify-between text-[10px] font-mono text-stone-500">
            <span>REAL-TIME DEPLOYMENT, PORTAL SYNC &amp; ATC DISPATCH CONSOLE</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                clearLogs();
              }}
              className="hover:text-stone-300 flex items-center gap-1"
            >
              <Trash className="w-3 h-3" />
              Clear Console
            </button>
          </div>
          <div className="p-3 overflow-y-auto flex-1 space-y-1 font-mono text-xs">
            {logs.map((entry) => {
              const colorClass =
                entry.level === 'error'
                  ? 'text-red-400'
                  : entry.level === 'warn'
                  ? 'text-amber-300'
                  : entry.level === 'success'
                  ? 'text-emerald-400'
                  : 'text-stone-300';
              return (
                <div key={entry.id} className="flex items-start gap-2 leading-relaxed">
                  <span className="text-stone-600 shrink-0">[{entry.timestamp}]</span>
                  <span className="text-stone-500 shrink-0 w-20">[{entry.source}]</span>
                  <span className={colorClass}>{entry.message}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
