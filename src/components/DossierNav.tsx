import React from 'react';
import {
  AirplaneTilt,
  Certificate,
  Check,
  Compass,
  ListChecks,
  Medal,
  SquaresFour,
} from '@phosphor-icons/react';
import { useApp } from '../context/AppContext';
import { NavigationTab } from '../types';

export const DossierNav: React.FC = () => {
  const { activeTab, setActiveTab, memberProfile, checklistSummary, memberFlightPlans } = useApp();

  const tabs: {
    id: NavigationTab;
    label: string;
    icon: React.ReactNode;
    count?: React.ReactNode;
    badgeColor?: string;
  }[] = [
    {
      id: 'dashboard',
      label: 'Dossier Overview',
      icon: <SquaresFour className="w-4 h-4" />,
    },
    {
      id: 'atc',
      label: 'Flight Plans & ATC',
      icon: <Compass className="w-4 h-4" />,
      count: memberFlightPlans?.length || 0,
      badgeColor: 'bg-sky-500/20 text-sky-300 border border-sky-500/40',
    },
    {
      id: 'checklist',
      label: 'Member Readiness',
      icon: <ListChecks className="w-4 h-4" />,
      count:
        checklistSummary.pendingCount > 0 ? (
          checklistSummary.pendingCount
        ) : (
          <Check weight="bold" className="w-3 h-3" />
        ),
      badgeColor:
        checklistSummary.pendingCount > 0
          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40',
    },
    {
      id: 'airframes',
      label: 'Qualified Airframes',
      icon: <AirplaneTilt className="w-4 h-4" />,
      count: memberProfile.qualifiedAirframes?.length || 0,
    },
    {
      id: 'qualifications',
      label: 'Certifications',
      icon: <Certificate className="w-4 h-4" />,
      count: memberProfile.certificates?.length || 0,
    },
    {
      id: 'awards',
      label: 'Awards & Ribbons',
      icon: <Medal className="w-4 h-4" />,
      count: memberProfile.awards?.length || 0,
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl bg-stone-900/90 border border-stone-800 shadow-md">
      {tabs.map((t) => {
        const isActive = activeTab === t.id;
        return (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono transition-all ${
              isActive
                ? 'bg-amber-500 text-stone-950 font-bold shadow-md shadow-amber-500/20'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/80'
            }`}
          >
            <span className={isActive ? 'text-stone-950' : 'text-amber-400'}>
              {t.icon}
            </span>
            <span>{t.label}</span>
            {t.count !== undefined && (
              <span
                className={`min-w-5 h-5 px-1.5 flex items-center justify-center rounded-full text-[10px] font-bold leading-none ${
                  isActive
                    ? 'bg-stone-950 text-amber-300'
                    : t.badgeColor || 'bg-stone-800 text-stone-300 border border-stone-700'
                }`}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
