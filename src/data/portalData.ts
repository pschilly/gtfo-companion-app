import {
  AdminPositionDetail,
  AtcFlightPlanPackage,
  DiscordUserSession,
  MemberAward,
  MemberCertificate,
  MemberGradeLevel,
  MemberPortalProfile,
  QualifiedAirframe,
  SquadronAssignment,
  UserTier,
} from '../types';

export const GTFO_GRADE_META: Record<
  MemberGradeLevel,
  {
    grade: MemberGradeLevel;
    title: string;
    xpRequired: number;
    monthsRequired: number;
    iconUrl: string;
    notes: string;
  }
> = {
  G0: {
    grade: 'G0',
    title: 'Grade 0 // Candidate',
    xpRequired: 0,
    monthsRequired: 0,
    iconUrl: 'https://cdn.globaltaskforceoverlord.org/rank-insignia/01K69JQS4NS26RB05EKQ8NRVMQ.png',
    notes: 'Starting point for new members of Global Task Force Overlord.',
  },
  G1: {
    grade: 'G1',
    title: 'Grade 1 // Aviator',
    xpRequired: 1000,
    monthsRequired: 1,
    iconUrl: 'https://cdn.globaltaskforceoverlord.org/rank-insignia/01K69JWNB6VGVHVC6269QM5870.png',
    notes: 'Awarded upon completion of Basic Check Flight (1,000 XP).',
  },
  G2: {
    grade: 'G2',
    title: 'Grade 2',
    xpRequired: 25000,
    monthsRequired: 3,
    iconUrl: 'https://cdn.globaltaskforceoverlord.org/rank-insignia/01K69JX0ZSXAREZJH35W4G027K.png',
    notes: '25,000 XP Service Milestone',
  },
  G3: {
    grade: 'G3',
    title: 'Grade 3',
    xpRequired: 50000,
    monthsRequired: 6,
    iconUrl: 'https://cdn.globaltaskforceoverlord.org/rank-insignia/01K69JXNJPE8S8Q9DJX6NRKGQ9.png',
    notes: '50,000 XP Service Milestone',
  },
  G4: {
    grade: 'G4',
    title: 'Grade 4',
    xpRequired: 75000,
    monthsRequired: 9,
    iconUrl: 'https://cdn.globaltaskforceoverlord.org/rank-insignia/01K69JYBM85BC9PGP5963PEEF2.png',
    notes: '75,000 XP Service Milestone',
  },
  G5: {
    grade: 'G5',
    title: 'Grade 5',
    xpRequired: 125000,
    monthsRequired: 12,
    iconUrl: 'https://cdn.globaltaskforceoverlord.org/rank-insignia/01K69JYSS7TBZMSN0SR8KGFHZS.png',
    notes: '125,000 XP Service Milestone',
  },
  G6: {
    grade: 'G6',
    title: 'Grade 6',
    xpRequired: 175000,
    monthsRequired: 18,
    iconUrl: 'https://cdn.globaltaskforceoverlord.org/rank-insignia/01K69JZ4KK67ZJ8PCYGHN1AY5M.png',
    notes: '175,000 XP Service Milestone',
  },
  G7: {
    grade: 'G7',
    title: 'Grade 7',
    xpRequired: 225000,
    monthsRequired: 24,
    iconUrl: 'https://cdn.globaltaskforceoverlord.org/rank-insignia/01K69K3H4DQYY3AM3MJRAWZ6HZ.png',
    notes: '225,000 XP Service Milestone',
  },
  G8: {
    grade: 'G8',
    title: 'Grade 8',
    xpRequired: 300000,
    monthsRequired: 30,
    iconUrl: 'https://cdn.globaltaskforceoverlord.org/rank-insignia/01K69K3XWENT6MBF8B321S70DP.png',
    notes: '300,000 XP Service Milestone',
  },
  G9: {
    grade: 'G9',
    title: 'Grade 9',
    xpRequired: 375000,
    monthsRequired: 36,
    iconUrl: 'https://cdn.globaltaskforceoverlord.org/rank-insignia/01K69K4ACEZ7A46VPQQ2M66NTY.png',
    notes: '375,000 XP Service Milestone',
  },
  G10: {
    grade: 'G10',
    title: 'Grade 10',
    xpRequired: 450000,
    monthsRequired: 42,
    iconUrl: 'https://cdn.globaltaskforceoverlord.org/rank-insignia/01K69K4Q360G9WXH4N185RXSB1.png',
    notes: '450,000 XP Senior Task Force Milestone',
  },
  G11: {
    grade: 'G11',
    title: 'Grade 11',
    xpRequired: 900000,
    monthsRequired: 48,
    iconUrl: 'https://cdn.globaltaskforceoverlord.org/rank-insignia/01K84AQXEM0E6H008TFDN3XKCT.png',
    notes: '900,000 XP Command & Veteran Milestone',
  },
};

