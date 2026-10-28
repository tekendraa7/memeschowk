import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeRegionalQuery,
  computeTrigramSimilarity,
  searchApprovedCatalog,
  evaluateAssetRights,
  calculateTrendingScore,
  evaluateEmergencyReportStatus,
  canPerformModeration,
  verifyDownloadEligibility,
  MemeAsset,
} from './domain-logic';

const mockAssetApproved: MemeAsset = {
  id: 'asset-ke-ho-yo',
  slug: 'ke-ho-yo-bhai-reaction',
  title: 'Ke Ho Yo Bhai?! (Shocked Nepali Reaction)',
  mediaType: 'AUDIO_DIALOGUE',
  language: 'NE',
  region: 'NP',
  category: 'College & Exams',
  emotion: 'Shocked / Confused',
  transcriptDeva: 'के हो यो भाई, यस्तो पनि हुन्छ र?',
  transcriptRoman: 'Ke ho yo bhai, yasto pani huncha ra?',
  englishContextNote: 'Used when reacting to an absurd exam question or unexpected plot twist.',
  originalMimeType: 'audio/mpeg',
  originalSizeBytes: 55296,
  width: 1080,
  height: 1080,
  durationMs: 3400,
  waveformPeaks: Array.from({ length: 48 }, (_, i) => 25 + ((i * 17) % 70)),
  sha256Hash: 'a1b2c3d4e5f6',
  perceptualHash: 'f0e1d2c3b4a59687',
  uploaderName: 'Aarav Thapa',
  uploaderHandle: 'aarav_ktm',
  moderationStatus: 'APPROVED_PUBLIC',
  publishedAt: new Date().toISOString(),
  viewCount: 1420,
  downloadCount: 380,
  likeCount: 215,
  remixCount: 44,
  trendingScore: 48.5,
  posterPalette: {
    bgPrimary: '#1E293B',
    bgSecondary: '#0F172A',
    accent: '#FFB800',
    illustrationType: 'shocked_student',
  },
  variants: [
    {
      id: 'var-mp3-1',
      assetId: 'asset-ke-ho-yo',
      kind: 'NORMALIZED_MP3',
      label: 'Normalized Audio (-16 LUFS)',
      mimeType: 'audio/wav',
      extension: 'wav',
      sizeBytes: 55296,
      durationMs: 3400,
      isReady: true,
    },
    {
      id: 'var-unready',
      assetId: 'asset-ke-ho-yo',
      kind: 'PREVIEW_OGG_OPUS',
      label: 'Opus Low-Data',
      mimeType: 'audio/ogg',
      extension: 'ogg',
      sizeBytes: 18400,
      durationMs: 3400,
      isReady: false,
    },
  ],
  rightsRecord: {
    sourceDeclaration: 'ORIGINAL_CREATION',
    creatorAttributionName: 'Aarav Thapa (@aarav_ktm)',
    attributionRequired: true,
    moderatorVerifiedRights: true,
    reuseTier: 'CREATOR_AUTHORIZED_COMMERCIAL',
    commercialEligible: true,
  },
  searchAliases: [
    { id: 'al-1', rawAlias: 'k ho yo', normalizedAlias: 'k ho yo', scriptType: 'LATIN', isCurated: true },
    { id: 'al-2', rawAlias: 'ke ho yo', normalizedAlias: 'k ho yo', scriptType: 'LATIN', isCurated: true },
    { id: 'al-3', rawAlias: 'के हो यो', normalizedAlias: 'के हो यो', scriptType: 'DEVANAGARI', isCurated: true },
  ],
  tags: ['nepali', 'exam', 'confused', 'shocked'],
  reports: [],
};

const mockAssetQuarantine: MemeAsset = {
  ...mockAssetApproved,
  id: 'asset-quarantine-99',
  slug: 'unapproved-secret-clip',
  title: 'Unapproved Hostel Clip',
  moderationStatus: 'UPLOADED_QUARANTINE',
};

