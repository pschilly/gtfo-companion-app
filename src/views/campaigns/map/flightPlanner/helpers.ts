import {
  CampaignMapAirbase,
  CampaignMapAirframeCatalogItem,
  CampaignMapNavaid,
  CampaignMapPayload,
  CampaignMapWarehouseInventory,
  FlightPlanCommsEntry,
  FlightPlanDetail,
  FlightPlanRoutePoint,
} from '../../../../types';
import {
  calculateDistanceKm,
  calculateDistanceNm,
  casToTas,
  formatCoordinateDdm,
  formatCoordinateDms,
  parseAnyCoordinate,
  tasToCas,
  toMgrs,
} from '../geodesy';

export type AvionicsDrawTarget =
  | { kind: 'f18_flot'; lineIdx: number }
  | { kind: 'f18_faor'; lineIdx: number }
  | { kind: 'f18_cap'; capIdx: number }
  | { kind: 'f18_corridor'; lineIdx: number }
  | { kind: 'f16_geo'; lineNum: 1 | 2 | 3 | 4 }
  | { kind: 'f16_dest' }
  | { kind: 'f14_plot'; lineNum: 1 | 2 | 3 | 4 }
  | { kind: 'jf17_airspace'; key: 'BKYA' | 'BKYB' | 'BKYC' | 'BKYD' };

export type PlannerTabId =
  | 'summary'
  | 'routes'
  | 'targets'
  | 'loadouts'
  | 'comms'
  | 'mids'
  | 'sa'
  | 'geolines'
  | 'destpts'
  | 'plotlines'
  | 'additionalpts'
  | 'jf17airspace'
  | 'cmds'
  | 'notes';

export interface TickConfig {
  type: 'off' | 'time' | 'range';
  interval: number;
}

export type DoghouseConfig = 'on' | 'off';

export type AutoSaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

export const SEQUENCE_DEFAULT_COLORS: Record<number, string> = {
  1: '#3b82f6',
  2: '#818cf8',
  3: '#34d399',
  4: '#f472b6',
  5: '#fbbf24',
  6: '#a855f7',
  7: '#06b6d4',
  8: '#f97316',
  9: '#ec4899',
  10: '#14b8a6',
  11: '#eab308',
  12: '#8b5cf6',
};

export const SEQUENCE_DASH_PATTERNS: Record<number, string | undefined> = {
  1: undefined,
  2: '8 5',
  3: '6 4',
  4: '4 4',
  5: '3 3',
};

export const JF17_DEFAULT_COLORS: Record<'BKYA' | 'BKYB' | 'BKYC' | 'BKYD', string> = {
  BKYA: '#a020f0',
  BKYB: '#00ffff',
  BKYC: '#0000ff',
  BKYD: '#d19275',
};

export const F16_GEO_LINE_COLORS: Record<1 | 2 | 3 | 4, string> = {
  1: '#ef4444',
  2: '#10b981',
  3: '#06b6d4',
  4: '#a855f7',
};

export function avionicsDrawTargetsEqual(
  a: AvionicsDrawTarget | null,
  b: AvionicsDrawTarget | null
): boolean {
  if (!a || !b) return false;
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case 'f18_flot':
    case 'f18_faor':
    case 'f18_corridor':
      return a.lineIdx === (b as typeof a).lineIdx;
    case 'f18_cap':
      return a.capIdx === (b as typeof a).capIdx;
    case 'f16_geo':
    case 'f14_plot':
      return a.lineNum === (b as typeof a).lineNum;
    case 'jf17_airspace':
      return a.key === (b as typeof a).key;
    case 'f16_dest':
      return true;
  }
}

export function describeAvionicsDrawTarget(target: AvionicsDrawTarget): string {
  switch (target.kind) {
    case 'f18_flot':
      return `Drawing FLOT #${target.lineIdx + 2} (max 7 pts)`;
    case 'f18_faor':
      return `Drawing FAOR #${target.lineIdx + 1} (max 7 pts)`;
    case 'f18_cap':
      return `Pick CAP #${target.capIdx + 1} Anchor`;
    case 'f18_corridor':
      return `Drawing Corridor #${target.lineIdx + 1} (max 14 pts)`;
    case 'f16_geo':
      return `Drawing F-16 Geo Line ${target.lineNum} (Total limit 25)`;
    case 'f16_dest':
      return 'Placing F-16 DEST Point (STPT 81–99)';
    case 'f14_plot':
      return `Drawing F-14 Plot Line ${target.lineNum} (Limit 9 pts)`;
    case 'jf17_airspace':
      return `Drawing JF-17 Airspace ${target.key}`;
  }
}

export function formatCoalitionLabel(coalition: unknown): string {
  const val = String(coalition ?? '').trim().toLowerCase();
  if (val === '2' || val === 'blue') return 'BLUE';
  if (val === '1' || val === 'red') return 'RED';
  if (val === '0' || val === 'neutral' || val === '') return 'NEUTRAL';
  return val.toUpperCase();
}

export type AirframeKey =
  | 'F_16C'
  | 'F_14_AB'
  | 'F_18C'
  | 'C_130J_30'
  | 'AH_64D'
  | 'CH_47F'
  | 'A_10C_II'
  | 'JF_17'
  | 'F_4E'
  | 'F_100D'
  | null;

export function getAirframeKey(airframe?: CampaignMapAirframeCatalogItem | FlightPlanDetail['airframe'] | null): AirframeKey {
  if (!airframe) return null;
  const entity = (airframe.dcs_entity || '').toLowerCase();
  const abbr = (airframe.abbreviation || '').toLowerCase();
  const name = (airframe.name || '').toLowerCase();

  if (entity.includes('f-16') || abbr.includes('f16') || abbr.includes('f-16') || name.includes('f-16') || name.includes('viper')) return 'F_16C';
  if (entity.includes('f-14') || abbr.includes('f14') || abbr.includes('f-14') || name.includes('f-14') || name.includes('tomcat')) return 'F_14_AB';
  if (entity.includes('fa-18') || abbr.includes('fa18') || abbr.includes('fa-18') || name.includes('f/a-18') || name.includes('fa-18') || name.includes('f-18') || name.includes('hornet')) return 'F_18C';
  if (entity.includes('c-130') || abbr.includes('c130') || name.includes('c-130') || name.includes('hercules')) return 'C_130J_30';
  if (entity.includes('ah-64') || abbr.includes('ah64') || name.includes('ah-64') || name.includes('apache')) return 'AH_64D';
  if (entity.includes('ch-47') || abbr.includes('ch47') || name.includes('ch-47') || name.includes('chinook')) return 'CH_47F';
  if (entity.includes('a-10') || abbr.includes('a10') || name.includes('a-10') || name.includes('thunderbolt') || name.includes('warthog')) return 'A_10C_II';
  if (entity.includes('jf-17') || abbr.includes('jf17') || name.includes('jf-17') || (name.includes('thunder') && !name.includes('thunderbolt'))) return 'JF_17';
  if (entity.includes('f-4') || abbr.includes('f4') || name.includes('f-4') || name.includes('phantom')) return 'F_4E';
  if (entity.includes('f-100') || abbr.includes('f100') || name.includes('f-100') || name.includes('super sabre')) return 'F_100D';
  return null;
}

export function isF18Airframe(plan: FlightPlanDetail | null, airframe?: CampaignMapAirframeCatalogItem | null): boolean {
  const key = getAirframeKey(airframe || plan?.airframe);
  if (key) return key === 'F_18C';
  return Boolean(plan?.is_f18 || airframe?.is_f18);
}

export function isF16Airframe(plan: FlightPlanDetail | null, airframe?: CampaignMapAirframeCatalogItem | null): boolean {
  const key = getAirframeKey(airframe || plan?.airframe);
  if (key) return key === 'F_16C';
  return Boolean(plan?.is_f16 || airframe?.is_f16);
}

export function isF14Airframe(plan: FlightPlanDetail | null, airframe?: CampaignMapAirframeCatalogItem | null): boolean {
  const key = getAirframeKey(airframe || plan?.airframe);
  if (key) return key === 'F_14_AB';
  return Boolean(plan?.is_f14 || airframe?.is_f14);
}

export function isF14BUAirframe(plan: FlightPlanDetail | null, airframe?: CampaignMapAirframeCatalogItem | null): boolean {
  const af = airframe || plan?.airframe;
  if (af) {
    const entity = (af.dcs_entity || '').toLowerCase();
    const abbr = (af.abbreviation || '').toLowerCase();
    const name = (af.name || '').toLowerCase();
    if (
      abbr.includes('f-14bu') ||
      abbr.includes('f14bu') ||
      abbr.includes('f-14b(u)') ||
      name.includes('f-14b(u)') ||
      name.includes('f-14bu') ||
      name.includes('f14bu') ||
      entity.includes('f-14bu') ||
      entity.includes('f14bu')
    ) {
      return true;
    }
    return false;
  }
  return Boolean(plan?.is_f14_bu);
}

export function isJf17Airframe(plan: FlightPlanDetail | null, airframe?: CampaignMapAirframeCatalogItem | null): boolean {
  const key = getAirframeKey(airframe || plan?.airframe);
  if (key) return key === 'JF_17';
  return Boolean(plan?.is_jf17 || airframe?.is_jf17);
}

export function hasMidsSupport(plan: FlightPlanDetail | null, airframe?: CampaignMapAirframeCatalogItem | null): boolean {
  if (isF18Airframe(plan, airframe) || isJf17Airframe(plan, airframe)) return true;
  return Boolean(airframe?.has_mids ?? plan?.has_mids);
}

export function hasCmdsSupport(plan: FlightPlanDetail | null, airframe?: CampaignMapAirframeCatalogItem | null): boolean {
  if (isJf17Airframe(plan, airframe)) return false;
  if (isF18Airframe(plan, airframe) || isF16Airframe(plan, airframe) || isF14BUAirframe(plan, airframe)) {
    return true;
  }
  const key = getAirframeKey(airframe || plan?.airframe);
  if (key && key !== 'F_18C' && key !== 'F_16C' && key !== 'F_14_AB') return false;
  if (airframe) return Boolean(airframe.has_cmds);
  return Boolean(plan?.has_cmds);
}