export const GTFO_SQUADRONS: Record<string, SquadronAssignment> = {
  '507th FS': {
    code: '507th FS',
    name: '507th Fighter Squadron',
    nickname: 'Knights',
    role: 'SEAD / Strike / Multi-Role',
    primaryAirframe: 'F-16C Viper',
    radioCallsign: 'Dagger / Hammer / Spear',
    emblemUrl: 'https://cdn.globaltaskforceoverlord.org/squadron-logos/pU9xtFLUuU8r5Ep840diEtdpkdoG6n7jm7bk4Ueb.png',
    rosterUrl: 'https://members.globaltaskforceoverlord.org/member/squadrons/507th-fighter-squadron/roster',
  },
  '449th TFS': {
    code: '449th TFS',
    name: '449th Tactical Fighter Squadron',
    nickname: 'Wolverines',
    role: 'Strike / Air Superiority',
    primaryAirframe: 'F/A-18C Hornet',
    radioCallsign: 'Logan',
    emblemUrl: 'https://cdn.globaltaskforceoverlord.org/squadron-logos/rduOq2gNFu8PHfX7Ovgv2xArV2l2gZfZo0Gou33Z.png',
    rosterUrl: 'https://kb.globaltaskforceoverlord.org/docs/squadrons/449th',
  },
  '19th AAB': {
    code: '19th AAB',
    name: '19th Air Assault Brigade',
    nickname: 'Shake & Bake',
    role: 'Rotary & Air Mobility',
    primaryAirframe: 'CH-47F / AH-64D / C-130J',
    radioCallsign: 'Shake / Bake / Wonder / Hawg',
    emblemUrl: 'https://cdn.globaltaskforceoverlord.org/squadron-logos/IKMfUTOd8385wO4YvJPKYXYHtdvpbaRqv1TSFahh.png',
    rosterUrl: 'https://kb.globaltaskforceoverlord.org/docs/squadrons/19th',
  },
  'VF-141': {
    code: 'VF-141',
    name: 'Strike Fighter Squadron 141',
    nickname: 'Ghostfighters',
    role: 'Naval Air Superiority',
    primaryAirframe: 'F-14A/B Tomcat',
    radioCallsign: 'Camelot / Gypsy / Black Knight',
    emblemUrl: 'https://cdn.globaltaskforceoverlord.org/squadron-logos/qdM2p9W4HbhyZNGkE5bN4vYu7lZjnfbsAUxT982a.png',
    rosterUrl: 'https://kb.globaltaskforceoverlord.org/docs/squadrons/VF-141',
  },
  '777AGR': {
    code: '777AGR',
    name: 'Squadron 777',
    nickname: 'The Nutcrackers',
    role: 'Aggressor / OPFOR Wing',
    primaryAirframe: 'Multi-Airframe Aggressor',
    radioCallsign: 'Red Air',
    emblemUrl: 'https://cdn.globaltaskforceoverlord.org/squadron-logos/nUOdVDMn8CjWQ7ufQeZcJlu8O0ejfThdKsJKwbyy.png',
  },
  '42nd HS': {
    code: '42nd HS',
    name: '42nd Holding Squadron',
    nickname: 'Training Wing',
    role: 'Check Flight & Indoctrination',
    primaryAirframe: 'All Training Airframes',
    radioCallsign: 'Overlord',
    emblemUrl: 'https://cdn.globaltaskforceoverlord.org/GTFO-Logo.png',
  },
  '479th FIS': {
    code: '479th FIS',
    name: '479th Fighter Interceptor Squadron',
    nickname: 'The Battering Rams',
    role: 'Air Intercept & Air Superiority',
    primaryAirframe: 'F-4E Phantom II',
    radioCallsign: 'Rut / Horn / Scythe',
    emblemUrl: 'https://cdn.globaltaskforceoverlord.org/GTFO-Logo.png',
  },
  '62nd TFS': {
    code: '62nd TFS',
    name: '62nd Tactical Fighter Squadron',
    nickname: 'Akula Squadron',
    role: 'Air Superiority',
    primaryAirframe: 'MiG-29A Fulcrum',
    radioCallsign: 'Mako / Tiger',
    emblemUrl: 'https://cdn.globaltaskforceoverlord.org/GTFO-Logo.png',
  },
};

/**
 * In-memory cache of live squadrons returned from the REST API endpoint
 * (/api/v1/companion/squadrons). Takes highest precedence over static fallbacks.
 */
let liveSquadronsRegistry: any[] = [];

export function setLiveSquadronsRegistry(squadrons: any[]): void {
  if (Array.isArray(squadrons) && squadrons.length > 0) {
    liveSquadronsRegistry = squadrons;
  }
}

