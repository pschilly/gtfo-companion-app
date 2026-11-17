import { HomeWidgetColSpan } from '../../types';

export interface HomeWidgetProps {
  colSpan: HomeWidgetColSpan;
}

export function getWidgetListLayout(colSpan: HomeWidgetColSpan) {
  const isWide = colSpan === 12;
  return {
    isWide,
    maxListCount: isWide ? 6 : 4,
    listContainerClass: isWide
      ? 'mt-4 grid grid-cols-1 md:grid-cols-2 gap-2.5'
      : 'mt-4 space-y-2.5',
  };
}