export function isDtcCompatibleAirframe(plan: FlightPlanDetail | null, airframe?: CampaignMapAirframeCatalogItem | null): boolean {
  if (isF18Airframe(plan, airframe) || isF16Airframe(plan, airframe) || isF14BUAirframe(plan, airframe)) {
    return true;
  }
  if (airframe) return Boolean(airframe.is_dtc_compatible);
  return Boolean(plan?.is_dtc_compatible);
}

export function getDefaultCmdsConfig(
  plan: FlightPlanDetail | null,
  airframe?: CampaignMapAirframeCatalogItem | null
): Record<string, any> | null {
  if (airframe?.default_cmds && Object.keys(airframe.default_cmds).length > 0) {
    return JSON.parse(JSON.stringify(airframe.default_cmds));
  }
  if (isF16Airframe(plan, airframe)) {
    return {
      type: 'F_16C',
      bingo: { BINGO: true, ChaffNum: 10, FDBK: true, FlaresNum: 10, Other1Num: 0, Other2Num: 0, REQCTR: true },
      delay_between_programs: 2,
      programs: {
        MAN1: { label: 'MAN 1 (Standard Mixed)', chaff: { burst_qty: 1, burst_interval: 0.02, salvo_qty: 10, salvo_interval: 1.0 }, flare: { burst_qty: 1, burst_interval: 0.02, salvo_qty: 10, salvo_interval: 1.0 }, other1: { burst_qty: 0, burst_interval: 0.02, salvo_qty: 0, salvo_interval: 0.5 }, other2: { burst_qty: 0, burst_interval: 0.02, salvo_qty: 0, salvo_interval: 0.5 } },
        MAN2: { label: 'MAN 2 (Rapid Mixed)', chaff: { burst_qty: 1, burst_interval: 0.02, salvo_qty: 10, salvo_interval: 0.5 }, flare: { burst_qty: 1, burst_interval: 0.02, salvo_qty: 10, salvo_interval: 0.5 }, other1: { burst_qty: 0, burst_interval: 0.02, salvo_qty: 0, salvo_interval: 0.5 }, other2: { burst_qty: 0, burst_interval: 0.02, salvo_qty: 0, salvo_interval: 0.5 } },
        MAN3: { label: 'MAN 3 (Burst Burst)', chaff: { burst_qty: 2, burst_interval: 0.1, salvo_qty: 5, salvo_interval: 1.0 }, flare: { burst_qty: 2, burst_interval: 0.1, salvo_qty: 5, salvo_interval: 1.0 }, other1: { burst_qty: 0, burst_interval: 0.02, salvo_qty: 0, salvo_interval: 0.5 }, other2: { burst_qty: 0, burst_interval: 0.02, salvo_qty: 0, salvo_interval: 0.5 } },
        MAN4: { label: 'MAN 4 (Rapid Burst)', chaff: { burst_qty: 2, burst_interval: 0.1, salvo_qty: 5, salvo_interval: 0.5 }, flare: { burst_qty: 2, burst_interval: 0.1, salvo_qty: 5, salvo_interval: 0.5 }, other1: { burst_qty: 0, burst_interval: 0.02, salvo_qty: 0, salvo_interval: 0.5 }, other2: { burst_qty: 0, burst_interval: 0.02, salvo_qty: 0, salvo_interval: 0.5 } },
        MAN5: { label: 'MAN 5 (High Intensity)', chaff: { burst_qty: 2, burst_interval: 0.05, salvo_qty: 20, salvo_interval: 0.75 }, flare: { burst_qty: 2, burst_interval: 0.05, salvo_qty: 20, salvo_interval: 0.75 }, other1: { burst_qty: 0, burst_interval: 0.02, salvo_qty: 0, salvo_interval: 0.5 }, other2: { burst_qty: 0, burst_interval: 0.02, salvo_qty: 0, salvo_interval: 0.5 } },
        MAN6: { label: 'MAN 6 (Single Pair)', chaff: { burst_qty: 1, burst_interval: 0.02, salvo_qty: 1, salvo_interval: 0.5 }, flare: { burst_qty: 1, burst_interval: 0.02, salvo_qty: 1, salvo_interval: 0.5 }, other1: { burst_qty: 0, burst_interval: 0.02, salvo_qty: 0, salvo_interval: 0.5 }, other2: { burst_qty: 0, burst_interval: 0.02, salvo_qty: 0, salvo_interval: 0.5 } },
        AUTO1: { label: 'AUTO 1 (Chaff Defense)', chaff: { burst_qty: 1, burst_interval: 0.02, salvo_qty: 4, salvo_interval: 1.5 }, flare: { burst_qty: 0, burst_interval: 0.0, salvo_qty: 0, salvo_interval: 0.0 }, other1: { burst_qty: 0, burst_interval: 0.02, salvo_qty: 0, salvo_interval: 0.5 }, other2: { burst_qty: 0, burst_interval: 0.02, salvo_qty: 0, salvo_interval: 0.5 } },
        AUTO2: { label: 'AUTO 2 (Moderate Chaff)', chaff: { burst_qty: 1, burst_interval: 0.02, salvo_qty: 6, salvo_interval: 1.0 }, flare: { burst_qty: 0, burst_interval: 0.0, salvo_qty: 0, salvo_interval: 0.0 }, other1: { burst_qty: 0, burst_interval: 0.02, salvo_qty: 0, salvo_interval: 0.5 }, other2: { burst_qty: 0, burst_interval: 0.02, salvo_qty: 0, salvo_interval: 0.5 } },
        AUTO3: { label: 'AUTO 3 (Dense Chaff)', chaff: { burst_qty: 1, burst_interval: 0.02, salvo_qty: 8, salvo_interval: 0.5 }, flare: { burst_qty: 0, burst_interval: 0.0, salvo_qty: 0, salvo_interval: 0.0 }, other1: { burst_qty: 0, burst_interval: 0.02, salvo_qty: 0, salvo_interval: 0.5 }, other2: { burst_qty: 0, burst_interval: 0.02, salvo_qty: 0, salvo_interval: 0.5 } },
        BYP: { label: 'BYPASS (Emergency)', chaff: { burst_qty: 1, burst_interval: 0.02, salvo_qty: 1, salvo_interval: 0.5 }, flare: { burst_qty: 1, burst_interval: 0.02, salvo_qty: 1, salvo_interval: 0.5 }, other1: { burst_qty: 0, burst_interval: 0.02, salvo_qty: 0, salvo_interval: 0.5 }, other2: { burst_qty: 0, burst_interval: 0.02, salvo_qty: 0, salvo_interval: 0.5 } },
      },
    };
  }
  if (isF18Airframe(plan, airframe)) {
    return {
      type: 'FA_18C',
      delay_between_programs: 0,
      programs: {
        MAN_1: { label: 'MAN 1 (Standard Radar Defeat)', chaff: { quantity: 1, interval: 1.0, repeat: 10 }, flare: { quantity: 1 }, other1: { quantity: 0 }, other2: { quantity: 0 } },
        MAN_2: { label: 'MAN 2 (Rapid Chaff / Flare)', chaff: { quantity: 1, interval: 0.5, repeat: 10 }, flare: { quantity: 1 }, other1: { quantity: 0 }, other2: { quantity: 0 } },
        MAN_3: { label: 'MAN 3 (Dual Burst 5 Rep)', chaff: { quantity: 2, interval: 1.0, repeat: 5 }, flare: { quantity: 2 }, other1: { quantity: 0 }, other2: { quantity: 0 } },
        MAN_4: { label: 'MAN 4 (Dual Rapid 10 Rep)', chaff: { quantity: 2, interval: 0.5, repeat: 10 }, flare: { quantity: 2 }, other1: { quantity: 0 }, other2: { quantity: 0 } },
        MAN_5: { label: 'MAN 5 (Preemptive Pop 2 Rep)', chaff: { quantity: 1, interval: 1.0, repeat: 2 }, flare: { quantity: 1 }, other1: { quantity: 0 }, other2: { quantity: 0 } },
        MAN_6: { label: 'MAN 6 (Panic / SAM Break 20 Rep)', chaff: { quantity: 2, interval: 0.75, repeat: 20 }, flare: { quantity: 2 }, other1: { quantity: 0 }, other2: { quantity: 0 } },
        AUTO_1: { label: 'AUTO 1 (Chaff 4 Rep)', chaff: { quantity: 1, interval: 1.5, repeat: 4 }, flare: { quantity: 0 }, other1: { quantity: 0 }, other2: { quantity: 0 } },
        AUTO_2: { label: 'AUTO 2 (Chaff 6 Rep)', chaff: { quantity: 1, interval: 1.0, repeat: 6 }, flare: { quantity: 0 }, other1: { quantity: 0 }, other2: { quantity: 0 } },
        AUTO_3: { label: 'AUTO 3 (Chaff 8 Rep)', chaff: { quantity: 1, interval: 0.5, repeat: 8 }, flare: { quantity: 0 }, other1: { quantity: 0 }, other2: { quantity: 0 } },
        BYP: { label: 'BYPASS (Emergency Dual)', chaff: { quantity: 2, interval: 1.0, repeat: 1 }, flare: { quantity: 2 }, other1: { quantity: 0 }, other2: { quantity: 0 } },
      },
    };
  }
  if (isF14BUAirframe(plan, airframe)) {
    return {
      type: 'F_14BU',
      bingo: { ChaffNum: 10, FlaresNum: 10, Other1Num: 0, Other2Num: 0 },
      auto_programs: {
        AAA: { program: 2, threshold: 2 },
        Aircraft: { program: 4, threshold: 3 },
        Naval: { program: 5, threshold: 3 },
        SAM: { program: 5, threshold: 3 },
        Unknown: { program: 4, threshold: 3 },
      },
      programs: {
        PROG_1: { label: 'PROG 1 (Flare Priority Sustained)', priority: 2, chaff: { burst_qty: 2, burst_interval: 0.2, salvo_qty: 8, salvo_interval: 1.0 }, flare: { burst_qty: 2, burst_interval: 0.5, salvo_qty: 8, salvo_interval: 1.0 }, other1: { burst_qty: 0, burst_interval: 0, salvo_qty: 0, salvo_interval: 0 }, other2: { burst_qty: 0, burst_interval: 0, salvo_qty: 0, salvo_interval: 0 } },
        PROG_2: { label: 'PROG 2 (AAA / Quick Chaff)', priority: 0, chaff: { burst_qty: 3, burst_interval: 0.25, salvo_qty: 3, salvo_interval: 2.0 }, flare: { burst_qty: 1, burst_interval: 1.0, salvo_qty: 1, salvo_interval: 1.0 }, other1: { burst_qty: 0, burst_interval: 0, salvo_qty: 0, salvo_interval: 0 }, other2: { burst_qty: 0, burst_interval: 0, salvo_qty: 0, salvo_interval: 0 } },
        PROG_3: { label: 'PROG 3 (IR Defense / Flare Burst)', priority: 0, chaff: { burst_qty: 1, burst_interval: 1.0, salvo_qty: 1, salvo_interval: 1.0 }, flare: { burst_qty: 2, burst_interval: 0.5, salvo_qty: 4, salvo_interval: 3.0 }, other1: { burst_qty: 0, burst_interval: 0, salvo_qty: 0, salvo_interval: 0 }, other2: { burst_qty: 0, burst_interval: 0, salvo_qty: 0, salvo_interval: 0 } },
        PROG_4: { label: 'PROG 4 (Aircraft Threat / Mixed)', priority: 0, chaff: { burst_qty: 2, burst_interval: 0.25, salvo_qty: 4, salvo_interval: 3.0 }, flare: { burst_qty: 1, burst_interval: 1.0, salvo_qty: 4, salvo_interval: 3.0 }, other1: { burst_qty: 0, burst_interval: 0, salvo_qty: 0, salvo_interval: 0 }, other2: { burst_qty: 0, burst_interval: 0, salvo_qty: 0, salvo_interval: 0 } },
        PROG_5: { label: 'PROG 5 (SAM & Naval / Chaff Pri)', priority: 1, chaff: { burst_qty: 4, burst_interval: 0.2, salvo_qty: 4, salvo_interval: 2.0 }, flare: { burst_qty: 1, burst_interval: 1.0, salvo_qty: 2, salvo_interval: 2.0 }, other1: { burst_qty: 0, burst_interval: 0, salvo_qty: 0, salvo_interval: 0 }, other2: { burst_qty: 0, burst_interval: 0, salvo_qty: 0, salvo_interval: 0 } },
        PROG_6: { label: 'PROG 6 (Heavy Flare Sustained)', priority: 1, chaff: { burst_qty: 1, burst_interval: 1.0, salvo_qty: 2, salvo_interval: 2.0 }, flare: { burst_qty: 2, burst_interval: 0.5, salvo_qty: 6, salvo_interval: 2.0 }, other1: { burst_qty: 0, burst_interval: 0, salvo_qty: 0, salvo_interval: 0 }, other2: { burst_qty: 0, burst_interval: 0, salvo_qty: 0, salvo_interval: 0 } },
        PROG_7: { label: 'PROG 7 (Single Pop Single)', priority: 0, chaff: { burst_qty: 1, burst_interval: 1.0, salvo_qty: 1, salvo_interval: 1.0 }, flare: { burst_qty: 1, burst_interval: 1.0, salvo_qty: 1, salvo_interval: 1.0 }, other1: { burst_qty: 0, burst_interval: 0, salvo_qty: 0, salvo_interval: 0 }, other2: { burst_qty: 0, burst_interval: 0, salvo_qty: 0, salvo_interval: 0 } },
        PROG_8: { label: 'PROG 8 (Single Pop Single)', priority: 0, chaff: { burst_qty: 1, burst_interval: 1.0, salvo_qty: 1, salvo_interval: 1.0 }, flare: { burst_qty: 1, burst_interval: 1.0, salvo_qty: 1, salvo_interval: 1.0 }, other1: { burst_qty: 0, burst_interval: 0, salvo_qty: 0, salvo_interval: 0 }, other2: { burst_qty: 0, burst_interval: 0, salvo_qty: 0, salvo_interval: 0 } },
      },
    };
  }
  return null;
}

