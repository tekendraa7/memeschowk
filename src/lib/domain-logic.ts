/**
 * Pure domain logic for MemeChowk:
 * 1. Cross-script Nepali/Hinglish/Devanagari query normalization & trigram similarity
 * 2. Enforceable Rights & Commercial Eligibility Matrix
 * 3. Anti-Gaming Time-Decayed Trending Score Calculator
 * 4. Moderation & Auto-Quarantine State Machine (3+ privacy reports -> UNDER_EMERGENCY_REVIEW)
 * 5. Nepal/India Unit Economics Calculator (Cloudflare R2 vs AWS S3)
 */

export type UserRole = 'USER' | 'CREATOR' | 'MODERATOR' | 'ADMIN';

export type MediaType =
  | 'IMAGE_TEMPLATE'
  | 'MEME_IMAGE'
  | 'VIDEO_CLIP'
  | 'GIF'
  | 'AUDIO_DIALOGUE'
  | 'SOUND_EFFECT'
  | 'VOICE_RECORDING'
  | 'CREATOR_PACK';

export type LanguageCode = 'NE' | 'HI' | 'EN' | 'NON_VERBAL';
export type RegionCode = 'NP' | 'IN' | 'SOUTH_ASIA' | 'GLOBAL';

export type ModerationStatus =
  | 'UPLOADED_QUARANTINE'
  | 'PROCESSING'
  | 'PROCESSING_FAILED'
  | 'PENDING_REVIEW'
  | 'UNDER_EMERGENCY_REVIEW'
  | 'APPROVED_PUBLIC'
  | 'REJECTED'
  | 'TAKEDOWN_REMOVED';

export type VariantKind =
  | 'THUMB_WEBP'
  | 'DISPLAY_WEBP'
  | 'ORIGINAL_CLEAN'
  | 'POSTER_WEBP'
  | 'PREVIEW_MP4_360P'
  | 'DOWNLOAD_MP4_720P'
  | 'LOOP_MP4'
  | 'OPTIMIZED_GIF'
  | 'NORMALIZED_MP3'
  | 'PREVIEW_OGG_OPUS';

export type SourceDeclaration =
  | 'ORIGINAL_CREATION'
  | 'LICENSED_OR_PUBLIC_DOMAIN'
  | 'THIRD_PARTY_REACTION_CONTEXT';

export type ReuseTier =
  | 'CC0_PUBLIC_DOMAIN'
  | 'CC_BY_4_0'
  | 'CREATOR_AUTHORIZED_COMMERCIAL'
  | 'CREATOR_NON_COMMERCIAL'
  | 'PERSONAL_MEME_ONLY_UNKNOWN_RIGHTS'
  | 'PROHIBITED';

export interface AssetVariant {
  id: string;
  assetId: string;
  kind: VariantKind;
  label: string;
  mimeType: string;
  extension: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  durationMs?: number;
  isReady: boolean;
}

export interface RightsRecord {
  sourceDeclaration: SourceDeclaration;
  sourceUrl?: string;
  creatorAttributionName: string;
  creatorAttributionUrl?: string;
  attributionRequired: boolean;
  moderatorVerifiedRights: boolean;
  reuseTier: ReuseTier;
  commercialEligible: boolean;
  notes?: string;
}

export interface SearchAlias {
  id: string;
  rawAlias: string;
  normalizedAlias: string;
  scriptType: 'LATIN' | 'DEVANAGARI';
  isCurated: boolean;
}

export interface AssetReport {
  id: string;
  assetId: string;
  reasonCategory: 'COPYRIGHT_OR_UNCREDITED_CREATOR' | 'PRIVATE_PERSON_OR_NON_CONSENSUAL' | 'HARASSMENT_OR_HATE_SPEECH' | 'NSFW_OR_VIOLENCE';
  details: string;
  reporterEmail?: string;
  createdAt: string;
  status: 'OPEN' | 'RESOLVED_REMOVED' | 'RESOLVED_DISMISSED';
}

export interface ModerationActionRecord {
  id: string;
  assetId: string;
  moderatorName: string;
  actionType: 'APPROVE' | 'REJECT' | 'TAKEDOWN' | 'EDIT_RIGHTS' | 'EMERGENCY_LOCK';
  reason: string;
  createdAt: string;
}

export interface AudioSynthProfile {
  baseFreq: number;
  notes: number[];
  tempoBpm: number;
  timbre: 'dialogue_ne' | 'dialogue_hi' | 'madal_beat' | 'synth_horn' | 'crowd_gasp' | 'cricket_cheer' | 'sigh_slide' | 'coin_rain';
}

export interface MemeAsset {
  id: string;
  slug: string;
  title: string;
  mediaType: MediaType;
  language: LanguageCode;
  region: RegionCode;
  category: string;
  emotion: string;
  transcriptDeva: string;
  transcriptRoman: string;
  englishContextNote: string;
  originalMimeType: string;
  originalSizeBytes: number;
  width: number;
  height: number;
  durationMs?: number;
  waveformPeaks: number[]; // 48 integers [10..100]
  sha256Hash: string;
  perceptualHash: string;
  uploaderUid?: string;
  uploaderName: string;
  uploaderHandle: string;
  parentAssetId?: string;
  parentAssetTitle?: string;
  moderationStatus: ModerationStatus;
  rejectionReason?: string;
  publishedAt: string;
  viewCount: number;
  downloadCount: number;
  likeCount: number;
  favoriteCount?: number;
  shareCount?: number;
  remixCount: number;
  trendingScore: number;
  isExplorationSlot?: boolean;
  autoDetectedLanguageReason?: string;
  posterPalette: {
    bgPrimary: string;
    bgSecondary: string;
    accent: string;
    illustrationType: 'shocked_student' | 'life_sigh' | 'panic_bro' | 'money_rain' | 'dal_bhat' | 'hostel_exam' | 'chai_guff' | 'coding_bug' | 'cricket_six' | 'rickshaw_horn' | 'momos_plate' | 'microbus_jam';
  };
  audioProfile?: AudioSynthProfile;
  mediaDataUrl?: string; // Preserves the exact original user-uploaded audio/video/GIF/image DataURL or ObjectURL
  originalFileName?: string;
  thumbnailDataUrl?: string; // Optional custom cover thumbnail image specifically for Audio clips
  thumbnailFileName?: string;
  variants: AssetVariant[];
  rightsRecord: RightsRecord;
  searchAliases: SearchAlias[];
  tags: string[];
  reports: AssetReport[];
}

/**
 * Normalizes Romanized Nepali, Hinglish, and Devanagari queries so
 * "K ho yo!!", "ke ho yoo", "keho yo", and "के हो यो" map cleanly against SearchAlias.
 */
