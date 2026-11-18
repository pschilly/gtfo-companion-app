import React from 'react';
import {
  AirplaneTilt,
  CalendarBlank,
  Compass,
  Crosshair,
  GraduationCap,
  SquaresFour,
  User,
} from '@phosphor-icons/react';
import { HomeWidgetId, HomeWidgetItem } from '../../types';
import { DossierSummaryWidget } from './DossierSummaryWidget';
import { FiledFlightPlansWidget } from './FiledFlightPlansWidget';
import { MyFlightPlansWidget } from './MyFlightPlansWidget';
import { PinnedCampaignWidget } from './PinnedCampaignWidget';
import { QualifiedAirframesWidget } from './QualifiedAirframesWidget';
import { TrackedQualificationsWidget } from './TrackedQualificationsWidget';
import { UpcomingSortiesWidget } from './UpcomingSortiesWidget';

export type { HomeWidgetProps } from './types';
export { getWidgetListLayout } from './types';
export { UpcomingSortiesWidget } from './UpcomingSortiesWidget';
export { FiledFlightPlansWidget } from './FiledFlightPlansWidget';
export { PinnedCampaignWidget } from './PinnedCampaignWidget';
export { MyFlightPlansWidget } from './MyFlightPlansWidget';
export { DossierSummaryWidget } from './DossierSummaryWidget';
export { TrackedQualificationsWidget } from './TrackedQualificationsWidget';
export { QualifiedAirframesWidget } from './QualifiedAirframesWidget';

export function getWidgetIcon(id: HomeWidgetId) {
  switch (id) {
    case 'upcoming_sorties':
      return <CalendarBlank className="w-4 h-4 text-amber-400" />;
    case 'filed_flight_plans':
      return <Compass className="w-4 h-4 text-sky-400" />;
    case 'pinned_campaign':
      return <Crosshair className="w-4 h-4 text-amber-400" />;
    case 'my_flight_plans':
      return <User className="w-4 h-4 text-amber-400" />;
    case 'dossier_summary':
      return <SquaresFour className="w-4 h-4 text-amber-400" />;
    case 'tracked_qualifications':
      return <GraduationCap className="w-4 h-4 text-emerald-400" />;
    case 'qualified_airframes':
      return <AirplaneTilt className="w-4 h-4 text-sky-400" />;
  }
}

export const HomeWidgetRenderer: React.FC<{ widget: HomeWidgetItem }> = ({ widget }) => {
  switch (widget.id) {
    case 'upcoming_sorties':
      return <UpcomingSortiesWidget colSpan={widget.colSpan} />;
    case 'filed_flight_plans':
      return <FiledFlightPlansWidget colSpan={widget.colSpan} />;
    case 'pinned_campaign':
      return <PinnedCampaignWidget colSpan={widget.colSpan} />;
    case 'my_flight_plans':
      return <MyFlightPlansWidget colSpan={widget.colSpan} />;
    case 'dossier_summary':
      return <DossierSummaryWidget colSpan={widget.colSpan} />;
    case 'tracked_qualifications':
      return <TrackedQualificationsWidget colSpan={widget.colSpan} />;
    case 'qualified_airframes':
      return <QualifiedAirframesWidget colSpan={widget.colSpan} />;
  }
};