test('Check 3 & 5: Cross-script regional search matches Romanized ("k ho yo", "ke ho yo") and Devanagari ("के हो यो") while hiding quarantined uploads', () => {
  const catalog = [mockAssetApproved, mockAssetQuarantine];

  const resRomanShorthand = searchApprovedCatalog(catalog, { query: 'k ho yo' });
  assert.equal(resRomanShorthand.length, 1);
  assert.equal(resRomanShorthand[0].id, 'asset-ke-ho-yo');

  const resRomanFull = searchApprovedCatalog(catalog, { query: 'Ke Ho Yoo!!' });
  assert.equal(resRomanFull.length, 1);
  assert.equal(resRomanFull[0].id, 'asset-ke-ho-yo');

  const resDevanagari = searchApprovedCatalog(catalog, { query: 'के हो यो' });
  assert.equal(resDevanagari.length, 1);
  assert.equal(resDevanagari[0].id, 'asset-ke-ho-yo');

  // Unapproved quarantine item must never appear in search results
  const resQuarantine = searchApprovedCatalog(catalog, { query: 'Unapproved Hostel' });
  assert.equal(resQuarantine.length, 0);
});

test('Check 4: Normal users cannot perform admin moderation operations', () => {
  assert.equal(canPerformModeration('USER'), false);
  assert.equal(canPerformModeration('CREATOR'), false);
  assert.equal(canPerformModeration('MODERATOR'), true);
  assert.equal(canPerformModeration('ADMIN'), true);
});

test('Check 7 & 9: Download verification enforces APPROVED_PUBLIC, blocks TAKEDOWN_REMOVED with 410, and rejects unready variants', () => {
  // Valid ready variant on approved asset
  const okCheck = verifyDownloadEligibility(mockAssetApproved, 'var-mp3-1');
  assert.equal(okCheck.allowed, true);
  assert.equal(okCheck.httpStatus, 200);

  // Unready variant must be blocked
  const unreadyCheck = verifyDownloadEligibility(mockAssetApproved, 'var-unready');
  assert.equal(unreadyCheck.allowed, false);
  assert.equal(unreadyCheck.httpStatus, 404);

  // Quarantined asset must return 404
  const quarantineCheck = verifyDownloadEligibility(mockAssetQuarantine, 'var-mp3-1');
  assert.equal(quarantineCheck.allowed, false);
  assert.equal(quarantineCheck.httpStatus, 404);

  // Takedown removed asset must immediately return 410 Gone
  const takedownAsset: MemeAsset = {
    ...mockAssetApproved,
    moderationStatus: 'TAKEDOWN_REMOVED',
  };
  const takedownCheck = verifyDownloadEligibility(takedownAsset, 'var-mp3-1');
  assert.equal(takedownCheck.allowed, false);
  assert.equal(takedownCheck.httpStatus, 410);
});

test('Check 9: Enforceable Rights Matrix hard-locks THIRD_PARTY_REACTION_CONTEXT and unverified uploads to commercialEligible = false', () => {
  const thirdParty = evaluateAssetRights({
    sourceDeclaration: 'THIRD_PARTY_REACTION_CONTEXT',
    moderatorVerifiedRights: true, // Even if someone tries to pass true
    requestedReuseTier: 'CC0_PUBLIC_DOMAIN',
  });
  assert.equal(thirdParty.commercialEligible, false);
  assert.equal(thirdParty.reuseTier, 'PERSONAL_MEME_ONLY_UNKNOWN_RIGHTS');

  const unverifiedCreator = evaluateAssetRights({
    sourceDeclaration: 'ORIGINAL_CREATION',
    moderatorVerifiedRights: false,
    requestedReuseTier: 'CREATOR_AUTHORIZED_COMMERCIAL',
  });
  assert.equal(unverifiedCreator.commercialEligible, false);
  assert.equal(unverifiedCreator.reuseTier, 'CREATOR_NON_COMMERCIAL');

  const verifiedCreator = evaluateAssetRights({
    sourceDeclaration: 'ORIGINAL_CREATION',
    moderatorVerifiedRights: true,
    requestedReuseTier: 'CREATOR_AUTHORIZED_COMMERCIAL',
  });
  assert.equal(verifiedCreator.commercialEligible, true);
  assert.equal(verifiedCreator.reuseTier, 'CREATOR_AUTHORIZED_COMMERCIAL');
});