// ============================================================================
// Point Classifiers & Sequences
// ============================================================================

export function isTargetPoint(pt: Partial<FlightPlanRoutePoint> | null | undefined): boolean {
  if (!pt) return false;
  const typeUp = String(pt.type || '').toUpperCase();
  const actionUp = String(pt.action || '').toUpperCase();
  const nameUp = String(pt.name || '').toUpperCase();
  return Boolean(
    pt.is_target ||
      typeUp === 'TARGET' ||
      typeUp === 'TGT' ||
      actionUp === 'TGT' ||
      nameUp.startsWith('TGT')
  );
}

export function isAdditionalPoint(pt: Partial<FlightPlanRoutePoint> | null | undefined): boolean {
  if (!pt || isTargetPoint(pt)) return false;
  const typeUp = String(pt.type || '').toUpperCase();
  const nameUp = String(pt.name || '').toUpperCase();
  return Boolean(
    pt.is_lantirn ||
      pt.is_additional ||
      typeUp === 'LANTIRN' ||
      typeUp === 'ADDITIONAL' ||
      nameUp.endsWith('XL') ||
      nameUp.startsWith('AP')
  );
}

export function isDivertPoint(pt: Partial<FlightPlanRoutePoint> | null | undefined): boolean {
  if (!pt || isTargetPoint(pt) || isAdditionalPoint(pt)) return false;
  return Boolean(pt.is_divert || Number(pt.sequence) === 99 || pt.sequence === 'divert');
}

export function isFixPoint(pt: Partial<FlightPlanRoutePoint> | null | undefined): boolean {
  if (!pt || isTargetPoint(pt) || isAdditionalPoint(pt)) return false;
  const typeUp = String(pt.type || '').toUpperCase();
  return Boolean(pt.is_fix || ['FIX', 'IAF', 'FAF', 'IF', 'MAP'].includes(typeUp));
}

export function isSequenceTrackPoint(
  pt: Partial<FlightPlanRoutePoint> | null | undefined,
  seq: number
): boolean {
  if (!pt || isTargetPoint(pt) || isAdditionalPoint(pt) || isDivertPoint(pt)) return false;
  const ptSeq = pt.sequence ? Number(pt.sequence) : 1;
  return ptSeq === seq;
}

export function getMaxSequences(isF14: boolean): number {
  return isF14 ? 11 : 3;
}

export function getSequenceColor(
  seq: number,
  planColor?: string | null,
  customSeqColors?: Record<number, string>
): string {
  const num = parseInt(String(seq), 10) || 1;
  if (customSeqColors && customSeqColors[num]) return customSeqColors[num];
  if (num === 1 && planColor) return planColor;
  return SEQUENCE_DEFAULT_COLORS[num] || '#3b82f6';
}

export function getAvailableSequences(
  points: FlightPlanRoutePoint[],
  userCreatedSequences: number[] = [1]
): number[] {
  const set = new Set<number>([1]);
  userCreatedSequences.forEach((s) => {
    const n = parseInt(String(s), 10);
    if (Number.isFinite(n) && n >= 1) set.add(n);
  });
  (points || []).forEach((pt) => {
    if (isDivertPoint(pt) || pt.sequence === 99 || pt.sequence === 'divert') return;
    const s = pt.sequence ? parseInt(String(pt.sequence), 10) : 1;
    if (Number.isFinite(s) && s >= 1) set.add(s);
  });
  return Array.from(set).sort((a, b) => a - b);
}

// ============================================================================
// Front Line & AOR Presets (EXACT Portal Extraction — NO Downsampling!)
// ============================================================================

export function extractFrontLinePoints(
  frontLineRaw: unknown,
  maxPts = 25
): Array<{ lat: number; lng: number }> {
  if (!frontLineRaw) return [];
  let pts: Array<{ lat: number; lng: number }> = [];

  if (Array.isArray(frontLineRaw)) {
    if (frontLineRaw.length === 0) return [];
    const first = frontLineRaw[0] as any;
    if (first && (first.lat !== undefined || first.lng !== undefined || first.lon !== undefined)) {
      pts = frontLineRaw.map((p: any) => ({
        lat: parseFloat(p.lat),
        lng: parseFloat(p.lng ?? p.lon),
      }));
    } else if (Array.isArray(first)) {
      if (typeof first[0] === 'number' || typeof first[0] === 'string') {
        pts = frontLineRaw.map((p: any) => ({
          lat: parseFloat(p[0]),
          lng: parseFloat(p[1]),
        }));
      } else if (first[0]?.lat !== undefined) {
        pts = first.map((p: any) => ({
          lat: parseFloat(p.lat),
          lng: parseFloat(p.lng ?? p.lon),
        }));
      }
    } else if (first?.points && Array.isArray(first.points)) {
      pts = first.points.map((p: any) => {
        if (Array.isArray(p)) {
          return { lat: parseFloat(p[0]), lng: parseFloat(p[1]) };
        }
        return { lat: parseFloat(p.lat), lng: parseFloat(p.lng ?? p.lon) };
      });
    }
  }

  return pts
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
    .slice(0, maxPts);
}

export interface AorPresetItem {
  id: string;
  name: string;
  source: string;
  points: Array<{ lat: number; lng: number; name?: string }>;
}

