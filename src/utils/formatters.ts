export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatShortDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function formatExpectedDcsNickname(
  callsign: string,
  discordServerNick?: string | null
): string {
  if (discordServerNick && discordServerNick.trim()) {
    const nick = discordServerNick.trim();
    if (nick.startsWith('GTFO | ')) {
      return nick;
    }
    if (/^GTFO\s*\|\s*/i.test(nick)) {
      return `GTFO | ${nick.replace(/^GTFO\s*\|\s*/i, '').trim()}`;
    }
    return `GTFO | ${nick}`;
  }

  const clean = (callsign || 'Aviator').trim();
  if (clean.startsWith('GTFO | ')) {
    return clean;
  }
  if (/^GTFO\s*\|\s*/i.test(clean)) {
    return `GTFO | ${clean.replace(/^GTFO\s*\|\s*/i, '').trim()}`;
  }
  return `GTFO | ${clean}`;
}

/**
 * Comprehensive mapping of DCS World weapon CLSIDs and internal IDs to clean human-readable names.
 */
const DCS_WEAPON_CLEAN_NAMES: Record<string, string> = {
  // Air-to-Air Missiles (AIM-120 AMRAAM)
  '{40ef17b7-f508-45de-8566-6ffecc0c1ab8}': 'AIM-120C-5 AMRAAM',
  '{c8e06185-7cd6-4c90-959f-044679e90751}': 'AIM-120B AMRAAM',
  '{lau-115 - aim-120c_r}': 'AIM-120C AMRAAM (LAU-115)',
  '{lau-115 - aim-120c_l}': 'AIM-120C AMRAAM (LAU-115)',
  '{lau-115 - aim-120c}': 'AIM-120C AMRAAM (LAU-115)',
  '{lau-115 - aim-120b_r}': 'AIM-120B AMRAAM (LAU-115)',
  '{lau-115 - aim-120b_l}': 'AIM-120B AMRAAM (LAU-115)',
  '{lau-115 - aim-120b}': 'AIM-120B AMRAAM (LAU-115)',
  'lau-115_2*lau-127_aim-120c': '2x AIM-120C AMRAAM (LAU-115)',
  'lau-115_2*lau-127_aim-120b': '2x AIM-120B AMRAAM (LAU-115)',
  'lau-115_lau-127_aim-120c': 'AIM-120C AMRAAM (LAU-115)',
  'lau-115_lau-127_aim-120b': 'AIM-120B AMRAAM (LAU-115)',

  // Air-to-Air Missiles (AIM-9 Sidewinder)
  '{5ce2ff2a-645a-4197-b48d-8720ac69394f}': 'AIM-9X Sidewinder',
  '{6ceb49fc-ded8-4ded-b053-e1f033ff72d3}': 'AIM-9M Sidewinder',
  '{9bfd8c90-f7ae-4e90-833b-bfd0ced0e536}': 'AIM-9P Sidewinder',
  '{aim-9p5}': 'AIM-9P5 Sidewinder',
  '{aim-9l}': 'AIM-9L Sidewinder',
  '{aim-9j}': 'AIM-9J Sidewinder',
  '{aim-9b}': 'AIM-9B Sidewinder',
  'catm-9m': 'CATM-9M Captive Sidewinder',
  'lau-115_2*lau-127_aim-9m': '2x AIM-9M Sidewinder (LAU-115)',
  'lau-115_2*lau-127_aim-9x': '2x AIM-9X Sidewinder (LAU-115)',
  'lau-115_lau-127_aim-9m': 'AIM-9M Sidewinder (LAU-115)',
  'lau-115_lau-127_aim-9x': 'AIM-9X Sidewinder (LAU-115)',
  'lau-105_1*aim-9m_l': 'AIM-9M Sidewinder (LAU-105 Left)',
  'lau-105_1*aim-9m_r': 'AIM-9M Sidewinder (LAU-105 Right)',
  'lau-105_1*aim-9l_l': 'AIM-9L Sidewinder (LAU-105 Left)',
  'lau-105_1*aim-9l_r': 'AIM-9L Sidewinder (LAU-105 Right)',
  'lau-105_2*aim-9l': '2x AIM-9L Sidewinder (LAU-105)',
  'lau-105_1*catm-9m_l': 'CATM-9M Captive Sidewinder (Left)',
  'lau-105_1*catm-9m_r': 'CATM-9M Captive Sidewinder (Right)',
  'lau-105_2*catm-9m': '2x CATM-9M Captive Sidewinder (LAU-105)',
  '{db434044-f5d0-4f1f-9ba9-b73027e18dd3}': '2x AIM-9M Sidewinder (LAU-105)',

  // Air-to-Air Missiles (AIM-7 Sparrow & AIM-54 Phoenix)
  '{8d399dda-ff81-4f14-904d-099b34fe7918}': 'AIM-7M Sparrow',
  '{lau-115 - aim-7m}': 'AIM-7M Sparrow (LAU-115)',
  '{lau-115 - aim-7f}': 'AIM-7F Sparrow (LAU-115)',
  '{lau-115 - aim-7mh}': 'AIM-7MH Sparrow (LAU-115)',
  '{lau-115 - aim-7p}': 'AIM-7P Sparrow (LAU-115)',
  '{lau-115 - aim-7e}': 'AIM-7E Sparrow (LAU-115)',
  'hb-aim-7e': 'AIM-7E Sparrow',
  'hb-aim-7e-2': 'AIM-7E-2 Sparrow',
  '{aim-7f}': 'AIM-7F Sparrow',
  '{aim-7e}': 'AIM-7E Sparrow',
  '{aim-7mh}': 'AIM-7MH Sparrow',
  '{aim-7p}': 'AIM-7P Sparrow',
  '{aim-54c-mk60}': 'AIM-54C-Mk60 Phoenix',
  'aim_54c_mk60': 'AIM-54C-Mk60 Phoenix',
  '{aim-54c-mk47}': 'AIM-54C-Mk47 Phoenix',
  'aim_54c_mk47': 'AIM-54C-Mk47 Phoenix',
  '{aim-54a-mk60}': 'AIM-54A-Mk60 Phoenix',
  'aim_54a_mk60': 'AIM-54A-Mk60 Phoenix',
  '{aim-54a-mk47}': 'AIM-54A-Mk47 Phoenix',
  'aim_54a_mk47': 'AIM-54A-Mk47 Phoenix',
  '{7575ba0b-7294-4844-857b-031a144b2595}': 'AIM-54A-Mk47 Phoenix',
  '{275a2855-4a79-4b2d-b082-91ea2adf4691}': 'AIM-54A-Mk60 Phoenix',
  '{b4fc81c9-b861-4e87-bbdc-a1158e648ebf}': 'AIM-54C-Mk47 Phoenix',
  '{6c0d552f-570b-42ff-9f6d-f10d9c1d4e1c}': 'AIM-54C-Mk60 Phoenix',

  // JF-17 Weapons & Pods
  'dis_pl-5eii': 'PL-5EII Heat-Seeking AAM',
  'dis_sd-10': 'SD-10 Active Radar AAM',
  'dis_sd-10_dual_l': '2x SD-10 Active Radar AAM (Dual Left)',
  'dis_sd-10_dual_r': '2x SD-10 Active Radar AAM (Dual Right)',
  'dis_ld-10': 'LD-10 Anti-Radiation Missile',
  'dis_ld-10_dual_l': '2x LD-10 Anti-Radiation Missile (Dual Left)',
  'dis_ld-10_dual_r': '2x LD-10 Anti-Radiation Missile (Dual Right)',
  'dis_c-802ak': 'C-802AK Anti-Ship Missile',
  'dis_cm-802akg': 'CM-802AKG MITL Cruise Missile',
  'dis_c-701t': 'C-701T TV-Guided Missile',
  'dis_c-701ir': 'C-701IR IR-Guided Missile',
  'dis_gb6': 'GB-6 Glide Dispenser',
  'dis_gb6_tsp': 'GB-6-SFW Sensor Fuzed Glide Dispenser',
  'dis_gb6_he': 'GB-6-HE Glide Dispenser',
  'dis_ls_6_500': 'LS-6-500 Glide Bomb (500 kg)',
  'dis_ls_6_250': 'LS-6-250 Glide Bomb (250 kg)',
  'dis_ls_6_250_dual_l': '2x LS-6-250 Glide Bomb (Dual Left)',
  'dis_ls_6_250_dual_r': '2x LS-6-250 Glide Bomb (Dual Right)',
  'dis_ls_6_100': 'LS-6-100 Glide Bomb (100 kg)',
  'dis_ls_6_100_dual_l': '2x LS-6-100 Glide Bomb (Dual Left)',
  'dis_ls_6_100_dual_r': '2x LS-6-100 Glide Bomb (Dual Right)',
  'dis_brm1_90': 'BRM-1 90mm Laser-Guided Rockets',
  'dis_rkt_90_ug': '90-1 90mm Unguided Rockets',
  'dis_gbu_10': 'GBU-10 Paveway II (2000 lb)',
  'dis_gbu_12': 'GBU-12 Paveway II (500 lb)',
  'dis_gbu_16': 'GBU-16 Paveway II (1000 lb)',
  'dis_mk_20': 'Mk-20 Rockeye Cluster Bomb',
  'dis_mk_82': 'Mk-82 (500 lb GP)',
  'dis_mk_82s': 'Mk-82 Snakeye (500 lb HD)',
  'dis_mk_83': 'Mk-83 (1000 lb GP)',
  'dis_mk_84': 'Mk-84 (2000 lb GP)',
  'dis_tank800': '800L (210 gal) External Fuel Tank',
  'dis_tank1100': '1100L (290 gal) External Fuel Tank',
  'dis_spj_pod': 'KG600 Self-Protection Jammer Pod',
  'dis_wmd7': 'WMD-7 FLIR/Laser Targeting Pod',
  'dis_akg_dlpod': 'AKG Datalink Pod',

  // Air-to-Ground Missiles (HARM, Maverick, Harpoon, SLAM, JSOW, Hellfire)
  '{b06dd79a-f21e-4eb9-bd9d-ab3844618c93}': 'AGM-88C HARM',
  '{b0dbc591-0f52-4f7d-ad7b-51e67725fb81}': 'AGM-88C HARM (LAU-118)',
  '{dac53a2f-79ca-42ff-a77a-f5649b601308}': '3x AGM-65D Maverick (LAU-88)',
  '{e6a6262a-ca08-4b3d-b030-e1a993b98452}': '2x AGM-65D Maverick (LAU-88 Left)',
  '{e6a6262a-ca08-4b3d-b030-e1a993b98453}': '2x AGM-65D Maverick (LAU-88 Right)',
  '{444ba8ae-82a7-4345-842e-76154efcca46}': 'AGM-65D Maverick',
  'lau_88_agm_65d_one': 'AGM-65D Maverick (LAU-88)',
  'lau_88_agm_65h': 'AGM-65H Maverick (LAU-88)',
  'lau_88_agm_65h_2_l': '2x AGM-65H Maverick (LAU-88 Left)',
  'lau_88_agm_65h_2_r': '2x AGM-65H Maverick (LAU-88 Right)',
  'lau_88_agm_65h_3': '3x AGM-65H Maverick (LAU-88)',
  'lau_117_agm_65d': 'AGM-65D Maverick (LAU-117)',
  'lau_117_agm_65f': 'AGM-65F Maverick (IR)',
  'lau_117_agm_65g': 'AGM-65G Maverick (IIR)',
  'lau_117_agm_65h': 'AGM-65H Maverick (CCD)',
  'lau_117_agm_65k': 'AGM-65K Maverick',
  'lau_117_agm_65l': 'AGM-65L Laser Maverick',
  '{69dc8ae7-8f77-427b-b8aa-b19d3f478b66}': 'AGM-65K Maverick',
  '{f16a4de0-116c-4a71-97f0-2cf85b0313ec}': 'AGM-65E Laser Maverick',
  '{agm_65e}': 'AGM-65E Laser Maverick',
  '{agm_65f}': 'AGM-65F Maverick (IR)',
  '{agm_84d}': 'AGM-84D Harpoon',
  '{af42e6df-9a60-46d8-a9a0-1708b241aadb}': 'AGM-84E SLAM',
  '{agm_84e}': 'AGM-84E SLAM',
  '{agm_84h}': 'AGM-84H SLAM-ER',
  '{agm-154a}': 'AGM-154A JSOW-A',
  '{agm-154c}': 'AGM-154C JSOW-C',
  '{bru55_2*agm-154a}': '2x AGM-154A JSOW (BRU-55)',
  '{bru55_2*agm-154c}': '2x AGM-154C JSOW (BRU-55)',
  '{88d18a5e-99c8-4b04-b40b-1c02f2018b6e}': '4x AGM-114K Hellfire',
  '{agm_114k}': '4x AGM-114K Hellfire',
  '{agm_114l}': '4x AGM-114L Hellfire',
  '{m299_4xagm_114l}': '4x AGM-114L Hellfire',
  '{m299_4xagm_114k}': '4x AGM-114K Hellfire',

  // Guided Bombs (Paveway & JDAM)
  '{db769d48-67d7-42ed-a2be-108d566c8b1e}': 'GBU-12 Paveway II (500 lb)',
  '{0d33ddae-524f-4a4e-b5b8-621754fe3ade}': 'GBU-16 Paveway II (1000 lb)',
  '{51f9aae5-964f-4d21-83fb-502e3bfe5f8a}': 'GBU-10 Paveway II (2000 lb)',
  '{34759bbc-af1e-4aee-a581-498ff7a6ebce}': 'GBU-24 Paveway III (2000 lb)',
  '{gbu-24}': 'GBU-24 Paveway III (2000 lb)',
  '{bru33_2x_gbu-12}': '2x GBU-12 Paveway II (BRU-33)',
  '{bru-33_2*gbu-12}': '2x GBU-12 Paveway II (BRU-33)',
  '{bru-42_2*gbu-12_l}': '2x GBU-12 Paveway II (TER Left)',
  '{bru-42_2*gbu-12_r}': '2x GBU-12 Paveway II (TER Right)',
  '{bru-42_3*gbu-12}': '3x GBU-12 Paveway II (TER)',
  '{ter_9a_2l*gbu-12}': '2x GBU-12 Paveway II (TER-9A Left)',
  '{ter_9a_2r*gbu-12}': '2x GBU-12 Paveway II (TER-9A Right)',
  '{ter_9a_3*gbu-12}': '3x GBU-12 Paveway II (TER-9A)',
  '{gbu-31}': 'GBU-31(V)1/B JDAM (2000 lb)',
  '{gbu_31_v_2b}': 'GBU-31(V)2/B JDAM (2000 lb)',
  '{gbu-31v3b}': 'GBU-31(V)3/B JDAM Penetrator',
  '{gbu_31_v_4b}': 'GBU-31(V)4/B JDAM Penetrator',
  '{gbu_32_v_2b}': 'GBU-32(V)2/B JDAM (1000 lb)',
  '{gbu-38}': 'GBU-38 JDAM (500 lb)',
  '{gbu_54_v_1b}': 'GBU-54 Laser JDAM (500 lb)',
  '{gbu-54}': 'GBU-54 Laser JDAM (500 lb)',
  '{bru55_2*gbu-38}': '2x GBU-38 JDAM (BRU-55)',
  '{bru55_2*gbu-54}': '2x GBU-54 Laser JDAM (BRU-55)',
  '{bru57_2*gbu-38}': '2x GBU-38 JDAM (BRU-57)',
  '{bru57_2*gbu-54}': '2x GBU-54 Laser JDAM (BRU-57)',

  // Unguided & Cluster Bombs
  '{bce4e030-38e9-423e-98ed-24be3da87c32}': 'Mk-82 (500 lb GP)',
  '{ccf898c9-5bc7-49a4-9d1e-c3ed3d5166a1}': 'Mk-82 Snakeye (500 lb HD)',
  '{mk82snakeye}': 'Mk-82 Snakeye (500 lb HD)',
  '{mk82air}': 'Mk-82 AIR Ballute (500 lb HD)',
  '{bru33_2x_mk-82}': '2x Mk-82 (BRU-33)',
  '{bru33_2x_mk-82_snakeye}': '2x Mk-82 Snakeye (BRU-33)',
  '{bru33_2x_mk-82y}': '2x Mk-82 AIR (BRU-33)',
  '{ter_9a_2l*mk-82}': '2x Mk-82 (TER-9A Left)',
  '{ter_9a_2r*mk-82}': '2x Mk-82 (TER-9A Right)',
  '{ter_9a_3*mk-82}': '3x Mk-82 (TER-9A)',
  '{7a44ff09-527c-4b7e-b42b-3f111cfe50fb}': 'Mk-83 (1000 lb GP)',
  '{bru33_2x_mk-83}': '2x Mk-83 (BRU-33)',
  '{ab8b8299-f1cc-4359-89b5-2172e0cf4a5a}': 'Mk-84 (2000 lb GP)',
  '{cbu-87}': 'CBU-87 CEM Cluster Bomb',
  '{5335d97a-35a5-4643-9d9b-026c75961e51}': 'CBU-87 CEM Cluster Bomb',
  '{5335d97a-35a5-4643-9d9b-026c75961e52}': 'CBU-97 SFW Cluster Bomb',
  '{cbu-97}': 'CBU-97 SFW Cluster Bomb',
  '{cbu_99}': 'CBU-99 Rockeye II Cluster Bomb',
  '{bru33_2x_rockeye}': '2x Mk-20 Rockeye (BRU-33)',
  '{cbu_103}': 'CBU-103 WCMD CEM',
  '{cbu_105}': 'CBU-105 WCMD SFW',
  '{bru57_2*cbu-103}': '2x CBU-103 WCMD (BRU-57)',
  '{bru57_2*cbu-105}': '2x CBU-105 WCMD (BRU-57)',

  // Rockets & APKWS
  '{lau-131 - 7 agr-20a}': 'LAU-131 (7x AGR-20A APKWS HE)',
  '{lau-131 - 7 agr-20 m282}': 'LAU-131 (7x AGR-20 M282 APKWS MPP)',
  '{lau-131x2 - 7 agr-20 m282 l}': '2x LAU-131 (14x AGR-20 M282 APKWS, Left)',
  '{lau-131x2 - 7 agr-20 m282 r}': '2x LAU-131 (14x AGR-20 M282 APKWS, Right)',
  '{lau-131x3 - 7 agr-20 m282}': '3x LAU-131 (21x AGR-20 M282 APKWS)',
  '{lau-131x2 - 7 agr-20a l}': '2x LAU-131 (14x AGR-20A APKWS, Left)',
  '{lau-131x2 - 7 agr-20a r}': '2x LAU-131 (14x AGR-20A APKWS, Right)',
  '{lau-131x3 - 7 agr-20a}': '3x LAU-131 (21x AGR-20A APKWS)',

  // Targeting, ECM, HTS & Special Pods
  '{a111396e-d3e8-4b9c-8ac9-2432489304d5}': 'AN/AAQ-28 LITENING Targeting Pod',
  '{aaq-28_left}': 'AN/AAQ-28 LITENING Targeting Pod',
  '{an_aaq_33}': 'AN/AAQ-33 Sniper ATP',
  '{an_asq_228}': 'AN/ASQ-228 ATFLIR Targeting Pod',
  '{f14-lantirn-tp}': 'AN/AAQ-14 LANTIRN Targeting Pod',
  'alq_184': 'AN/ALQ-184 ECM Pod',
  'alq_184_long': 'AN/ALQ-184(V)9 Long ECM Pod',
  '{6d21ecea-f85b-4e8d-9d51-31dc9b8aa4ef}': 'AN/ALQ-131 ECM Pod',
  '{an_asq_213}': 'AN/ASQ-213 HTS Pod',
  '{aww-13}': 'AN/AWW-13 Datalink Pod',
  '{ais_asq_t50}': 'AN/ASQ-T50 TCTS ACMI Pod',
  'mxu-648-tp': 'MXU-648 Travel Pod',
  'hb_f14_ext_eca': 'Expanded Chaff Adapter (ECA)',
  'hb_f14_ext_tarps': 'TARPS Reconnaissance Pod',
  'hb_f14_ext_an_apq-167': 'AN/ALQ-167 ECM Pod',

  // External Fuel Tanks
  '{f376dbee-4cae-41ba-add9-b2910ac95dec}': '370 gal Wing Fuel Tank',
  '{8a0be8ae-58d4-4572-9263-3144c0d06364}': '300 gal Centerline Fuel Tank',
  '{fpu_8a_fuel_tank}': 'FPU-8A 330 gal Fuel Tank',
  '{f14-300gal}': '300 gal External Fuel Tank',
  '{b99ee8a8-99bc-4a8d-89ac-a26831920dce}': '300 gal External Fuel Tank',
  '{f14-300gal-empty}': '300 gal External Fuel Tank (Empty)',
  '{e1f29b21-f291-4589-9fd8-3272eec69506}': 'TK-600 600 gal Fuel Tank',
  '{dft-600gal}': '600 gal External Fuel Tank',
  'fuel_tank_ft600': '600 gal External Fuel Tank',
  '<clean>': 'Empty / Clean',
};