test('Auto-Quarantine Threshold transitions asset to UNDER_EMERGENCY_REVIEW after 3 privacy reports', () => {
  const reports = [
    {
      id: 'r1',
      assetId: 'asset-ke-ho-yo',
      reasonCategory: 'PRIVATE_PERSON_OR_NON_CONSENSUAL' as const,
      details: 'Private classmate voice clip',
      createdAt: new Date().toISOString(),
      status: 'OPEN' as const,
    },
    {
      id: 'r2',
      assetId: 'asset-ke-ho-yo',
      reasonCategory: 'PRIVATE_PERSON_OR_NON_CONSENSUAL' as const,
      details: 'Filmed without consent',
      createdAt: new Date().toISOString(),
      status: 'OPEN' as const,
    },
  ];
  assert.equal(evaluateEmergencyReportStatus('APPROVED_PUBLIC', reports), 'APPROVED_PUBLIC');

  reports.push({
    id: 'r3',
    assetId: 'asset-ke-ho-yo',
    reasonCategory: 'PRIVATE_PERSON_OR_NON_CONSENSUAL' as const,
    details: 'Third report of non-consensual audio',
    createdAt: new Date().toISOString(),
    status: 'OPEN' as const,
  });
  assert.equal(evaluateEmergencyReportStatus('APPROVED_PUBLIC', reports), 'UNDER_EMERGENCY_REVIEW');
});

test('Anti-gaming trending formula decays older assets properly', () => {
  const freshScore = calculateTrendingScore({
    uniqueDownloads7d: 50,
    uniqueRemixes7d: 10,
    uniqueSaves7d: 20,
    uniquePreviews7d: 200,
    hoursSincePublished: 2,
  });
  const oldScore = calculateTrendingScore({
    uniqueDownloads7d: 50,
    uniqueRemixes7d: 10,
    uniqueSaves7d: 20,
    uniquePreviews7d: 200,
    hoursSincePublished: 72,
  });
  assert.equal(freshScore > oldScore, true);
  assert.equal(
    normalizeRegionalQuery('Kya kr rha h yr!!'),
    normalizeRegionalQuery('kya kar raha h yaar')
  );
  assert.equal(computeTrigramSimilarity('ke ho yo', 'k ho yo') > 0.5, true);
});

import {
  INITIAL_TRENDING_TAGS,
  recordUserSearchQuery,
  computeDynamicTrendingTags,
} from './domain-logic';

test('Dynamic Trending Tags update based on user search queries and rank matching topics first', () => {
  const initialRanked = computeDynamicTrendingTags(INITIAL_TRENDING_TAGS);
  assert.equal(initialRanked[0].tag, 'k ho yo');

  // Searching "dal bhat power" repeatedly boosts it to #1
  let updated = recordUserSearchQuery(INITIAL_TRENDING_TAGS, 'dal bhat power', [mockAssetApproved], 'ALL', 1800000010);
  updated = recordUserSearchQuery(updated, 'dal bhat power', [mockAssetApproved], 'ALL', 1800000020);
  updated = recordUserSearchQuery(updated, 'dal bhat power', [mockAssetApproved], 'ALL', 1800000030);

  const afterBoost = computeDynamicTrendingTags(updated);
  assert.equal(afterBoost[0].tag, 'dal bhat power');
  assert.equal(afterBoost[0].searchHits, 87);

  // Searching a brand new regional meme topic inserts it into Trending Tags
  const withCustom = recordUserSearchQuery(updated, 'bidesh jane bela', [mockAssetApproved], 'NE', 1800000040);
  const customMatchRanked = computeDynamicTrendingTags(withCustom, { currentQuery: 'bidesh' });
  assert.equal(customMatchRanked[0].tag, 'bidesh jane bela');
  assert.equal(customMatchRanked[0].isQueryMatch, true);
});