export function getAvailableAorPresetsFromMapData(mapData: CampaignMapPayload): AorPresetItem[] {
  if (Array.isArray(mapData.aorPresets) && mapData.aorPresets.length > 0) {
    return mapData.aorPresets;
  }

  const presets: AorPresetItem[] = [];

  const extractGeo = (raw: any): Array<{ lat: number; lng: number }> => {
    if (!raw) return [];
    if (Array.isArray(raw)) {
      return raw
        .map((p: any) =>
          Array.isArray(p)
            ? { lat: Number(p[0]), lng: Number(p[1]) }
            : { lat: Number(p?.lat), lng: Number(p?.lng ?? p?.lon) }
        )
        .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    }
    if (Array.isArray(raw.points) && raw.points.length > 0) {
      return extractGeo(raw.points);
    }
    if (Array.isArray(raw.coordinates) && raw.coordinates.length > 0) {
      return extractGeo(raw.coordinates);
    }
    if (
      raw.type === 'box' &&
      raw.north !== undefined &&
      raw.south !== undefined &&
      raw.east !== undefined &&
      raw.west !== undefined
    ) {
      return [
        { lat: Number(raw.north), lng: Number(raw.west) },
        { lat: Number(raw.north), lng: Number(raw.east) },
        { lat: Number(raw.south), lng: Number(raw.east) },
        { lat: Number(raw.south), lng: Number(raw.west) },
      ];
    }
    return [];
  };

  (mapData.missions || []).forEach((m) => {
    const mPts = extractGeo(m.aor);
    if (mPts.length >= 2) {
      presets.push({
        id: `mission_${m.id}`,
        name: m.name,
        source: 'Mission AOR',
        points: mPts,
      });
    }
    (m.objectives || []).forEach((obj, idx) => {
      if (obj.status === 'completed') return;
      const oPts = extractGeo(obj.aor);
      if (oPts.length >= 2) {
        presets.push({
          id: `obj_${m.id}_${idx}`,
          name: `${m.name}: ${obj.objective}`,
          source: 'Objective AOR',
          points: oPts,
        });
      }
    });
  });

  (mapData.polygonGroups || []).forEach((pg, idx) => {
    const pts = extractGeo(pg.points);
    if (pts.length >= 2) {
      presets.push({
        id: `poly_${idx}`,
        name: pg.label || pg.name || pg.group_name || `Zone #${idx + 1}`,
        source: 'Campaign Zone',
        points: pts,
      });
    }
  });

  (mapData.tacticalMarkings || []).forEach((tm) => {
    const pts = extractGeo(tm.geometry?.points || tm.geometry);
    if (pts.length >= 2) {
      presets.push({
        id: `tm_${tm.id}`,
        name: String(tm.properties?.label || tm.properties?.name || `Drawing #${tm.id}`),
        source: 'Tactical Marking',
        points: pts,
      });
    }
  });

  return presets;
}

// ============================================================================
// Route Math, TOT & Speeds (Exact Portal Logic)
// ============================================================================

export function parseTimeStr(timeStr?: string | null): number | null {
  if (!timeStr) return null;
  const clean = timeStr.toString().trim().replace(/^M\+/i, '').replace(/Z$/i, '').trim();
  const parts = clean.split(':');
  if (parts.length === 2) parts.push('00');
  if (parts.length !== 3) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const s = parseInt(parts[2], 10);
  if (Number.isNaN(h) || Number.isNaN(m) || Number.isNaN(s)) return null;
  return h + m / 60 + s / 3600;
}

/**
 * Compute required CAS (`transitSpeed`) between TOT constraints across route points.
 */
export function recalculateTransitSpeeds(points: FlightPlanRoutePoint[]): FlightPlanRoutePoint[] {
  const next = points.map((p) => ({ ...p, transitSpeed: null as number | null }));
  if (next.length < 2) return next;

  const constraints: Array<{ idx: number; time: number }> = [];
  next.forEach((pt, idx) => {
    if (isTargetPoint(pt)) return;
    const t = parseTimeStr(pt.tot);
    if (t !== null) {
      constraints.push({ idx, time: t });
    }
  });

  if (constraints.length > 0 && constraints[0].idx !== 0) {
    constraints.unshift({ idx: 0, time: 0 });
  }

  for (let i = 0; i < constraints.length - 1; i++) {
    const start = constraints[i];
    const end = constraints[i + 1];

    let totalDistNm = 0;
    for (let j = start.idx; j < end.idx; j++) {
      totalDistNm += calculateDistanceNm(next[j].lat, next[j].lng, next[j + 1].lat, next[j + 1].lng);
    }

    let durationHours = end.time - start.time;
    if (durationHours < 0) durationHours += 24;
    if (durationHours <= 0) continue;

    const reqGS = totalDistNm / durationHours;
    for (let j = start.idx; j < end.idx; j++) {
      const legAlt = parseFloat(String(next[j + 1].alt || 0)) || 0;
      next[j + 1].transitSpeed = Math.round(tasToCas(reqGS, legAlt));
    }
  }

  return next;
}