/**
 * Converts a raw DCS weapon CLSID or internal weapon identifier into a clean display name.
 */
export function formatWeaponName(rawWeapon?: string | null): string {
  if (!rawWeapon) return 'Empty';
  const trimmed = String(rawWeapon).trim();
  if (!trimmed || trimmed.toLowerCase() === '<clean>' || trimmed.toLowerCase() === 'empty') {
    return 'Empty';
  }

  // Handle optional quantity prefix e.g. "2x {40EF17B7-...}"
  const qtyPrefixMatch = trimmed.match(/^(\d+x\s+)(.+)$/i);
  if (qtyPrefixMatch) {
    const prefix = qtyPrefixMatch[1];
    const innerClean = formatWeaponName(qtyPrefixMatch[2]);
    if (/^\d+x\s+/i.test(innerClean)) {
      return innerClean;
    }
    return `${prefix}${innerClean}`;
  }

  const lower = trimmed.toLowerCase();
  if (DCS_WEAPON_CLEAN_NAMES[lower]) {
    return DCS_WEAPON_CLEAN_NAMES[lower];
  }

  const withBraces = lower.startsWith('{') ? lower : `{${lower}}`;
  if (DCS_WEAPON_CLEAN_NAMES[withBraces]) {
    return DCS_WEAPON_CLEAN_NAMES[withBraces];
  }

  const withoutBraces = lower.replace(/^\{|\}$/g, '');
  if (DCS_WEAPON_CLEAN_NAMES[withoutBraces]) {
    return DCS_WEAPON_CLEAN_NAMES[withoutBraces];
  }

  // If it's an unrecognized raw GUID like {XXXX-XXXX...}, label cleanly
  if (/^\{?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}?$/i.test(trimmed)) {
    return `Store ${trimmed.replace(/^\{|\}$/g, '').slice(0, 8).toUpperCase()}`;
  }

  // Smart cleanup for internal DCS ID strings (e.g. LAU-115_2*LAU-127_AIM-120C, DIS_..., HB_F14_EXT_...)
  let cleaned = trimmed
    .replace(/^\{|\}$/g, '')
    .replace(/^(DIS_|HB_F14_EXT_|HB_)/i, '')
    .replace(/_DUAL_L$/i, ' (Dual Left)')
    .replace(/_DUAL_R$/i, ' (Dual Right)')
    .replace(/_L$/i, ' (Left)')
    .replace(/_R$/i, ' (Right)')
    .replace(/(\d+)\*/g, '$1x ')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned || trimmed;
}