export function getLiveSquadronsRegistry(): any[] {
  return liveSquadronsRegistry;
}

const GRADE_ORDER: MemberGradeLevel[] = [
  'G0',
  'G1',
  'G2',
  'G3',
  'G4',
  'G5',
  'G6',
  'G7',
  'G8',
  'G9',
  'G10',
  'G11',
];

export function resolveSquadronAssignment(
  raw: unknown,
  liveEmblemUrl?: string | null
): SquadronAssignment | null {
  if (!raw) {
    if (liveEmblemUrl) {
      return {
        code: 'GTFO',
        name: 'Assigned Squadron',
        nickname: '',
        role: 'Active Billet',
        primaryAirframe: 'Multi-Role',
        radioCallsign: 'Overlord',
        emblemUrl: normalizePortalCdnUrl(
          liveEmblemUrl,
          'https://cdn.globaltaskforceoverlord.org/GTFO-Logo.png'
        ),
      };
    }
    return null;
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.toUpperCase() === 'NONE' || trimmed.toUpperCase() === 'UNASSIGNED') {
      return null;
    }
    const lower = trimmed.toLowerCase();

    // 1. Check live REST API registry first
    if (liveSquadronsRegistry.length > 0) {
      const liveSq = liveSquadronsRegistry.find((s: any) => {
        const sName = String(s.name || '').toLowerCase();
        const sCode = String(s.code || s.abbreviation || '').toLowerCase();
        const sSlug = String(s.slug || '').toLowerCase();
        return (
          sName === lower ||
          sCode === lower ||
          sSlug === lower ||
          (lower.includes('449') && (sCode.includes('449') || sName.includes('449'))) ||
          (lower.includes('507') && (sCode.includes('507') || sName.includes('507'))) ||
          (lower.includes('141') && (sCode.includes('141') || sName.includes('141'))) ||
          (lower.includes('19th') && (sCode.includes('19th') || sName.includes('19th'))) ||
          (lower.includes('777') && (sCode.includes('777') || sName.includes('777')))
        );
      });

      if (liveSq) {
        return {
          code: liveSq.abbreviation || liveSq.code || trimmed,
          name: liveSq.name || trimmed,
          nickname: liveSq.nickname || '',
          role: liveSq.role || 'Multi-Role Squadron',
          primaryAirframe: liveSq.primaryAirframe || '',
          radioCallsign: Array.isArray(liveSq.callsigns)
            ? liveSq.callsigns
                .map((c: any) =>
                  typeof c === 'string'
                    ? c
                    : c && typeof c === 'object' && 'callsign' in c
                    ? String((c as Record<string, unknown>).callsign || '')
                    : ''
                )
                .filter(Boolean)
                .join(' / ')
            : '',
          emblemUrl: normalizePortalCdnUrl(
            liveEmblemUrl || liveSq.emblemUrl || liveSq.emblem_url,
            'https://cdn.globaltaskforceoverlord.org/GTFO-Logo.png'
          ),
          rosterUrl: liveSq.slug
            ? `https://members.globaltaskforceoverlord.org/member/squadrons/${liveSq.slug}/roster`
            : undefined,
        };
      }
    }

    // 2. Fall back to static dictionary
    for (const sq of Object.values(GTFO_SQUADRONS)) {
      if (
        sq.code.toLowerCase() === lower ||
        sq.name.toLowerCase() === lower ||
        sq.nickname.toLowerCase() === lower ||
        (lower.includes('449') && sq.code === '449th TFS') ||
        (lower.includes('507') && sq.code === '507th FS') ||
        (lower.includes('141') && sq.code === 'VF-141') ||
        (lower.includes('19th') && sq.code === '19th AAB') ||
        (lower.includes('777') && sq.code === '777AGR') ||
        (lower.includes('42nd') && sq.code === '42nd HS') ||
        (lower.includes('479') && sq.code === '479th FIS') ||
        (lower.includes('62nd') && sq.code === '62nd TFS')
      ) {
        return {
          ...sq,
          emblemUrl: normalizePortalCdnUrl(liveEmblemUrl || sq.emblemUrl, sq.emblemUrl),
        };
      }
    }

    return {
      code: trimmed,
      name: trimmed,
      nickname: 'GTFO Squadron',
      role: 'Aviator',
      primaryAirframe: 'Multi-Role',
      radioCallsign: 'Overlord',
      emblemUrl: normalizePortalCdnUrl(
        liveEmblemUrl,
        'https://cdn.globaltaskforceoverlord.org/GTFO-Logo.png'
      ),
    };
  }

  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const nameOrCode = String(obj.name || obj.code || obj.abbreviation || '').trim();
    const emblemCandidate = String(
      liveEmblemUrl ||
        obj.emblemUrl ||
        obj.emblem_url ||
        obj.squadronEmblemUrl ||
        obj.squadron_emblem_url ||
        obj.logoUrl ||
        obj.logo_url ||
        obj.imageUrl ||
        obj.image_url ||
        obj.image_path ||
        ''
    );
    const matched = nameOrCode ? resolveSquadronAssignment(nameOrCode, emblemCandidate) : null;

    let callsignStr = '';
    if (typeof obj.radioCallsign === 'string') {
      callsignStr = obj.radioCallsign;
    } else if (Array.isArray(obj.callsigns) && obj.callsigns.length > 0) {
      callsignStr = obj.callsigns
        .map((c) =>
          typeof c === 'string'
            ? c
            : c && typeof c === 'object' && 'callsign' in c
            ? String((c as Record<string, unknown>).callsign || '')
            : ''
        )
        .filter(Boolean)
        .join(' / ');
    }

    let airframeStr = '';
    if (typeof obj.primaryAirframe === 'string') {
      airframeStr = obj.primaryAirframe;
    } else if (Array.isArray(obj.airframes) && obj.airframes.length > 0) {
      airframeStr = obj.airframes
        .map((a) =>
          typeof a === 'string'
            ? a
            : a && typeof a === 'object' && 'name' in a
            ? String((a as Record<string, unknown>).name || '')
            : ''
        )
        .filter(Boolean)
        .join(' / ');
    }

    return {
      code: String(obj.abbreviation || obj.code || matched?.code || nameOrCode || 'GTFO'),
      name: String(obj.name || matched?.name || nameOrCode || 'Assigned Squadron'),
      nickname: String(obj.nickname || matched?.nickname || ''),
      role: String(obj.role || obj.position || matched?.role || 'Active Billet'),
      primaryAirframe: airframeStr || matched?.primaryAirframe || '',
      radioCallsign: callsignStr || matched?.radioCallsign || '',
      emblemUrl: normalizePortalCdnUrl(
        obj.logoUrl || obj.emblemUrl || obj.imageUrl || obj.image_path,
        matched?.emblemUrl || 'https://cdn.globaltaskforceoverlord.org/GTFO-Logo.png'
      ),
      rosterUrl: obj.rosterUrl ? String(obj.rosterUrl) : matched?.rosterUrl,
    };
  }

  return null;
}