export function calculateRouteStats(
  points: FlightPlanRoutePoint[],
  unit: 'nm' | 'km',
  activeSequence = 1
): { count: number; distDisplay: string; timeDisplay: string; totalDistNm: number; totalSeconds: number } {
  const isKm = unit === 'km';
  const seqPts = (points || []).filter(
    (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && isSequenceTrackPoint(p, activeSequence)
  );
  const trackPts = seqPts.length > 0 ? seqPts : (points || []).filter((p) => !isTargetPoint(p));

  if (trackPts.length < 2) {
    return {
      count: points.length,
      distDisplay: isKm ? '0.0 KM' : '0.0 NM',
      timeDisplay: '00:00:00',
      totalDistNm: 0,
      totalSeconds: 0,
    };
  }

  let totalDistNm = 0;
  let totalDistKm = 0;
  let totalHours = 0;

  for (let i = 0; i < trackPts.length - 1; i++) {
    const p1 = trackPts[i];
    const p2 = trackPts[i + 1];
    const dNm = calculateDistanceNm(p1.lat, p1.lng, p2.lat, p2.lng);
    const dKm = calculateDistanceKm(p1.lat, p1.lng, p2.lat, p2.lng);
    totalDistNm += dNm;
    totalDistKm += dKm;

    let casSpeed = 350;
    if (p2.transitSpeed && Number.isFinite(Number(p2.transitSpeed))) {
      casSpeed = Number(p2.transitSpeed);
    } else if (p2.speed && Number.isFinite(Number(p2.speed)) && Number(p2.speed) > 0) {
      casSpeed = Number(p2.speed);
    }
    const legAlt = parseFloat(String(p2.alt || 0)) || 0;
    const gsSpeed = casToTas(casSpeed, legAlt);
    if (gsSpeed > 0) {
      totalHours += dNm / gsSpeed;
    }
  }

  const h = Math.floor(totalHours);
  const m = Math.floor((totalHours - h) * 60);
  const s = Math.round(((totalHours - h) * 60 - m) * 60) % 60;
  const timeDisplay = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

  return {
    count: points.length,
    distDisplay: isKm ? `${totalDistKm.toFixed(1)} KM` : `${totalDistNm.toFixed(1)} NM`,
    timeDisplay,
    totalDistNm,
    totalSeconds: Math.round(totalHours * 3600),
  };
}

// ============================================================================
// Auto Flight Rules (METAR + Time of Day)
// ============================================================================

export function computeAutoFlightRules(
  plan: FlightPlanDetail | null,
  mapData: CampaignMapPayload
): 'VFR' | 'MVFR' | 'IFR' | 'LIFR' {
  let weather: string | null = null;
  let time: string | null = plan?.launch_time || null;

  if (plan?.mission_id && Array.isArray(mapData.missions)) {
    const m = mapData.missions.find((x) => Number(x.id) === Number(plan.mission_id));
    if (m) {
      if (m.weather) weather = m.weather;
      if (!time && m.mission_time) time = m.mission_time;
    }
  }
  if (!weather && mapData.campaign.weather) weather = mapData.campaign.weather;
  if (!time && mapData.campaign.missionTime) time = mapData.campaign.missionTime;
  if (!time && mapData.campaign.missionStartTime) time = mapData.campaign.missionStartTime;

  let isNight = false;
  if (time) {
    const match = time.toString().match(/(?:^|\s|T)(\d{1,2}):(\d{2})/);
    if (match) {
      const hour = parseInt(match[1], 10);
      if (hour >= 19 || hour < 6) isNight = true;
    }
  }

  let cat: 'VFR' | 'MVFR' | 'IFR' | 'LIFR' = 'VFR';
  if (weather) {
    const str = weather.toString().toUpperCase();
    const ceilingMatches = str.match(/\b(BKN|OVC|VV)(\d{3})\b/g);
    if (ceilingMatches) {
      let lowestCeiling = 10000;
      ceilingMatches.forEach((cm) => {
        const num = parseInt(cm.slice(3), 10) * 100;
        if (num < lowestCeiling) lowestCeiling = num;
      });
      if (lowestCeiling < 500) cat = 'LIFR';
      else if (lowestCeiling < 1000) cat = 'IFR';
      else if (lowestCeiling <= 3000) cat = 'MVFR';
    }
    const visMatch = str.match(/\b(\d{4})\b/);
    if (visMatch && !str.includes('9999') && !str.includes('CAVOK')) {
      const visM = parseInt(visMatch[1], 10);
      if (visM < 1600) cat = 'LIFR';
      else if (visM < 4800 && cat !== 'LIFR') cat = 'IFR';
      else if (visM <= 8000 && cat === 'VFR') cat = 'MVFR';
    }
  }

  if (isNight && (cat === 'VFR' || cat === 'MVFR')) {
    return 'IFR';
  }
  return cat;
}

// ============================================================================
// Loadout, Warehouse, Mirror Wings & Pylon SVG
// ============================================================================

export function getStationsListFromConfig(cfg: Record<string, any> | null | undefined): any[] {
  if (!cfg || !cfg.stations) return [];
  if (Array.isArray(cfg.station_order)) {
    return cfg.station_order.map((k: string | number) => cfg.stations[k]).filter(Boolean);
  }
  return Object.values(cfg.stations);
}

export function getStationOptions(cfg: Record<string, any> | null | undefined, staNum: string | number): any[] {
  const staDef = cfg?.stations?.[staNum] ?? cfg?.stations?.[String(staNum)];
  if (!staDef) return [];
  if (Array.isArray(staDef.options) && staDef.options.length > 0) return staDef.options;
  if (Array.isArray(staDef.allowed) && staDef.allowed.length > 0) return staDef.allowed;
  return [];
}

export function getAirframeLoadoutImageUrl(
  cfg: Record<string, any> | null | undefined,
  airframeKey: AirframeKey,
  apiBaseUrl: string
): string {
  let origin = 'https://members.globaltaskforceoverlord.org';
  try {
    origin = new URL(apiBaseUrl).origin;
  } catch {
    // keep default origin
  }

  const rawImg = cfg?.image;
  if (typeof rawImg === 'string' && rawImg.trim() !== '') {
    if (rawImg.startsWith('http://') || rawImg.startsWith('https://')) return rawImg;
    return `${origin}${rawImg.startsWith('/') ? '' : '/'}${rawImg}`;
  }

  if (airframeKey === 'F_16C') return `${origin}/storage/flight-planner-images/f16-loadout.png`;
  if (airframeKey === 'JF_17') return `${origin}/storage/flight-planner-images/jf17-loadout.png`;
  if (airframeKey === 'A_10C_II') return `${origin}/storage/flight-planner-images/a10-loadout.png`;
  if (airframeKey === 'F_14_AB') return `${origin}/storage/flight-planner-images/f14-loadout.png`;
  return `${origin}/storage/flight-planner-images/f18-loadout.png`;
}

export function sanitizeF16Stations(
  airframeKey: AirframeKey,
  stations: Record<string, string>
): Record<string, string> {
  if (airframeKey !== 'F_16C') return stations;
  const copy = { ...stations };
  if (copy['11'] && (!copy['9'] || copy['9'] === '<CLEAN>')) {
    copy['9'] = copy['11'];
  }
  if (copy['10'] && (!copy['8'] || copy['8'] === '<CLEAN>')) {
    copy['8'] = copy['10'];
  }
  delete copy['10'];
  delete copy['11'];
  return copy;
}

export function mirrorWingStations(
  airframeKey: AirframeKey,
  stationsList: any[],
  currentStations: Record<string, string>
): { stations: Record<string, string>; message: string; ok: boolean } {
  const next: Record<string, string> = { ...currentStations };

  if (airframeKey === 'F_16C' || stationsList.some((s) => String(s.number) === '5R' || String(s.number) === '5L')) {
    next['9'] = next['1'] || '<CLEAN>';
    next['8'] = next['2'] || '<CLEAN>';
    next['7'] = next['3'] || '<CLEAN>';
    next['6'] = next['4'] || '<CLEAN>';
    if (next['5L']) next['5R'] = next['5L'];
    delete next['10'];
    delete next['11'];
    return { stations: next, ok: true, message: 'Mirrored Left Wing stores to Right Wing (STA 1-4 -> STA 9-6)' };
  }

  if (stationsList.length === 11) {
    const mirrorMap: Record<string, string> = {
      'LAU-105_1*AIM-9M_L': 'LAU-105_1*AIM-9M_R',
      'LAU-105_1*AIM-9M_R': 'LAU-105_1*AIM-9M_L',
      'LAU-105_1*AIM-9L_L': 'LAU-105_1*AIM-9L_R',
      'LAU-105_1*AIM-9L_R': 'LAU-105_1*AIM-9L_L',
      'LAU-105_1*CATM-9M_L': 'LAU-105_1*CATM-9M_R',
      'LAU-105_1*CATM-9M_R': 'LAU-105_1*CATM-9M_L',
      'LAU-105_AIS_ASQ_T50_L': 'LAU-105_AIS_ASQ_T50_R',
      'LAU-105_AIS_ASQ_T50_R': 'LAU-105_AIS_ASQ_T50_L',
      '{E6A6262A-CA08-4B3D-B030-E1A993B98452}': '{E6A6262A-CA08-4B3D-B030-E1A993B98453}',
      '{E6A6262A-CA08-4B3D-B030-E1A993B98453}': '{E6A6262A-CA08-4B3D-B030-E1A993B98452}',
      'LAU_88_AGM_65H_2_L': 'LAU_88_AGM_65H_2_R',
      'LAU_88_AGM_65H_2_R': 'LAU_88_AGM_65H_2_L',
      '{BRU42_2X_MK-82_L}': '{BRU42_2X_MK-82_R}',
      '{BRU42_2X_MK-82_R}': '{BRU42_2X_MK-82_L}',
      '{BRU42_2X_MK-82AIR_L}': '{BRU42_2X_MK-82AIR_R}',
      '{BRU42_2X_MK-82AIR_R}': '{BRU42_2X_MK-82AIR_L}',
      '{BRU42_2X_GBU-12_L}': '{BRU42_2X_GBU-12_R}',
      '{BRU42_2X_GBU-12_R}': '{BRU42_2X_GBU-12_L}',
      '{LAU-131x2 - 7 AGR-20A L}': '{LAU-131x2 - 7 AGR-20A R}',
      '{LAU-131x2 - 7 AGR-20A R}': '{LAU-131x2 - 7 AGR-20A L}',
      '{LAU-131x2 - 7 AGR-20 M282 L}': '{LAU-131x2 - 7 AGR-20 M282 R}',
      '{LAU-131x2 - 7 AGR-20 M282 R}': '{LAU-131x2 - 7 AGR-20 M282 L}',
      '{BRU42LS_2*LAU131_HYDRA_70_M151_L}': '{BRU42LS_2*LAU131_HYDRA_70_M151_R}',
      '{BRU42LS_2*LAU131_HYDRA_70_M151_R}': '{BRU42LS_2*LAU131_HYDRA_70_M151_L}',
    };
    for (let i = 1; i <= 5; i++) {
      const opp = 12 - i;
      const val = next[String(i)] || '<CLEAN>';
      next[String(opp)] = mirrorMap[val] || val;
    }
    return { stations: next, ok: true, message: 'Mirrored Left Wing stores to Right Wing (STA 1-5 -> STA 11-7)' };
  }

  if (stationsList.length === 9) {
    next['9'] = next['1'] || '<CLEAN>';
    next['8'] = next['2'] || '<CLEAN>';
    next['7'] = next['3'] || '<CLEAN>';
    next['6'] = next['4'] || '<CLEAN>';
    return { stations: next, ok: true, message: 'Mirrored Left Wing stores to Right Wing (STA 1-4 -> STA 9-6)' };
  }

  if (stationsList.length === 7) {
    const mirrorMap: Record<string, string> = {
      'DIS_SD-10_DUAL_L': 'DIS_SD-10_DUAL_R',
      'DIS_LD-10_DUAL_L': 'DIS_LD-10_DUAL_R',
      'DIS_LS_6_250_DUAL_L': 'DIS_LS_6_250_DUAL_R',
      'DIS_LS_6_100_DUAL_L': 'DIS_LS_6_100_DUAL_R',
      'DIS_TYPE200_DUAL_L': 'DIS_TYPE200_DUAL_R',
      'DIS_MK_82_DUAL_GDJ_II19_L': 'DIS_MK_82_DUAL_GDJ_II19_R',
      'DIS_MK_82S_DUAL_GDJ_II19_L': 'DIS_MK_82S_DUAL_GDJ_II19_R',
      'DIS_MK_20_DUAL_GDJ_II19_L': 'DIS_MK_20_DUAL_GDJ_II19_R',
      'DIS_GBU_12_DUAL_GDJ_II19_L': 'DIS_GBU_12_DUAL_GDJ_II19_R',
      'DIS_LAU68_MK5_DUAL_GDJ_II19_L': 'DIS_LAU68_MK5_DUAL_GDJ_II19_R',
    };
    const s1 = next['1'] || '<CLEAN>';
    const s2 = next['2'] || '<CLEAN>';
    const s3 = next['3'] || '<CLEAN>';
    next['7'] = mirrorMap[s1] || s1;
    next['6'] = mirrorMap[s2] || s2;
    next['5'] = mirrorMap[s3] || s3;
    return { stations: next, ok: true, message: 'Mirrored Left Wing stores to Right Wing (STA 1-3 -> STA 7-5)' };
  }

  if (stationsList.length === 10 || airframeKey === 'F_14_AB') {
    const mirrorMap: Record<string, string> = {
      'HB_F14_MK-81_2_L': 'HB_F14_MK-81_2_R',
      'HB_F14_MK-81_2_R': 'HB_F14_MK-81_2_L',
      'HB_F14_MK-82_2_L': 'HB_F14_MK-82_2_R',
      'HB_F14_MK-82_2_R': 'HB_F14_MK-82_2_L',
      'HB_F14_MK-82AIR_2_L': 'HB_F14_MK-82AIR_2_R',
      'HB_F14_MK-82AIR_2_R': 'HB_F14_MK-82AIR_2_L',
      'HB_F14_MK-82SE_2_L': 'HB_F14_MK-82SE_2_R',
      'HB_F14_MK-82SE_2_R': 'HB_F14_MK-82SE_2_L',
      'HB_F14_MK-20_2_L': 'HB_F14_MK-20_2_R',
      'HB_F14_MK-20_2_R': 'HB_F14_MK-20_2_L',
      'HB_F14_CBU-99_2_L': 'HB_F14_CBU-99_2_R',
      'HB_F14_CBU-99_2_R': 'HB_F14_CBU-99_2_L',
      'HB_F14_MK-83_L': 'HB_F14_MK-83_R',
      'HB_F14_MK-83_R': 'HB_F14_MK-83_L',
      'HB_F14_MK-83AIR_L': 'HB_F14_MK-83AIR_R',
      'HB_F14_MK-83AIR_R': 'HB_F14_MK-83AIR_L',
      'HB_F14_BDU-45_2_L': 'HB_F14_BDU-45_2_R',
      'HB_F14_BDU-45_2_R': 'HB_F14_BDU-45_2_L',
      'HB_F14_BDU-45B_2_L': 'HB_F14_BDU-45B_2_R',
      'HB_F14_BDU-45B_2_R': 'HB_F14_BDU-45B_2_L',
      'HB_F14_LAU-10_2_L': 'HB_F14_LAU-10_2_R',
      'HB_F14_LAU-10_2_R': 'HB_F14_LAU-10_2_L',
    };
    const s8A = next['8A'] || '<CLEAN>';
    const s8B = next['8B'] || '<CLEAN>';
    const s7 = next['7'] || '<CLEAN>';
    const s6 = next['6'] || '<CLEAN>';
    const s5 = next['5'] || '<CLEAN>';
    next['1A'] = mirrorMap[s8A] || s8A;
    next['1B'] = mirrorMap[s8B] || s8B;
    next['2'] = mirrorMap[s7] || s7;
    next['3'] = mirrorMap[s6] || s6;
    next['4'] = mirrorMap[s5] || s5;
    return { stations: next, ok: true, message: 'Mirrored Left Wing/Belly stores to Right (STA 8A-5 -> STA 1A-4)' };
  }

  return { stations: next, ok: false, message: 'Mirroring requires a standard dual-wing configuration' };
}

export function compileLoadoutSummary(
  stations: Record<string, string>,
  cfg: Record<string, any> | null | undefined
): string {
  const counts: Record<string, number> = {};
  for (const staNum of Object.keys(stations || {})) {
    const val = stations[staNum];
    if (!val || val === '<CLEAN>' || val === 'CLEAN') continue;
    const options = getStationOptions(cfg, staNum);
    const found = options.find((o) => o.clsid === val || o.id === val || String(o.id) === String(val));
    let label = found ? String(found.name) : String(val);
    label = label
      .replace(/^[0-9]+x\s+/, '')
      .replace(/\s+\(BRU-[^)]+\)/, '')
      .replace(/\s+\(LAU-[^)]+\)/, '')
      .replace(/\s+\(Fuselage[^)]+\)/, '');
    const qty = Number(found?.qty) || 1;
    counts[label] = (counts[label] || 0) + qty;
  }
  const keys = Object.keys(counts);
  if (keys.length === 0) return 'Clean';
  return keys.map((name) => `${counts[name]}x ${name}`).join(', ');
}