test('Uploaded audio assets preserve exact mediaDataUrl and originalFileName across catalog search and download verification', () => {
  const customUploadedAudioAsset: MemeAsset = {
    ...mockAssetApproved,
    id: 'mc-upload-custom-mp3',
    title: 'My Custom Uploaded Dialogue',
    originalMimeType: 'audio/mpeg',
    originalFileName: 'my-custom-dialogue.mp3',
    mediaDataUrl: 'data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA',
  };

  const results = searchApprovedCatalog([customUploadedAudioAsset], {
    query: 'My Custom Uploaded Dialogue',
  });
  assert.equal(results.length, 1);
  assert.equal(results[0].originalFileName, 'my-custom-dialogue.mp3');
  assert.equal(
    results[0].mediaDataUrl,
    'data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA'
  );
});

import {
  checkDuplicateAssetUpload,
  evaluateBatchUploadCandidates,
  buildAutoApprovedSoundboardAsset,
} from './domain-logic';

test('Automated duplicate check detects exact SHA-256 hash, filename+size, and intra-batch duplicates while auto-approving unique multi-file uploads', () => {
  const existingAsset: MemeAsset = {
    ...mockAssetApproved,
    id: 'mc-existing-pad-1',
    title: 'Momo Ko Jhol',
    originalFileName: 'momo-ko-jhol.mp3',
    originalSizeBytes: 84200,
    sha256Hash: 'sha256-momo-hash-999',
  };

  // 1. Exact SHA-256 match even if renamed
  const shaMatch = checkDuplicateAssetUpload(
    {
      fileName: 'renamed-copy.mp3',
      sizeBytes: 84200,
      sha256Hash: 'sha256-momo-hash-999',
    },
    [existingAsset]
  );
  assert.equal(shaMatch.isDuplicate, true);
  assert.equal(shaMatch.reason, 'EXACT_SHA256_HASH');
  assert.equal(shaMatch.matchedAssetTitle, 'Momo Ko Jhol');

  // 2. Multi-file batch upload evaluation: 2 unique files + 1 catalog duplicate + 1 intra-batch duplicate
  const batchCandidates = [
    {
      fileName: 'unique-dialogue-1.mp3',
      sizeBytes: 42000,
      sha256Hash: 'sha256-unique-111',
      title: 'Unique Dialogue One',
    },
    {
      fileName: 'momo-ko-jhol.mp3',
      sizeBytes: 84200,
      sha256Hash: 'sha256-momo-hash-999',
      title: 'Momo Ko Jhol',
    },
    {
      fileName: 'unique-dialogue-2.wav',
      sizeBytes: 91000,
      sha256Hash: 'sha256-unique-222',
      title: 'Unique Dialogue Two',
    },
    {
      fileName: 'unique-dialogue-1-copy.mp3',
      sizeBytes: 42000,
      sha256Hash: 'sha256-unique-111', // Same SHA-256 as first file in this batch!
      title: 'Unique Dialogue One Copy',
    },
  ];

  const batchResult = evaluateBatchUploadCandidates(batchCandidates, [existingAsset]);
  assert.equal(batchResult.accepted.length, 2);
  assert.equal(batchResult.accepted[0].fileName, 'unique-dialogue-1.mp3');
  assert.equal(batchResult.accepted[1].fileName, 'unique-dialogue-2.wav');

  assert.equal(batchResult.skippedDuplicates.length, 2);
  assert.equal(batchResult.skippedDuplicates[0].duplicateInfo.reason, 'EXACT_SHA256_HASH');
  assert.equal(batchResult.skippedDuplicates[1].duplicateInfo.reason, 'BATCH_INTERNAL_DUPLICATE');

  // 3. Auto-approved soundboard asset is published directly as APPROVED_PUBLIC without moderator wait
  const builtAsset = buildAutoApprovedSoundboardAsset({
    id: 'mc-auto-1',
    fileName: 'unique-dialogue-1.mp3',
    mimeType: 'audio/mpeg',
    sizeBytes: 42000,
    sha256Hash: 'sha256-unique-111',
    mediaDataUrl: 'data:audio/mpeg;base64,AAAA',
    durationMs: 2800,
    waveformPeaks: Array.from({ length: 48 }, () => 60),
  });
  assert.equal(builtAsset.moderationStatus, 'APPROVED_PUBLIC');
  assert.equal(builtAsset.originalFileName, 'unique-dialogue-1.mp3');
  assert.equal(builtAsset.mediaDataUrl, 'data:audio/mpeg;base64,AAAA');
});