function computeTimeServedFromDate(isoDate?: string | null): {
  months: number;
  label: string;
  formattedDate: string;
} {
  if (!isoDate) {
    return { months: 0, label: '—', formattedDate: 'Active Roster' };
  }
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return { months: 0, label: '—', formattedDate: String(isoDate).slice(0, 10) };
  }

  const formattedDate = parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - parsed.getTime());
  const totalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const totalMonths = Math.max(
    0,
    (now.getFullYear() - parsed.getFullYear()) * 12 + (now.getMonth() - parsed.getMonth())
  );

  if (totalMonths < 1) {
    return {
      months: 0,
      label: `${Math.max(1, totalDays)}d`,
      formattedDate,
    };
  }
  if (totalMonths >= 12) {
    const yrs = Math.floor(totalMonths / 12);
    const remMo = totalMonths % 12;
    return {
      months: totalMonths,
      label: remMo > 0 ? `${yrs}y ${remMo}m` : `${yrs} yr${yrs > 1 ? 's' : ''}`,
      formattedDate,
    };
  }
  return {
    months: totalMonths,
    label: `${totalMonths} mo`,
    formattedDate,
  };
}

export function normalizePortalCdnUrl(rawUrl: unknown, fallbackUrl: string): string {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return fallbackUrl;
  }
  const trimmed = rawUrl.trim();
  if (trimmed.includes('kb.globaltaskforceoverlord.org/assets/')) {
    return fallbackUrl;
  }
  // Convert any legacy local storage URLs into official CDN URLs
  if (trimmed.startsWith('https://members.globaltaskforceoverlord.org/storage/')) {
    return trimmed.replace(
      'https://members.globaltaskforceoverlord.org/storage/',
      'https://cdn.globaltaskforceoverlord.org/'
    );
  }
  // Discord CDN and other absolute HTTPS URLs
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  // Relative storage paths resolve directly to Cloudflare R2 / CDN
  return `https://cdn.globaltaskforceoverlord.org/${trimmed.replace(
    /^\/?(storage\/)?/,
    ''
  )}`;
}