export function resolveStoreStock(
  storeId: string | undefined,
  staNum: string | number,
  cfg: Record<string, any> | null | undefined,
  warehouse: CampaignMapWarehouseInventory | null,
  isLoadingWarehouse: boolean,
  departureAirfield?: string | null
): { available: boolean; quantity: number | null; is_unlimited: boolean; label: string } {
  if (!storeId || storeId === '<CLEAN>' || storeId === 'CLEAN') {
    return { available: true, quantity: null, is_unlimited: true, label: 'Clean' };
  }
  if (!departureAirfield) {
    return { available: true, quantity: null, is_unlimited: true, label: 'No Dep Base' };
  }
  if (warehouse && warehouse.is_unlimited) {
    return { available: true, quantity: null, is_unlimited: true, label: 'Unlimited' };
  }
  if (isLoadingWarehouse) {
    return { available: true, quantity: null, is_unlimited: false, label: 'Checking stock...' };
  }

  const rawWeapons = warehouse?.weapons;
  const weaponsMap: Record<string, number> = {};
  if (Array.isArray(rawWeapons)) {
    rawWeapons.forEach((w: any) => {
      const k = w?.name || w?.item || w?.dcs_entity;
      if (k) weaponsMap[String(k)] = Number(w.amount ?? w.quantity ?? 0);
    });
  } else if (rawWeapons && typeof rawWeapons === 'object') {
    Object.entries(rawWeapons).forEach(([k, v]) => {
      weaponsMap[k] = Number(v ?? 0);
    });
  }

  const options = getStationOptions(cfg, staNum);
  const opt = options.find((o) => o.clsid === storeId || o.id === storeId || String(o.id) === String(storeId));

  const rawCandidates = [
    opt?.dcs_entity,
    opt?.clsid,
    opt?.id,
    storeId,
    ...(Array.isArray(opt?.dcs_keys) ? opt.dcs_keys : []),
  ].filter(Boolean);

  const searchKeys = new Set<string>();
  rawCandidates.forEach((c) => {
    const clean = String(c).replace(/[{}]/g, '').toLowerCase().trim();
    const norm = clean.replace(/-/g, '_');
    searchKeys.add(clean);
    searchKeys.add(norm);

    if (norm.includes('fpu_8a') || norm.includes('330gal') || norm.includes('330_gal') || norm.includes('f_18c_ptb')) {
      ['fpu_8a', 'f_18c_ptb', 'f-18c-ptb', 'fpu-8a', 'fuel_tank_330gal'].forEach((k) => searchKeys.add(k));
    }
    if (norm.includes('asq_228') || norm.includes('atflir')) {
      ['an_asq_228', 'atflir'].forEach((k) => searchKeys.add(k));
    }
    if (norm.includes('aaq_28') || norm.includes('litening')) {
      ['aaq_28_litening', 'aaq_28left litening', 'litening'].forEach((k) => searchKeys.add(k));
    }
    if (norm.includes('agm_88') || norm.includes('harm') || norm.includes('agm88')) {
      [
        'agm_88',
        'agm-88',
        'agm_88c',
        'harm',
        'weapons.missiles.agm_88',
        'weapons.missiles.agm-88',
        'weapons.missiles.agm_88c',
        'weapons.missiles.agm-88c',
      ].forEach((k) => searchKeys.add(k));
    }
  });

  for (const whKey of Object.keys(weaponsMap)) {
    const cleanWh = String(whKey).replace(/[{}]/g, '').toLowerCase().trim();
    const normWh = cleanWh.replace(/-/g, '_');
    const whParts = cleanWh.split('.');
    const whLast = whParts[whParts.length - 1];
    const normWhLast = whLast.replace(/-/g, '_');

    for (const k of searchKeys) {
      if (
        cleanWh === k ||
        normWh === k ||
        whLast === k ||
        normWhLast === k ||
        cleanWh.endsWith('.' + k) ||
        normWh.endsWith('.' + k)
      ) {
        const qty = parseInt(String(weaponsMap[whKey]), 10) || 0;
        return {
          available: qty > 0,
          quantity: qty,
          is_unlimited: false,
          label: qty > 0 ? `${qty} in stock` : '0 in stock (Depleted)',
        };
      }
    }
  }

  return { available: false, quantity: 0, is_unlimited: false, label: '0 in stock (Depleted)' };
}

export function getOutOfStockWarnings(
  stations: Record<string, string>,
  cfg: Record<string, any> | null | undefined,
  warehouse: CampaignMapWarehouseInventory | null,
  isLoadingWarehouse: boolean,
  departureAirfield?: string | null
): Array<{ station: string; weapon: string }> {
  if (!departureAirfield || warehouse?.is_unlimited) return [];
  const list = getStationsListFromConfig(cfg);
  const warnings: Array<{ station: string; weapon: string }> = [];

  for (const staNum of Object.keys(stations || {})) {
    const storeId = stations[staNum];
    if (!storeId || storeId === '<CLEAN>' || storeId === 'CLEAN') continue;
    const staDef = list.find((s) => String(s.number) === String(staNum));
    if (!staDef) continue;

    const stock = resolveStoreStock(storeId, staNum, cfg, warehouse, isLoadingWarehouse, departureAirfield);
    if (!stock.is_unlimited && !stock.available) {
      const options = getStationOptions(cfg, staNum);
      const opt = options.find((o) => o.clsid === storeId || o.id === storeId || String(o.id) === String(storeId));
      warnings.push({
        station: staDef.short_name || `STA ${staNum}`,
        weapon: opt?.name || storeId,
      });
    }
  }

  return warnings;
}

export function getPylonSvgPaths(
  stationsList: any[],
  hoveredStation: string | number | null,
  focusedStation: string | number | null,
  isHighlight: boolean
): { lines: string; dots: string } {
  if (!stationsList || stationsList.length === 0) return { lines: '', dots: '' };
  const n = stationsList.length;
  const linePaths: string[] = [];
  const dotPaths: string[] = [];
  const r = isHighlight ? 5 : 3.5;

  stationsList.forEach((sta, idx) => {
    const isHigh =
      String(hoveredStation) === String(sta.number) ||
      String(focusedStation) === String(sta.number);
    if (isHigh !== Boolean(isHighlight)) return;

    const px = sta.x !== undefined ? Number(sta.x) : sta.pylon_x !== undefined ? Number(sta.pylon_x) : 500;
    const py = sta.y !== undefined ? Number(sta.y) : sta.pylon_y !== undefined ? Number(sta.pylon_y) : 170;
    const bx = (idx + 0.5) * (1000 / n);
    const by = 245;
    const cy1 = py + (by - py) * 0.45;
    const cy2 = py + (by - py) * 0.85;
    linePaths.push(`M ${px} ${py} C ${px} ${cy1}, ${bx} ${cy2}, ${bx} ${by}`);
    dotPaths.push(`M ${px - r} ${py} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0`);
  });

  return { lines: linePaths.join(' '), dots: dotPaths.join(' ') };
}

// ============================================================================
// Comms Validation & Coordinate Autocomplete Parser
// ============================================================================

export function validateRadioFrequency(
  radioDef: Record<string, any> | null | undefined,
  frequency: string,
  modulation = 'AM'
): { valid: boolean; error: string | null } {
  const bands = radioDef?.bands;
  if (!radioDef || !Array.isArray(bands) || bands.length === 0) {
    return { valid: true, error: null };
  }
  const raw = (frequency || '').toString().trim();
  if (!raw) return { valid: true, error: null };
  const match = raw.match(/[0-9]+(?:\.[0-9]+)?/);
  if (!match) return { valid: true, error: null };
  const mhz = parseFloat(match[0]);
  const mod = (modulation || 'AM').toUpperCase();

  let matchedBand = false;
  let wrongMod = false;
  for (const b of bands) {
    const min = parseFloat(b.min_mhz);
    const max = parseFloat(b.max_mhz);
    const bMod = String(b.modulation || '').toUpperCase();
    if (mhz >= min - 0.0001 && mhz <= max + 0.0001) {
      if (bMod === 'AM_FM' || bMod === mod) {
        matchedBand = true;
        break;
      } else {
        wrongMod = true;
      }
    }
  }
  if (matchedBand) return { valid: true, error: null };
  if (wrongMod) {
    const reqMod = bands.find((b: any) => mhz >= b.min_mhz && mhz <= b.max_mhz)?.modulation;
    return { valid: false, error: `Requires ${reqMod} on ${radioDef.name}` };
  }
  const bandsStr = bands
    .map((b: any) => `${b.min_mhz}-${b.max_mhz} MHz ${b.modulation === 'AM_FM' ? 'AM/FM' : b.modulation}`)
    .join(', ');
  return { valid: false, error: `Out of band (${bandsStr})` };
}

