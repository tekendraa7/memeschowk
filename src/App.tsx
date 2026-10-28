/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  AssetReport,
  autoDetectAssetLanguageAndRegion,
  buildAutoApprovedSoundboardAsset,
  computeAssetPublicViralityStatus,
  computeDynamicTrendingTags,
  DuplicateCheckCandidate,
  DuplicateCheckResult,
  EngagementActionType,
  evaluateAssetRights,
  evaluateBatchUploadCandidates,
  evaluateEmergencyReportStatus,
  getRolePermissions,
  INITIAL_TRENDING_TAGS,
  LanguageCode,
  linkUserCredentialsToUploadedAssets,
  MediaType,
  MemeAsset,
  ModerationActionRecord,
  normalizeRegionalQuery,
  organizeCatalogByLanguage,
  recordAssetEngagement,
  recordUserSearchQuery,
  reorganizeCatalogWithAutoLanguage,
  searchApprovedCatalog,
  TrendingTagEntry,
  UserRole,
  verifyAdminPanelAccess,
} from './lib/domain-logic';
import {
  INITIAL_COLLECTIONS,
  INITIAL_MEME_ASSETS,
  INITIAL_MODERATION_HISTORY,
  INITIAL_ZERO_RESULT_REQUESTS,
  ZeroResultRequestItem,
} from './data/seed-assets';
import { audioController } from './lib/audio-controller';
import {
  computeBlobSha256Hex,
  extractAudioMetadataAndPeaks,
  loadUploadedMediaFromDb,
  loadUploadedThumbnailFromDb,
  readBlobAsDataUrl,
  saveUploadedMediaToDb,
  saveUploadedThumbnailToDb,
} from './lib/media-storage';
import {
  auth,
  AuthenticatedCreatorAccount,
  fetchAssetMediaFromFirestore,
  reconstructMemeAssetFromFirestore,
  resolvePersistentUserSession,
  signOutFirebaseUser,
  subscribeApprovedFirestoreAssets,
  syncEngagementToFirestore,
  syncPublicAssetToFirestore,
  verifyAdminAccessInFirestore,
} from './lib/firebase-client';
import { MemeArtworkCardPreview } from './components/MemeArtworkCanvas';
import { MemeEditorStudio } from './components/MemeEditorStudio';
import { UploadWizardView } from './components/UploadWizardView';
import { AdminAndBlueprintView } from './components/AdminAndBlueprintView';
import { AssetDetailModal } from './components/AssetDetailModal';
import { AuthAccountModal } from './components/AuthAccountModal';
import {
  Search,
  Play,
  Square,
  Download,
  Sparkles,
  Bookmark,
  Volume2,
  Home,
  Compass,
  PlusCircle,
  Shield,
  TrendingUp,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Image as ImageIcon,
  Heart,
  Share2,
  UserCheck,
  Layers,
  Globe,
} from 'lucide-react';

type ActiveTab =
  | 'home'
  | 'explore'
  | 'soundboard'
  | 'editor'
  | 'upload'
  | 'saved'
  | 'admin';

interface PreparedUploadCandidate extends DuplicateCheckCandidate {
  file: File;
  mimeType: string;
  dataUrl: string;
  durationMs: number;
  waveformPeaks: number[];
}

interface BatchUploadReport {
  addedAssets: MemeAsset[];
  skippedDuplicates: Array<{
    fileName: string;
    duplicateInfo: DuplicateCheckResult;
  }>;
}

const DEFAULT_PUBLIC_CREATOR: AuthenticatedCreatorAccount = {
  uid: 'usr-creator-aarav',
  displayName: 'Aarav Thapa',
  handle: 'aarav_ktm',
  email: 'aarav@memechowk.np',
  primaryLanguage: 'NE',
  role: 'CREATOR',
  authSource: 'CHOWK_ACCOUNT',
};