export function normalizeMemberPortalProfile(
  raw: Record<string, unknown>,
  session: DiscordUserSession | null,
  effectiveTier: UserTier
): MemberPortalProfile {
  const gp =
    raw.gradeProgression && typeof raw.gradeProgression === 'object'
      ? (raw.gradeProgression as Record<string, unknown>)
      : null;

  const rawGradeStr = String(gp?.currentGrade || raw.grade || raw.rank || 'G1')
    .toUpperCase()
    .trim();
  const matchedGrade: MemberGradeLevel = (
    GRADE_ORDER.includes(rawGradeStr as MemberGradeLevel)
      ? rawGradeStr
      : GRADE_ORDER.find((g) => GTFO_GRADE_META[g].title.toUpperCase().startsWith(rawGradeStr)) ||
        'G1'
  ) as MemberGradeLevel;

  const gradeMeta = GTFO_GRADE_META[matchedGrade] || GTFO_GRADE_META.G1;
  const currentIdx = GRADE_ORDER.indexOf(matchedGrade);

  const isMaxGrade = Boolean(gp?.isMaxGrade);
  const rawNextGradeStr = String(
    gp?.nextGrade || (typeof raw.nextGrade === 'string' ? raw.nextGrade : '') || ''
  )
    .toUpperCase()
    .trim();

  const nextGradeKey: MemberGradeLevel | undefined = isMaxGrade
    ? undefined
    : GRADE_ORDER.includes(rawNextGradeStr as MemberGradeLevel)
    ? (rawNextGradeStr as MemberGradeLevel)
    : currentIdx >= 0 && currentIdx < GRADE_ORDER.length - 1
    ? GRADE_ORDER[currentIdx + 1]
    : undefined;

  const enlistedRaw = (raw.enlistmentDate ||
    raw.enlistment_date ||
    raw.joinedDate ||
    raw.joined_date ||
    raw.enlistedAt ||
    raw.enlisted_at ||
    raw.joinedAt ||
    raw.joined_at ||
    null) as string | null;
  const timeInfo = computeTimeServedFromDate(enlistedRaw);

  const explicitTimeServed = (raw.timeServed ||
    raw.time_served ||
    raw.timeServedLabel ||
    raw.time_served_label ||
    null) as string | null;

  const rawTier = String(
    raw.rosterTier || raw.roster_tier || (effectiveTier === 'core' ? 'CORE' : 'Community')
  );
  const rosterTier: 'CORE' | 'Community' =
    rawTier.toUpperCase() === 'CORE' ? 'CORE' : 'Community';

  const xp =
    typeof gp?.currentXp === 'number'
      ? gp.currentXp
      : typeof raw.xp === 'number'
      ? raw.xp
      : Number(raw.xp) || gradeMeta.xpRequired;

  const currentGradeXpRequired =
    typeof gp?.currentGradeXp === 'number' ? gp.currentGradeXp : gradeMeta.xpRequired;

  const nextGradeXpRequired = nextGradeKey
    ? typeof gp?.nextGradeXp === 'number'
      ? gp.nextGradeXp
      : typeof raw.requiredXp === 'number'
      ? raw.requiredXp
      : GTFO_GRADE_META[nextGradeKey].xpRequired
    : undefined;

  const remainingXp =
    typeof gp?.remainingXp === 'number'
      ? gp.remainingXp
      : typeof raw.remainingXp === 'number'
      ? raw.remainingXp
      : nextGradeXpRequired
      ? Math.max(0, nextGradeXpRequired - xp)
      : 0;

  // Use overall percentage toward nextGradeXp (e.g. 57.31% for 515,760 / 900,000 XP)
  const tierPercentage =
    typeof gp?.percentage === 'number'
      ? gp.percentage
      : typeof raw.gradePercentage === 'number'
      ? raw.gradePercentage
      : typeof gp?.tierPercentage === 'number'
      ? gp.tierPercentage
      : nextGradeXpRequired && nextGradeXpRequired > 0
      ? Number(((xp / nextGradeXpRequired) * 100).toFixed(2))
      : undefined;

  const liveEmblem =
    (typeof raw.squadronEmblemUrl === 'string' && raw.squadronEmblemUrl) ||
    (typeof raw.squadron_emblem_url === 'string' && raw.squadron_emblem_url) ||
    (typeof raw.squadronLogoUrl === 'string' && raw.squadronLogoUrl) ||
    (typeof raw.squadron_logo_url === 'string' && raw.squadron_logo_url) ||
    (typeof raw.squadronLogo === 'string' && raw.squadronLogo) ||
    (typeof raw.squadron_logo === 'string' && raw.squadron_logo) ||
    (typeof raw.squadronImageUrl === 'string' && raw.squadronImageUrl) ||
    (typeof raw.squadron_image_url === 'string' && raw.squadron_image_url) ||
    undefined;

  const primarySq = resolveSquadronAssignment(
    raw.squadron ?? raw.squadronAssignment ?? raw.squadron_assignment,
    liveEmblem
  );
  if (primarySq && liveEmblem) {
    primarySq.emblemUrl = normalizePortalCdnUrl(liveEmblem, primarySq.emblemUrl);
  }
  const secondarySq = resolveSquadronAssignment(raw.secondarySquadronAssignment);

  const gradeIconUrl = normalizePortalCdnUrl(
    gp?.currentInsigniaUrl ||
      gp?.current_insignia_url ||
      raw.insigniaUrl ||
      raw.insignia_url ||
      raw.gradeIconUrl ||
      raw.grade_icon_url,
    gradeMeta.iconUrl
  );

  const nextInsigniaUrl = nextGradeKey
    ? normalizePortalCdnUrl(
        gp?.nextInsigniaUrl ||
          gp?.next_insignia_url ||
          raw.nextInsigniaUrl ||
          raw.next_insignia_url,
        GTFO_GRADE_META[nextGradeKey].iconUrl
      )
    : undefined;

  return {
    discordId: String(raw.discordId || raw.discord_id || session?.id || ''),
    callsign: String(
      raw.callsign || raw.name || session?.globalName || session?.username || 'Aviator'
    ),
    avatarUrl:
      typeof raw.avatar === 'string' && raw.avatar
        ? raw.avatar
        : session?.avatarUrl || null,
    dcsUcid: raw.dcsUcid || raw.dcs_ucid ? String(raw.dcsUcid || raw.dcs_ucid) : null,
    flightIdentifier:
      raw.flightIdentifier || raw.flight_identifier
        ? String(raw.flightIdentifier || raw.flight_identifier)
        : null,
    rosterTier,
    grade: matchedGrade,
    gradeTitle: String(
      gp?.currentGradeName || raw.gradeName || raw.grade_name || raw.rank || gradeMeta.title
    ),
    gradeIconUrl,
    xp,
    currentGradeXpRequired,
    remainingXp,
    gradePercentage: tierPercentage,
    tierPercentage,
    timeServedMonths:
      typeof raw.timeServedMonths === 'number'
        ? raw.timeServedMonths
        : typeof raw.time_served_months === 'number'
        ? raw.time_served_months
        : timeInfo.months,
    timeServedLabel: explicitTimeServed || timeInfo.label,
    joinedAt: timeInfo.formattedDate,
    nextGrade:
      nextGradeKey && nextGradeXpRequired !== undefined
        ? {
            grade: nextGradeKey,
            title: String(gp?.nextGradeName || GTFO_GRADE_META[nextGradeKey].title),
            xpRequired: nextGradeXpRequired,
            monthsRequired: GTFO_GRADE_META[nextGradeKey].monthsRequired,
            insigniaUrl: nextInsigniaUrl,
          }
        : undefined,
    adminPosition:
      (raw.adminPosition || raw.admin_position || null) as string | null,
    adminPositions: Array.isArray(raw.adminPositions)
      ? (raw.adminPositions as string[])
      : Array.isArray(raw.admin_positions)
      ? (raw.admin_positions as string[])
      : Array.isArray(raw.administrativePositions)
      ? (raw.administrativePositions as string[])
      : Array.isArray(raw.administrative_positions)
      ? (raw.administrative_positions as string[])
      : raw.adminPosition
      ? [String(raw.adminPosition)]
      : [],
    adminPositionDetails: Array.isArray(raw.adminPositionDetails ?? raw.admin_position_details)
      ? ((raw.adminPositionDetails ?? raw.admin_position_details) as any[]).map((d: any) => ({
          id: Number(d.id || 0),
          name: String(d.name || ''),
          slug: String(d.slug || ''),
          discordRole: d.discordRole || d.discord_role,
        }))
      : [],
    isCouncilMember: Boolean(raw.isCouncilMember ?? raw.is_council_member ?? false),
    isSquadronLeader: Boolean(raw.isSquadronLeader ?? raw.is_squadron_leader ?? false),
    position: String(raw.position || (rosterTier === 'CORE' ? 'Aviator' : 'Member')),
    checkFlightCompleted: matchedGrade !== 'G0',
    squadronAssignment: primarySq,
    secondarySquadronAssignment: secondarySq,
    qualifiedAirframes: Array.isArray(raw.qualifiedAirframes ?? raw.qualified_airframes)
      ? ((raw.qualifiedAirframes ?? raw.qualified_airframes) as any[]).map((item: any, idx: number) => {
          if (typeof item === 'string') {
            return {
              id: idx + 1,
              name: item,
              abbreviation: item.toLowerCase().replace(/[^a-z0-9]/g, ''),
              dcsEntity: item,
              imageUrl: null,
              isPrimary: idx === 0,
              isPilot: true,
              isCrew: false,
              isInstructor: false,
              role: 'pilot',
              roleLabel: 'Pilot',
              status: 'qualified',
            };
          }
          return {
            id: Number(item.id || idx + 1),
            name: String(item.name || item.airframe || 'Airframe'),
            abbreviation: String(item.abbreviation || item.airframe_abbreviation || ''),
            dcsEntity: String(item.dcsEntity || item.dcs_entity || ''),
            imageUrl: item.imageUrl || item.image_url || null,
            isPrimary: Boolean(item.isPrimary ?? item.is_primary ?? false),
            isPilot: Boolean(item.isPilot ?? item.is_pilot ?? true),
            isCrew: Boolean(item.isCrew ?? item.is_crew ?? false),
            isInstructor: Boolean(item.isInstructor ?? item.is_instructor ?? false),
            role: String(item.role || 'pilot'),
            roleLabel: String(item.roleLabel || item.role_label || 'Pilot'),
            status: String(item.status || 'qualified'),
            discordRole: item.discordRole || item.discord_role,
            squadron: item.squadron ? String(item.squadron) : undefined,
          };
        })
      : [],
    certificates: Array.isArray(raw.certificates)
      ? raw.certificates.map((cert: any, idx: number) => ({
          id: Number(cert.id || idx + 1),
          code: String(cert.code || ''),
          name: String(cert.name || 'Certificate'),
          slug: String(cert.slug || ''),
          description: String(cert.description || ''),
          requirements: Array.isArray(cert.requirements)
            ? cert.requirements.map((r: any) => ({
                skill: String(r.skill || ''),
                benchmarks: String(r.benchmarks || ''),
              }))
            : [],
          xpValue: Number(cert.xpValue || cert.xp_value || 0),
          airframe: String(cert.airframe || ''),
          airframeAbbreviation: cert.airframeAbbreviation || cert.airframe_abbreviation,
          airframes: Array.isArray(cert.airframes) ? cert.airframes : cert.airframe ? [cert.airframe] : [],
          awardedRole: cert.awardedRole || cert.awarded_role,
          status: String(cert.status || 'issued'),
          isIssued: Boolean(cert.isIssued ?? cert.is_issued ?? true),
          progress: cert.progress ?? null,
          startedAt: cert.startedAt || cert.started_at,
          completedAt: cert.completedAt || cert.completed_at,
          issuedAt: cert.issuedAt || cert.issued_at,
          issuedBy: cert.issuedBy || cert.issued_by,
        }))
      : [],
    awards: Array.isArray(raw.awards)
      ? raw.awards.map((aw: any, idx: number) => ({
          id: Number(aw.id || idx + 1),
          name: String(aw.name || 'Award'),
          category: String(aw.category || 'General'),
          description: String(aw.description || ''),
          citation: aw.citation || null,
          requirements: Array.isArray(aw.requirements)
            ? aw.requirements.map((r: any) => ({
                requirement: String(r.requirement || ''),
              }))
            : [],
          xpValue: Number(aw.xpValue || aw.xp_value || 0),
          issuedAt: String(aw.issuedAt || aw.issued_at || ''),
          issuedBy: aw.issuedBy || aw.issued_by,
          ribbonUrl: aw.ribbonUrl || aw.ribbon_url || null,
          medalUrl: aw.medalUrl || aw.medal_url || null,
          issueCount: Number(aw.issueCount || aw.issue_count || 1),
          numeralAlignment: aw.numeralAlignment || aw.numeral_alignment,
          numeralType: aw.numeralType || aw.numeral_type,
          numeralUrl: aw.numeralUrl || aw.numeral_url || null,
          issuances: Array.isArray(aw.issuances)
            ? aw.issuances.map((iss: any, iIdx: number) => ({
                id: Number(iss.id || iIdx + 1),
                issuedAt: String(iss.issuedAt || iss.issued_at || ''),
                issuedBy: iss.issuedBy || iss.issued_by,
                citation: iss.citation || null,
              }))
            : [],
        }))
      : [],
    awardsCount:
      typeof raw.awardsCount === 'number'
        ? raw.awardsCount
        : Array.isArray(raw.awards)
        ? raw.awards.length
        : 0,
    serviceRecords: Array.isArray(raw.serviceRecords ?? raw.service_records)
      ? ((raw.serviceRecords ?? raw.service_records) as any[]).map((sr: any, idx: number) => ({
          id: Number(sr.id || idx + 1),
          type: String(sr.type || 'note'),
          typeLabel: String(sr.typeLabel || sr.type_label || sr.type || 'Note'),
          color: String(sr.color || 'gray'),
          details: String(sr.details || ''),
          createdAt: sr.createdAt || sr.created_at || null,
        }))
      : [],
    serviceRecordStats: (() => {
      const rawStats = (raw.serviceRecordStats ?? raw.service_record_stats) as Record<string, any> | undefined;
      const recordsArr = Array.isArray(raw.serviceRecords ?? raw.service_records)
        ? ((raw.serviceRecords ?? raw.service_records) as any[])
        : [];
      if (!rawStats || typeof rawStats !== 'object') {
        return {
          totalRsvps: 0,
          attended: 0,
          absent: 0,
          pending: 0,
          rate: null,
          rateFormatted: 'N/A',
          totalEntries: recordsArr.length,
        };
      }
      return {
        totalRsvps: Number(rawStats.totalRsvps ?? rawStats.total_rsvps ?? 0),
        attended: Number(rawStats.attended ?? 0),
        absent: Number(rawStats.absent ?? 0),
        pending: Number(rawStats.pending ?? 0),
        rate: typeof rawStats.rate === 'number' ? rawStats.rate : null,
        rateFormatted: String(rawStats.rateFormatted ?? rawStats.rate_formatted ?? 'N/A'),
        totalEntries: Number(rawStats.totalEntries ?? rawStats.total_entries ?? recordsArr.length),
      };
    })(),
    flightHoursLogged: typeof raw.flightHoursLogged === 'number' ? raw.flightHoursLogged : 0,
    portalSyncSource: 'portal_api',
    lastPortalSyncAt: new Date().toISOString(),
  };
}