export function getRadioBandsSummary(radioDef: Record<string, any> | null | undefined): string {
  const bands = radioDef?.bands;
  if (!radioDef || !Array.isArray(bands) || bands.length === 0) {
    return 'Unrestricted frequency & modulation';
  }
  return bands
    .map((b: any) => `${b.type} (${b.min_mhz}-${b.max_mhz} MHz ${b.modulation === 'AM_FM' ? 'AM/FM' : b.modulation})`)
    .join(' • ');
}

export function autoParseCoordinateOrLocation(
  val: string,
  airbases: CampaignMapAirbase[],
  navaids: CampaignMapNavaid[]
): { lat: number; lng: number; name?: string } | null {
  const q = (val || '').trim();
  if (!q) return null;
  const qLower = q.toLowerCase();

  const abExact = airbases.find(
    (a) =>
      (a.name || '').toLowerCase() === qLower ||
      ((a.code || a.icao || '') && (a.code || a.icao || '').toLowerCase() === qLower)
  );
  if (abExact && Number.isFinite(Number(abExact.lat)) && Number.isFinite(Number(abExact.lng))) {
    const code = abExact.code || abExact.icao || '';
    return { lat: Number(abExact.lat), lng: Number(abExact.lng), name: code ? `${abExact.name} (${code})` : abExact.name };
  }

  const navExact = navaids.find((n) => (n.ident || '').toLowerCase() === qLower);
  if (navExact) {
    const lat = Number(navExact.coordinates?.lat ?? navExact.lat);
    const lng = Number(navExact.coordinates?.lon ?? navExact.coordinates?.lng ?? navExact.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng, name: navExact.ident || navExact.name };
    }
  }

  const parsedCoord = parseAnyCoordinate(q);
  if (parsedCoord) {
    return { lat: parsedCoord.lat, lng: parsedCoord.lng };
  }

  const abPartial = airbases.find(
    (a) =>
      (a.name || '').toLowerCase().includes(qLower) ||
      ((a.code || a.icao || '') && (a.code || a.icao || '').toLowerCase().includes(qLower))
  );
  if (abPartial && Number.isFinite(Number(abPartial.lat)) && Number.isFinite(Number(abPartial.lng))) {
    const code = abPartial.code || abPartial.icao || '';
    return { lat: Number(abPartial.lat), lng: Number(abPartial.lng), name: code ? `${abPartial.name} (${code})` : abPartial.name };
  }

  const navPartial = navaids.find((n) => (n.ident || '').toLowerCase().includes(qLower));
  if (navPartial) {
    const lat = Number(navPartial.coordinates?.lat ?? navPartial.lat);
    const lng = Number(navPartial.coordinates?.lon ?? navPartial.coordinates?.lng ?? navPartial.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng, name: navPartial.ident || navPartial.name };
    }
  }

  return null;
}

// ============================================================================
// Avionics Normalization, Line Closure & Map Click Append
// ============================================================================

export function isFaorPointsClosed(pts: Array<{ lat: number; lng: number }> | undefined): boolean {
  if (!pts || pts.length < 4) return false;
  const p0 = pts[0];
  const pLast = pts[pts.length - 1];
  return (
    Math.abs(parseFloat(String(p0.lat)) - parseFloat(String(pLast.lat))) < 0.00005 &&
    Math.abs(parseFloat(String(p0.lng)) - parseFloat(String(pLast.lng))) < 0.00005
  );
}

export function isGeoLinePointsClosed(pts: Array<{ lat: number; lng: number }> | undefined): boolean {
  if (!pts || pts.length < 3) return false;
  const p0 = pts[0];
  const pLast = pts[pts.length - 1];
  return (
    Math.abs(parseFloat(String(p0.lat)) - parseFloat(String(pLast.lat))) < 0.00005 &&
    Math.abs(parseFloat(String(p0.lng)) - parseFloat(String(pLast.lng))) < 0.00005
  );
}

export function recalcF16GeoLines(rawGeo: Record<string, any> | null | undefined): Record<number, any[]> {
  const geo: Record<number, any[]> = { 1: [], 2: [], 3: [], 4: [] };
  const src = rawGeo?.lines && typeof rawGeo.lines === 'object' ? rawGeo.lines : rawGeo || {};
  ([1, 2, 3, 4] as const).forEach((l) => {
    const list = src[l] || src[String(l)];
    if (Array.isArray(list)) {
      geo[l] = list.map((pt: any) => ({ ...pt }));
    }
  });
  let stpt = 31;
  ([1, 2, 3, 4] as const).forEach((l) => {
    geo[l].forEach((pt) => {
      pt.stpt = stpt++;
      pt.line = l;
    });
  });
  return geo;
}

export function recalcF16DestPoints(list: any[]): any[] {
  return (list || []).map((pt, idx) => ({
    ...pt,
    stpt: 81 + idx,
  }));
}

export function appendPointToAvionicsDrawTarget(
  plan: FlightPlanDetail,
  target: AvionicsDrawTarget,
  lat: number,
  lng: number,
  onNotify?: (level: 'info' | 'success' | 'warning' | 'error', msg: string) => void
): { plan: FlightPlanDetail; stopDraw: boolean } {
  const cleanLat = Number(lat.toFixed(6));
  const cleanLng = Number(lng.toFixed(6));

  if (target.kind === 'f18_cap') {
    const sa = { ...(plan.sa_settings || {}) } as Record<string, any>;
    const caps = Array.isArray(sa.cap_points) ? [...sa.cap_points] : [];
    const idx = target.capIdx;
    if (caps[idx]) {
      caps[idx] = { ...caps[idx], lat: cleanLat, lng: cleanLng };
    } else {
      caps[idx] = {
        num: idx + 1,
        name: `CAP ${idx + 1}`,
        note: '',
        course: 0,
        length: 20,
        turn_direction: 'Right',
        lat: cleanLat,
        lng: cleanLng,
      };
    }
    return {
      plan: { ...plan, sa_settings: { ...sa, cap_points: caps } },
      stopDraw: true,
    };
  }

  if (target.kind === 'f18_flot') {
    const sa = { ...(plan.sa_settings || {}) } as Record<string, any>;
    const flots = Array.isArray(sa.flot) ? [...sa.flot] : [];
    const item = flots[target.lineIdx]
      ? { ...flots[target.lineIdx], points: [...(flots[target.lineIdx].points || [])] }
      : { name: `FLOT ${target.lineIdx + 2}`, note: '', points: [] as any[] };
    if (item.points.length >= 7) {
      onNotify?.('warning', 'Max 7 points reached for FLOT');
      return { plan, stopDraw: true };
    }
    item.points.push({ lat: cleanLat, lng: cleanLng });
    flots[target.lineIdx] = item;
    const stop = item.points.length >= 7;
    return { plan: { ...plan, sa_settings: { ...sa, flot: flots } }, stopDraw: stop };
  }

  if (target.kind === 'f18_faor') {
    const sa = { ...(plan.sa_settings || {}) } as Record<string, any>;
    const faors = Array.isArray(sa.faor) ? [...sa.faor] : [];
    const item = faors[target.lineIdx]
      ? { ...faors[target.lineIdx], points: [...(faors[target.lineIdx].points || [])] }
      : { name: `FAOR ${target.lineIdx + 1}`, note: '', points: [] as any[] };
    const pts = item.points;
    if (pts.length >= 3 && pts.length < 7 && !isFaorPointsClosed(pts)) {
      const p0 = pts[0];
      if (Math.abs(Number(p0.lat) - cleanLat) < 0.04 && Math.abs(Number(p0.lng) - cleanLng) < 0.06) {
        pts.push({ lat: Number(p0.lat), lng: Number(p0.lng) });
        faors[target.lineIdx] = item;
        return { plan: { ...plan, sa_settings: { ...sa, faor: faors } }, stopDraw: true };
      }
    }
    if (pts.length >= 7) {
      onNotify?.('warning', 'Max 7 points reached for FAOR');
      return { plan, stopDraw: true };
    }
    pts.push({ lat: cleanLat, lng: cleanLng });
    faors[target.lineIdx] = item;
    return { plan: { ...plan, sa_settings: { ...sa, faor: faors } }, stopDraw: pts.length >= 7 };
  }

  if (target.kind === 'f18_corridor') {
    const sa = { ...(plan.sa_settings || {}) } as Record<string, any>;
    const corrs = Array.isArray(sa.corridors) ? [...sa.corridors] : [];
    const item = corrs[target.lineIdx]
      ? { ...corrs[target.lineIdx], points: [...(corrs[target.lineIdx].points || [])] }
      : { name: `CORR ${target.lineIdx + 1}`, note: '', points: [] as any[] };
    if (item.points.length >= 14) {
      onNotify?.('warning', 'Max 14 points reached for Corridor');
      return { plan, stopDraw: true };
    }
    item.points.push({ lat: cleanLat, lng: cleanLng });
    corrs[target.lineIdx] = item;
    return { plan: { ...plan, sa_settings: { ...sa, corridors: corrs } }, stopDraw: item.points.length >= 14 };
  }

  if (target.kind === 'f16_geo') {
    const lines = recalcF16GeoLines(plan.geo_lines_settings);
    const total = lines[1].length + lines[2].length + lines[3].length + lines[4].length;
    if (total >= 25) {
      onNotify?.('warning', 'Maximum 25 Geo Line points reached (STPT 31-55)');
      return { plan, stopDraw: true };
    }
    const line = target.lineNum;
    const ptNum = lines[line].length + 1;
    lines[line].push({ name: `L${line} P${ptNum}`, lat: cleanLat, lng: cleanLng, line });
    const recalced = recalcF16GeoLines(lines);
    const nextTotal = recalced[1].length + recalced[2].length + recalced[3].length + recalced[4].length;
    return { plan: { ...plan, geo_lines_settings: recalced }, stopDraw: nextTotal >= 25 };
  }

  if (target.kind === 'f16_dest') {
    const rawDest = plan.dest_points_settings;
    const cur = Array.isArray(rawDest)
      ? [...rawDest]
      : Array.isArray((rawDest as any)?.points)
        ? [...(rawDest as any).points]
        : [];
    if (cur.length >= 19) {
      onNotify?.('warning', 'Maximum 19 Destination points reached (STPT 81-99)');
      return { plan, stopDraw: true };
    }
    const stpt = 81 + cur.length;
    cur.push({ stpt, name: `DEST ${stpt}`, lat: cleanLat, lng: cleanLng, elev: 0, note: `D${stpt}` });
    return { plan: { ...plan, dest_points_settings: cur }, stopDraw: cur.length >= 19 };
  }

  if (target.kind === 'f14_plot') {
    const f14 = { ...(plan.f14_plot_lines_settings || {}) } as Record<string, any>;
    const existing = f14[target.lineNum] ?? f14[String(target.lineNum)] ?? { closed: false, points: [] };
    const pts = Array.isArray(existing) ? [...existing] : [...(existing.points || [])];
    if (pts.length >= 9) {
      onNotify?.('warning', `Plot Line ${target.lineNum} already has maximum 9 points`);
      return { plan, stopDraw: true };
    }
    const ptNum = pts.length + 1;
    pts.push({
      name: target.lineNum === 1 ? `FLOT ${ptNum}` : `L${target.lineNum} P${ptNum}`,
      lat: cleanLat,
      lng: cleanLng,
      elev: 0,
      line: target.lineNum,
    });
    return {
      plan: {
        ...plan,
        f14_plot_lines_settings: {
          ...f14,
          [target.lineNum]: { closed: Boolean(existing?.closed), points: pts },
        },
      },
      stopDraw: pts.length >= 9,
    };
  }

  // jf17_airspace
  const jf = { ...(plan.jf17_airspace_settings || {}) } as Record<string, any>;
  const existing = jf[target.key] ?? jf[target.key.toLowerCase()] ?? { color: JF17_DEFAULT_COLORS[target.key], closed: false, points: [] };
  const pts = Array.isArray(existing) ? [...existing] : [...(existing.points || [])];
  const ptNum = pts.length + 1;
  pts.push({
    name: target.key === 'BKYA' ? `FLOT ${ptNum}` : `${target.key} P${ptNum}`,
    lat: cleanLat,
    lng: cleanLng,
    line: target.key,
  });
  return {
    plan: {
      ...plan,
      jf17_airspace_settings: {
        ...jf,
        [target.key]: {
          color: existing?.color || JF17_DEFAULT_COLORS[target.key],
          closed: Boolean(existing?.closed),
          points: pts,
        },
      },
    },
    stopDraw: false,
  };
}

