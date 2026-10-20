import React from 'react';
import { Award, FileCheck2, LayoutDashboard, Plane } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { NavigationTab } from '../types';

export const DossierNav: React.FC = () => {
  const { activeTab, setActiveTab, memberProfile } = useApp();

  const tabs: {
    id: NavigationTab;
    label: string;
    icon: React.ReactNode;
    count?: number;
  }[] = [
    {
      id: 'dashboard',
      label: 'Dossier Overview',
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      id: 'airframes',
      label: 'Qualified Airframes',
      icon: <Plane className="w-4 h-4" />,
      count: memberProfile.qualifiedAirframes?.length || 0,
    },
    {
      id: 'qualifications',
      label: 'Certifications',
      icon: <FileCheck2 className="w-4 h-4" />,
      count: memberProfile.certificates?.length || 0,
    },
    {
      id: 'awards',
      label: 'Awards & Ribbons',
      icon: <Award className="w-4 h-4" />,
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
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  isActive
                    ? 'bg-stone-950 text-amber-300'
                    : 'bg-stone-800 text-stone-300 border border-stone-700'
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
