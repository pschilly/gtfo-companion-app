import React, { useState, useRef, useEffect } from 'react';
import {
  Bell,
  Check,
  Checks,
  Trash,
  X,
  Sparkle,
  PaintBrush,
  Package,
  AirplaneTilt,
  Megaphone,
  ArrowSquareOut,
} from '@phosphor-icons/react';
import { listen } from '@tauri-apps/api/event';
import { isTauriRuntime } from '../services/tauriBridge';
import { useApp } from '../context/AppContext';
import { AppNotification, NotificationCategory } from '../types';

interface NotificationCenterDropdownProps {
  onClose?: () => void;
}

export const NotificationCenterDropdown: React.FC<NotificationCenterDropdownProps> = () => {
  const {
    notifications,
    unreadNotificationsCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    clearNotification,
    clearAllNotifications,
    setActiveTab,
    setSelectedAsset,
    manifest,
    setIsUpdateModalOpen,
  } = useApp();

  const [isOpen, setIsOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<'all' | NotificationCategory>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Open notification dropdown when triggered from Tray Menu "🔔 X New Notifications"
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    if (isTauriRuntime()) {
      listen('open-notifications', () => {
        setIsOpen(true);
      }).then((fn) => {
        unlisten = fn;
      });
    }
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const filteredNotifications = notifications.filter((item) => {
    if (categoryFilter === 'all') return true;
    if (categoryFilter === 'livery' || categoryFilter === 'mod') {
      return item.category === 'livery' || item.category === 'mod';
    }
    return item.category === categoryFilter;
  });

  const formatRelativeTime = (timestamp: string): string => {
    try {
      const diffMs = Date.now() - new Date(timestamp).getTime();
      const diffSec = Math.floor(diffMs / 1000);
      if (diffSec < 60) return 'Just now';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch {
      return 'Recently';
    }
  };

  const getCategoryIcon = (category: NotificationCategory) => {
    switch (category) {
      case 'app':
        return <Sparkle className="w-4 h-4 text-amber-400" />;
      case 'livery':
        return <PaintBrush className="w-4 h-4 text-cyan-400" />;
      case 'mod':
        return <Package className="w-4 h-4 text-emerald-400" />;
      case 'flight_plan':
        return <AirplaneTilt className="w-4 h-4 text-sky-400" />;
      case 'announcement':
        return <Megaphone className="w-4 h-4 text-rose-400" />;
      default:
        return <Bell className="w-4 h-4 text-stone-400" />;
    }
  };

  const handleNotificationClick = (item: AppNotification) => {
    markNotificationAsRead(item.id);

    if (item.category === 'app') {
      setIsUpdateModalOpen(true);
      setIsOpen(false);
      return;
    }

    if (item.actionTab) {
      setActiveTab(item.actionTab);
    }

    if (item.actionAssetId) {
      const match = manifest.assets.find((a) => a.id === item.actionAssetId);
      if (match) {
        setSelectedAsset(match);
      }
    }

    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={`relative p-2 rounded-xl border transition-all ${
          isOpen
            ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
            : 'bg-stone-900/90 hover:bg-stone-800 border-stone-800 text-stone-300 hover:text-amber-400'
        }`}
        title="Notifications"
        aria-label="Toggle notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadNotificationsCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-amber-500 text-[9px] font-mono font-bold text-stone-950 shadow-sm animate-pulse">
            {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] rounded-2xl bg-stone-950/95 border border-stone-800 shadow-2xl backdrop-blur-xl z-50 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="p-3.5 border-b border-stone-800/80 flex items-center justify-between gap-2 bg-stone-900/50">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold tracking-wider text-stone-200 uppercase">
                Notifications
              </span>
              {unreadNotificationsCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-mono font-semibold">
                  {unreadNotificationsCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {unreadNotificationsCount > 0 && (
                <button
                  onClick={markAllNotificationsAsRead}
                  className="px-2 py-1 rounded-lg text-[10px] font-mono text-stone-400 hover:text-stone-200 hover:bg-stone-800/80 transition-colors flex items-center gap-1"
                  title="Mark all as read"
                >
                  <Checks className="w-3.5 h-3.5 text-stone-400" />
                  <span>Mark read</span>
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearAllNotifications}
                  className="p-1 rounded-lg text-stone-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                  title="Clear all notifications"
                >
                  <Trash className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Filter Pills */}
          <div className="px-3 py-2 border-b border-stone-800/60 bg-stone-900/20 flex items-center gap-1 overflow-x-auto scrollbar-none text-[11px] font-mono">
            <button
              onClick={() => setCategoryFilter('all')}
              className={`px-2 py-1 rounded-lg transition-all shrink-0 ${
                categoryFilter === 'all'
                  ? 'bg-amber-500 text-stone-950 font-bold'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/60'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              onClick={() => setCategoryFilter('app')}
              className={`px-2 py-1 rounded-lg transition-all shrink-0 ${
                categoryFilter === 'app'
                  ? 'bg-amber-500 text-stone-950 font-bold'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/60'
              }`}
            >
              App
            </button>
            <button
              onClick={() => setCategoryFilter('livery')}
              className={`px-2 py-1 rounded-lg transition-all shrink-0 ${
                categoryFilter === 'livery'
                  ? 'bg-amber-500 text-stone-950 font-bold'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/60'
              }`}
            >
              Liveries & Mods
            </button>
            <button
              onClick={() => setCategoryFilter('flight_plan')}
              className={`px-2 py-1 rounded-lg transition-all shrink-0 ${
                categoryFilter === 'flight_plan'
                  ? 'bg-amber-500 text-stone-950 font-bold'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/60'
              }`}
            >
              Flight Plans
            </button>
          </div>

          {/* Notification List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-stone-800/50">
            {filteredNotifications.length === 0 ? (
              <div className="py-12 px-6 text-center">
                <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-stone-900/80 border border-stone-800 flex items-center justify-center text-stone-500">
                  <Bell className="w-5 h-5 text-stone-600" />
                </div>
                <div className="text-xs font-mono font-medium text-stone-400">
                  No notifications
                </div>
                <div className="text-[11px] text-stone-600 mt-0.5">
                  All systems operating at standard readiness
                </div>
              </div>
            ) : (
              filteredNotifications.map((item) => (
                <div
                  key={item.id}
                  className={`group relative p-3 transition-colors flex items-start gap-3 cursor-pointer ${
                    item.read
                      ? 'bg-stone-950/40 hover:bg-stone-900/40 opacity-80 hover:opacity-100'
                      : 'bg-amber-500/5 hover:bg-amber-500/10'
                  }`}
                  onClick={() => handleNotificationClick(item)}
                >
                  {/* Category Icon Badge */}
                  <div className="mt-0.5 p-2 rounded-xl bg-stone-900 border border-stone-800 shrink-0">
                    {getCategoryIcon(item.category)}
                  </div>

                  {/* Text Content */}
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-1.5">
                      {!item.read && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                      )}
                      <h4
                        className={`text-xs font-medium truncate ${
                          item.read ? 'text-stone-300' : 'text-stone-100 font-semibold'
                        }`}
                      >
                        {item.title}
                      </h4>
                    </div>
                    <p className="text-[11px] text-stone-400 mt-1 line-clamp-2 leading-relaxed">
                      {item.message}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] font-mono text-stone-500">
                        {formatRelativeTime(item.timestamp)}
                      </span>
                      {(item.actionTab || item.category === 'app') && (
                        <span className="text-[10px] font-mono text-amber-400/80 flex items-center gap-0.5">
                          <span>View</span>
                          <ArrowSquareOut className="w-2.5 h-2.5" />
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Dismiss Single Notification Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      clearNotification(item.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-stone-500 hover:text-stone-300 hover:bg-stone-800 transition-all shrink-0"
                    title="Dismiss"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Footer note */}
          <div className="px-3.5 py-2 bg-stone-900/60 border-t border-stone-800/80 text-[10px] font-mono text-stone-500 flex items-center justify-between">
            <span>GTFO Tactical Comm Link</span>
            <span className="text-stone-600">v{manifest.manifestVersion}</span>
          </div>
        </div>
      )}
    </div>
  );
};