/**
 * Cleans a formatted_loadout summary string by replacing any embedded raw CLSIDs or IDs with clean names.
 */
export function formatLoadoutSummary(rawSummary?: string | null): string {
  if (!rawSummary) return '';
  return rawSummary
    .split(',')
    .map((part) => {
      const segment = part.trim();
      if (!segment) return '';
      return formatWeaponName(segment);
    })
    .filter(Boolean)
    .join(', ');
}

export interface NormalizedStationLoadoutItem {
  station: string;
  rawWeapon: string;
  weaponName: string;
}

/**
 * Extracts and normalizes aircraft station loadouts from FlightPlanDetail,
 * handling both object maps and 0-indexed Lua arrays where index 0 is null.
 */
export function normalizeStationLoadout(
  stationLoadout?: Record<string, string> | Array<string | null> | null,
  metadataStations?: Record<string, string> | Array<string | null> | null
): NormalizedStationLoadoutItem[] {
  const source =
    stationLoadout && Object.keys(stationLoadout).length > 0
      ? stationLoadout
      : metadataStations;

  if (!source) return [];

  if (Array.isArray(source)) {
    const startAtOne = source.length > 1 && (source[0] === null || source[0] === undefined);
    const items: NormalizedStationLoadoutItem[] = [];
    source.forEach((val, idx) => {
      if (startAtOne && idx === 0) return;
      if (val === null || val === undefined || String(val).trim() === '') return;
      const rawWeapon = String(val).trim();
      const stationNum = startAtOne ? String(idx) : String(idx + 1);
      items.push({
        station: stationNum,
        rawWeapon,
        weaponName: formatWeaponName(rawWeapon),
      });
    });
    return items;
  }

  if (typeof source === 'object') {
    const entries = Object.entries(source);
    const hasNullZero =
      entries.some(([k, v]) => k === '0' && (v === null || v === undefined || v === ''));
    const items: NormalizedStationLoadoutItem[] = [];
    for (const [key, val] of entries) {
      if (hasNullZero && key === '0') continue;
      if (val === null || val === undefined || String(val).trim() === '') continue;
      const rawWeapon = String(val).trim();
      items.push({
        station: key,
        rawWeapon,
        weaponName: formatWeaponName(rawWeapon),
      });
    }
    return items;
  }

  return [];
}