import {
  detectMediaTypeFromFile,
  requiresCustomThumbnailOption,
} from './domain-logic';

test('GIF and Meme Video media detection and Audio-only custom thumbnail rules', () => {
  assert.equal(detectMediaTypeFromFile('momo-loop.gif', 'image/gif'), 'GIF');
  assert.equal(detectMediaTypeFromFile('funny-roast.mp4', 'video/mp4'), 'VIDEO_CLIP');
  assert.equal(detectMediaTypeFromFile('dialogue.mp3', 'audio/mpeg'), 'AUDIO_DIALOGUE');
  assert.equal(detectMediaTypeFromFile('template.png', 'image/png'), 'IMAGE_TEMPLATE');

  // Audio types support custom thumbnail option; Video and GIF do not need it
  assert.equal(requiresCustomThumbnailOption('AUDIO_DIALOGUE'), true);
  assert.equal(requiresCustomThumbnailOption('SOUND_EFFECT'), true);
  assert.equal(requiresCustomThumbnailOption('VOICE_RECORDING'), true);
  assert.equal(requiresCustomThumbnailOption('VIDEO_CLIP'), false);
  assert.equal(requiresCustomThumbnailOption('GIF'), false);

  // Audio asset preserves custom thumbnailDataUrl
  const audioWithThumb = buildAutoApprovedSoundboardAsset({
    id: 'mc-aud-thumb-1',
    fileName: 'ke-ho-yo.mp3',
    mimeType: 'audio/mpeg',
    sizeBytes: 32000,
    sha256Hash: 'sha-aud-1',
    mediaDataUrl: 'data:audio/mpeg;base64,AAAA',
    durationMs: 2500,
    waveformPeaks: Array.from({ length: 48 }, () => 50),
    thumbnailDataUrl: 'data:image/png;base64,THUMB_DATA',
    thumbnailFileName: 'shocked-face.png',
  });
  assert.equal(audioWithThumb.mediaType, 'AUDIO_DIALOGUE');
  assert.equal(audioWithThumb.thumbnailDataUrl, 'data:image/png;base64,THUMB_DATA');
  assert.equal(audioWithThumb.thumbnailFileName, 'shocked-face.png');

  // GIF and Video assets omit separate thumbnailDataUrl and create OPTIMIZED_GIF / DOWNLOAD_MP4_720P variants
  const gifAsset = buildAutoApprovedSoundboardAsset({
    id: 'mc-gif-1',
    fileName: 'reaction-loop.gif',
    mimeType: 'image/gif',
    sizeBytes: 120000,
    sha256Hash: 'sha-gif-1',
    mediaDataUrl: 'data:image/gif;base64,R0lGODlh',
    durationMs: 2000,
    waveformPeaks: Array.from({ length: 48 }, () => 40),
    thumbnailDataUrl: 'data:image/png;base64,SHOULD_BE_OMITTED',
  });
  assert.equal(gifAsset.mediaType, 'GIF');
  assert.equal(gifAsset.thumbnailDataUrl, undefined);
  assert.equal(gifAsset.variants[0].kind, 'OPTIMIZED_GIF');
});