export function normalizePlanForEditor(
  rawPlan: FlightPlanDetail,
  mapData: CampaignMapPayload,
  airframe?: CampaignMapAirframeCatalogItem | null
): FlightPlanDetail {
  const plan = { ...rawPlan };
  const resolvedAf =
    airframe ||
    mapData.airframesCatalog.find((a) => Number(a.id) === Number(plan.airframe_id)) ||
    null;

  // Ensure route_points carry standard metadata flags without losing custom fields
  plan.route_points = (plan.route_points || []).map((pt, idx) => {
    const isTgt = isTargetPoint(pt);
    const isAdd = isAdditionalPoint(pt);
    const isFix = isFixPoint(pt);
    const lat = Number(pt.lat);
    const lng = Number(pt.lng);
    return {
      ...pt,
      index: idx,
      is_target: isTgt,
      is_additional: isAdd,
      is_lantirn: isAdd || Boolean(pt.is_lantirn),
      is_fix: isFix,
      sequence: isDivertPoint(pt) ? 99 : Number(pt.sequence || 1),
      mgrs: pt.mgrs || (Number.isFinite(lat) && Number.isFinite(lng) ? toMgrs(lat, lng) : ''),
      lldm: pt.lldm || (Number.isFinite(lat) && Number.isFinite(lng) ? formatCoordinateDdm(lat, lng) : ''),
      dms: pt.dms || (Number.isFinite(lat) && Number.isFinite(lng) ? formatCoordinateDms(lat, lng) : ''),
    };
  });

  // Normalize F/A-18C SA settings
  if (!plan.sa_settings || typeof plan.sa_settings !== 'object') {
    plan.sa_settings = {
      flot: [],
      default_flot: 1,
      faor: [],
      default_faor: 1,
      cap_points: [],
      default_cap: 1,
      corridors: [],
      default_corridor: 1,
    };
  }

  // Normalize F-16C GEO lines (auto-seed Line 1 from front line if empty)
  if (isF16Airframe(plan, resolvedAf)) {
    const geo = recalcF16GeoLines(plan.geo_lines_settings);
    if (geo[1].length === 0) {
      const flPts = extractFrontLinePoints(mapData.frontLine, 25);
      if (flPts.length > 0) {
        geo[1] = flPts.map((pt, idx) => ({
          name: `FLOT ${idx + 1}`,
          lat: pt.lat,
          lng: pt.lng,
          line: 1,
        }));
      }
    }
    plan.geo_lines_settings = recalcF16GeoLines(geo);
    plan.dest_points_settings = recalcF16DestPoints(
      Array.isArray(plan.dest_points_settings) ? plan.dest_points_settings : []
    );
  }

  // Normalize F-14 Plot Lines (auto-seed Line 1 with max 9 pts)
  if (isF14Airframe(plan, resolvedAf)) {
    const rawF14 = (plan.f14_plot_lines_settings || {}) as Record<string, any>;
    const f14: Record<number, { closed: boolean; points: any[] }> = {
      1: { closed: false, points: [] },
      2: { closed: false, points: [] },
      3: { closed: false, points: [] },
      4: { closed: false, points: [] },
    };
    ([1, 2, 3, 4] as const).forEach((l) => {
      const entry = rawF14[l] ?? rawF14[String(l)];
      if (Array.isArray(entry)) {
        f14[l] = { closed: false, points: entry };
      } else if (entry && typeof entry === 'object') {
        f14[l] = { closed: Boolean(entry.closed), points: Array.isArray(entry.points) ? entry.points : [] };
      }
    });
    if (
      f14[1].points.length === 0 &&
      f14[2].points.length === 0 &&
      f14[3].points.length === 0 &&
      f14[4].points.length === 0
    ) {
      const flPts = extractFrontLinePoints(mapData.frontLine, 9);
      if (flPts.length > 0) {
        f14[1] = {
          closed: false,
          points: flPts.map((pt, idx) => ({
            name: `L1 P${idx + 1}`,
            lat: pt.lat,
            lng: pt.lng,
            elev: 0,
            line: 1,
          })),
        };
      }
    }
    plan.f14_plot_lines_settings = f14;
  }

  // Normalize JF-17 Airspace (auto-seed BKYA if missing)
  if (isJf17Airframe(plan, resolvedAf)) {
    const rawJf = (plan.jf17_airspace_settings || {}) as Record<string, any>;
    const hasAnyKey = ['BKYA', 'BKYB', 'BKYC', 'BKYD'].some((k) => rawJf[k] || rawJf[k.toLowerCase()]);
    const jf: Record<string, { color: string; closed: boolean; points: any[] }> = {};
    (['BKYA', 'BKYB', 'BKYC', 'BKYD'] as const).forEach((k) => {
      const entry = rawJf[k] ?? rawJf[k.toLowerCase()];
      if (Array.isArray(entry)) {
        jf[k] = { color: JF17_DEFAULT_COLORS[k], closed: false, points: entry };
      } else if (entry && typeof entry === 'object') {
        jf[k] = {
          color: entry.color || JF17_DEFAULT_COLORS[k],
          closed: Boolean(entry.closed),
          points: Array.isArray(entry.points) ? entry.points : [],
        };
      } else {
        jf[k] = { color: JF17_DEFAULT_COLORS[k], closed: false, points: [] };
      }
    });
    if (!hasAnyKey && jf.BKYA.points.length === 0) {
      const flPts = extractFrontLinePoints(mapData.frontLine, 25);
      jf.BKYA.points = flPts.map((pt, idx) => ({
        name: `FLOT ${idx + 1}`,
        lat: pt.lat,
        lng: pt.lng,
        line: 'BKYA',
      }));
    }
    plan.jf17_airspace_settings = jf;
  }

  // Ensure multi-radio comms map has comm1 / comm2 hydrated
  const ladder = (plan.comms_ladder_by_radio || (typeof plan.comms_ladder === 'object' && !Array.isArray(plan.comms_ladder) ? plan.comms_ladder : {}) || {}) as Record<string, FlightPlanCommsEntry[]>;
  if ((!plan.comm1 || plan.comm1.length === 0) && Array.isArray(ladder.comm1)) {
    plan.comm1 = ladder.comm1;
  }
  if ((!plan.comm2 || plan.comm2.length === 0) && Array.isArray(ladder.comm2)) {
    plan.comm2 = ladder.comm2;
  }
  plan.comms_ladder_by_radio = {
    ...ladder,
    ...(Array.isArray(plan.comm1) ? { comm1: plan.comm1 } : {}),
    ...(Array.isArray(plan.comm2) ? { comm2: plan.comm2 } : {}),
  };

  if (!plan.mids_settings || !plan.mids_settings.mids_a_channel) {
    plan.mids_settings = {
      mids_a_channel: '44',
      mids_a_name: 'MIDS A',
      mids_a_notes: 'Interflight Datalink',
      mids_b_channel: '49',
      mids_b_name: 'MIDS B',
      mids_b_notes: 'Package Tactical',
      ...(plan.mids_settings || {}),
    };
  }

  return plan;
}