function resolveInitialTabFromLocation(): ActiveTab {
  if (typeof window === 'undefined') return 'home';
  const path = window.location.pathname.toLowerCase();
  const hash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
  if (path.startsWith('/admin') || hash === 'admin' || hash.startsWith('admin/')) {
    return 'admin';
  }
  if (path.startsWith('/soundboard') || hash === 'soundboard') return 'soundboard';
  if (path.startsWith('/explore') || hash === 'explore') return 'explore';
  if (path.startsWith('/editor') || hash === 'editor') return 'editor';
  if (path.startsWith('/upload') || hash === 'upload') return 'upload';
  if (path.startsWith('/saved') || hash === 'saved') return 'saved';
  return 'home';
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>(resolveInitialTabFromLocation);

  // Authenticated User & Role State (Public Creator vs Platform Admin)
  const [currentUser, setCurrentUser] = useState<AuthenticatedCreatorAccount | null>(() => {
    try {
      if (localStorage.getItem('memechowk_logged_out_v1') === '1') {
        return null;
      }
      const savedUser = localStorage.getItem('memechowk_auth_user_v1');
      if (savedUser) return JSON.parse(savedUser);
    } catch {
      // Fallback to default public creator account
    }
    return DEFAULT_PUBLIC_CREATOR;
  });
  const [authSessionReady, setAuthSessionReady] = useState(false);
  const [serverVerifiedAdmin, setServerVerifiedAdmin] = useState(false);
  const [firestoreVerifiedAdmin, setFirestoreVerifiedAdmin] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [onlyMyUploads, setOnlyMyUploads] = useState(false);

  // Core catalog & persistence (synced with shared backend /api/assets & Firestore)
  const [assets, setAssets] = useState<MemeAsset[]>(() => {
    try {
      const saved = localStorage.getItem('memechowk_catalog_v1');
      if (saved) {
        const parsed: MemeAsset[] = JSON.parse(saved);
        const existingIds = new Set(parsed.map((a) => a.id));
        const missingSeeds = INITIAL_MEME_ASSETS.filter((s) => !existingIds.has(s.id));
        return [...parsed, ...missingSeeds];
      }
    } catch {
      // Fallback to seed
    }
    return INITIAL_MEME_ASSETS;
  });

  const [likedIds, setLikedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('memechowk_liked_ids_v1');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return ['mc-asset-01'];
  });
  const [savedIds, setSavedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('memechowk_saved_ids_v1');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return ['mc-asset-01', 'mc-asset-03'];
  });
  const [sharedFeedbackId, setSharedFeedbackId] = useState<string | null>(null);

  const [zeroResultRequests, setZeroResultRequests] = useState<ZeroResultRequestItem[]>(
    INITIAL_ZERO_RESULT_REQUESTS
  );
  const [moderationHistory, setModerationHistory] = useState<ModerationActionRecord[]>(
    INITIAL_MODERATION_HISTORY
  );

  // Sync currentRole with logged-in user's role (Admin vs Public Creator)
  const currentRole: UserRole = currentUser?.role ?? 'USER';
  const rolePermissions = useMemo(() => getRolePermissions(currentRole), [currentRole]);

  // Sync URL hash / path changes (e.g. navigating to /admin or #admin)
  useEffect(() => {
    const syncFromUrl = () => {
      const targetTab = resolveInitialTabFromLocation();
      setActiveTab(targetTab);
    };
    window.addEventListener('hashchange', syncFromUrl);
    window.addEventListener('popstate', syncFromUrl);
    return () => {
      window.removeEventListener('hashchange', syncFromUrl);
      window.removeEventListener('popstate', syncFromUrl);
    };
  }, []);

  // Persistent User Session via Firebase Auth's `onAuthStateChanged` listener in App.tsx
  // Ensures user credentials persist across page reloads and are linked to their uploaded data.
  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (!active) return;

      if (fbUser) {
        const resolvedAccount = await resolvePersistentUserSession(fbUser);
        if (!active) return;
        try {
          localStorage.removeItem('memechowk_logged_out_v1');
          localStorage.setItem('memechowk_auth_user_v1', JSON.stringify(resolvedAccount));
        } catch {
          // ignore
        }
        setCurrentUser(resolvedAccount);
        setAssets((prev) => linkUserCredentialsToUploadedAssets(prev, resolvedAccount));
        setAuthSessionReady(true);
        return;
      }

      // If no active Firebase Auth user, verify persisted session from localStorage against server /api/auth/session
      try {
        if (localStorage.getItem('memechowk_logged_out_v1') === '1') {
          setCurrentUser(null);
          setAuthSessionReady(true);
          return;
        }
        const rawSaved = localStorage.getItem('memechowk_auth_user_v1');
        const candidate: AuthenticatedCreatorAccount = rawSaved
          ? JSON.parse(rawSaved)
          : DEFAULT_PUBLIC_CREATOR;

        const resp = await fetch('/api/auth/session', {
          headers: {
            'x-user-uid': candidate.uid || '',
            'x-user-handle': candidate.handle || '',
            'x-user-email': candidate.email || '',
          },
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data.authenticated && data.user && active) {
            const verifiedSessionUser: AuthenticatedCreatorAccount = {
              uid: data.user.uid,
              displayName: data.user.displayName,
              handle: data.user.handle,
              email: data.user.email,
              primaryLanguage: data.user.primaryLanguage || candidate.primaryLanguage || 'NE',
              role: data.user.role === 'ADMIN' ? 'ADMIN' : 'CREATOR',
              authSource: candidate.authSource || 'CHOWK_ACCOUNT',
            };
            localStorage.setItem(
              'memechowk_auth_user_v1',
              JSON.stringify(verifiedSessionUser)
            );
            setCurrentUser(verifiedSessionUser);
            setAssets((prev) =>
              linkUserCredentialsToUploadedAssets(prev, verifiedSessionUser)
            );
            setAuthSessionReady(true);
            return;
          }
        }

        if (active) {
          setCurrentUser(candidate);
          setAssets((prev) => linkUserCredentialsToUploadedAssets(prev, candidate));
        }
      } catch {
        // Keep existing local state on offline reload
      } finally {
        if (active) setAuthSessionReady(true);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  // Keep user credentials linked to their uploaded data whenever currentUser updates
  useEffect(() => {
    if (!currentUser) {
      setOnlyMyUploads(false);
      return;
    }
    setAssets((prev) => linkUserCredentialsToUploadedAssets(prev, currentUser));
  }, [currentUser]);

  // Server-side permission check (/api/admin/verify) + Firestore Security Rule check (/admins/{adminId}) for '/admin'
  useEffect(() => {
    let active = true;
    if (!currentUser || currentUser.role !== 'ADMIN') {
      setServerVerifiedAdmin(false);
      setFirestoreVerifiedAdmin(false);
      return () => {
        active = false;
      };
    }

    const verifyAdminPermissions = async () => {
      try {
        const [srvResp, fsAllowed] = await Promise.all([
          fetch('/api/admin/verify', {
            headers: {
              'x-user-uid': currentUser.uid,
              'x-user-handle': currentUser.handle,
              'x-user-email': currentUser.email,
            },
          }).catch(() => null),
          verifyAdminAccessInFirestore(currentUser).catch(() => false),
        ]);

        let srvAllowed = false;
        if (srvResp && srvResp.ok) {
          const data = await srvResp.json();
          srvAllowed = Boolean(data.authorized && data.role === 'ADMIN');
        }

        if (active) {
          setServerVerifiedAdmin(srvAllowed);
          setFirestoreVerifiedAdmin(fsAllowed);
        }
      } catch {
        if (active) {
          setServerVerifiedAdmin(false);
          setFirestoreVerifiedAdmin(false);
        }
      }
    };

    verifyAdminPermissions();
    return () => {
      active = false;
    };
  }, [currentUser, activeTab]);

  const adminAccessVerification = useMemo(
    () =>
      verifyAdminPanelAccess({
        user: currentUser,
        serverVerifiedAdmin,
        firestoreVerifiedAdmin,
      }),
    [currentUser, serverVerifiedAdmin, firestoreVerifiedAdmin]
  );

  // Search, Language Organization & Facet Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode | 'ALL'>('ALL');
  const [selectedMediaType, setSelectedMediaType] = useState<MediaType | 'ALL'>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [commercialOnly, setCommercialOnly] = useState(false);
  const [dataSaver, setDataSaver] = useState(false);
  const [groupByLanguageShelves, setGroupByLanguageShelves] = useState(false);
  const [autoOrganizeBanner, setAutoOrganizeBanner] = useState<string | null>(null);

  // Dynamic Trending Tags State
  const [trendingTags, setTrendingTags] = useState<TrendingTagEntry[]>(() => {
    try {
      const saved = localStorage.getItem('memechowk_trending_tags_v1');
      if (saved) return JSON.parse(saved);
    } catch {
      // Fallback to initial seed tags
    }
    return INITIAL_TRENDING_TAGS;
  });
  const [lastLoggedSearchTerm, setLastLoggedSearchTerm] = useState<string | null>(null);

  // Audio Playback State (Singleton Controller)
  const [activeAudioId, setActiveAudioId] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState(0);

  // Multi-file Soundboard Drag & Drop + Auto-Duplicate Check State
  const [isDraggingSoundboard, setIsDraggingSoundboard] = useState(false);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [batchUploadReport, setBatchUploadReport] = useState<BatchUploadReport | null>(null);

  // Active Asset Modal & Selected Editor Template
  const [inspectingAssetId, setInspectingAssetId] = useState<string | null>(null);
  const [editorTemplate, setEditorTemplate] = useState<MemeAsset | null>(null);

  // Zero-Result Request Form State
  const [requestDescription, setRequestDescription] = useState('');
  const [requestSubmittedMsg, setRequestSubmittedMsg] = useState<string | null>(null);

  // Fetch & sync shared public catalog from backend server so friends see each other's uploads
  const fetchSharedCatalogFromServer = async () => {
    try {
      const resp = await fetch('/api/assets');
      if (!resp.ok) return;
      const data = await resp.json();
      if (Array.isArray(data.assets) && data.assets.length > 0) {
        setAssets((prev) => {
          const prevMap = new Map<string, MemeAsset>(prev.map((a) => [a.id, a]));
          const merged: MemeAsset[] = data.assets.map((srvAsset: MemeAsset) => {
            const localMatch = prevMap.get(srvAsset.id);
            return {
              ...srvAsset,
              // Keep local base64/blob fallback if server media URL is not set
              mediaDataUrl: srvAsset.mediaDataUrl || localMatch?.mediaDataUrl,
              thumbnailDataUrl: srvAsset.thumbnailDataUrl || localMatch?.thumbnailDataUrl,
            };
          });
          const serverIds = new Set(merged.map((m) => m.id));
          const unsyncedLocals = prev.filter((l) => !serverIds.has(l.id));
          const combined = [...unsyncedLocals, ...merged];
          return linkUserCredentialsToUploadedAssets(combined, currentUser);
        });
      }
    } catch {
      // Ignore offline errors
    }
  };

  useEffect(() => {
    fetchSharedCatalogFromServer();
    const interval = window.setInterval(fetchSharedCatalogFromServer, 6000);
    return () => window.clearInterval(interval);
  }, []);

  // Subscribe to Firestore public_assets for real-time cross-instance & friend updates
  useEffect(() => {
    try {
      const unsub = subscribeApprovedFirestoreAssets((cloudDocs) => {
        if (!cloudDocs || cloudDocs.length === 0) return;

        setAssets((prev) => {
          const next = [...prev];
          for (const docData of cloudDocs) {
            const id = String(docData.id || '');
            if (!id) continue;
            const idx = next.findIndex((a) => a.id === id);
            if (idx !== -1) {
              next[idx] = {
                ...next[idx],
                title: String(docData.title || next[idx].title),
                language: (docData.language as LanguageCode) || next[idx].language,
                likeCount: Math.max(
                  next[idx].likeCount ?? 0,
                  Number(docData.likeCount ?? 0)
                ),
                favoriteCount: Math.max(
                  next[idx].favoriteCount ?? 0,
                  Number(docData.favoriteCount ?? 0)
                ),
                shareCount: Math.max(
                  next[idx].shareCount ?? 0,
                  Number(docData.shareCount ?? 0)
                ),
                downloadCount: Math.max(
                  next[idx].downloadCount ?? 0,
                  Number(docData.downloadCount ?? 0)
                ),
                trendingScore: Math.max(
                  next[idx].trendingScore ?? 0,
                  Number(docData.trendingScore ?? 0)
                ),
              };
            } else {
              // Insert newly discovered public upload from friend or another link!
              const reconstructed = reconstructMemeAssetFromFirestore(docData);
              next.unshift(reconstructed);
            }
          }
          return next;
        });

        // Asynchronously hydrate binary media & thumbnails from Firestore /public_asset_media chunks
        for (const docData of cloudDocs) {
          const id = String(docData.id || '');
          if (!id) continue;
          const hasCloudMedia = Boolean(docData.hasCloudMedia);
          const mediaChunkCount = Number(docData.mediaChunkCount || 0);
          const hasCloudThumb = Boolean(docData.hasCloudThumb);
          const thumbChunkCount = Number(docData.thumbChunkCount || 0);

          if (hasCloudMedia && mediaChunkCount > 0) {
            fetchAssetMediaFromFirestore(id, 'MEDIA', mediaChunkCount).then(
              async (cloudMediaDataUrl) => {
                if (!cloudMediaDataUrl) return;
                await saveUploadedMediaToDb(id, cloudMediaDataUrl);
                setAssets((curr) =>
                  curr.map((item) =>
                    item.id === id &&
                    (!item.mediaDataUrl || !item.mediaDataUrl.startsWith('data:'))
                      ? { ...item, mediaDataUrl: cloudMediaDataUrl }
                      : item
                  )
                );
              }
            );
          }

          if (hasCloudThumb && thumbChunkCount > 0) {
            fetchAssetMediaFromFirestore(id, 'THUMB', thumbChunkCount).then(
              async (cloudThumbDataUrl) => {
                if (!cloudThumbDataUrl) return;
                await saveUploadedThumbnailToDb(id, cloudThumbDataUrl);
                setAssets((curr) =>
                  curr.map((item) =>
                    item.id === id &&
                    (!item.thumbnailDataUrl || !item.thumbnailDataUrl.startsWith('data:'))
                      ? { ...item, thumbnailDataUrl: cloudThumbDataUrl }
                      : item
                  )
                );
              }
            );
          }
        }
      });
      return () => unsub();
    } catch {
      return () => {};
    }
  }, []);

  // Persist user & local catalog
  useEffect(() => {
    try {
      if (currentUser) {
        localStorage.setItem('memechowk_auth_user_v1', JSON.stringify(currentUser));
      } else {
        localStorage.removeItem('memechowk_auth_user_v1');
      }
    } catch {
      // ignore
    }
  }, [currentUser]);

  useEffect(() => {
    try {
      localStorage.setItem('memechowk_liked_ids_v1', JSON.stringify(likedIds));
    } catch {
      // ignore
    }
  }, [likedIds]);

  useEffect(() => {
    try {
      localStorage.setItem('memechowk_saved_ids_v1', JSON.stringify(savedIds));
    } catch {
      // ignore
    }
  }, [savedIds]);

  useEffect(() => {
    try {
      const lightweightCatalog = assets.map(({ mediaDataUrl, thumbnailDataUrl, ...rest }) => ({
        ...rest,
        mediaDataUrl:
          mediaDataUrl && mediaDataUrl.startsWith('/api/assets/') ? mediaDataUrl : undefined,
        thumbnailDataUrl:
          thumbnailDataUrl && thumbnailDataUrl.startsWith('/api/assets/')
            ? thumbnailDataUrl
            : undefined,
      }));
      localStorage.setItem('memechowk_catalog_v1', JSON.stringify(lightweightCatalog));
    } catch {
      // Ignore storage quota errors
    }
  }, [assets]);

  // Hydrate custom Audio Thumbnails from IndexedDB on initial mount
  useEffect(() => {
    let active = true;
    Promise.all(
      assets.map(async (asset) => {
        if (asset.thumbnailDataUrl) return null;
        const storedThumb = await loadUploadedThumbnailFromDb(asset.id);
        return storedThumb ? { id: asset.id, storedThumb } : null;
      })
    ).then((found) => {
      if (!active) return;
      const thumbMap = new Map<string, string>();
      for (const item of found) {
        if (item) thumbMap.set(item.id, item.storedThumb);
      }
      if (thumbMap.size > 0) {
        setAssets((prev) =>
          prev.map((a) =>
            thumbMap.has(a.id) ? { ...a, thumbnailDataUrl: thumbMap.get(a.id) } : a
          )
        );
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('memechowk_trending_tags_v1', JSON.stringify(trendingTags));
    } catch {
      // Ignore storage quota errors
    }
  }, [trendingTags]);

  // Automatically record completed user search queries after a brief typing pause (450ms)
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) return;
    const timer = window.setTimeout(() => {
      setTrendingTags((prev) =>
        recordUserSearchQuery(prev, trimmed, assets, selectedLanguage)
      );
      setLastLoggedSearchTerm(trimmed);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [searchQuery, assets, selectedLanguage]);

  const displayedTrendingTags = useMemo(() => {
    return computeDynamicTrendingTags(trendingTags, {
      currentQuery: searchQuery,
      language: selectedLanguage,
      limit: 8,
    });
  }, [trendingTags, searchQuery, selectedLanguage]);

  const handleTriggerSearchTag = (rawTerm: string) => {
    const cleaned = rawTerm.trim();
    if (!cleaned) return;
    setSearchQuery(cleaned);
    setRequestSubmittedMsg(null);
    setTrendingTags((prev) =>
      recordUserSearchQuery(prev, cleaned, assets, selectedLanguage)
    );
    setLastLoggedSearchTerm(cleaned);
  };

  useEffect(() => {
    return audioController.subscribe((id, prog) => {
      setActiveAudioId(id);
      setAudioProgress(prog);
    });
  }, []);

  // Keyboard Escape to stop soundboard audio
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeAudioId) {
        audioController.stopAll();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeAudioId]);

  // Language distribution counts across approved public catalog
  const languageCounts = useMemo(() => {
    const approved = assets.filter((a) => a.moderationStatus === 'APPROVED_PUBLIC');
    return {
      ALL: approved.length,
      NE: approved.filter((a) => a.language === 'NE').length,
      HI: approved.filter((a) => a.language === 'HI').length,
      EN: approved.filter((a) => a.language === 'EN').length,
      NON_VERBAL: approved.filter((a) => a.language === 'NON_VERBAL').length,
    };
  }, [assets]);

  // Count of uploads linked to the current authenticated user's persistent credentials
  const myLinkedUploadsCount = useMemo(() => {
    if (!currentUser) return 0;
    const normHandle = currentUser.handle.trim().replace(/^@/, '').toLowerCase();
    return assets.filter(
      (a) =>
        a.moderationStatus === 'APPROVED_PUBLIC' &&
        (a.uploaderUid === currentUser.uid ||
          a.uploaderHandle.trim().replace(/^@/, '').toLowerCase() === normHandle)
    ).length;
  }, [assets, currentUser]);

  // Filtered & Ranked Public Catalog (Strictly APPROVED_PUBLIC only!)
  const filteredPublicAssets = useMemo(() => {
    const results = searchApprovedCatalog(assets, {
      query: searchQuery,
      language: selectedLanguage,
      mediaType: selectedMediaType,
      category: selectedCategory,
      commercialOnly,
    });
    if (onlyMyUploads && currentUser) {
      const normHandle = currentUser.handle.trim().replace(/^@/, '').toLowerCase();
      return results.filter(
        (a) =>
          a.uploaderUid === currentUser.uid ||
          a.uploaderHandle.trim().replace(/^@/, '').toLowerCase() === normHandle
      );
    }
    return results;
  }, [
    assets,
    searchQuery,
    selectedLanguage,
    selectedMediaType,
    selectedCategory,
    commercialOnly,
    onlyMyUploads,
    currentUser,
  ]);

  // Organized Language Shelves for filtered public assets
  const languageShelves = useMemo(() => {
    return organizeCatalogByLanguage(filteredPublicAssets);
  }, [filteredPublicAssets]);

  const soundboardAssets = useMemo(
    () =>
      assets.filter(
        (a) =>
          a.moderationStatus === 'APPROVED_PUBLIC' &&
          (selectedLanguage === 'ALL' || a.language === selectedLanguage) &&
          (a.mediaType === 'AUDIO_DIALOGUE' ||
            a.mediaType === 'SOUND_EFFECT' ||
            a.mediaType === 'VOICE_RECORDING' ||
            Boolean(a.mediaDataUrl) ||
            Boolean(a.originalFileName) ||
            a.variants.some((v) => v.kind === 'NORMALIZED_MP3'))
      ),
    [assets, selectedLanguage]
  );

  const inspectingAsset = useMemo(
    () => assets.find((a) => a.id === inspectingAssetId) ?? null,
    [assets, inspectingAssetId]
  );

  const publishAssetsToSharedPublicCatalog = async (newAssets: MemeAsset[]) => {
    if (newAssets.length === 0) return;
    setAssets((prev) => [...newAssets, ...prev]);

    // First sync full assets + base64 media/thumbnail chunks directly to Firestore
    await Promise.all(
      newAssets.map((asset) =>
        syncPublicAssetToFirestore(
          asset,
          asset.mediaDataUrl,
          asset.thumbnailDataUrl
        ).catch(() => {})
      )
    );

    try {
      const resp = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assets: newAssets }),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data.assets)) {
          const updatedMap = new Map<string, MemeAsset>(
            data.assets.map((a: MemeAsset) => [a.id, a])
          );
          setAssets((prev) =>
            prev.map((item) => {
              const srv = updatedMap.get(item.id);
              if (!srv) return item;
              return {
                ...item,
                ...srv,
                // Keep data: URL in memory for instant playback alongside server/Firestore stream
                mediaDataUrl:
                  item.mediaDataUrl && item.mediaDataUrl.startsWith('data:')
                    ? item.mediaDataUrl
                    : srv.mediaDataUrl,
                thumbnailDataUrl:
                  item.thumbnailDataUrl && item.thumbnailDataUrl.startsWith('data:')
                    ? item.thumbnailDataUrl
                    : srv.thumbnailDataUrl,
              };
            })
          );
        }
      }
    } catch {
      // Ignore offline errors
    }
  };

  const handleAutoOrganizeCatalogByLanguage = async () => {
    const { updatedAssets, reclassifiedCount } = reorganizeCatalogWithAutoLanguage(assets);
    setAssets(updatedAssets);
    setGroupByLanguageShelves(true);
    setAutoOrganizeBanner(
      `Auto-Language Engine scanned ${updatedAssets.length} public assets (${reclassifiedCount} updated) and organized them into Nepali (NE), Hindi/Hinglish (HI), English (EN), and Sound Effects (SFX) shelves!`
    );
    try {
      await fetch('/api/assets/reorganize-languages', { method: 'POST' });
    } catch {
      // ignore
    }
  };

  const handleEngageWithAsset = async (assetId: string, action: EngagementActionType) => {
    let updatedTarget: MemeAsset | null = null;
    setAssets((prev) =>
      prev.map((a) => {
        if (a.id !== assetId) return a;
        updatedTarget = recordAssetEngagement(a, action);
        return updatedTarget;
      })
    );

    try {
      const resp = await fetch(`/api/assets/${assetId}/engage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.asset) {
          setAssets((prev) => prev.map((a) => (a.id === assetId ? { ...a, ...data.asset } : a)));
        }
      }
    } catch {
      // ignore
    }

    if (updatedTarget) {
      syncEngagementToFirestore(updatedTarget).catch(() => {});
    }
  };

  const handleTogglePlay = (asset: MemeAsset) => {
    audioController.playAsset(asset);
  };

  const handleStopAllAudio = () => {
    audioController.stopAll();
  };

  const handleToggleLike = (assetId: string) => {
    const alreadyLiked = likedIds.includes(assetId);
    setLikedIds((prev) =>
      alreadyLiked ? prev.filter((id) => id !== assetId) : [...prev, assetId]
    );
    handleEngageWithAsset(assetId, alreadyLiked ? 'UNLIKE' : 'LIKE');
  };

  const handleToggleSave = (assetId: string) => {
    const alreadySaved = savedIds.includes(assetId);
    setSavedIds((prev) =>
      alreadySaved ? prev.filter((id) => id !== assetId) : [...prev, assetId]
    );
    handleEngageWithAsset(assetId, alreadySaved ? 'UNFAVORITE' : 'FAVORITE');
  };

  const handleShareAssetCard = (asset: MemeAsset) => {
    const shareUrl = `${window.location.origin}/?asset=${asset.slug}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl).catch(() => {});
    }
    handleEngageWithAsset(asset.id, 'SHARE');
    setSharedFeedbackId(asset.id);
    window.setTimeout(() => {
      setSharedFeedbackId((curr) => (curr === asset.id ? null : curr));
    }, 2500);
  };

  const handleRecordDownload = (assetId: string) => {
    handleEngageWithAsset(assetId, 'DOWNLOAD');
  };

  const handleOpenInEditor = (asset: MemeAsset) => {
    setEditorTemplate(asset);
    setActiveTab('editor');
  };

  const handlePublishRemix = (remixAsset: MemeAsset) => {
    const attributedRemix: MemeAsset = {
      ...remixAsset,
      uploaderUid: currentUser?.uid || 'usr-creator-aarav',
      uploaderName: currentUser?.displayName || remixAsset.uploaderName,
      uploaderHandle: currentUser?.handle || remixAsset.uploaderHandle,
    };
    publishAssetsToSharedPublicCatalog([attributedRemix]);
  };

  const handleBatchUploadPublished = (newAssets: MemeAsset[]) => {
    if (newAssets.length === 0) return;
    publishAssetsToSharedPublicCatalog(newAssets);
    audioController.playAsset(newAssets[0]);
  };

  const handleDeleteOwnAsset = async (assetId: string) => {
    setAssets((prev) => prev.filter((a) => a.id !== assetId));
    try {
      await fetch(`/api/assets/${assetId}/moderation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-uid': currentUser?.uid || '',
          'x-user-handle': currentUser?.handle || '',
          'x-user-email': currentUser?.email || '',
        },
        body: JSON.stringify({
          action: 'DELETE_OWN',
          role: currentRole,
          userUid: currentUser?.uid,
        }),
      });
    } catch {
      // ignore
    }
  };

  const handleAttachCustomAudio = (
    assetId: string,
    mediaDataUrl: string,
    fileName: string,
    mimeType: string,
    sizeBytes: number,
    durationMs: number,
    waveformPeaks: number[]
  ) => {
    setAssets((prev) =>
      prev.map((a) => {
        if (a.id !== assetId) return a;
        const ext = fileName.includes('.')
          ? fileName.split('.').pop()?.toLowerCase() || 'mp3'
          : 'mp3';
        const updated: MemeAsset = {
          ...a,
          mediaDataUrl,
          originalFileName: fileName,
          originalMimeType: mimeType,
          originalSizeBytes: sizeBytes,
          durationMs,
          waveformPeaks,
          variants: a.variants.map((v) =>
            v.kind === 'NORMALIZED_MP3'
              ? {
                  ...v,
                  label: `Original Uploaded Audio (${fileName})`,
                  mimeType,
                  extension: ext,
                  sizeBytes,
                  durationMs,
                  isReady: true,
                }
              : v
          ),
        };
        fetch('/api/assets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assets: [updated] }),
        }).catch(() => {});
        return updated;
      })
    );
  };

  const handleAttachAudioThumbnail = (
    assetId: string,
    thumbnailDataUrl: string,
    thumbnailFileName: string
  ) => {
    setAssets((prev) =>
      prev.map((a) => {
        if (a.id !== assetId) return a;
        const updated = {
          ...a,
          thumbnailDataUrl,
          thumbnailFileName,
        };
        fetch('/api/assets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assets: [updated] }),
        }).catch(() => {});
        return updated;
      })
    );
  };

  const handlePadQuickThumbnailUpload = async (
    assetId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await readBlobAsDataUrl(file);
    await saveUploadedThumbnailToDb(assetId, dataUrl);
    handleAttachAudioThumbnail(assetId, dataUrl, file.name);
    e.target.value = '';
  };

  /**
   * Multi-file Soundboard ingestion pipeline:
   * - Processes multiple selected or drag-and-dropped audio files concurrently
   * - Auto-detects Language (NE, HI, EN, NON_VERBAL) and checks SHA-256 duplicates
   * - Publishes unique files to the shared Public Catalog so friends can access them immediately
   */
  const processSoundboardFileBatch = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    setIsProcessingBatch(true);

    try {
      const preparedCandidates: PreparedUploadCandidate[] = await Promise.all(
        files.map(async (file) => {
          const [sha256Hash, dataUrl, meta] = await Promise.all([
            computeBlobSha256Hex(file),
            readBlobAsDataUrl(file),
            extractAudioMetadataAndPeaks(file),
          ]);
          const cleanTitle = file.name
            .replace(/\.[^/.]+$/, '')
            .replace(/[-_]+/g, ' ')
            .trim();
          return {
            file,
            fileName: file.name,
            sizeBytes: file.size,
            sha256Hash,
            title: cleanTitle,
            durationMs: meta.durationMs,
            mimeType: file.type || 'audio/mpeg',
            dataUrl,
            waveformPeaks: meta.waveformPeaks,
          };
        })
      );

      const { accepted, skippedDuplicates } = evaluateBatchUploadCandidates(
        preparedCandidates,
        assets
      );

      const newlyCreatedAssets: MemeAsset[] = [];
      const baseTimestamp = Date.now();

      for (let i = 0; i < accepted.length; i++) {
        const item = accepted[i];
        const assetId = `mc-upload-${baseTimestamp}-${i}`;

        await saveUploadedMediaToDb(assetId, item.file);

        const newPadAsset = buildAutoApprovedSoundboardAsset({
          id: assetId,
          fileName: item.fileName,
          mimeType: item.mimeType,
          sizeBytes: item.sizeBytes,
          sha256Hash: item.sha256Hash,
          mediaDataUrl: item.dataUrl,
          durationMs: item.durationMs,
          waveformPeaks: item.waveformPeaks,
          title: item.title,
          language: 'AUTO',
          region: 'AUTO',
          paletteIndex: i,
          uploaderUid: currentUser?.uid || 'usr-creator-aarav',
          uploaderName: currentUser?.displayName || 'Aarav Thapa',
          uploaderHandle: currentUser?.handle || 'aarav_ktm',
        });

        newlyCreatedAssets.push(newPadAsset);
      }

      if (newlyCreatedAssets.length > 0) {
        await publishAssetsToSharedPublicCatalog(newlyCreatedAssets);
        audioController.playAsset(newlyCreatedAssets[0]);
      }

      setBatchUploadReport({
        addedAssets: newlyCreatedAssets,
        skippedDuplicates: skippedDuplicates.map((d) => ({
          fileName: d.candidate.fileName,
          duplicateInfo: d.duplicateInfo,
        })),
      });
    } finally {
      setIsProcessingBatch(false);
    }
  };

  const handleMultiSoundboardInputChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (e.target.files && e.target.files.length > 0) {
      await processSoundboardFileBatch(e.target.files);
      e.target.value = '';
    }
  };

  const handleSoundboardDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingSoundboard(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processSoundboardFileBatch(e.dataTransfer.files);
    }
  };

  const handleSubmitReport = (
    assetId: string,
    reasonCategory: AssetReport['reasonCategory'],
    details: string
  ) => {
    setAssets((prev) =>
      prev.map((asset) => {
        if (asset.id !== assetId) return asset;
        const newReport: AssetReport = {
          id: `rep-${Date.now()}`,
          assetId,
          reasonCategory,
          details,
          createdAt: new Date().toISOString(),
          status: 'OPEN',
        };
        const updatedReports = [...asset.reports, newReport];
        const nextStatus = evaluateEmergencyReportStatus(
          asset.moderationStatus,
          updatedReports
        );
        return {
          ...asset,
          reports: updatedReports,
          moderationStatus: nextStatus,
        };
      })
    );
  };

  const handleApproveAsset = async (assetId: string, verifyCommercialRights: boolean) => {
    setAssets((prev) =>
      prev.map((asset) => {
        if (asset.id !== assetId) return asset;
        const evaluated = evaluateAssetRights({
          sourceDeclaration: asset.rightsRecord.sourceDeclaration,
          moderatorVerifiedRights: verifyCommercialRights,
          requestedReuseTier: verifyCommercialRights
            ? 'CREATOR_AUTHORIZED_COMMERCIAL'
            : 'CREATOR_NON_COMMERCIAL',
        });
        return {
          ...asset,
          moderationStatus: 'APPROVED_PUBLIC',
          publishedAt: new Date().toISOString(),
          rightsRecord: {
            ...asset.rightsRecord,
            moderatorVerifiedRights: verifyCommercialRights,
            reuseTier: evaluated.reuseTier,
            commercialEligible: evaluated.commercialEligible,
          },
        };
      })
    );
    try {
      await fetch(`/api/assets/${assetId}/moderation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-uid': currentUser?.uid || '',
          'x-user-handle': currentUser?.handle || '',
          'x-user-email': currentUser?.email || '',
        },
        body: JSON.stringify({
          action: 'APPROVE',
          role: currentRole,
          userUid: currentUser?.uid,
          verifyCommercialRights,
        }),
      });
    } catch {
      // ignore
    }
    setModerationHistory((prev) => [
      {
        id: `mod-${Date.now()}`,
        assetId,
        moderatorName: `${currentUser?.displayName || 'Admin'} (${currentRole})`,
        actionType: 'APPROVE',
        reason: `Approved from quarantine (moderatorVerifiedRights=${verifyCommercialRights})`,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
  };

  const handleRejectAsset = async (assetId: string, reason: string) => {
    setAssets((prev) =>
      prev.map((a) =>
        a.id === assetId
          ? { ...a, moderationStatus: 'REJECTED', rejectionReason: reason }
          : a
      )
    );
    try {
      await fetch(`/api/assets/${assetId}/moderation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-uid': currentUser?.uid || '',
          'x-user-handle': currentUser?.handle || '',
          'x-user-email': currentUser?.email || '',
        },
        body: JSON.stringify({
          action: 'REJECT',
          role: currentRole,
          userUid: currentUser?.uid,
          reason,
        }),
      });
    } catch {
      // ignore
    }
    setModerationHistory((prev) => [
      {
        id: `mod-${Date.now()}`,
        assetId,
        moderatorName: `${currentUser?.displayName || 'Admin'} (${currentRole})`,
        actionType: 'REJECT',
        reason,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
  };

  const handleTakedownAsset = async (assetId: string, reason: string) => {
    if (activeAudioId === assetId) {
      audioController.stopAll();
    }
    setAssets((prev) =>
      prev.map((a) =>
        a.id === assetId
          ? {
              ...a,
              moderationStatus: 'TAKEDOWN_REMOVED',
              variants: a.variants.map((v) => ({ ...v, isReady: false })),
            }
          : a
      )
    );
    try {
      await fetch(`/api/assets/${assetId}/moderation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-uid': currentUser?.uid || '',
          'x-user-handle': currentUser?.handle || '',
          'x-user-email': currentUser?.email || '',
        },
        body: JSON.stringify({
          action: 'TAKEDOWN',
          role: currentRole,
          userUid: currentUser?.uid,
          reason,
        }),
      });
    } catch {
      // ignore
    }
    setModerationHistory((prev) => [
      {
        id: `mod-${Date.now()}`,
        assetId,
        moderatorName: `${currentUser?.displayName || 'Admin'} (${currentRole})`,
        actionType: 'TAKEDOWN',
        reason,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
  };

  const handleSimulateThreePrivacyReports = (assetId: string) => {
    setAssets((prev) =>
      prev.map((asset) => {
        if (asset.id !== assetId) return asset;
        const threePrivacyReports: AssetReport[] = [1, 2, 3].map((n) => ({
          id: `rep-sim-${Date.now()}-${n}`,
          assetId,
          reasonCategory: 'PRIVATE_PERSON_OR_NON_CONSENSUAL',
          details: `Simulated privacy report #${n}`,
          createdAt: new Date().toISOString(),
          status: 'OPEN',
        }));
        const allReports = [...asset.reports, ...threePrivacyReports];
        return {
          ...asset,
          reports: allReports,
          moderationStatus: evaluateEmergencyReportStatus(
            asset.moderationStatus,
            allReports
          ),
        };
      })
    );
  };

  const handleRequestMissingMeme = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const autoLang = autoDetectAssetLanguageAndRegion({ title: searchQuery.trim() });
    const newReq: ZeroResultRequestItem = {
      id: `req-${Date.now()}`,
      queryText: searchQuery.trim(),
      normalizedQuery: normalizeRegionalQuery(searchQuery),
      language:
        selectedLanguage !== 'ALL' && selectedLanguage !== 'NON_VERBAL'
          ? selectedLanguage
          : autoLang.language === 'NON_VERBAL'
          ? 'NE'
          : autoLang.language,
      description:
        requestDescription.trim() ||
        `Requested by @${currentUser?.handle || 'community'} after searching "${searchQuery.trim()}"`,
      upvotes: 1,
      status: 'OPEN',
      createdAt: new Date().toISOString(),
    };
    setZeroResultRequests((prev) => [newReq, ...prev]);
    setRequestSubmittedMsg(
      `Logged "${searchQuery.trim()}" (Auto-Detected Language: ${autoLang.language}) into ZeroResultQuery & MemeRequest queue!`
    );
    setRequestDescription('');
  };

  const renderAssetCard = (asset: MemeAsset) => {
    const isPlaying = activeAudioId === asset.id;
    const isSaved = savedIds.includes(asset.id);
    const isLiked = likedIds.includes(asset.id);
    const hasCustomAudio = Boolean(asset.mediaDataUrl || asset.originalFileName);
    const virality = computeAssetPublicViralityStatus(asset);
    const isOwnUpload = Boolean(
      currentUser &&
        (asset.uploaderUid === currentUser.uid ||
          asset.uploaderHandle.trim().replace(/^@/, '').toLowerCase() ===
            currentUser.handle.trim().replace(/^@/, '').toLowerCase())
    );

    return (
      <article
        key={asset.id}
        data-testid={`asset-card-${asset.id}`}
        className="bg-[#181B22] border border-[#262B36] rounded-2xl overflow-hidden flex flex-col justify-between transition-transform duration-150 hover:-translate-y-0.5"
      >
        <div>
          <div
            onClick={() => setInspectingAssetId(asset.id)}
            className="cursor-pointer relative"
          >
            <MemeArtworkCardPreview
              asset={asset}
              isPlaying={isPlaying}
              progress={audioProgress}
              dataSaver={dataSaver}
            />
          </div>

          <div className="p-4">
            {/* Unboxed Metadata Line: Auto-Language + Creator + Public Status */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#9CA3AF] font-mono-tabular">
              <span className="font-bold text-[#FFB800]">
                {asset.language === 'NE'
                  ? '🇳🇵 NE'
                  : asset.language === 'HI'
                  ? '🇮🇳 HI'
                  : asset.language === 'EN'
                  ? '🇬🇧 EN'
                  : '🔊 SFX'}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {hasCustomAudio ? 'ORIGINAL UPLOAD' : asset.mediaType.replace('_', ' ')}
              </span>
              <span aria-hidden="true">·</span>
              <span className="text-[#10B981]">@{asset.uploaderHandle}</span>
              {isOwnUpload && (
                <>
                  <span aria-hidden="true">·</span>
                  <span
                    data-testid={`own-upload-badge-${asset.id}`}
                    className="text-[#FFB800] font-bold"
                  >
                    YOUR UPLOAD
                  </span>
                </>
              )}
            </div>

            <h3 className="text-base font-bold text-[#F3F4F6] mt-1 line-clamp-1">
              <button
                type="button"
                onClick={() => setInspectingAssetId(asset.id)}
                className="text-left hover:text-[#FFB800] transition-colors cursor-pointer"
              >
                {asset.title}
              </button>
            </h3>

            <p className="text-xs font-deva text-[#E5E7EB] mt-1 line-clamp-1">
              {asset.transcriptDeva}
            </p>

            {/* Public Status & Engagement Summary Line */}
            <div className="mt-2 pt-2 border-t border-[#262B36]/50 flex items-center justify-between text-[11px] font-mono-tabular text-[#9CA3AF]">
              <span className="text-[#38BDF8] truncate">{virality.label}</span>
              <span>↓ {asset.downloadCount ?? 0} DL</span>
            </div>
          </div>
        </div>

        {/* Card Action & Public Engagement Bar (Play, Like, Favorite, Share, Download) */}
        <div className="px-4 pb-4 pt-2 border-t border-[#262B36]/60 flex items-center justify-between gap-1.5">
          <button
            type="button"
            onClick={() => handleTogglePlay(asset)}
            aria-label={`Play preview for ${asset.title}`}
            className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              isPlaying
                ? 'bg-[#FF4D4D] text-[#0F1115]'
                : 'bg-[#FFB800] text-[#0F1115] hover:bg-[#e6a600]'
            }`}
          >
            {isPlaying ? (
              <>
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Play</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-1">
            <button
              type="button"
              data-testid={`like-btn-${asset.id}`}
              onClick={() => handleToggleLike(asset.id)}
              title="Like this public upload"
              className={`px-2 py-1.5 rounded-lg border text-xs font-mono-tabular flex items-center gap-1 cursor-pointer ${
                isLiked
                  ? 'bg-[#F43F5E]/15 border-[#F43F5E] text-[#F43F5E] font-bold'
                  : 'bg-[#0F1115] border-[#262B36] text-[#9CA3AF] hover:text-[#F43F5E]'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} />
              <span>{asset.likeCount ?? 0}</span>
            </button>

            <button
              type="button"
              data-testid={`fav-btn-${asset.id}`}
              onClick={() => handleToggleSave(asset.id)}
              title="Favorite / Save to Collection"
              className={`px-2 py-1.5 rounded-lg border text-xs font-mono-tabular flex items-center gap-1 cursor-pointer ${
                isSaved
                  ? 'bg-[#FFB800]/15 border-[#FFB800] text-[#FFB800] font-bold'
                  : 'bg-[#0F1115] border-[#262B36] text-[#9CA3AF] hover:text-[#FFB800]'
              }`}
            >
              <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-current' : ''}`} />
              <span>{asset.favoriteCount ?? 0}</span>
            </button>

            <button
              type="button"
              data-testid={`share-btn-${asset.id}`}
              onClick={() => handleShareAssetCard(asset)}
              title="Share public link with friends"
              className={`px-2 py-1.5 rounded-lg border text-xs font-mono-tabular flex items-center gap-1 cursor-pointer ${
                sharedFeedbackId === asset.id
                  ? 'bg-[#132A1E] border-[#10B981] text-[#10B981] font-bold'
                  : 'bg-[#0F1115] border-[#262B36] text-[#9CA3AF] hover:text-[#38BDF8]'
              }`}
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{sharedFeedbackId === asset.id ? 'Copied' : asset.shareCount ?? 0}</span>
            </button>

            <button
              type="button"
              onClick={() => setInspectingAssetId(asset.id)}
              aria-label={`Download variants for ${asset.title}`}
              title="Download or inspect"
              className="p-1.5 rounded-lg bg-[#0F1115] border border-[#262B36] text-[#9CA3AF] hover:text-[#F3F4F6] cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="min-h-screen bg-[#0F1115] text-[#F3F4F6] flex flex-col pb-16 md:pb-0">
      {/* STRICT 3-ZONE TOP BAR CONTRACT */}
      <header className="sticky top-0 z-30 h-14 bg-[#0F1115]/95 border-b border-[#262B36] px-4 sm:px-6 flex items-center justify-between gap-6">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#home"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('home');
          }}
          className="text-lg font-extrabold tracking-tight text-[#FFB800] whitespace-nowrap shrink-0"
        >
          MemeChowk
        </a>

        {/* Zone 2: 5 concise single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[#9CA3AF]">
          <a
            href="#home"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('home');
            }}
            className={`hover:text-[#F3F4F6] transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'home'
                ? 'text-[#F3F4F6] underline underline-offset-8 decoration-[#FFB800]'
                : ''
            }`}
          >
            Discover
          </a>
          <a
            href="#explore"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('explore');
            }}
            className={`hover:text-[#F3F4F6] transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'explore'
                ? 'text-[#F3F4F6] underline underline-offset-8 decoration-[#FFB800]'
                : ''
            }`}
          >
            Explore
          </a>
          <a
            href="#soundboard"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('soundboard');
            }}
            className={`hover:text-[#F3F4F6] transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'soundboard'
                ? 'text-[#F3F4F6] underline underline-offset-8 decoration-[#FFB800]'
                : ''
            }`}
          >
            Soundboard
          </a>
          <a
            href="#editor"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('editor');
            }}
            className={`hover:text-[#F3F4F6] transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'editor'
                ? 'text-[#F3F4F6] underline underline-offset-8 decoration-[#FFB800]'
                : ''
            }`}
          >
            Meme Editor
          </a>
          {rolePermissions.canAccessAdminConsole ? (
            <a
              href="#admin"
              data-testid="nav-admin-console"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab('admin');
              }}
              className={`hover:text-[#F3F4F6] transition-colors whitespace-nowrap shrink-0 text-[#10B981] font-semibold ${
                activeTab === 'admin'
                  ? 'underline underline-offset-8 decoration-[#10B981]'
                  : ''
              }`}
            >
              Admin Console
            </a>
          ) : (
            <a
              href="#saved"
              data-testid="nav-saved-collection"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab('saved');
              }}
              className={`hover:text-[#F3F4F6] transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'saved'
                  ? 'text-[#F3F4F6] underline underline-offset-8 decoration-[#FFB800]'
                  : ''
              }`}
            >
              Saved ({savedIds.length})
            </a>
          )}
        </nav>

        {/* Zone 3: Account Login/Role Button + Upload Media Primary CTA */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            data-testid="open-auth-modal-btn"
            onClick={() => setShowAuthModal(true)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              currentUser?.role === 'ADMIN'
                ? 'bg-[#132A1E] border-[#10B981] text-[#10B981]'
                : currentUser
                ? 'bg-[#181B22] border-[#262B36] text-[#F3F4F6] hover:border-[#FFB800]'
                : 'bg-[#181B22] border-[#FFB800] text-[#FFB800]'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>
              {currentUser
                ? `@${currentUser.handle} (${currentUser.role === 'ADMIN' ? 'ADMIN' : 'PUBLIC'})`
                : 'Login / Register'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className="px-3.5 py-2 text-xs font-bold text-[#0F1115] bg-[#FFB800] rounded-lg hover:bg-[#e6a600] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Upload Media
          </button>
        </div>
      </header>

      {/* MAIN VIEWPORT CONTENT */}
      <main className="flex-1">
        {/* =============================================================== */}
        {/* HOME & EXPLORE VIEWS                                            */}
        {/* =============================================================== */}
        {(activeTab === 'home' || activeTab === 'explore') && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
            {/* Hero Search & Cross-Script Transliteration Bar */}
            <section className="bg-[#181B22] border border-[#262B36] rounded-2xl p-5 sm:p-7">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="max-w-3xl">
                  <p className="text-xs font-semibold text-[#FFB800]">
                    मिम चोक · मीम चौक · Auto-Language Organized Public Meme & Soundboard Hub
                  </p>
                  <h1
                    className="text-2xl sm:text-4xl font-extrabold text-[#F3F4F6] mt-1.5 tracking-tight"
                    style={{ textWrap: 'balance' }}
                  >
                    Find & Share Nepali, Hindi & English Memes with Friends.
                  </h1>
                  <p className="text-xs sm:text-sm text-[#9CA3AF] mt-2 max-w-2xl">
                    Every upload is <strong className="text-[#10B981]">auto-organized by language</strong> (Nepali, Hindi/Hinglish, English, SFX) and published to the <strong className="text-[#F3F4F6]">shared public cloud catalog</strong> so your friends can immediately access your uploads and boost them with Likes, Favorites, Shares & Downloads.
                  </p>
                </div>

                {/* Role & Friend Sharing Status Card */}
                <div className="p-3.5 rounded-xl bg-[#0F1115] border border-[#262B36] text-xs space-y-1.5 shrink-0">
                  <div className="flex items-center gap-2 font-bold">
                    <Globe className="w-4 h-4 text-[#10B981]" />
                    <span className="text-[#10B981]">Shared Public Feed: LIVE</span>
                  </div>
                  <div className="text-[#9CA3AF]">
                    Signed in as{' '}
                    <strong className="text-[#F3F4F6]">
                      {currentUser ? `@${currentUser.handle}` : 'Guest'}
                    </strong>{' '}
                    · Role:{' '}
                    <strong
                      className={
                        currentRole === 'ADMIN' ? 'text-[#10B981]' : 'text-[#FFB800]'
                      }
                    >
                      {rolePermissions.displayLabel}
                    </strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAuthModal(true)}
                    className="text-[#FFB800] font-semibold hover:underline cursor-pointer"
                  >
                    Manage Creator Account / Switch User →
                  </button>
                </div>
              </div>

              {/* Search Input + Language Organization Tabs */}
              <div className="mt-5 flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (searchQuery.trim().length >= 2) {
                      handleTriggerSearchTag(searchQuery);
                    }
                  }}
                  className="relative flex-1 flex items-center gap-2"
                >
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="search"
                      aria-label="Search regional memes in Romanized Nepali, Hinglish, or Devanagari"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setRequestSubmittedMsg(null);
                      }}
                      placeholder='Try "k ho yo", "के हो यो", "paisa hi paisa", "dal bhat"...'
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#0F1115] border border-[#262B36] text-sm text-[#F3F4F6] placeholder-[#9CA3AF] focus:outline-none focus:border-[#FFB800]"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-3 rounded-xl bg-[#232834] hover:bg-[#2E3545] border border-[#262B36] text-xs font-bold text-[#FFB800] whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Search
                  </button>
                </form>

                {/* Interactive Language Filter Segmented Control with Live Counts */}
                <div
                  data-testid="language-filter-bar"
                  className="flex items-center gap-1 p-1 bg-[#0F1115] border border-[#262B36] rounded-xl overflow-x-auto"
                >
                  {(
                    [
                      { id: 'ALL', label: `All (${languageCounts.ALL})` },
                      { id: 'NE', label: `🇳🇵 नेपाली (${languageCounts.NE})` },
                      { id: 'HI', label: `🇮🇳 हिन्दी (${languageCounts.HI})` },
                      { id: 'EN', label: `🇬🇧 English (${languageCounts.EN})` },
                      { id: 'NON_VERBAL', label: `🔊 SFX (${languageCounts.NON_VERBAL})` },
                    ] as const
                  ).map((lang) => (
                    <button
                      key={lang.id}
                      type="button"
                      data-testid={`lang-tab-${lang.id}`}
                      onClick={() => setSelectedLanguage(lang.id)}
                      className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        selectedLanguage === lang.id
                          ? 'bg-[#FFB800] text-[#0F1115]'
                          : 'text-[#9CA3AF] hover:text-[#F3F4F6]'
                      }`}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>

                {/* Auto-Organize by Language Shelves Toggle */}
                <button
                  type="button"
                  data-testid="toggle-language-shelves-btn"
                  onClick={() => setGroupByLanguageShelves((prev) => !prev)}
                  className={`px-3.5 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    groupByLanguageShelves
                      ? 'bg-[#132A1E] border-[#10B981] text-[#10B981]'
                      : 'bg-[#0F1115] border-[#262B36] text-[#FFB800] hover:border-[#FFB800]'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>
                    {groupByLanguageShelves
                      ? 'Language Shelves: ON'
                      : 'Organize by Language'}
                  </span>
                </button>
              </div>

              {autoOrganizeBanner && (
                <div className="mt-3 p-3 rounded-xl bg-[#132A1E] border border-[#10B981] text-xs text-[#A7F3D0] flex items-center justify-between gap-2">
                  <span>{autoOrganizeBanner}</span>
                  <button
                    type="button"
                    onClick={() => setAutoOrganizeBanner(null)}
                    className="underline text-[#10B981] cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* Dynamic Trending Tags Section Below Search Bar */}
              <div
                data-testid="trending-tags-section"
                className="mt-4 pt-4 border-t border-[#262B36] space-y-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs">
                    <TrendingUp className="w-3.5 h-3.5 text-[#FFB800] shrink-0" />
                    <span className="font-bold text-[#F3F4F6]">Trending Tags</span>
                    <span aria-hidden="true" className="text-[#9CA3AF]">
                      ·
                    </span>
                    <span className="text-[#9CA3AF]">
                      {searchQuery.trim()
                        ? `Dynamically ranked for "${searchQuery.trim()}"`
                        : lastLoggedSearchTerm
                        ? `Updated from recent search "${lastLoggedSearchTerm}"`
                        : 'Live regional topics ranked by search velocity'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      data-testid="auto-detect-reorganize-btn"
                      onClick={handleAutoOrganizeCatalogByLanguage}
                      className="text-xs font-bold text-[#10B981] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      ✨ Auto-Detect & Organize All Languages
                    </button>
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="text-xs text-[#FF4D4D] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Clear Search Filter
                      </button>
                    )}
                    <label className="flex items-center gap-1.5 text-xs text-[#9CA3AF] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={commercialOnly}
                        onChange={(e) => setCommercialOnly(e.target.checked)}
                        className="accent-[#10B981]"
                      />
                      <span>Commercial-Safe Only</span>
                    </label>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {displayedTrendingTags.map((item, idx) => {
                    const isSelected =
                      normalizeRegionalQuery(searchQuery) === item.normalizedKey ||
                      (Boolean(item.devaLabel) && searchQuery.trim() === item.devaLabel);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleTriggerSearchTag(item.tag)}
                        className={`px-3 py-1.5 rounded-lg border text-xs transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                          isSelected
                            ? 'bg-[#FFB800] text-[#0F1115] border-[#FFB800] font-bold'
                            : item.isQueryMatch
                            ? 'bg-[#232834] text-[#F3F4F6] border-[#FFB800]/60 hover:border-[#FFB800]'
                            : 'bg-[#0F1115] text-[#E5E7EB] border-[#262B36] hover:border-[#FFB800]'
                        }`}
                      >
                        <span className="font-mono-tabular opacity-75">#{idx + 1}</span>
                        <span className="font-semibold">{item.tag}</span>
                        {item.devaLabel && item.devaLabel !== item.tag && (
                          <span
                            className={`font-deva ${
                              isSelected ? 'text-[#0F1115]' : 'text-[#FFB800]'
                            }`}
                          >
                            · {item.devaLabel}
                          </span>
                        )}
                        <span
                          className={`font-mono-tabular text-[11px] ${
                            isSelected ? 'text-[#0F1115]/80' : 'text-[#9CA3AF]'
                          }`}
                        >
                          ({item.searchHits})
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* Instant Soundboard Strip (Multi-File Direct Upload · Auto-Language & Duplicate Check) */}
            {activeTab === 'home' && !searchQuery && (
              <section
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingSoundboard(true);
                }}
                onDragLeave={() => setIsDraggingSoundboard(false)}
                onDrop={handleSoundboardDrop}
                className={`bg-[#181B22] border rounded-2xl p-5 transition-colors ${
                  isDraggingSoundboard
                    ? 'border-[#10B981] bg-[#132A1E]/30'
                    : 'border-[#262B36]'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3.5">
                  <div>
                    <h2 className="text-base font-bold text-[#F3F4F6]">
                      Instant Regional Soundboard Strip (Auto-Language Detection · Shared with Friends)
                    </h2>
                    <p className="text-xs text-[#9CA3AF]">
                      Drop multiple MP3/WAV files — each sound is auto-tagged with its language (NE / HI / EN / SFX), checked for duplicates, and shared publicly with your friends.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {activeAudioId && (
                      <button
                        type="button"
                        onClick={handleStopAllAudio}
                        className="px-3 py-1.5 rounded-lg bg-[#FF4D4D] text-[#0F1115] font-bold text-xs flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Square className="w-3.5 h-3.5 fill-current" />
                        <span>Stop Audio</span>
                      </button>
                    )}
                    <label className="px-3 py-1.5 rounded-lg bg-[#FFB800] hover:bg-[#e6a600] text-[#0F1115] font-bold text-xs flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      <span>
                        {isProcessingBatch
                          ? 'Processing Batch...'
                          : '+ Upload Public Sounds (Multi-File)'}
                      </span>
                      <input
                        type="file"
                        multiple
                        accept="audio/*,video/*"
                        onChange={handleMultiSoundboardInputChange}
                        className="hidden"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setActiveTab('soundboard')}
                      className="px-3 py-1.5 rounded-lg bg-[#232834] hover:bg-[#2E3545] text-[#FFB800] font-semibold text-xs flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>Open Full Soundboard</span>
                    </button>
                  </div>
                </div>

                {batchUploadReport && (
                  <div
                    data-testid="home-batch-upload-summary"
                    className="mb-3 px-4 py-3 rounded-xl bg-[#132A1E] border border-[#10B981] text-xs text-[#F3F4F6] flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="space-y-1">
                      <div className="font-bold text-[#10B981]">
                        Auto-Published {batchUploadReport.addedAssets.length} Public Sound Pad(s) by @{currentUser?.handle || 'you'} (Accessible to Friends!)
                      </div>
                      {batchUploadReport.addedAssets.length > 0 && (
                        <div className="font-mono text-[#A7F3D0]">
                          Auto-Organized:{' '}
                          {batchUploadReport.addedAssets
                            .map((a) => `"${a.title}" → [${a.language}]`)
                            .join(' · ')}
                        </div>
                      )}
                      {batchUploadReport.skippedDuplicates.length > 0 && (
                        <div className="text-[#FDE68A]">
                          Auto-skipped {batchUploadReport.skippedDuplicates.length} duplicate(s):{' '}
                          {batchUploadReport.skippedDuplicates
                            .map(
                              (d) =>
                                `${d.fileName} (${d.duplicateInfo.reason} → "${d.duplicateInfo.matchedAssetTitle}")`
                            )
                            .join(', ')}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setBatchUploadReport(null)}
                      className="text-xs underline text-[#A7F3D0] cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                  {soundboardAssets.slice(0, 5).map((item) => {
                    const isPlaying = activeAudioId === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleTogglePlay(item)}
                        className={`p-3 rounded-xl border text-left transition-colors flex items-center justify-between gap-2.5 cursor-pointer ${
                          isPlaying
                            ? 'bg-[#2D161E] border-[#FF4D4D] text-[#F3F4F6]'
                            : 'bg-[#0F1115] border-[#262B36] hover:border-[#FFB800] text-[#F3F4F6]'
                        }`}
                      >
                        {item.thumbnailDataUrl && (
                          <img
                            src={item.thumbnailDataUrl}
                            alt={item.title}
                            className="w-10 h-10 rounded-lg object-cover border border-[#262B36] shrink-0"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold font-deva text-[#FFB800] truncate">
                            {item.transcriptDeva}
                          </div>
                          <div className="text-xs text-[#9CA3AF] truncate">
                            [{item.language}] @{item.uploaderHandle} · ♥ {item.likeCount ?? 0}
                          </div>
                        </div>
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                            isPlaying
                              ? 'bg-[#FF4D4D] text-[#0F1115]'
                              : 'bg-[#FFB800] text-[#0F1115]'
                          }`}
                        >
                          {isPlaying ? (
                            <Square className="w-4 h-4 fill-current" />
                          ) : (
                            <Play className="w-4 h-4 fill-current" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Media Type Filter Bar (Includes Audio Dialogues, Meme Videos, Animated GIFs, Blank Templates, Sound Effects) */}
            <div
              data-testid="media-type-filter-bar"
              className="flex flex-wrap items-center justify-between gap-3"
            >
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {(
                  [
                    { id: 'ALL', label: 'All Media' },
                    { id: 'AUDIO_DIALOGUE', label: 'Audio Dialogues' },
                    { id: 'VIDEO_CLIP', label: 'Meme Videos' },
                    { id: 'GIF', label: 'Animated GIFs' },
                    { id: 'IMAGE_TEMPLATE', label: 'Blank Templates' },
                    { id: 'SOUND_EFFECT', label: 'Sound Effects' },
                  ] as const
                ).map((mt) => (
                  <button
                    key={mt.id}
                    type="button"
                    data-testid={`filter-media-${mt.id}`}
                    onClick={() => setSelectedMediaType(mt.id)}
                    className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      selectedMediaType === mt.id
                        ? 'bg-[#232834] text-[#FFB800] border border-[#FFB800]/50'
                        : 'bg-[#181B22] text-[#9CA3AF] border border-[#262B36] hover:text-[#F3F4F6]'
                    }`}
                  >
                    {mt.label}
                  </button>
                ))}
                {currentUser && (
                  <button
                    type="button"
                    data-testid="filter-my-uploads-btn"
                    onClick={() => setOnlyMyUploads((prev) => !prev)}
                    className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      onlyMyUploads
                        ? 'bg-[#132A1E] text-[#10B981] border border-[#10B981]'
                        : 'bg-[#181B22] text-[#10B981] border border-[#262B36] hover:border-[#10B981]'
                    }`}
                  >
                    My Uploads ({myLinkedUploadsCount})
                  </button>
                )}
              </div>

              <div className="text-xs text-[#9CA3AF] font-mono-tabular">
                Showing {filteredPublicAssets.length} public assets · Session:{' '}
                {authSessionReady ? `@${currentUser?.handle || 'guest'}` : 'Restoring...'}
              </div>
            </div>

            {/* ZERO-RESULTS RECOVERY FLOW */}
            {filteredPublicAssets.length === 0 ? (
              <div
                data-testid="zero-results-recovery"
                className="bg-[#181B22] border border-[#262B36] rounded-2xl p-6 max-w-2xl mx-auto text-center space-y-4"
              >
                <h2 className="text-lg font-bold text-[#F3F4F6]">
                  No Verified Assets Found for "{searchQuery}"
                </h2>
                <p className="text-xs text-[#9CA3AF]">
                  We logged this normalized query (
                  <code className="font-mono">{normalizeRegionalQuery(searchQuery)}</code>) without
                  storing personal IP data so our creators know what dialogue or template is
                  missing.
                </p>

                <div className="flex flex-wrap justify-center gap-2">
                  <span className="text-xs text-[#9CA3AF]">Did you mean:</span>
                  {['k ho yo', 'yastai cha jindagi', 'arey bhai bhai', 'paisa hi paisa'].map(
                    (sug) => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => setSearchQuery(sug)}
                        className="text-xs text-[#FFB800] underline cursor-pointer"
                      >
                        "{sug}"
                      </button>
                    )
                  )}
                </div>

                {requestSubmittedMsg ? (
                  <div className="p-3 rounded-xl bg-[#132A1E] border border-[#10B981] text-xs text-[#A7F3D0]">
                    {requestSubmittedMsg}
                  </div>
                ) : (
                  <form
                    onSubmit={handleRequestMissingMeme}
                    className="pt-3 border-t border-[#262B36] flex flex-col sm:flex-row gap-2"
                  >
                    <input
                      type="text"
                      value={requestDescription}
                      onChange={(e) => setRequestDescription(e.target.value)}
                      placeholder="Describe the scene, dialogue, or reference context..."
                      className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#0F1115] border border-[#262B36] text-xs text-[#F3F4F6]"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2.5 rounded-xl bg-[#FFB800] text-[#0F1115] font-bold text-xs whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Request This Meme
                    </button>
                  </form>
                )}
              </div>
            ) : groupByLanguageShelves ? (
              /* ORGANIZED BY LANGUAGE SHELVES VIEW */
              <div data-testid="organized-language-shelves" className="space-y-8">
                {languageShelves.map((shelf) => (
                  <section
                    key={shelf.language}
                    data-testid={`language-shelf-${shelf.language}`}
                    className="bg-[#181B22]/60 border border-[#262B36] rounded-2xl p-5 space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#262B36]">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{shelf.flag}</span>
                          <h2 className="text-lg font-extrabold text-[#F3F4F6]">
                            {shelf.label} ({shelf.assets.length})
                          </h2>
                          <span className="text-sm font-deva text-[#FFB800]">
                            · {shelf.nativeLabel}
                          </span>
                        </div>
                        <p className="text-xs text-[#9CA3AF] mt-0.5">{shelf.subtitle}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedLanguage(shelf.language);
                          setGroupByLanguageShelves(false);
                        }}
                        className="text-xs font-bold text-[#FFB800] hover:underline cursor-pointer"
                      >
                        Filter Only {shelf.language} →
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                      {shelf.assets.map((asset) => renderAssetCard(asset))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              /* UNIFIED PUBLIC GRID */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {filteredPublicAssets.map((asset) => renderAssetCard(asset))}
              </div>
            )}

            {/* Curated Regional Collections */}
            {activeTab === 'home' && (
              <section className="pt-4">
                <div className="mb-4">
                  <h2 className="text-lg font-bold text-[#F3F4F6]">
                    Curated Regional Collections (`/c/[slug]`)
                  </h2>
                  <p className="text-xs text-[#9CA3AF]">
                    Themed packs for Nepali hostel life, Indian gaming streams, and hackathon nights.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {INITIAL_COLLECTIONS.map((col) => (
                    <div
                      key={col.id}
                      className="bg-[#181B22] border border-[#262B36] rounded-2xl p-5 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2 text-xs text-[#9CA3AF]">
                          <span>{col.language}</span>
                          <span aria-hidden="true">·</span>
                          <span>{col.assetIds.length} verified items</span>
                          {col.isSponsored && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-[#FFB800] font-semibold">
                                Sponsored Challenge
                              </span>
                            </>
                          )}
                        </div>
                        <h3 className="text-base font-bold text-[#F3F4F6] mt-1.5">
                          {col.title}
                        </h3>
                        <p className="text-xs font-deva text-[#FFB800] mt-0.5">
                          {col.titleDeva}
                        </p>
                        <p className="text-xs text-[#9CA3AF] mt-2">{col.description}</p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-[#262B36] flex items-center justify-between">
                        <span className="text-xs text-[#9CA3AF]">@{col.ownerHandle}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedLanguage(col.language === 'EN' ? 'ALL' : col.language);
                            setActiveTab('explore');
                          }}
                          className="text-xs font-bold text-[#FFB800] hover:underline cursor-pointer"
                        >
                          Browse Collection →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* =============================================================== */}
        {/* ORIGINAL AUDIO SOUNDBOARD (/soundboard)                         */}
        {/* =============================================================== */}
        {activeTab === 'soundboard' && (
          <div>
            {/* Soundboard Control Bar */}
            <div className="bg-[#181B22] border-b border-[#262B36] px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-[#FFB800]" />
                <div>
                  <span className="text-xs sm:text-sm font-bold text-[#F3F4F6]">
                    Public Streamer Soundboard (Auto-Language Organized · Shared with Friends)
                  </span>
                  <p className="text-[11px] text-[#9CA3AF]">
                    Select or drop multiple audio files — each file is auto-organized by language (NE / HI / EN / SFX) and shared publicly so your friends can play & download it.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label
                  data-testid="soundboard-quick-upload-label"
                  className="px-3.5 py-2 rounded-lg bg-[#FFB800] hover:bg-[#e6a600] text-[#0F1115] font-bold text-xs flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>
                    {isProcessingBatch
                      ? 'Processing Audio Batch...'
                      : '+ Upload Public Sounds (Multi-File)'}
                  </span>
                  <input
                    data-testid="soundboard-multi-file-input"
                    type="file"
                    multiple
                    accept="audio/*,video/*"
                    onChange={handleMultiSoundboardInputChange}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => setActiveTab('upload')}
                  className="px-3 py-2 rounded-lg bg-[#232834] hover:bg-[#2E3545] border border-[#262B36] text-xs font-semibold text-[#F3F4F6] whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Batch Studio & Mic Recorder
                </button>

                <button
                  type="button"
                  onClick={handleStopAllAudio}
                  className="px-3.5 py-2 rounded-lg bg-[#FF4D4D] text-[#0F1115] font-bold text-xs flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Stop All Audio (Esc)</span>
                </button>
              </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
              {/* Language Filter Bar inside Soundboard */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  {(
                    [
                      { id: 'ALL', label: `All Languages (${languageCounts.ALL})` },
                      { id: 'NE', label: `🇳🇵 नेपाली (${languageCounts.NE})` },
                      { id: 'HI', label: `🇮🇳 हिन्दी (${languageCounts.HI})` },
                      { id: 'EN', label: `🇬🇧 English (${languageCounts.EN})` },
                      { id: 'NON_VERBAL', label: `🔊 SFX (${languageCounts.NON_VERBAL})` },
                    ] as const
                  ).map((lang) => (
                    <button
                      key={lang.id}
                      type="button"
                      onClick={() => setSelectedLanguage(lang.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                        selectedLanguage === lang.id
                          ? 'bg-[#FFB800] text-[#0F1115]'
                          : 'bg-[#181B22] border border-[#262B36] text-[#9CA3AF] hover:text-[#F3F4F6]'
                      }`}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-[#9CA3AF] font-mono-tabular">
                  Uploading as @{currentUser?.handle || 'guest'} ({currentRole})
                </span>
              </div>

              {/* Interactive Multi-File Drag-and-Drop Soundboard Zone */}
              <div
                data-testid="soundboard-dropzone"
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingSoundboard(true);
                }}
                onDragLeave={() => setIsDraggingSoundboard(false)}
                onDrop={handleSoundboardDrop}
                className={`rounded-2xl border-2 border-dashed p-5 transition-colors flex flex-col sm:flex-row items-center justify-between gap-4 ${
                  isDraggingSoundboard
                    ? 'border-[#10B981] bg-[#132A1E]/40'
                    : 'border-[#262B36] bg-[#181B22]/70 hover:border-[#FFB800]/60'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#0F1115] border border-[#262B36] flex items-center justify-center shrink-0">
                    <Upload className="w-5 h-5 text-[#FFB800]" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-[#F3F4F6]">
                      Drag & Drop Multiple Audio Files Here (Auto-Detects Language & Publishes to Friends)
                    </h2>
                    <p className="text-xs text-[#9CA3AF] mt-0.5">
                      Each audio file becomes its own public Soundboard pad · Automatic SHA-256 duplicate check · Auto-organized into Nepali, Hindi, English, or SFX
                    </p>
                  </div>
                </div>

                <label className="px-4 py-2.5 rounded-xl bg-[#0F1115] hover:bg-[#232834] border border-[#FFB800]/60 text-xs font-bold text-[#FFB800] whitespace-nowrap shrink-0 cursor-pointer">
                  Select Multiple Files (MP3 / WAV / OGG / M4A)
                  <input
                    type="file"
                    multiple
                    accept="audio/*,video/*"
                    onChange={handleMultiSoundboardInputChange}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Batch Upload & Automatic Duplicate Check Report Banner */}
              {batchUploadReport && (
                <div
                  data-testid="batch-upload-summary"
                  className="p-4 rounded-2xl bg-[#181B22] border border-[#10B981] text-xs space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-bold text-[#10B981]">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>
                        Auto-Published {batchUploadReport.addedAssets.length} New Public Sound Pad
                        {batchUploadReport.addedAssets.length === 1 ? '' : 's'} Directly to Shared Soundboard
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBatchUploadReport(null)}
                      className="text-xs text-[#9CA3AF] hover:text-[#F3F4F6] underline cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>

                  {batchUploadReport.addedAssets.length > 0 && (
                    <div className="text-[#A7F3D0] font-mono">
                      Added Public Pads:{' '}
                      {batchUploadReport.addedAssets
                        .map(
                          (a) =>
                            `"${a.title}" [${a.language} · @${a.uploaderHandle}] (${(
                              (a.durationMs ?? 3000) / 1000
                            ).toFixed(1)}s)`
                        )
                        .join(' · ')}
                    </div>
                  )}

                  {batchUploadReport.skippedDuplicates.length > 0 && (
                    <div
                      data-testid="duplicate-skipped-alert"
                      className="pt-2 border-t border-[#262B36] flex items-start gap-2 text-[#F59E0B]"
                    >
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">
                          Auto-Checked & Skipped {batchUploadReport.skippedDuplicates.length} Duplicate File
                          {batchUploadReport.skippedDuplicates.length === 1 ? '' : 's'}:
                        </span>{' '}
                        {batchUploadReport.skippedDuplicates
                          .map(
                            (d) =>
                              `${d.fileName} [${d.duplicateInfo.reason} — matches "${d.duplicateInfo.matchedAssetTitle}"]`
                          )
                          .join(' · ')}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {soundboardAssets.map((pad, idx) => {
                  const isPlaying = activeAudioId === pad.id;
                  const isLiked = likedIds.includes(pad.id);
                  return (
                    <div
                      key={pad.id}
                      data-testid={`soundboard-pad-${idx + 1}`}
                      className={`rounded-2xl border p-5 transition-all flex flex-col justify-between ${
                        isPlaying
                          ? 'bg-[#2D161E] border-[#FF4D4D] shadow-lg'
                          : 'bg-[#181B22] border-[#262B36] hover:border-[#FFB800]'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between text-xs font-mono-tabular text-[#9CA3AF]">
                          <span>
                            PAD {String(idx + 1).padStart(2, '0')} · @{pad.uploaderHandle}
                          </span>
                          <span className="text-[#FFB800] font-bold">
                            {pad.language} · {((pad.durationMs ?? 3000) / 1000).toFixed(1)}s
                          </span>
                        </div>

                        {/* Audio Pad Visual Header with Custom Audio Thumbnail Option */}
                        <div className="mt-2.5 flex items-center gap-3">
                          {pad.thumbnailDataUrl ? (
                            <img
                              data-testid={`pad-thumb-img-${idx + 1}`}
                              src={pad.thumbnailDataUrl}
                              alt={`Thumbnail for ${pad.title}`}
                              className="w-12 h-12 rounded-xl object-cover border border-[#FFB800] shrink-0"
                            />
                          ) : (
                            <label
                              title="Upload custom visual thumbnail for this audio pad"
                              className="w-12 h-12 rounded-xl bg-[#0F1115] border border-dashed border-[#374151] hover:border-[#10B981] flex flex-col items-center justify-center text-[#9CA3AF] hover:text-[#10B981] cursor-pointer shrink-0 transition-colors"
                            >
                              <ImageIcon className="w-4 h-4" />
                              <span className="text-[9px] font-semibold mt-0.5">Thumb</span>
                              <input
                                data-testid={`pad-thumb-input-${idx + 1}`}
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                onChange={(e) => handlePadQuickThumbnailUpload(pad.id, e)}
                                className="hidden"
                              />
                            </label>
                          )}

                          <div className="min-w-0 flex-1">
                            <h3 className="text-base font-extrabold font-deva text-[#FFB800] line-clamp-1">
                              {pad.transcriptDeva}
                            </h3>
                            <p className="text-xs font-medium text-[#F3F4F6] mt-0.5 line-clamp-1">
                              "{pad.transcriptRoman}"
                            </p>
                            {pad.originalFileName && (
                              <p className="text-[11px] font-mono text-[#10B981] mt-0.5 truncate">
                                File: {pad.originalFileName}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* 32-bar Real Waveform */}
                        <div className="mt-3.5 flex items-end gap-[2px] h-8 bg-[#0F1115] p-2 rounded-lg border border-[#262B36]">
                          {(Array.isArray(pad.waveformPeaks) && pad.waveformPeaks.length > 0
                            ? pad.waveformPeaks
                            : Array.from({ length: 32 }, (_, i) => 28 + ((i * 17) % 60))
                          )
                            .slice(0, 32)
                            .map((peak, i) => {
                              const played = isPlaying && i / 32 <= audioProgress;
                              return (
                                <div
                                  key={i}
                                  className="flex-1 rounded-t"
                                  style={{
                                    height: `${Math.max(18, peak)}%`,
                                    backgroundColor: played
                                      ? '#FF4D4D'
                                      : pad.posterPalette?.accent || '#FFB800',
                                  }}
                                />
                              );
                            })}
                        </div>
                      </div>

                      <div className="mt-4 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleTogglePlay(pad)}
                          className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer ${
                            isPlaying
                              ? 'bg-[#FF4D4D] text-[#0F1115]'
                              : 'bg-[#FFB800] text-[#0F1115] hover:bg-[#e6a600]'
                          }`}
                        >
                          {isPlaying ? (
                            <>
                              <Square className="w-3.5 h-3.5 fill-current" />
                              <span>Stop</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>Play</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleLike(pad.id)}
                          className={`px-2.5 py-2.5 rounded-xl border text-xs font-mono-tabular flex items-center gap-1 cursor-pointer ${
                            isLiked
                              ? 'bg-[#F43F5E]/15 border-[#F43F5E] text-[#F43F5E] font-bold'
                              : 'bg-[#0F1115] border-[#262B36] text-[#9CA3AF]'
                          }`}
                        >
                          <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} />
                          <span>{pad.likeCount ?? 0}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setInspectingAssetId(pad.id)}
                          aria-label={`Inspect or download ${pad.title}`}
                          className="p-2.5 rounded-xl bg-[#0F1115] border border-[#262B36] text-[#9CA3AF] hover:text-[#F3F4F6] cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* =============================================================== */}
        {/* IMAGE MEME EDITOR (/editor)                                     */}
        {/* =============================================================== */}
        {activeTab === 'editor' && (
          <MemeEditorStudio
            templates={assets.filter((a) => a.moderationStatus === 'APPROVED_PUBLIC')}
            initialTemplate={editorTemplate}
            onPublishRemix={(newRemix) => {
              handlePublishRemix(newRemix);
            }}
          />
        )}

        {/* =============================================================== */}
        {/* BATCH UPLOAD & VOICE RECORDING STUDIO (/upload)                 */}
        {/* =============================================================== */}
        {activeTab === 'upload' && (
          <UploadWizardView
            existingAssets={assets}
            currentUser={currentUser}
            onOpenAuthModal={() => setShowAuthModal(true)}
            onBatchUploadPublished={handleBatchUploadPublished}
            onNavigateToSoundboard={() => setActiveTab('soundboard')}
            onNavigateToHome={() => setActiveTab('home')}
          />
        )}

        {/* =============================================================== */}
        {/* SAVED FAVORITES & CUSTOM SOUNDBOARDS (/saved)                   */}
        {/* =============================================================== */}
        {activeTab === 'saved' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
            <div className="pb-5 border-b border-[#262B36]">
              <p className="text-xs text-[#FFB800] font-medium">
                Personal Collection & Custom Streamer Soundboard
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#F3F4F6] mt-1">
                Saved Memes & Audio Pads ({savedIds.length})
              </h1>
            </div>

            {savedIds.length === 0 ? (
              <div className="bg-[#181B22] border border-[#262B36] rounded-2xl p-8 text-center">
                <p className="text-sm text-[#9CA3AF]">
                  You have no saved items yet. Tap the bookmark icon on any meme or audio clip to
                  build your custom soundboard.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {assets
                  .filter(
                    (a) =>
                      savedIds.includes(a.id) &&
                      a.moderationStatus === 'APPROVED_PUBLIC'
                  )
                  .map((asset) => renderAssetCard(asset))}
              </div>
            )}
          </div>
        )}

        {/* =============================================================== */}
        {/* ADMIN MODERATION & BLUEPRINT ARCHITECTURE (/admin)              */}
        {/* =============================================================== */}
        {activeTab === 'admin' && (
          <AdminAndBlueprintView
            currentRole={currentRole}
            isServerOrFirestoreVerifiedAdmin={adminAccessVerification.allowed}
            adminVerificationReason={adminAccessVerification.reason}
            onOpenAuthModal={() => setShowAuthModal(true)}
            onReturnHome={() => {
              if (window.location.hash) window.location.hash = '#home';
              setActiveTab('home');
            }}
            assets={assets}
            moderationHistory={moderationHistory}
            zeroResultRequests={zeroResultRequests}
            onApproveAsset={handleApproveAsset}
            onRejectAsset={handleRejectAsset}
            onTakedownAsset={handleTakedownAsset}
            onSimulateThreePrivacyReports={handleSimulateThreePrivacyReports}
          />
        )}
      </main>

      {/* LOGIN, REGISTER & CREATOR ACCOUNT MODAL */}
      {showAuthModal && (
        <AuthAccountModal
          currentUser={currentUser}
          assets={assets}
          onClose={() => setShowAuthModal(false)}
          onAuthenticated={(user) => {
            try {
              localStorage.removeItem('memechowk_logged_out_v1');
              localStorage.setItem('memechowk_auth_user_v1', JSON.stringify(user));
            } catch {
              // ignore
            }
            setCurrentUser(user);
            setAssets((prev) => linkUserCredentialsToUploadedAssets(prev, user));
            fetchSharedCatalogFromServer();
          }}
          onLogout={() => {
            try {
              localStorage.setItem('memechowk_logged_out_v1', '1');
              localStorage.removeItem('memechowk_auth_user_v1');
            } catch {
              // ignore
            }
            signOutFirebaseUser().catch(() => {});
            setCurrentUser(null);
            setServerVerifiedAdmin(false);
            setFirestoreVerifiedAdmin(false);
          }}
          onDeleteOwnAsset={handleDeleteOwnAsset}
          onInspectAsset={(id) => setInspectingAssetId(id)}
        />
      )}

      {/* ASSET DETAIL MODAL (/a/[slug]) */}
      {inspectingAsset && (
        <AssetDetailModal
          asset={inspectingAsset}
          isPlaying={activeAudioId === inspectingAsset.id}
          audioProgress={audioProgress}
          isSaved={savedIds.includes(inspectingAsset.id)}
          isLiked={likedIds.includes(inspectingAsset.id)}
          onClose={() => setInspectingAssetId(null)}
          onTogglePlay={handleTogglePlay}
          onToggleSave={handleToggleSave}
          onToggleLike={handleToggleLike}
          onRecordShare={(id) => handleEngageWithAsset(id, 'SHARE')}
          onOpenInEditor={handleOpenInEditor}
          onRecordDownload={handleRecordDownload}
          onSubmitReport={handleSubmitReport}
          onAttachCustomAudio={handleAttachCustomAudio}
          onAttachAudioThumbnail={handleAttachAudioThumbnail}
        />
      )}

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 h-14 bg-[#0F1115]/95 border-t border-[#262B36] grid grid-cols-5 items-center px-1"
      >
        {(
          [
            { id: 'home', label: 'Home', Icon: Home },
            { id: 'soundboard', label: 'Soundboard', Icon: Compass },
            { id: 'editor', label: 'Editor', Icon: Sparkles },
            { id: 'upload', label: 'Upload', Icon: PlusCircle },
            rolePermissions.canAccessAdminConsole
              ? { id: 'admin', label: 'Admin', Icon: Shield }
              : { id: 'saved', label: 'Saved', Icon: Bookmark },
          ] as const
        ).map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`flex flex-col items-center justify-center h-11 rounded-lg transition-colors cursor-pointer ${
              activeTab === id ? 'text-[#FFB800]' : 'text-[#9CA3AF]'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="text-[10px] font-medium mt-0.5 whitespace-nowrap">{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
