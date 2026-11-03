import React, { useEffect, useState } from 'react';
import { ActivityConsole } from './components/ActivityConsole';
import { AppUpdateModal } from './components/AppUpdateModal';
import { AssetDetailsModal } from './components/AssetDetailsModal';
import { LoginModal } from './components/LoginModal';
import { PathOnboardingModal } from './components/PathOnboardingModal';
import { RepairPromptModal } from './components/RepairPromptModal';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { AppProvider, useApp } from './context/AppContext';
import { openExternalUrl } from './services/tauriBridge';
import { AirframesView } from './views/AirframesView';
import { AssetManagerView } from './views/AssetManagerView';
import { AwardsView } from './views/AwardsView';
import { ChecklistView } from './views/ChecklistView';
import { DashboardView } from './views/DashboardView';
import { HomeView } from './views/HomeView';
import { LoginGateView } from './views/LoginGateView';
import { QualificationsView } from './views/QualificationsView';
import { SettingsView } from './views/SettingsView';
import { AtcView } from './views/AtcView';
import { EventCalendarView } from './views/EventCalendarView';

const MainShell: React.FC = () => {
  const { activeTab, setActiveTab, userSession } = useApp();
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
        e.preventDefault();
        openExternalUrl(href);
      }
    };
    document.addEventListener('click', handleDocumentClick, true);
    return () => document.removeEventListener('click', handleDocumentClick, true);
  }, []);

  // Require an authenticated Discord session with a verified GTFO role (Community or CORE)
  // before rendering any part of the application.
  const baseRoleVerified =
    userSession &&
    userSession.isGuildMember &&
    userSession.tier !== 'guest';

  if (!baseRoleVerified) {
    return <LoginGateView />;
  }

  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
  };

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-stone-950 text-stone-200">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-topo">
        <TopBar searchQuery={searchQuery} onSearchChange={handleSearchChange} />

        <main className="flex-1 overflow-y-auto p-6">
          {activeTab === 'home' && <HomeView />}
          {activeTab === 'calendar' && <EventCalendarView />}
          {activeTab === 'dashboard' && <DashboardView />}
          {activeTab === 'checklist' && <ChecklistView />}
          {activeTab === 'airframes' && <AirframesView />}
          {activeTab === 'qualifications' && <QualificationsView />}
          {activeTab === 'awards' && <AwardsView />}
          {activeTab === 'atc' && <AtcView />}
          {(activeTab === 'library' || activeTab === 'liveries' || activeTab === 'mods') && (
            <AssetManagerView searchQuery={searchQuery} />
          )}
          {activeTab === 'settings' && <SettingsView />}
        </main>

        <ActivityConsole />
      </div>

      <AssetDetailsModal />
      <RepairPromptModal />
      <LoginModal />
      <PathOnboardingModal />
      <AppUpdateModal />
    </div>
  );
};

export function App() {
  return (
    <AppProvider>
      <MainShell />
    </AppProvider>
  );
}

export default App;