export function buildFallbackMemberProfile(
  session: DiscordUserSession | null,
  effectiveTier: UserTier
): MemberPortalProfile {
  const isCore = effectiveTier === 'core';
  const gradeKey: MemberGradeLevel = 'G0';
  const gradeMeta = GTFO_GRADE_META[gradeKey];

  return {
    discordId: session?.id || '',
    callsign: session?.globalName || session?.username || 'Authenticating...',
    avatarUrl: session?.avatarUrl || null,
    dcsUcid: null,
    flightIdentifier: null,
    rosterTier: isCore ? 'CORE' : 'Community',
    grade: gradeKey,
    gradeTitle: 'Syncing Dossier...',
    gradeIconUrl: gradeMeta.iconUrl,
    xp: 0,
    currentGradeXpRequired: 0,
    timeServedMonths: 0,
    timeServedLabel: '—',
    joinedAt: '—',
    adminPosition: null,
    adminPositions: [],
    adminPositionDetails: [],
    isCouncilMember: false,
    isSquadronLeader: false,
    nextGrade: {
      grade: 'G1',
      xpRequired: GTFO_GRADE_META.G1.xpRequired,
      monthsRequired: GTFO_GRADE_META.G1.monthsRequired,
    },
    position: isCore ? 'Aviator' : 'Member',
    checkFlightCompleted: false,
    squadronAssignment: null,
    secondarySquadronAssignment: null,
    qualifiedAirframes: [],
    certificates: [],
    awards: [],
    awardsCount: 0,
    serviceRecords: [],
    serviceRecordStats: {
      totalRsvps: 0,
      attended: 0,
      absent: 0,
      pending: 0,
      rate: null,
      rateFormatted: 'N/A',
      totalEntries: 0,
    },
    flightHoursLogged: 0,
    portalSyncSource: 'discord_fallback',
    lastPortalSyncAt: new Date().toISOString(),
  };
}