export function normalizeRegionalQuery(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ');

  return cleaned
    .replace(/\b(ke)\b/g, 'k')
    .replace(/\b(keho)\b/g, 'k ho')
    .replace(/\b(chha|xa|xan|chhan)\b/g, 'cha')
    .replace(/\b(yestai)\b/g, 'yastai')
    .replace(/\b(zindagi)\b/g, 'jindagi')
    .replace(/\b(arey)\b/g, 'are')
    .replace(/\b(kr)\b/g, 'kar')
    .replace(/\b(rha)\b/g, 'raha')
    .replace(/\b(yr)\b/g, 'yaar')
    .replace(/aa+/g, 'a')
    .replace(/ee+/g, 'i')
    .replace(/oo+/g, 'u')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Computes PostgreSQL pg_trgm equivalent character 3-gram Jaccard similarity [0..1]
 */
export function computeTrigramSimilarity(a: string, b: string): number {
  const normA = normalizeRegionalQuery(a);
  const normB = normalizeRegionalQuery(b);
  if (!normA || !normB) return 0;
  if (normA === normB) return 1.0;

  const getTrigrams = (str: string): Set<string> => {
    const padded = `  ${str} `;
    const trigrams = new Set<string>();
    for (let i = 0; i <= padded.length - 3; i++) {
      trigrams.add(padded.slice(i, i + 3));
    }
    return trigrams;
  };

  const setA = getTrigrams(normA);
  const setB = getTrigrams(normB);
  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export interface SearchFilterCriteria {
  query?: string;
  language?: LanguageCode | 'ALL';
  region?: RegionCode | 'ALL';
  mediaType?: MediaType | 'ALL';
  category?: string | 'ALL';
  emotion?: string | 'ALL';
  commercialOnly?: boolean;
}

/**
 * Searches ONLY APPROVED_PUBLIC assets using the 3-Layer Hybrid Search Pipeline:
 * Match A: Exact or Prefix match on SearchAlias.normalizedAlias (Weight 1.0)
 * Match B: Full-Text / Substring match on title, transcriptDeva, transcriptRoman (Weight 0.8)
 * Match C: Trigram similarity > 0.30 for typos / shorthand (Weight 0.5)
 */
export function searchApprovedCatalog(
  catalog: MemeAsset[],
  filters: SearchFilterCriteria
): MemeAsset[] {
  const rawQuery = (filters.query ?? '').trim();
  const normQuery = normalizeRegionalQuery(rawQuery);

  // Hard filter: NEVER return unapproved, quarantined, rejected, or takedown-removed assets
  const eligible = catalog.filter((asset) => {
    if (asset.moderationStatus !== 'APPROVED_PUBLIC') return false;
    if (filters.language && filters.language !== 'ALL' && asset.language !== filters.language) {
      return false;
    }
    if (filters.region && filters.region !== 'ALL' && asset.region !== filters.region) {
      return false;
    }
    if (filters.mediaType && filters.mediaType !== 'ALL' && asset.mediaType !== filters.mediaType) {
      return false;
    }
    if (filters.category && filters.category !== 'ALL' && asset.category !== filters.category) {
      return false;
    }
    if (filters.emotion && filters.emotion !== 'ALL' && asset.emotion !== filters.emotion) {
      return false;
    }
    if (filters.commercialOnly && !asset.rightsRecord.commercialEligible) {
      return false;
    }
    return true;
  });

  if (!normQuery) {
    return [...eligible].sort((a, b) => b.trendingScore - a.trendingScore);
  }

  const scored: Array<{ asset: MemeAsset; score: number }> = [];

  for (const asset of eligible) {
    let textMatchScore = 0;

    for (const alias of asset.searchAliases) {
      const normAlias = normalizeRegionalQuery(alias.normalizedAlias || alias.rawAlias);
      if (normAlias === normQuery || alias.rawAlias.trim() === rawQuery) {
        textMatchScore = Math.max(textMatchScore, 1.0);
      } else if (normAlias.startsWith(normQuery) || normAlias.includes(normQuery)) {
        textMatchScore = Math.max(textMatchScore, 0.88);
      } else {
        const sim = computeTrigramSimilarity(normAlias, normQuery);
        if (sim >= 0.30) {
          textMatchScore = Math.max(textMatchScore, sim * 0.72);
        }
      }
    }

    const titleNorm = normalizeRegionalQuery(asset.title);
    const romanNorm = normalizeRegionalQuery(asset.transcriptRoman);
    const devaRaw = asset.transcriptDeva.trim();
    const contextNorm = normalizeRegionalQuery(asset.englishContextNote);

    if (
      titleNorm.includes(normQuery) ||
      romanNorm.includes(normQuery) ||
      devaRaw.includes(rawQuery) ||
      contextNorm.includes(normQuery)
    ) {
      textMatchScore = Math.max(textMatchScore, 0.82);
    } else {
      const maxFieldSim = Math.max(
        computeTrigramSimilarity(titleNorm, normQuery),
        computeTrigramSimilarity(romanNorm, normQuery),
        computeTrigramSimilarity(devaRaw, rawQuery)
      );
      if (maxFieldSim >= 0.30) {
        textMatchScore = Math.max(textMatchScore, maxFieldSim * 0.65);
      }
    }

    for (const tag of asset.tags) {
      if (normalizeRegionalQuery(tag).includes(normQuery)) {
        textMatchScore = Math.max(textMatchScore, 0.75);
      }
    }

    if (textMatchScore > 0) {
      const popularityBoost = Math.min(asset.trendingScore / 200, 0.25);
      const compositeScore = textMatchScore * 0.75 + popularityBoost;
      scored.push({ asset, score: compositeScore });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.asset);
}

export interface RightsEvaluationInput {
  sourceDeclaration: SourceDeclaration;
  moderatorVerifiedRights: boolean;
  requestedReuseTier?: ReuseTier;
}

export interface RightsEvaluationResult {
  reuseTier: ReuseTier;
  commercialEligible: boolean;
  badgeText: string;
}

/**
 * Enforces the hard rule that an uploader checkbox alone NEVER grants
 * commercial reuse eligibility for third-party or unverified uploads.
 */
export function evaluateAssetRights(input: RightsEvaluationInput): RightsEvaluationResult {
  if (input.sourceDeclaration === 'THIRD_PARTY_REACTION_CONTEXT') {
    return {
      reuseTier: 'PERSONAL_MEME_ONLY_UNKNOWN_RIGHTS',
      commercialEligible: false,
      badgeText: 'Editorial / Personal Context Only — Unknown Third-Party Rights',
    };
  }

  if (!input.moderatorVerifiedRights) {
    return {
      reuseTier: 'CREATOR_NON_COMMERCIAL',
      commercialEligible: false,
      badgeText: 'Community Upload — Personal & Social Share OK (Unverified Commercial)',
    };
  }

  if (input.requestedReuseTier === 'CC0_PUBLIC_DOMAIN') {
    return {
      reuseTier: 'CC0_PUBLIC_DOMAIN',
      commercialEligible: true,
      badgeText: 'Verified Public Domain (CC0) — Commercial & Remix OK',
    };
  }

  if (input.requestedReuseTier === 'CC_BY_4_0') {
    return {
      reuseTier: 'CC_BY_4_0',
      commercialEligible: true,
      badgeText: 'Verified CC-BY 4.0 — Commercial & Remix OK with Attribution',
    };
  }

  if (input.requestedReuseTier === 'CREATOR_AUTHORIZED_COMMERCIAL') {
    return {
      reuseTier: 'CREATOR_AUTHORIZED_COMMERCIAL',
      commercialEligible: true,
      badgeText: 'Original Creator Verified — Commercial & Remix OK',
    };
  }

  return {
    reuseTier: 'CREATOR_NON_COMMERCIAL',
    commercialEligible: false,
    badgeText: 'Creator Non-Commercial License',
  };
}

export interface TrendingScoreInput {
  uniqueDownloads7d: number;
  uniqueRemixes7d: number;
  uniqueSaves7d: number;
  uniquePreviews7d: number;
  hoursSincePublished: number;
  gravity?: number;
}

/**
 * Computes the Anti-Gaming Time-Decayed Trending Formula:
 * Score = (5*D + 4*R + 3*S + 1*P) / (T_hours + 2)^G
 */
export function calculateTrendingScore(input: TrendingScoreInput): number {
  const G = input.gravity ?? 1.5;
  const numerator =
    5.0 * Math.max(0, input.uniqueDownloads7d) +
    4.0 * Math.max(0, input.uniqueRemixes7d) +
    3.0 * Math.max(0, input.uniqueSaves7d) +
    1.0 * Math.max(0, input.uniquePreviews7d);
  const denominator = Math.pow(Math.max(0, input.hoursSincePublished) + 2, G);
  return Number((numerator / denominator).toFixed(2));
}

/**
 * Enforces auto-quarantine threshold: if an asset accumulates >= 3
 * PRIVATE_PERSON_OR_NON_CONSENSUAL reports, it transitions to UNDER_EMERGENCY_REVIEW.
 */
export function evaluateEmergencyReportStatus(
  currentStatus: ModerationStatus,
  reports: AssetReport[]
): ModerationStatus {
  if (currentStatus === 'TAKEDOWN_REMOVED' || currentStatus === 'REJECTED') {
    return currentStatus;
  }
  const openPrivacyReports = reports.filter(
    (r) =>
      r.status === 'OPEN' &&
      r.reasonCategory === 'PRIVATE_PERSON_OR_NON_CONSENSUAL'
  );
  if (openPrivacyReports.length >= 3) {
    return 'UNDER_EMERGENCY_REVIEW';
  }
  return currentStatus;
}

/**
 * Validates role permissions for admin moderation actions.
 */
export function canPerformModeration(role: UserRole): boolean {
  return role === 'MODERATOR' || role === 'ADMIN';
}

/**
 * Checks whether an asset variant can be downloaded publicly.
 */
export function verifyDownloadEligibility(
  asset: MemeAsset | undefined,
  variantId: string
): { allowed: boolean; httpStatus: number; reason?: string; variant?: AssetVariant } {
  if (!asset) {
    return { allowed: false, httpStatus: 404, reason: 'Asset not found' };
  }
  if (asset.moderationStatus === 'TAKEDOWN_REMOVED') {
    return {
      allowed: false,
      httpStatus: 410,
      reason: '410 Gone — Media removed via copyright or privacy takedown',
    };
  }
  if (asset.moderationStatus !== 'APPROVED_PUBLIC') {
    return {
      allowed: false,
      httpStatus: 404,
      reason: '404 Not Found — Asset is in quarantine or pending moderation review',
    };
  }
  const variant = asset.variants.find((v) => v.id === variantId);
  if (!variant || !variant.isReady) {
    return {
      allowed: false,
      httpStatus: 404,
      reason: 'Requested file variant is not ready or does not exist',
    };
  }
  return { allowed: true, httpStatus: 200, variant };
}

/**
 * Calculates monthly storage and egress bandwidth cost comparison (Cloudflare R2 vs AWS S3)
 */
export function calculateMonthlyInfraCosts(params: {
  monthlyActiveVisitors: number;
  totalApprovedAssets: number;
  vpsUsd: number;
  moderationNpr: number;
}) {
  const storageGb = (params.totalApprovedAssets * 1.5) / 1024;
  const bandwidthGb = (params.monthlyActiveVisitors * 3.5 * 2.1) / 1024; // ~2.1 sessions/user
  const r2StorageUsd = storageGb <= 10 ? 0 : (storageGb - 10) * 0.015;
  const r2BandwidthUsd = 0; // $0/GB egress on Cloudflare R2
  const awsS3BandwidthUsd = bandwidthGb * 0.09; // $0.09/GB egress on AWS S3
  const totalUsdR2 = params.vpsUsd + r2StorageUsd + r2BandwidthUsd + 1.5;
  const totalNprR2 = Math.round(totalUsdR2 * 135 + params.moderationNpr);
  return {
    storageGb: Number(storageGb.toFixed(2)),
    bandwidthGb: Number(bandwidthGb.toFixed(1)),
    r2StorageUsd: Number(r2StorageUsd.toFixed(2)),
    awsS3BandwidthUsd: Number(awsS3BandwidthUsd.toFixed(2)),
    totalUsdR2: Number(totalUsdR2.toFixed(2)),
    totalNprR2,
  };
}

export interface TrendingTagEntry {
  id: string;
  tag: string;
  devaLabel?: string;
  normalizedKey: string;
  language: LanguageCode;
  searchHits: number;
  recentSessionBoost: number;
  lastSearchedAt: number;
}

export const INITIAL_TRENDING_TAGS: TrendingTagEntry[] = [
  {
    id: 'tt-k-ho-yo',
    tag: 'k ho yo',
    devaLabel: 'के हो यो',
    normalizedKey: 'k ho yo',
    language: 'NE',
    searchHits: 142,
    recentSessionBoost: 0,
    lastSearchedAt: 1700000001,
  },
  {
    id: 'tt-arey-bhai',
    tag: 'arey bhai',
    devaLabel: 'अरे भाई',
    normalizedKey: 'are bhai',
    language: 'HI',
    searchHits: 128,
    recentSessionBoost: 0,
    lastSearchedAt: 1700000002,
  },
  {
    id: 'tt-paisa',
    tag: 'paisa hi paisa',
    devaLabel: 'पैसा ही पैसा',
    normalizedKey: 'paisa hi paisa',
    language: 'HI',
    searchHits: 115,
    recentSessionBoost: 0,
    lastSearchedAt: 1700000003,
  },
  {
    id: 'tt-yastai-cha',
    tag: 'yastai cha jindagi',
    devaLabel: 'यस्तै छ जिन्दगी',
    normalizedKey: 'yastai cha jindagi',
    language: 'NE',
    searchHits: 98,
    recentSessionBoost: 0,
    lastSearchedAt: 1700000004,
  },
  {
    id: 'tt-dal-bhat',
    tag: 'dal bhat power',
    devaLabel: 'दाल भात पावर',
    normalizedKey: 'dal bhat power',
    language: 'NE',
    searchHits: 84,
    recentSessionBoost: 0,
    lastSearchedAt: 1700000005,
  },
  {
    id: 'tt-chiya-guff',
    tag: 'chiya guff',
    devaLabel: 'चिया गफ',
    normalizedKey: 'chiya guff',
    language: 'NE',
    searchHits: 76,
    recentSessionBoost: 0,
    lastSearchedAt: 1700000006,
  },
  {
    id: 'tt-code-chalyo',
    tag: 'code chalyo',
    devaLabel: 'कोड त चल्यो',
    normalizedKey: 'code chalyo',
    language: 'NE',
    searchHits: 69,
    recentSessionBoost: 0,
    lastSearchedAt: 1700000007,
  },
  {
    id: 'tt-chhakka',
    tag: 'chhakka',
    devaLabel: 'छक्का',
    normalizedKey: 'chhakka',
    language: 'NON_VERBAL',
    searchHits: 64,
    recentSessionBoost: 0,
    lastSearchedAt: 1700000008,
  },
];

/**
 * Records a user search query and dynamically updates or inserts a TrendingTagEntry.
 * Matches Romanized and Devanagari equivalents against both the existing tag list
 * and the approved asset catalog's SearchAliases.
 */
export function recordUserSearchQuery(
  currentTags: TrendingTagEntry[],
  rawQuery: string,
  catalog: MemeAsset[] = [],
  activeLanguage: LanguageCode | 'ALL' = 'ALL',
  timestamp = Date.now()
): TrendingTagEntry[] {
  const trimmed = rawQuery.trim();
  if (trimmed.length < 2) return currentTags;

  const normQuery = normalizeRegionalQuery(trimmed);
  if (!normQuery) return currentTags;

  // Check if the query matches an existing trending tag (by normalizedKey, devaLabel, or trigram similarity >= 0.65)
  let matchedIndex = currentTags.findIndex(
    (item) =>
      item.normalizedKey === normQuery ||
      item.devaLabel === trimmed ||
      normalizeRegionalQuery(item.tag) === normQuery ||
      computeTrigramSimilarity(item.normalizedKey, normQuery) >= 0.65
  );

  // Also check if the query matches an approved asset's SearchAlias so "के हो यो" maps to "k ho yo"
  if (matchedIndex === -1 && catalog.length > 0) {
    const matchedAsset = catalog.find(
      (a) =>
        a.moderationStatus === 'APPROVED_PUBLIC' &&
        a.searchAliases.some(
          (al) =>
            normalizeRegionalQuery(al.normalizedAlias || al.rawAlias) === normQuery ||
            al.rawAlias.trim() === trimmed
        )
    );
    if (matchedAsset) {
      matchedIndex = currentTags.findIndex((item) =>
        matchedAsset.searchAliases.some(
          (al) =>
            normalizeRegionalQuery(al.normalizedAlias || al.rawAlias) === item.normalizedKey ||
            al.rawAlias.trim() === item.devaLabel
        )
      );
    }
  }

  if (matchedIndex !== -1) {
    return currentTags.map((item, idx) =>
      idx === matchedIndex
        ? {
            ...item,
            searchHits: item.searchHits + 1,
            recentSessionBoost: item.recentSessionBoost + 25,
            lastSearchedAt: timestamp,
          }
        : item
    );
  }

  // Otherwise insert a new dynamic trending tag from the user's live search query
  const isDeva = /[\u0900-\u097F]/.test(trimmed);
  const inferredLang: LanguageCode =
    activeLanguage !== 'ALL' ? activeLanguage : isDeva ? 'NE' : 'NE';

  const newEntry: TrendingTagEntry = {
    id: `tt-dyn-${normQuery.replace(/\s+/g, '-')}`,
    tag: trimmed.toLowerCase(),
    devaLabel: isDeva ? trimmed : undefined,
    normalizedKey: normQuery,
    language: inferredLang,
    searchHits: 1,
    recentSessionBoost: 45, // Fresh user query bubbles into the active trending strip
    lastSearchedAt: timestamp,
  };

  return [newEntry, ...currentTags];
}

/**
 * Ranks and filters Trending Tags dynamically based on:
 * 1. Current live search query context (matching or related tags bubble to the front)
 * 2. Selected language filter (if set)
 * 3. Combined score = searchHits + recentSessionBoost + recency tie-breaker
 */
export function computeDynamicTrendingTags(
  tags: TrendingTagEntry[],
  options: {
    currentQuery?: string;
    language?: LanguageCode | 'ALL';
    limit?: number;
  } = {}
): Array<TrendingTagEntry & { isQueryMatch: boolean; score: number }> {
  const normCurrent = normalizeRegionalQuery(options.currentQuery ?? '');
  const rawCurrent = (options.currentQuery ?? '').trim();
  const limit = options.limit ?? 8;

  const filtered = tags.filter((t) => {
    if (options.language && options.language !== 'ALL' && t.language !== options.language) {
      return false;
    }
    return true;
  });

  const scored = filtered.map((t) => {
    let queryRelevanceBoost = 0;
    let isQueryMatch = false;

    if (normCurrent.length >= 1) {
      if (
        t.normalizedKey === normCurrent ||
        t.devaLabel === rawCurrent ||
        t.normalizedKey.includes(normCurrent) ||
        (t.devaLabel && t.devaLabel.includes(rawCurrent))
      ) {
        queryRelevanceBoost = 250;
        isQueryMatch = true;
      } else {
        const sim = computeTrigramSimilarity(t.normalizedKey, normCurrent);
        if (sim >= 0.25) {
          queryRelevanceBoost = Math.round(sim * 160);
          isQueryMatch = true;
        }
      }
    }

    const score = t.searchHits + t.recentSessionBoost + queryRelevanceBoost;
    return {
      ...t,
      isQueryMatch,
      score,
    };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.lastSearchedAt - a.lastSearchedAt;
  });

  return scored.slice(0, limit);
}

/**
 * ============================================================================
 * AUTOMATED DUPLICATE DETECTION & DIRECT AUTO-PUBLISH ENGINE (NO MODERATOR GATE)
 * ============================================================================
 */

export interface DuplicateCheckCandidate {
  fileName: string;
  sizeBytes: number;
  sha256Hash: string;
  title?: string;
  durationMs?: number;
}

export type DuplicateMatchReason =
  | 'EXACT_SHA256_HASH'
  | 'FILENAME_AND_BYTE_SIZE'
  | 'NORMALIZED_TITLE_AND_SIZE'
  | 'BATCH_INTERNAL_DUPLICATE';

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  reason: DuplicateMatchReason | null;
  matchedAssetId?: string;
  matchedAssetTitle?: string;
}

/**
 * Automatically checks whether an uploaded audio/media file is a duplicate of an
 * existing active asset in the catalog without requiring human moderator review.
 */
export function checkDuplicateAssetUpload(
  candidate: DuplicateCheckCandidate,
  existingAssets: MemeAsset[]
): DuplicateCheckResult {
  const activeCatalog = existingAssets.filter(
    (a) => a.moderationStatus !== 'REJECTED' && a.moderationStatus !== 'TAKEDOWN_REMOVED'
  );

  const cleanCandidateFile = candidate.fileName.trim().toLowerCase();
  const baseTitle =
    candidate.title?.trim() ||
    candidate.fileName.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').trim();
  const normCandidateTitle = normalizeRegionalQuery(baseTitle);

  for (const asset of activeCatalog) {
    // 1. Exact SHA-256 cryptographic content hash match (catches identical audio even if renamed)
    if (
      candidate.sha256Hash &&
      asset.sha256Hash &&
      candidate.sha256Hash.toLowerCase() === asset.sha256Hash.toLowerCase()
    ) {
      return {
        isDuplicate: true,
        reason: 'EXACT_SHA256_HASH',
        matchedAssetId: asset.id,
        matchedAssetTitle: asset.title,
      };
    }

    // 2. Identical original filename + exact byte size match
    if (
      cleanCandidateFile &&
      asset.originalFileName &&
      asset.originalFileName.trim().toLowerCase() === cleanCandidateFile &&
      candidate.sizeBytes > 0 &&
      asset.originalSizeBytes === candidate.sizeBytes
    ) {
      return {
        isDuplicate: true,
        reason: 'FILENAME_AND_BYTE_SIZE',
        matchedAssetId: asset.id,
        matchedAssetTitle: asset.title,
      };
    }

    // 3. Normalized regional title + exact byte size match
    if (
      normCandidateTitle.length >= 2 &&
      normalizeRegionalQuery(asset.title) === normCandidateTitle &&
      candidate.sizeBytes > 0 &&
      asset.originalSizeBytes === candidate.sizeBytes
    ) {
      return {
        isDuplicate: true,
        reason: 'NORMALIZED_TITLE_AND_SIZE',
        matchedAssetId: asset.id,
        matchedAssetTitle: asset.title,
      };
    }
  }

  return {
    isDuplicate: false,
    reason: null,
  };
}

/**
 * Evaluates a multi-file batch upload against both the existing catalog and earlier
 * files within the same selection/drop batch so duplicate files are automatically filtered out.
 */
export function evaluateBatchUploadCandidates<T extends DuplicateCheckCandidate>(
  candidates: T[],
  existingAssets: MemeAsset[]
): {
  accepted: T[];
  skippedDuplicates: Array<{ candidate: T; duplicateInfo: DuplicateCheckResult }>;
} {
  const accepted: T[] = [];
  const skippedDuplicates: Array<{ candidate: T; duplicateInfo: DuplicateCheckResult }> = [];
  const seenHashesInBatch = new Map<string, string>();
  const seenFileSizeKeysInBatch = new Map<string, string>();

  for (const candidate of candidates) {
    // First check against existing catalog assets
    const catalogCheck = checkDuplicateAssetUpload(candidate, existingAssets);
    if (catalogCheck.isDuplicate) {
      skippedDuplicates.push({ candidate, duplicateInfo: catalogCheck });
      continue;
    }

    // Next check if the same file was selected twice within this multi-file batch
    const hashKey = candidate.sha256Hash.trim().toLowerCase();
    const fileSizeKey = `${candidate.fileName.trim().toLowerCase()}::${candidate.sizeBytes}`;

    if (hashKey && seenHashesInBatch.has(hashKey)) {
      skippedDuplicates.push({
        candidate,
        duplicateInfo: {
          isDuplicate: true,
          reason: 'BATCH_INTERNAL_DUPLICATE',
          matchedAssetTitle: seenHashesInBatch.get(hashKey),
        },
      });
      continue;
    }

    if (candidate.sizeBytes > 0 && seenFileSizeKeysInBatch.has(fileSizeKey)) {
      skippedDuplicates.push({
        candidate,
        duplicateInfo: {
          isDuplicate: true,
          reason: 'BATCH_INTERNAL_DUPLICATE',
          matchedAssetTitle: seenFileSizeKeysInBatch.get(fileSizeKey),
        },
      });
      continue;
    }

    if (hashKey) {
      seenHashesInBatch.set(hashKey, candidate.title || candidate.fileName);
    }
    if (candidate.sizeBytes > 0) {
      seenFileSizeKeysInBatch.set(fileSizeKey, candidate.title || candidate.fileName);
    }

    accepted.push(candidate);
  }

  return { accepted, skippedDuplicates };
}

const ACCENT_PALETTES = [
  { bgPrimary: '#1E1B4B', bgSecondary: '#0F172A', accent: '#10B981' },
  { bgPrimary: '#1E293B', bgSecondary: '#0F172A', accent: '#FFB800' },
  { bgPrimary: '#31102F', bgSecondary: '#181124', accent: '#F43F5E' },
  { bgPrimary: '#172554', bgSecondary: '#0F172A', accent: '#38BDF8' },
  { bgPrimary: '#14332A', bgSecondary: '#0D1F1A', accent: '#34D399' },
] as const;

/**
 * Automatically detects the appropriate MediaType from an uploaded file's name and MIME type.
 */
export function detectMediaTypeFromFile(fileName: string, mimeType: string): MediaType {
  const lowerName = fileName.trim().toLowerCase();
  const lowerMime = (mimeType || '').trim().toLowerCase();

  if (lowerMime === 'image/gif' || lowerName.endsWith('.gif')) {
    return 'GIF';
  }
  if (
    lowerMime.startsWith('video/') ||
    /\.(mp4|webm|mov|mkv|avi)$/i.test(lowerName)
  ) {
    return 'VIDEO_CLIP';
  }
  if (
    lowerMime.startsWith('image/') ||
    /\.(png|jpe?g|webp|svg)$/i.test(lowerName)
  ) {
    return 'IMAGE_TEMPLATE';
  }
  return 'AUDIO_DIALOGUE';
}

/**
 * Returns true ONLY for Audio media types (AUDIO_DIALOGUE, SOUND_EFFECT, VOICE_RECORDING)
 * because Audio clips benefit from a custom visual thumbnail, whereas Meme Videos and GIFs
 * render their own frames/loops directly and do not require a separate thumbnail upload.
 */
export function requiresCustomThumbnailOption(mediaType: MediaType): boolean {
  return (
    mediaType === 'AUDIO_DIALOGUE' ||
    mediaType === 'SOUND_EFFECT' ||
    mediaType === 'VOICE_RECORDING'
  );
}

/**
 * ============================================================================
 * AUTO-LANGUAGE DETECTION & REGIONAL LANGUAGE ORGANIZATION ENGINE
 * ============================================================================
 */

export interface LanguageDetectionResult {
  language: LanguageCode;
  region: RegionCode;
  confidence: number;
  detectedScript: 'DEVANAGARI_NE' | 'DEVANAGARI_HI' | 'ROMANIZED_NEPALI' | 'HINGLISH' | 'ENGLISH' | 'SFX';
  matchedSignals: string[];
  badgeLabel: string;
}

const NEPALI_DEVANAGARI_MARKERS = [
  'के हो', 'यो', 'यस्तै', 'जिन्दगी', 'दाल', 'भात', 'चिया', 'गफ', 'साथी', 'दाइ',
  'भाइ', 'दिदी', 'बहिनी', 'कस्तो', 'राम्रो', 'छैन', 'हुन्छ', 'भयो', 'गयो', 'आयो',
  'खायो', 'चल्छ', 'चल्यो', 'नेपाल', 'नेपाली', 'मम', 'मादल', 'सोल्टी', 'हजुर',
  'आमा', 'बुवा', 'तिमी', 'हाम्रो', 'मेरो', 'तिम्रो', 'गर्ने', 'भनेको', 'लामो',
  'बबाल', 'कडा', 'पैसा त', 'होइन', 'हैन', 'कहाँ', 'किन', 'कसरी', 'छक्का', 'ल है'
];

const HINDI_DEVANAGARI_MARKERS = [
  'अरे', 'भाई', 'पैसा', 'क्या', 'कर', 'रहा', 'है', 'हैं', 'नहीं', 'अच्छा',
  'रुको', 'ज़रा', 'जरा', 'सब्र', 'करो', 'ख़त्म', 'खतम', 'टाटा', 'बाय', 'साले',
  'भईया', 'भैया', 'यार', 'मस्त', 'बढ़िया', 'गजब', 'जुगाड़', 'चाय', 'पापा',
  'मम्मी', 'बेटा', 'देखा', 'देखो', 'बोल', 'बाबू', 'राजू', 'श्याम', 'सिस्टम'
];

const NEPALI_ROMAN_MARKERS = [
  'k ho', 'ke ho', 'keho', 'yo', 'yastai', 'yestai', 'cha', 'chha', 'xa', 'xan',
  'chhan', 'jindagi', 'dal bhat', 'chiya', 'guff', 'momo', 'momos', 'dai', 'didi',
  'bahini', 'solti', 'soltini', 'kasto', 'ramro', 'haina', 'hoina', 'babal',
  'kada', 'chalyo', 'aayo', 'gayo', 'khayo', 'bhayo', 'sathi', 'timro', 'mero',
  'hamro', 'hajur', 'nepal', 'nepali', 'ktm', 'kathmandu', 'dhangadhi', 'pokhara',
  'dharan', 'butwal', 'chitwan', 'madal', 'microbus', 'koteshwor', 'kalanki',
  'garne', 'bhaneko', 'huncha', 'hunxa', 'xaina', 'chaina', 'chhaina', 'la hai',
  'aama', 'buwa', 'kaka', 'mama', 'geda', 'muji', 'laamo', 'bro nepal'
];

const HINDI_ROMAN_MARKERS = [
  'arey', 'are bhai', 'bhai', 'bhaisahab', 'yaar', 'yr', 'paisa', 'kya', 'kar',
  'raha', 'rha', 'hai', 'hain', 'nahi', 'nhi', 'accha', 'achha', 'theek', 'mast',
  'badiya', 'gajab', 'gazab', 'jugaad', 'chai', 'ruko', 'zara', 'sabar', 'karo',
  'khatam', 'tata', 'bye bye', 'abey', 'saale', 'chutiya', 'bakchod', 'systumm',
  'elvish', 'babu rao', 'raju', 'shyam', 'hera pheri', 'hindi', 'india', 'desi',
  'bollywood', 'dekho', 'dekha', 'laparwahi', 'natiija', 'jalwa', 'mirzapur',
  'gangs of', 'panchayat', 'binod', 'dekisugi'
];

const SFX_MARKERS = [
  'sfx', 'sound effect', 'horn', 'rickshaw', 'bell', 'thud', 'boom', 'vine boom',
  'laugh', 'applause', 'cheer', 'crowd', 'chhakka', 'sixer', 'drum', 'beat',
  'clap', 'whistle', 'gasp', 'scream', 'beep', 'whoosh', 'ding', 'siren'
];

const ENGLISH_MARKERS = [
  'when', 'pov', 'me when', 'my face', 'teacher', 'exam', 'hostel', 'coding',
  'bug', 'production', 'deploy', 'deadline', 'salary', 'client', 'template',
  'reaction', 'monday', 'weekend', 'interview', 'developer', 'engineer', 'student'
];

/**
 * Automatically detects the primary LanguageCode ('NE' | 'HI' | 'EN' | 'NON_VERBAL')
 * and RegionCode ('NP' | 'IN' | 'SOUTH_ASIA' | 'GLOBAL') from title, filename,
 * transcripts, and aliases.
 */
export function autoDetectAssetLanguageAndRegion(input: {
  title?: string;
  fileName?: string;
  transcriptDeva?: string;
  transcriptRoman?: string;
  aliases?: string[];
  mediaType?: MediaType;
}): LanguageDetectionResult {
  const combinedRaw = [
    input.title ?? '',
    (input.fileName ?? '').replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' '),
    input.transcriptDeva ?? '',
    input.transcriptRoman ?? '',
    ...(input.aliases ?? []),
  ]
    .join(' ')
    .trim();

  const lowerRaw = combinedRaw.toLowerCase();
  const normText = ` ${normalizeRegionalQuery(combinedRaw)} `;
  const hasDevanagari = /[\u0900-\u097F]/.test(combinedRaw);

  let neScore = 0;
  let hiScore = 0;
  let sfxScore = 0;
  let enScore = 0;
  const matchedSignals: string[] = [];

  if (input.mediaType === 'SOUND_EFFECT') {
    sfxScore += 3;
    matchedSignals.push('mediaType:SOUND_EFFECT');
  }

  for (const m of NEPALI_DEVANAGARI_MARKERS) {
    if (combinedRaw.includes(m)) {
      neScore += 4;
      matchedSignals.push(m);
    }
  }

  for (const m of HINDI_DEVANAGARI_MARKERS) {
    if (combinedRaw.includes(m)) {
      hiScore += 4;
      matchedSignals.push(m);
    }
  }

  for (const m of NEPALI_ROMAN_MARKERS) {
    const regex = new RegExp(`\\b${m.replace(/\s+/g, '\\s+')}\\b`, 'i');
    if (regex.test(lowerRaw) || regex.test(normText)) {
      neScore += 3;
      matchedSignals.push(m);
    }
  }

  for (const m of HINDI_ROMAN_MARKERS) {
    const regex = new RegExp(`\\b${m.replace(/\s+/g, '\\s+')}\\b`, 'i');
    if (regex.test(lowerRaw) || regex.test(normText)) {
      hiScore += 3;
      matchedSignals.push(m);
    }
  }

  for (const m of SFX_MARKERS) {
    const regex = new RegExp(`\\b${m.replace(/\s+/g, '\\s+')}\\b`, 'i');
    if (regex.test(lowerRaw)) {
      sfxScore += 3.5;
      matchedSignals.push(m);
    }
  }

  for (const m of ENGLISH_MARKERS) {
    const regex = new RegExp(`\\b${m.replace(/\s+/g, '\\s+')}\\b`, 'i');
    if (regex.test(lowerRaw)) {
      enScore += 2;
      matchedSignals.push(m);
    }
  }

  // If Devanagari script is present and neither NE nor HI had specific lexical matches,
  // check common Devanagari morphological endings (छ, को, ले, लाई -> NE; है, का, की, को -> HI)
  if (hasDevanagari && neScore === 0 && hiScore === 0) {
    if (/[छखग]/.test(combinedRaw) || /(को|ले|लाई|बाट|हरू)/.test(combinedRaw)) {
      neScore += 2.5;
      matchedSignals.push('Devanagari Nepali suffix');
    } else if (/(है|हैं|का|की|में|से)/.test(combinedRaw)) {
      hiScore += 2.5;
      matchedSignals.push('Devanagari Hindi suffix');
    } else {
      neScore += 2;
      matchedSignals.push('Devanagari script');
    }
  }

  const maxScore = Math.max(neScore, hiScore, sfxScore, enScore);

  if (sfxScore > 0 && sfxScore >= maxScore && neScore < 4 && hiScore < 4) {
    return {
      language: 'NON_VERBAL',
      region: 'SOUTH_ASIA',
      confidence: Math.min(0.98, 0.65 + sfxScore * 0.06),
      detectedScript: 'SFX',
      matchedSignals: matchedSignals.slice(0, 4),
      badgeLabel: '🔊 Auto-Detected: Sound Effect (NON_VERBAL)',
    };
  }

  if (hiScore > neScore && hiScore >= enScore) {
    return {
      language: 'HI',
      region: 'IN',
      confidence: Math.min(0.99, 0.65 + hiScore * 0.05),
      detectedScript: hasDevanagari ? 'DEVANAGARI_HI' : 'HINGLISH',
      matchedSignals: matchedSignals.slice(0, 4),
      badgeLabel: '🇮🇳 Auto-Detected: Hindi / Hinglish (HI · IN)',
    };
  }

  if (neScore >= hiScore && neScore > 0) {
    return {
      language: 'NE',
      region: 'NP',
      confidence: Math.min(0.99, 0.65 + neScore * 0.05),
      detectedScript: hasDevanagari ? 'DEVANAGARI_NE' : 'ROMANIZED_NEPALI',
      matchedSignals: matchedSignals.slice(0, 4),
      badgeLabel: '🇳🇵 Auto-Detected: Nepali (NE · NP)',
    };
  }

  if (enScore > 0) {
    return {
      language: 'EN',
      region: 'SOUTH_ASIA',
      confidence: Math.min(0.95, 0.6 + enScore * 0.07),
      detectedScript: 'ENGLISH',
      matchedSignals: matchedSignals.slice(0, 4),
      badgeLabel: '🇬🇧 Auto-Detected: South Asian English (EN)',
    };
  }

  // Default fallback for regional Nepal/India platform
  return {
    language: 'NE',
    region: 'NP',
    confidence: 0.55,
    detectedScript: 'ROMANIZED_NEPALI',
    matchedSignals: ['regional-default'],
    badgeLabel: '🇳🇵 Auto-Detected: Nepali Regional (NE · NP)',
  };
}

export interface LanguageOrganizedShelf {
  language: LanguageCode;
  flag: string;
  label: string;
  nativeLabel: string;
  subtitle: string;
  assets: MemeAsset[];
}

/**
 * Organizes public assets cleanly into language-specific shelves so users can browse
 * Nepali, Hindi/Hinglish, South Asian English, and Sound Effects in dedicated sections.
 */
export function organizeCatalogByLanguage(assets: MemeAsset[]): LanguageOrganizedShelf[] {
  const shelfMeta: Array<{
    language: LanguageCode;
    flag: string;
    label: string;
    nativeLabel: string;
    subtitle: string;
  }> = [
    {
      language: 'NE',
      flag: '🇳🇵',
      label: 'Nepali Memes & Dialogues',
      nativeLabel: 'नेपाली संवाद र मिम',
      subtitle: 'Nepali viral reactions, chiya guff dialogues, and Kathmandu/Dhangadhi hostel templates',
    },
    {
      language: 'HI',
      flag: '🇮🇳',
      label: 'Hindi & Hinglish Reactions',
      nativeLabel: 'हिन्दी और हिंग्लिश मीम',
      subtitle: 'Desi streamer punchlines, iconic Bollywood/comedy dialogues, and Hinglish templates',
    },
    {
      language: 'EN',
      flag: '🇬🇧',
      label: 'South Asian English',
      nativeLabel: 'English Campus & Tech Memes',
      subtitle: 'Engineering hostel life, coding bugs, exam deadlines, and relatable English templates',
    },
    {
      language: 'NON_VERBAL',
      flag: '🔊',
      label: 'Universal SFX & Non-Verbal',
      nativeLabel: 'ध्वनि प्रभाव र प्रतिक्रिया',
      subtitle: 'Cricket sixer cheers, madal beats, rickshaw horns, and visual reaction loops',
    },
  ];

  return shelfMeta
    .map((meta) => ({
      ...meta,
      assets: assets
        .filter((a) => a.language === meta.language)
        .sort((a, b) => b.trendingScore - a.trendingScore),
    }))
    .filter((shelf) => shelf.assets.length > 0);
}

/**
 * Re-scans a catalog of assets and organizes each item into its auto-detected language & region
 * when strong linguistic signals are present.
 */
export function reorganizeCatalogWithAutoLanguage(assets: MemeAsset[]): {
  updatedAssets: MemeAsset[];
  reclassifiedCount: number;
} {
  let reclassifiedCount = 0;
  const updatedAssets = assets.map((asset) => {
    const detection = autoDetectAssetLanguageAndRegion({
      title: asset.title,
      fileName: asset.originalFileName,
      transcriptDeva: asset.transcriptDeva,
      transcriptRoman: asset.transcriptRoman,
      aliases: asset.searchAliases.map((s) => s.rawAlias),
      mediaType: asset.mediaType,
    });

    if (detection.confidence >= 0.7 && detection.language !== asset.language) {
      reclassifiedCount++;
      return {
        ...asset,
        language: detection.language,
        region: detection.region,
        autoDetectedLanguageReason: detection.badgeLabel,
      };
    }
    return {
      ...asset,
      autoDetectedLanguageReason: asset.autoDetectedLanguageReason || detection.badgeLabel,
    };
  });

  return { updatedAssets, reclassifiedCount };
}

/**
 * ============================================================================
 * PUBLIC ENGAGEMENT (LIKES, FAVORITES, SHARES, DOWNLOADS) & ROLE PERMISSIONS
 * ============================================================================
 */

export type EngagementActionType =
  | 'LIKE'
  | 'UNLIKE'
  | 'FAVORITE'
  | 'UNFAVORITE'
  | 'SHARE'
  | 'DOWNLOAD'
  | 'VIEW';

/**
 * Applies a public user engagement event (Like, Favorite, Share, Download, View)
 * to a MemeAsset and recalculates its live public trendingScore.
 */
export function recordAssetEngagement(
  asset: MemeAsset,
  action: EngagementActionType
): MemeAsset {
  let likeCount = asset.likeCount ?? 0;
  let favoriteCount = asset.favoriteCount ?? 0;
  let shareCount = asset.shareCount ?? 0;
  let downloadCount = asset.downloadCount ?? 0;
  let viewCount = asset.viewCount ?? 0;

  switch (action) {
    case 'LIKE':
      likeCount += 1;
      break;
    case 'UNLIKE':
      likeCount = Math.max(0, likeCount - 1);
      break;
    case 'FAVORITE':
      favoriteCount += 1;
      break;
    case 'UNFAVORITE':
      favoriteCount = Math.max(0, favoriteCount - 1);
      break;
    case 'SHARE':
      shareCount += 1;
      break;
    case 'DOWNLOAD':
      downloadCount += 1;
      break;
    case 'VIEW':
      viewCount += 1;
      break;
  }

  // Boost trending score based on public engagement metrics
  const engagementScore =
    downloadCount * 5 +
    shareCount * 4 +
    favoriteCount * 3.5 +
    likeCount * 3 +
    (asset.remixCount ?? 0) * 4 +
    Math.min(viewCount, 500) * 0.2;

  const updatedTrendingScore = Number(
    Math.max(asset.trendingScore, 25 + engagementScore * 0.6).toFixed(1)
  );

  return {
    ...asset,
    likeCount,
    favoriteCount,
    shareCount,
    downloadCount,
    viewCount,
    trendingScore: updatedTrendingScore,
  };
}

export interface PublicViralityStatus {
  tier: 'VIRAL_PUBLIC_HIT' | 'RISING_PUBLIC' | 'PUBLIC_LIVE';
  label: string;
  totalInteractions: number;
  isPubliclyAccessibleToFriends: boolean;
}

/**
 * Evaluates an asset's public status and community engagement velocity from
 * Likes, Favorites, Shares, and Downloads.
 */
export function computeAssetPublicViralityStatus(asset: MemeAsset): PublicViralityStatus {
  const likes = asset.likeCount ?? 0;
  const favorites = asset.favoriteCount ?? 0;
  const shares = asset.shareCount ?? 0;
  const downloads = asset.downloadCount ?? 0;
  const totalInteractions = likes + favorites + shares + downloads;
  const isPublic = asset.moderationStatus === 'APPROVED_PUBLIC';

  if (totalInteractions >= 15 || asset.trendingScore >= 75) {
    return {
      tier: 'VIRAL_PUBLIC_HIT',
      label: '🔥 Public Viral Hit',
      totalInteractions,
      isPubliclyAccessibleToFriends: isPublic,
    };
  }
  if (totalInteractions >= 4) {
    return {
      tier: 'RISING_PUBLIC',
      label: '📈 Rising Public Upload',
      totalInteractions,
      isPubliclyAccessibleToFriends: isPublic,
    };
  }
  return {
    tier: 'PUBLIC_LIVE',
    label: '🌐 Public (Shared with Friends)',
    totalInteractions,
    isPubliclyAccessibleToFriends: isPublic,
  };
}

export interface RolePermissionMatrix {
  role: UserRole;
  displayLabel: string;
  canUploadToPublic: boolean;
  canInteractPublicly: boolean;
  canDeleteOwnUpload: boolean;
  canAccessAdminConsole: boolean;
  canApproveOrRejectQuarantine: boolean;
  canTakedownAnyAsset: boolean;
  canVerifyCommercialRights: boolean;
}

/**
 * Enforces strict separation between Public Users/Creators and Platform Admins/Moderators.
 */
export function getRolePermissions(role: UserRole): RolePermissionMatrix {
  if (role === 'ADMIN' || role === 'MODERATOR') {
    return {
      role,
      displayLabel: role === 'ADMIN' ? 'Platform Admin' : 'Regional Moderator',
      canUploadToPublic: true,
      canInteractPublicly: true,
      canDeleteOwnUpload: true,
      canAccessAdminConsole: role === 'ADMIN',
      canApproveOrRejectQuarantine: true,
      canTakedownAnyAsset: true,
      canVerifyCommercialRights: true,
    };
  }

  return {
    role,
    displayLabel: 'Public Creator',
    canUploadToPublic: true,
    canInteractPublicly: true,
    canDeleteOwnUpload: true,
    canAccessAdminConsole: false,
    canApproveOrRejectQuarantine: false,
    canTakedownAnyAsset: false,
    canVerifyCommercialRights: false,
  };
}

export interface AdminAccessVerificationResult {
  allowed: boolean;
  httpStatus: 200 | 401 | 403;
  reason: string;
}

/**
 * Enforces that the `/admin` panel is strictly accessible only to users with the `'ADMIN'` role
 * who have passed server-side permission verification or Firestore security rule enforcement.
 */
export function verifyAdminPanelAccess(params: {
  user: { uid?: string; handle?: string; email?: string; role?: UserRole } | null;
  serverVerifiedAdmin?: boolean;
  firestoreVerifiedAdmin?: boolean;
}): AdminAccessVerificationResult {
  const { user, serverVerifiedAdmin = false, firestoreVerifiedAdmin = false } = params;
  if (!user || !user.uid) {
    return {
      allowed: false,
      httpStatus: 401,
      reason: 'HTTP 401 Unauthorized: You must sign in with an ADMIN account to access /admin.',
    };
  }
  if (user.role !== 'ADMIN') {
    return {
      allowed: false,
      httpStatus: 403,
      reason: `HTTP 403 Forbidden: Access to /admin is restricted to users with the ADMIN role (current role: ${user.role || 'USER'}).`,
    };
  }
  if (!serverVerifiedAdmin && !firestoreVerifiedAdmin) {
    return {
      allowed: false,
      httpStatus: 403,
      reason:
        'HTTP 403 Forbidden: Server-side permission check and Firestore security rule verification rejected unverified ADMIN claim.',
    };
  }
  return {
    allowed: true,
    httpStatus: 200,
    reason: 'Verified ADMIN access granted.',
  };
}

/**
 * Links a persistent user's credentials (`uid`, `displayName`, `handle`) to all of their
 * uploaded assets across page reloads so ownership and attribution remain intact.
 */
export function linkUserCredentialsToUploadedAssets(
  catalog: MemeAsset[],
  user: { uid: string; displayName: string; handle: string } | null
): MemeAsset[] {
  if (!user || !user.uid || !user.handle) return catalog;
  const normalizedHandle = user.handle.trim().replace(/^@/, '').toLowerCase();
  let changed = false;

  const updated = catalog.map((asset) => {
    const assetHandle = (asset.uploaderHandle || '').trim().replace(/^@/, '').toLowerCase();
    const matchesUid = Boolean(asset.uploaderUid && asset.uploaderUid === user.uid);
    const matchesHandle = Boolean(normalizedHandle && assetHandle === normalizedHandle);

    if (!matchesUid && !matchesHandle) {
      return asset;
    }

    if (
      asset.uploaderUid === user.uid &&
      asset.uploaderHandle === normalizedHandle &&
      asset.uploaderName === user.displayName
    ) {
      return asset;
    }

    changed = true;
    return {
      ...asset,
      uploaderUid: user.uid,
      uploaderName: user.displayName,
      uploaderHandle: normalizedHandle,
    };
  });

  return changed ? updated : catalog;
}

/**
 * Builds an immediately playable, auto-approved (`APPROVED_PUBLIC`) MemeAsset
 * (Audio, Meme Video, Animated GIF, or Meme Template) from an uploaded file
 * without requiring moderator approval, and automatically detects its language & region.
 */
export function buildAutoApprovedSoundboardAsset(params: {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256Hash: string;
  mediaDataUrl: string;
  durationMs: number;
  waveformPeaks: number[];
  title?: string;
  transcriptDeva?: string;
  transcriptRoman?: string;
  language?: LanguageCode | 'AUTO';
  region?: RegionCode | 'AUTO';
  category?: string;
  emotion?: string;
  mediaType?: MediaType;
  thumbnailDataUrl?: string;
  thumbnailFileName?: string;
  aliases?: string[];
  paletteIndex?: number;
  uploaderUid?: string;
  uploaderName?: string;
  uploaderHandle?: string;
}): MemeAsset {
  const cleanBaseName = params.fileName
    .replace(/\.[^/.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .trim();
  const resolvedMediaType =
    params.mediaType ?? detectMediaTypeFromFile(params.fileName, params.mimeType);
  const finalTitle = params.title?.trim() || cleanBaseName || 'Original Meme Clip';
  const finalRoman = params.transcriptRoman?.trim() || finalTitle;
  const finalDeva = params.transcriptDeva?.trim() || finalTitle;

  const autoDetected = autoDetectAssetLanguageAndRegion({
    title: finalTitle,
    fileName: params.fileName,
    transcriptDeva: finalDeva,
    transcriptRoman: finalRoman,
    aliases: params.aliases,
    mediaType: resolvedMediaType,
  });

  const resolvedLanguage: LanguageCode =
    !params.language || params.language === 'AUTO'
      ? autoDetected.language
      : params.language;

  const resolvedRegion: RegionCode =
    !params.region || params.region === 'AUTO'
      ? autoDetected.region
      : params.region;

  const ext = params.fileName.includes('.')
    ? params.fileName.split('.').pop()?.toLowerCase() || 'mp3'
    : resolvedMediaType === 'GIF'
    ? 'gif'
    : resolvedMediaType === 'VIDEO_CLIP'
    ? 'mp4'
    : 'mp3';
  const normSlug =
    normalizeRegionalQuery(finalTitle).replace(/\s+/g, '-') || 'meme-clip';
  const palette =
    ACCENT_PALETTES[(params.paletteIndex ?? 0) % ACCENT_PALETTES.length];

  const rawAliases = Array.from(
    new Set([finalRoman, finalDeva, cleanBaseName, ...(params.aliases ?? [])].filter(Boolean))
  );

  // Only attach custom thumbnailDataUrl for Audio media types (not necessary for Video/GIF)
  const useThumbnail = requiresCustomThumbnailOption(resolvedMediaType);

  const creatorName = params.uploaderName?.trim() || 'Creator (@you_chowk)';
  const creatorHandle =
    params.uploaderHandle?.trim().replace(/^@/, '') || 'you_chowk';

  const variants: AssetVariant[] =
    resolvedMediaType === 'GIF'
      ? [
          {
            id: `var-gif-${params.id}`,
            assetId: params.id,
            kind: 'OPTIMIZED_GIF',
            label: `Animated Meme GIF (${params.fileName})`,
            mimeType: 'image/gif',
            extension: 'gif',
            sizeBytes: params.sizeBytes,
            width: 1080,
            height: 1080,
            isReady: true,
          },
        ]
      : resolvedMediaType === 'VIDEO_CLIP'
      ? [
          {
            id: `var-vid-${params.id}`,
            assetId: params.id,
            kind: 'DOWNLOAD_MP4_720P',
            label: `Original Meme Video (${params.fileName})`,
            mimeType: params.mimeType || 'video/mp4',
            extension: ext,
            sizeBytes: params.sizeBytes,
            durationMs: params.durationMs,
            width: 1080,
            height: 1080,
            isReady: true,
          },
          {
            id: `var-orig-${params.id}`,
            assetId: params.id,
            kind: 'NORMALIZED_MP3',
            label: `Video Audio Track (${params.fileName})`,
            mimeType: params.mimeType || 'video/mp4',
            extension: ext,
            sizeBytes: params.sizeBytes,
            durationMs: params.durationMs,
            isReady: true,
          },
        ]
      : resolvedMediaType === 'IMAGE_TEMPLATE' || resolvedMediaType === 'MEME_IMAGE'
      ? [
          {
            id: `var-img-${params.id}`,
            assetId: params.id,
            kind: 'ORIGINAL_CLEAN',
            label: `Original Meme Image (${params.fileName})`,
            mimeType: params.mimeType || 'image/png',
            extension: ext,
            sizeBytes: params.sizeBytes,
            width: 1080,
            height: 1080,
            isReady: true,
          },
        ]
      : [
          {
            id: `var-orig-${params.id}`,
            assetId: params.id,
            kind: 'NORMALIZED_MP3',
            label: `Original Uploaded Audio (${params.fileName})`,
            mimeType: params.mimeType || 'audio/mpeg',
            extension: ext,
            sizeBytes: params.sizeBytes,
            durationMs: params.durationMs,
            isReady: true,
          },
        ];

  return {
    id: params.id,
    slug: `${normSlug}-${params.id.slice(-5)}`,
    title: finalTitle,
    mediaType: resolvedMediaType,
    language: resolvedLanguage,
    region: resolvedRegion,
    category:
      params.category ??
      (resolvedMediaType === 'GIF'
        ? 'Reaction GIFs'
        : resolvedMediaType === 'VIDEO_CLIP'
        ? 'Meme Videos'
        : 'Original Soundboard Upload'),
    emotion: params.emotion ?? 'Custom Original Media',
    transcriptDeva: finalDeva,
    transcriptRoman: finalRoman,
    englishContextNote: `Original uploaded ${resolvedMediaType.replace('_', ' ').toLowerCase()} (${params.fileName}) by @${creatorHandle} — auto-organized to ${resolvedLanguage} (${resolvedRegion}) and published to shared public catalog.`,
    originalMimeType: params.mimeType || 'audio/mpeg',
    originalSizeBytes: params.sizeBytes,
    mediaDataUrl: params.mediaDataUrl,
    originalFileName: params.fileName,
    thumbnailDataUrl: useThumbnail ? params.thumbnailDataUrl : undefined,
    thumbnailFileName: useThumbnail ? params.thumbnailFileName : undefined,
    width: 1080,
    height: 1080,
    durationMs: params.durationMs,
    waveformPeaks:
      Array.isArray(params.waveformPeaks) && params.waveformPeaks.length > 0
        ? params.waveformPeaks
        : Array.from({ length: 48 }, (_, i) => 24 + ((i * 19) % 68)),
    sha256Hash: params.sha256Hash,
    perceptualHash: `phash-${params.sha256Hash.slice(0, 16)}`,
    uploaderUid: params.uploaderUid || `user-${creatorHandle}`,
    uploaderName: creatorName,
    uploaderHandle: creatorHandle,
    moderationStatus: 'APPROVED_PUBLIC',
    publishedAt: new Date().toISOString(),
    viewCount: 1,
    downloadCount: 0,
    likeCount: 1,
    favoriteCount: 0,
    shareCount: 0,
    remixCount: 0,
    trendingScore: 34,
    autoDetectedLanguageReason: autoDetected.badgeLabel,
    posterPalette: {
      bgPrimary: palette.bgPrimary,
      bgSecondary: palette.bgSecondary,
      accent: palette.accent,
      illustrationType: 'shocked_student',
    },
    variants,
    rightsRecord: {
      sourceDeclaration: 'ORIGINAL_CREATION',
      creatorAttributionName: `${creatorName} (@${creatorHandle})`,
      attributionRequired: true,
      moderatorVerifiedRights: true,
      reuseTier: 'CREATOR_AUTHORIZED_COMMERCIAL',
      commercialEligible: true,
    },
    searchAliases: rawAliases.map((alias, idx) => ({
      id: `al-${params.id}-${idx}`,
      rawAlias: alias,
      normalizedAlias: normalizeRegionalQuery(alias),
      scriptType: /[\u0900-\u097F]/.test(alias) ? 'DEVANAGARI' : 'LATIN',
      isCurated: true,
    })),
    tags: [
      'original-upload',
      'auto-verified',
      resolvedLanguage.toLowerCase(),
      resolvedMediaType.toLowerCase(),
      normalizeRegionalQuery(finalTitle),
    ].filter(Boolean),
    reports: [],
  };
}