import {
  autoDetectAssetLanguageAndRegion,
  organizeCatalogByLanguage,
  recordAssetEngagement,
  computeAssetPublicViralityStatus,
  getRolePermissions,
} from './domain-logic';

test('Auto-Language Detection accurately classifies Nepali, Hindi/Hinglish, English, and Sound Effects and organizes catalog by language', () => {
  const neDeva = autoDetectAssetLanguageAndRegion({
    title: 'के हो यो भाई',
    fileName: 'ke-ho-yo.mp3',
  });
  assert.equal(neDeva.language, 'NE');
  assert.equal(neDeva.region, 'NP');

  const neRoman = autoDetectAssetLanguageAndRegion({
    title: 'Yastai cha jindagi chiya guff',
    fileName: 'chiya-guff-ktm.mp3',
  });
  assert.equal(neRoman.language, 'NE');
  assert.equal(neRoman.region, 'NP');

  const hiRoman = autoDetectAssetLanguageAndRegion({
    title: 'Arey bhai bhai ruko zara sabar karo',
    fileName: 'ruko-zara.mp3',
  });
  assert.equal(hiRoman.language, 'HI');
  assert.equal(hiRoman.region, 'IN');

  const hiDeva = autoDetectAssetLanguageAndRegion({
    title: 'पैसा ही पैसा होगा बाबू भैया',
    fileName: 'paisa.mp3',
  });
  assert.equal(hiDeva.language, 'HI');
  assert.equal(hiDeva.region, 'IN');

  const sfxClip = autoDetectAssetLanguageAndRegion({
    title: 'Cricket Chhakka Crowd Cheer SFX',
    fileName: 'crowd-cheer-horn.mp3',
    mediaType: 'SOUND_EFFECT',
  });
  assert.equal(sfxClip.language, 'NON_VERBAL');

  const enClip = autoDetectAssetLanguageAndRegion({
    title: 'When production deploy fails on Friday deadline',
    fileName: 'coding-bug-template.png',
  });
  assert.equal(enClip.language, 'EN');

  // Auto-organization groups assets into distinct language shelves
  const hiAsset: MemeAsset = {
    ...mockAssetApproved,
    id: 'asset-hi-1',
    language: 'HI',
    region: 'IN',
    title: 'Arey Bhai Reaction',
  };
  const shelves = organizeCatalogByLanguage([mockAssetApproved, hiAsset]);
  assert.equal(shelves.length, 2);
  assert.equal(shelves[0].language, 'NE');
  assert.equal(shelves[0].assets[0].id, 'asset-ke-ho-yo');
  assert.equal(shelves[1].language, 'HI');
  assert.equal(shelves[1].assets[0].id, 'asset-hi-1');
});

test('Public engagement counters (Like, Favorite, Share, Download) update trendingScore & virality tier, and Admin vs Public roles are strictly separated', () => {
  let asset: MemeAsset = {
    ...mockAssetApproved,
    likeCount: 1,
    favoriteCount: 0,
    shareCount: 0,
    downloadCount: 0,
    remixCount: 0,
    viewCount: 1,
    trendingScore: 25,
  };

  asset = recordAssetEngagement(asset, 'LIKE');
  asset = recordAssetEngagement(asset, 'FAVORITE');
  asset = recordAssetEngagement(asset, 'SHARE');
  asset = recordAssetEngagement(asset, 'DOWNLOAD');

  assert.equal(asset.likeCount, 2);
  assert.equal(asset.favoriteCount, 1);
  assert.equal(asset.shareCount, 1);
  assert.equal(asset.downloadCount, 1);
  assert.equal(asset.trendingScore > 25, true);

  const virality = computeAssetPublicViralityStatus(asset);
  assert.equal(virality.isPubliclyAccessibleToFriends, true);
  assert.equal(virality.tier, 'RISING_PUBLIC');

  // Admin vs Public Creator role separation
  const publicPerms = getRolePermissions('CREATOR');
  const adminPerms = getRolePermissions('ADMIN');

  assert.equal(publicPerms.canUploadToPublic, true);
  assert.equal(publicPerms.canInteractPublicly, true);
  assert.equal(publicPerms.canAccessAdminConsole, false);
  assert.equal(publicPerms.canTakedownAnyAsset, false);

  assert.equal(adminPerms.canAccessAdminConsole, true);
  assert.equal(adminPerms.canTakedownAnyAsset, true);
  assert.equal(adminPerms.canVerifyCommercialRights, true);
});