export function formatRoutePresetToLuaSnippet(
  preset: AtcFlightPlanPackage['routePreset']
): string {
  const wpBlocks = preset.waypoints
    .map((wp, idx) => {
      const luaIdx = idx + 1;
      const altMeters = Math.round(wp.altFeet * 0.3048);
      const speedMps = Number((wp.speedKnots * 0.514444).toFixed(2));
      const xCoord = wp.x ?? Math.round(wp.lat * 10000);
      const yCoord = wp.y ?? Math.round(wp.lon * 10000);
      return [
        `        [${luaIdx}] = `,
        `        {`,
        `            ["alt"] = ${altMeters},`,
        `            ["alt_type"] = "BARO",`,
        `            ["name"] = "${wp.name}",`,
        `            ["speed"] = ${speedMps},`,
        `            ["type"] = "Turning Point",`,
        `            ["action"] = "Turning Point",`,
        `            ["x"] = ${xCoord},`,
        `            ["y"] = ${yCoord},`,
        `        }, -- end of [${luaIdx}]`,
      ].join('\n');
    })
    .join('\n');

  return [
    `["${preset.presetName}"] = `,
    `{`,
    `${wpBlocks}`,
    `}, -- end of ["${preset.presetName}"]`,
  ].join('\n');
}

export function generateKneeboardSvgCard(
  pkg: AtcFlightPlanPackage,
  kb: AtcFlightPlanPackage['kneeboards'][number]
): string {
  if (kb.generatedSvgContent) {
    return kb.generatedSvgContent;
  }
  return '';
}
