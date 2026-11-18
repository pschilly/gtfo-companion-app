import React from 'react';
import { AirplaneTilt, Coins, Scan, Truck } from '@phosphor-icons/react';
import { CampaignItem } from '../../types';

export const RESOURCE_STYLE_MAP: Record<
  string,
  {
    border: string;
    gradient: string;
    iconBox: string;
    text: string;
    accent: string;
  }
> = {
  command_points: {
    border: 'border-amber-500/30',
    gradient: 'from-amber-950/25 via-stone-900 to-stone-900/95',
    iconBox: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
    text: 'text-amber-300',
    accent: 'text-amber-400/80',
  },
  airframe_credits: {
    border: 'border-sky-500/30',
    gradient: 'from-sky-950/25 via-stone-900 to-stone-900/95',
    iconBox: 'bg-sky-500/15 text-sky-400 border-sky-500/25',
    text: 'text-sky-300',
    accent: 'text-sky-400/80',
  },
  isr_credits: {
    border: 'border-emerald-500/30',
    gradient: 'from-emerald-950/25 via-stone-900 to-stone-900/95',
    iconBox: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
    text: 'text-emerald-300',
    accent: 'text-emerald-400/80',
  },
  logistics_points: {
    border: 'border-purple-500/30',
    gradient: 'from-purple-950/25 via-stone-900 to-stone-900/95',
    iconBox: 'bg-purple-500/15 text-purple-400 border-purple-500/25',
    text: 'text-purple-300',
    accent: 'text-purple-400/80',
  },
};

export function renderResourceIcon(key: string, className = 'w-5 h-5'): React.ReactNode {
  switch (key) {
    case 'command_points':
      return <Coins className={className} />;
    case 'airframe_credits':
      return <AirplaneTilt className={className} />;
    case 'isr_credits':
      return <Scan className={className} />;
    case 'logistics_points':
      return <Truck className={className} />;
    default:
      return <Coins className={className} />;
  }
}

export function getStatusBadgeClasses(statusColor: string): string {
  switch (statusColor) {
    case 'success':
      return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/35';
    case 'primary':
      return 'bg-blue-500/20 text-blue-300 border-blue-500/35';
    case 'info':
      return 'bg-sky-500/20 text-sky-300 border-sky-500/35';
    case 'warning':
      return 'bg-amber-500/20 text-amber-300 border-amber-500/35';
    case 'danger':
      return 'bg-rose-500/20 text-rose-300 border-rose-500/35';
    default:
      return 'bg-stone-800 text-stone-300 border-stone-700';
  }
}

export function getMissionStatusBadgeClasses(status: string): string {
  switch (status.toLowerCase()) {
    case 'active':
      return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/35';
    case 'open':
      return 'bg-sky-500/20 text-sky-300 border-sky-500/35';
    case 'completed':
      return 'bg-blue-500/20 text-blue-300 border-blue-500/35';
    case 'cancelled':
      return 'bg-rose-500/20 text-rose-300 border-rose-500/35';
    default:
      return 'bg-stone-800 text-stone-300 border-stone-700';
  }
}

export function formatZuluShort(iso?: string | null): string {
  if (!iso) return 'TBD';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const month = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  const day = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${month} ${day}, ${hh}:${mm}z`;
}

export function formatDateTimeShort(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getCampaignAarCount(campaign?: CampaignItem | null): number {
  if (!campaign) return 0;
  return (campaign.missions || []).reduce((sum, mission) => {
    const aarCount = (mission.sorties || []).filter((s) => Boolean(s.hasAar)).length;
    return sum + aarCount;
  }, 0);
}

export function getCampaignTotalIntelCount(campaign?: CampaignItem | null): number {
  if (!campaign) return 0;
  const s2Count = Math.max(campaign.intelReportsCount || 0, (campaign.intelReports || []).length);
  return s2Count + getCampaignAarCount(campaign);
}