import {
  verifyAdminPanelAccess,
  linkUserCredentialsToUploadedAssets,
} from './domain-logic';

test('verifyAdminPanelAccess strictly enforces ADMIN role and server/Firestore verification for /admin panel', () => {
  // Unauthenticated guest -> 401
  const guestRes = verifyAdminPanelAccess({ user: null });
  assert.equal(guestRes.allowed, false);
  assert.equal(guestRes.httpStatus, 401);

  // Public Creator -> 403 Forbidden even if server/firestore flags are passed
  const creatorRes = verifyAdminPanelAccess({
    user: { uid: 'usr-creator-aarav', handle: 'aarav_ktm', role: 'CREATOR' },
    serverVerifiedAdmin: true,
    firestoreVerifiedAdmin: true,
  });
  assert.equal(creatorRes.allowed, false);
  assert.equal(creatorRes.httpStatus, 403);

  // Moderator -> 403 Forbidden on /admin panel (strictly ADMIN only)
  const modRes = verifyAdminPanelAccess({
    user: { uid: 'usr-mod-1', handle: 'mod_ktm', role: 'MODERATOR' },
    serverVerifiedAdmin: true,
  });
  assert.equal(modRes.allowed, false);
  assert.equal(modRes.httpStatus, 403);
  assert.equal(getRolePermissions('MODERATOR').canAccessAdminConsole, false);

  // Spoofed client-side ADMIN role without server or Firestore verification -> 403 Forbidden
  const spoofedAdminRes = verifyAdminPanelAccess({
    user: { uid: 'usr-spoof', handle: 'spoof', role: 'ADMIN' },
    serverVerifiedAdmin: false,
    firestoreVerifiedAdmin: false,
  });
  assert.equal(spoofedAdminRes.allowed, false);
  assert.equal(spoofedAdminRes.httpStatus, 403);

  // Verified ADMIN role with server or Firestore verification -> 200 OK
  const verifiedAdminRes = verifyAdminPanelAccess({
    user: { uid: 'usr-admin-subash', handle: 'subash_admin', role: 'ADMIN' },
    serverVerifiedAdmin: true,
    firestoreVerifiedAdmin: false,
  });
  assert.equal(verifiedAdminRes.allowed, true);
  assert.equal(verifiedAdminRes.httpStatus, 200);
});

test('linkUserCredentialsToUploadedAssets links persisted user credentials to their uploaded assets across reloads', () => {
  const catalog: MemeAsset[] = [
    {
      ...mockAssetApproved,
      id: 'mc-upload-1',
      uploaderUid: 'legacy-uid-aarav',
      uploaderName: 'Aarav',
      uploaderHandle: 'aarav_ktm',
    },
    {
      ...mockAssetApproved,
      id: 'mc-upload-2',
      uploaderUid: 'usr-creator-priya',
      uploaderName: 'Priya Gurung',
      uploaderHandle: 'priya_pokhara',
    },
  ];

  const linked = linkUserCredentialsToUploadedAssets(catalog, {
    uid: 'usr-creator-aarav',
    displayName: 'Aarav Thapa',
    handle: 'aarav_ktm',
  });

  assert.equal(linked[0].uploaderUid, 'usr-creator-aarav');
  assert.equal(linked[0].uploaderName, 'Aarav Thapa');
  assert.equal(linked[0].uploaderHandle, 'aarav_ktm');
  assert.equal(linked[1].uploaderUid, 'usr-creator-priya');
});





