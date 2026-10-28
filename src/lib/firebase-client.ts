import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  autoDetectAssetLanguageAndRegion,
  buildAutoApprovedSoundboardAsset,
  LanguageCode,
  MediaType,
  MemeAsset,
  RegionCode,
  UserRole,
} from './domain-logic';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): void {
  const msg = error instanceof Error ? error.message : String(error);
  if (
    msg.includes('Quota limit exceeded') ||
    msg.includes('resource-exhausted') ||
    msg.includes('the client is offline')
  ) {
    return;
  }
  const errInfo: FirestoreErrorInfo = {
    error: msg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export interface AuthenticatedCreatorAccount {
  uid: string;
  displayName: string;
  handle: string;
  email: string;
  primaryLanguage: LanguageCode;
  role: UserRole;
  authSource: 'GOOGLE_FIREBASE' | 'CHOWK_ACCOUNT';
}

const MAX_CHUNK_CHARS = 550000;
const mediaMemoryCache = new Map<string, string>();
const thumbMemoryCache = new Map<string, string>();

export function sanitizeFirestoreId(raw: string): string {
  const cleaned = String(raw || 'item')
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .slice(0, 120);
  return cleaned.length >= 1 ? cleaned : 'item_1';
}

export function sanitizeHandle(raw: string): string {
  const cleaned = String(raw || 'creator')
    .trim()
    .replace(/^@/, '')
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .toLowerCase()
    .slice(0, 40);
  return cleaned.length >= 2 ? cleaned : `${cleaned}_np`;
}

export async function hashPasswordClient(rawPassword: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoded = new TextEncoder().encode(`memechowk-salt:${rawPassword}`);
    const digest = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return `hash_${btoa(rawPassword).replace(/[^a-zA-Z0-9]/g, '')}_mc2026`;
}

export async function registerChowkAccountInCloud(params: {
  uid: string;
  handle: string;
  displayName: string;
  primaryLanguage: LanguageCode;
  passwordHash: string;
}): Promise<void> {
  const cleanHandle = sanitizeHandle(params.handle);
  const cleanUid = sanitizeFirestoreId(params.uid);
  const path = `chowk_accounts/${cleanHandle}`;
  try {
    const existing = await getDoc(doc(db, 'chowk_accounts', cleanHandle));
    if (!existing.exists()) {
      await setDoc(doc(db, 'chowk_accounts', cleanHandle), {
        uid: cleanUid,
        handle: cleanHandle,
        displayName: String(params.displayName || cleanHandle).slice(0, 80),
        primaryLanguage: params.primaryLanguage,
        role: 'CREATOR',
        passwordHash: params.passwordHash.slice(0, 128),
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function loginChowkAccountFromCloud(
  handleOrId: string,
  rawPassword: string
): Promise<AuthenticatedCreatorAccount | null> {
  const cleanHandle = sanitizeHandle(handleOrId);
  const path = `chowk_accounts/${cleanHandle}`;
  try {
    const snap = await getDoc(doc(db, 'chowk_accounts', cleanHandle));
    if (!snap.exists()) return null;
    const data = snap.data();
    const clientHash = await hashPasswordClient(rawPassword);
    if (data.passwordHash !== clientHash) {
      return null;
    }
    return {
      uid: String(data.uid || `usr-${cleanHandle}`),
      displayName: String(data.displayName || cleanHandle),
      handle: String(data.handle || cleanHandle),
      email: `${cleanHandle}@memechowk.np`,
      primaryLanguage: (data.primaryLanguage as LanguageCode) || 'NE',
      role: data.role === 'ADMIN' ? 'ADMIN' : 'CREATOR',
      authSource: 'CHOWK_ACCOUNT',
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
}

export async function signInWithGoogleAndProvisionProfile(
  preferredHandle?: string,
  preferredLanguage: LanguageCode = 'NE'
): Promise<AuthenticatedCreatorAccount> {
  const provider = new GoogleAuthProvider();
  const credential = await signInWithPopup(auth, provider);
  const fbUser = credential.user;

  const isAdmin =
    fbUser.email?.toLowerCase() === 'pantsubash30@gmail.com' && fbUser.emailVerified;
  const role: UserRole = isAdmin ? 'ADMIN' : 'CREATOR';
  const cleanHandle = sanitizeHandle(
    preferredHandle || fbUser.email?.split('@')[0] || fbUser.displayName || 'creator'
  );

  const cleanName = (fbUser.displayName || cleanHandle).slice(0, 80);
  const uid = sanitizeFirestoreId(fbUser.uid);

  const publicPath = `users_public/${uid}`;
  try {
    const existingSnap = await getDoc(doc(db, 'users_public', uid));
    if (!existingSnap.exists()) {
      await setDoc(doc(db, 'users_public', uid), {
        uid,
        displayName: cleanName,
        handle: cleanHandle,
        primaryLanguage: preferredLanguage,
        role,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, publicPath);
  }

  if (fbUser.email) {
    const privatePath = `users_private/${uid}`;
    try {
      const existingPriv = await getDoc(doc(db, 'users_private', uid));
      if (!existingPriv.exists()) {
        await setDoc(doc(db, 'users_private', uid), {
          uid,
          email: fbUser.email.slice(0, 160),
          createdAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, privatePath);
    }
  }

  return {
    uid,
    displayName: cleanName,
    handle: cleanHandle,
    email: fbUser.email || '',
    primaryLanguage: preferredLanguage,
    role,
    authSource: 'GOOGLE_FIREBASE',
  };
}

/**
 * Resolves a persistent Firebase Auth `User` (from `onAuthStateChanged` in App.tsx)
 * into a full `AuthenticatedCreatorAccount`, hydrating or provisioning `/users_public/{uid}`
 * and checking Firestore `/admins/{uid}` so user credentials and role persist across reloads.
 */
export async function resolvePersistentUserSession(
  fbUser: User
): Promise<AuthenticatedCreatorAccount> {
  const uid = sanitizeFirestoreId(fbUser.uid);
  let isAdmin =
    fbUser.email?.toLowerCase() === 'pantsubash30@gmail.com' && fbUser.emailVerified;

  if (!isAdmin) {
    try {
      const adminSnap = await getDoc(doc(db, 'admins', uid));
      if (adminSnap.exists()) {
        isAdmin = true;
      }
    } catch {
      // Non-admin user is expectedly denied by Firestore Security Rules on /admins/{adminId}
    }
  }

  const fallbackHandle = sanitizeHandle(
    fbUser.email?.split('@')[0] || fbUser.displayName || 'creator'
  );
  const fallbackName = (fbUser.displayName || fallbackHandle).slice(0, 80);
  const resolvedRole: UserRole = isAdmin ? 'ADMIN' : 'CREATOR';

  try {
    const publicSnap = await getDoc(doc(db, 'users_public', uid));
    if (publicSnap.exists()) {
      const data = publicSnap.data();
      return {
        uid,
        displayName: String(data.displayName || fallbackName),
        handle: String(data.handle || fallbackHandle),
        email: fbUser.email || `${fallbackHandle}@memechowk.np`,
        primaryLanguage: (data.primaryLanguage as LanguageCode) || 'NE',
        role: isAdmin || data.role === 'ADMIN' ? 'ADMIN' : 'CREATOR',
        authSource: 'GOOGLE_FIREBASE',
      };
    }

    await setDoc(doc(db, 'users_public', uid), {
      uid,
      displayName: fallbackName,
      handle: fallbackHandle,
      primaryLanguage: 'NE',
      role: resolvedRole,
      createdAt: serverTimestamp(),
    });
  } catch {
    // Fallback to in-memory profile if offline
  }

  return {
    uid,
    displayName: fallbackName,
    handle: fallbackHandle,
    email: fbUser.email || `${fallbackHandle}@memechowk.np`,
    primaryLanguage: 'NE',
    role: resolvedRole,
    authSource: 'GOOGLE_FIREBASE',
  };
}

/**
 * Enforces Firestore Security Rule verification on `/admins/{adminId}` (`allow get: if isValidId(adminId) && isAdmin()`).
 * Non-admin users are rejected by Firestore Security Rules (`PERMISSION_DENIED`) and return `false`.
 */
export async function verifyAdminAccessInFirestore(
  user: AuthenticatedCreatorAccount | null
): Promise<boolean> {
  if (!user || user.role !== 'ADMIN') return false;
  if (!auth.currentUser) return false;
  const uid = sanitizeFirestoreId(auth.currentUser.uid);
  try {
    await getDoc(doc(db, 'admins', uid));
    return true;
  } catch {
    return false;
  }
}

export async function signOutFirebaseUser(): Promise<void> {
  if (auth.currentUser) {
    await signOut(auth);
  }
}

export function subscribeToFirebaseAuth(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

function splitDataUrlIntoChunks(dataUrl: string | undefined, maxChunks: number): string[] {
  if (!dataUrl || !dataUrl.startsWith('data:')) return [];
  const chunks: string[] = [];
  for (let i = 0; i < dataUrl.length; i += MAX_CHUNK_CHARS) {
    chunks.push(dataUrl.slice(i, i + MAX_CHUNK_CHARS));
  }
  if (chunks.length > maxChunks) {
    return [];
  }
  return chunks;
}

async function uploadMediaChunksToFirestore(
  cleanAssetId: string,
  mediaKind: 'MEDIA' | 'THUMB',
  mimeType: string,
  chunks: string[]
): Promise<boolean> {
  if (chunks.length === 0) return false;
  const safeMime = (mimeType || 'application/octet-stream').slice(0, 80);
  await Promise.all(
    chunks.map(async (chunkStr, idx) => {
      const chunkDocId = sanitizeFirestoreId(`${cleanAssetId}_${mediaKind}_${idx}`);
      const path = `public_asset_media/${chunkDocId}`;
      try {
        const existing = await getDoc(doc(db, 'public_asset_media', chunkDocId));
        if (!existing.exists()) {
          await setDoc(doc(db, 'public_asset_media', chunkDocId), {
            id: chunkDocId,
            assetId: cleanAssetId,
            mediaKind,
            chunkIndex: idx,
            totalChunks: chunks.length,
            mimeType: safeMime,
            dataChunk: chunkStr,
            createdAt: serverTimestamp(),
          });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      }
    })
  );
  return true;
}

export async function fetchAssetMediaFromFirestore(
  assetId: string,
  mediaKind: 'MEDIA' | 'THUMB',
  chunkCount: number
): Promise<string | null> {
  const cleanAssetId = sanitizeFirestoreId(assetId);
  if (chunkCount <= 0) return null;

  const cache = mediaKind === 'MEDIA' ? mediaMemoryCache : thumbMemoryCache;
  if (cache.has(cleanAssetId)) {
    return cache.get(cleanAssetId) || null;
  }

  try {
    const indices = Array.from({ length: chunkCount }, (_, i) => i);
    const parts = await Promise.all(
      indices.map(async (idx) => {
        const chunkDocId = sanitizeFirestoreId(`${cleanAssetId}_${mediaKind}_${idx}`);
        const path = `public_asset_media/${chunkDocId}`;
        try {
          const snap = await getDoc(doc(db, 'public_asset_media', chunkDocId));
          if (!snap.exists()) return null;
          const data = snap.data();
          return typeof data.dataChunk === 'string' ? data.dataChunk : null;
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, path);
        }
      })
    );

    if (parts.some((p) => !p)) return null;
    const fullDataUrl = parts.join('');
    cache.set(cleanAssetId, fullDataUrl);
    return fullDataUrl;
  } catch {
    return null;
  }
}

/**
 * Syncs a published MemeAsset AND its binary media/thumbnail chunks to Firestore
 * so that all friends and the published link (`ais-pre`) immediately receive both
 * the catalog listing and the playable/downloadable original media.
 */
export async function syncPublicAssetToFirestore(
  asset: MemeAsset,
  explicitMediaDataUrl?: string,
  explicitThumbDataUrl?: string
): Promise<void> {
  const cleanId = sanitizeFirestoreId(asset.id);
  const rawMedia =
    explicitMediaDataUrl && explicitMediaDataUrl.startsWith('data:')
      ? explicitMediaDataUrl
      : asset.mediaDataUrl && asset.mediaDataUrl.startsWith('data:')
      ? asset.mediaDataUrl
      : undefined;
  const rawThumb =
    explicitThumbDataUrl && explicitThumbDataUrl.startsWith('data:')
      ? explicitThumbDataUrl
      : asset.thumbnailDataUrl && asset.thumbnailDataUrl.startsWith('data:')
      ? asset.thumbnailDataUrl
      : undefined;

  if (rawMedia) {
    mediaMemoryCache.set(cleanId, rawMedia);
  }
  if (rawThumb) {
    thumbMemoryCache.set(cleanId, rawThumb);
  }

  const mediaChunks = splitDataUrlIntoChunks(rawMedia, 40);
  const thumbChunks = splitDataUrlIntoChunks(rawThumb, 10);

  if (mediaChunks.length > 0) {
    await uploadMediaChunksToFirestore(
      cleanId,
      'MEDIA',
      asset.originalMimeType || 'audio/mpeg',
      mediaChunks
    );
  }
  if (thumbChunks.length > 0) {
    await uploadMediaChunksToFirestore(cleanId, 'THUMB', 'image/png', thumbChunks);
  }

  const uid = sanitizeFirestoreId(
    auth.currentUser?.uid || asset.uploaderUid || 'usr_creator_aarav'
  );
  const cleanHandle = sanitizeHandle(asset.uploaderHandle || 'aarav_ktm');
  const path = `public_assets/${cleanId}`;

  const payload = {
    id: cleanId,
    slug: String(asset.slug || cleanId).slice(0, 140),
    title: String(asset.title || 'Meme Clip').slice(0, 140),
    mediaType: asset.mediaType,
    language: asset.language,
    region: asset.region,
    category: String(asset.category || 'Regional Meme').slice(0, 80),
    emotion: String(asset.emotion || 'Reaction').slice(0, 80),
    transcriptDeva: String(asset.transcriptDeva || asset.title || 'मिम').slice(0, 300),
    transcriptRoman: String(asset.transcriptRoman || asset.title || 'Meme').slice(0, 300),
    englishContextNote: String(
      asset.englishContextNote || 'Shared public community upload'
    ).slice(0, 500),
    originalMimeType: String(asset.originalMimeType || 'audio/mpeg').slice(0, 80),
    originalSizeBytes: Math.min(
      50000000,
      Math.max(0, Math.round(asset.originalSizeBytes || 1024))
    ),
    durationMs: Math.min(600000, Math.max(0, Math.round(asset.durationMs || 2500))),
    sha256Hash: String(asset.sha256Hash || `sha256-${cleanId}`).slice(0, 128),
    uploaderUid: uid,
    uploaderName: String(asset.uploaderName || 'Creator').slice(0, 80),
    uploaderHandle: cleanHandle,
    moderationStatus: asset.moderationStatus,
    viewCount: Math.max(0, Math.round(asset.viewCount || 1)),
    downloadCount: Math.max(0, Math.round(asset.downloadCount || 0)),
    likeCount: Math.max(0, Math.round(asset.likeCount || 1)),
    favoriteCount: Math.max(0, Math.round(asset.favoriteCount || 0)),
    shareCount: Math.max(0, Math.round(asset.shareCount || 0)),
    remixCount: Math.max(0, Math.round(asset.remixCount || 0)),
    trendingScore: Math.max(0, Number(asset.trendingScore || 30)),
    originalFileName: String(asset.originalFileName || `${cleanId}.mp3`).slice(0, 160),
    hasCloudMedia: mediaChunks.length > 0,
    hasCloudThumb: thumbChunks.length > 0,
    mediaChunkCount: mediaChunks.length,
    thumbChunkCount: thumbChunks.length,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    const existingSnap = await getDoc(doc(db, 'public_assets', cleanId));
    if (!existingSnap.exists()) {
      await setDoc(doc(db, 'public_assets', cleanId), payload);
    } else if (mediaChunks.length > 0 || thumbChunks.length > 0) {
      const existingData = existingSnap.data();
      await updateDoc(doc(db, 'public_assets', cleanId), {
        title: payload.title,
        language: payload.language,
        region: payload.region,
        category: payload.category,
        emotion: payload.emotion,
        transcriptDeva: payload.transcriptDeva,
        transcriptRoman: payload.transcriptRoman,
        hasCloudMedia: Boolean(existingData.hasCloudMedia || mediaChunks.length > 0),
        hasCloudThumb: Boolean(existingData.hasCloudThumb || thumbChunks.length > 0),
        mediaChunkCount:
          mediaChunks.length > 0
            ? mediaChunks.length
            : Number(existingData.mediaChunkCount || 0),
        thumbChunkCount:
          thumbChunks.length > 0
            ? thumbChunks.length
            : Number(existingData.thumbChunkCount || 0),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncEngagementToFirestore(asset: MemeAsset): Promise<void> {
  const cleanId = sanitizeFirestoreId(asset.id);
  const path = `public_assets/${cleanId}`;
  try {
    const snap = await getDoc(doc(db, 'public_assets', cleanId));
    if (!snap.exists()) return;
    await updateDoc(doc(db, 'public_assets', cleanId), {
      likeCount: Math.max(0, Math.round(asset.likeCount || 0)),
      favoriteCount: Math.max(0, Math.round(asset.favoriteCount || 0)),
      shareCount: Math.max(0, Math.round(asset.shareCount || 0)),
      downloadCount: Math.max(0, Math.round(asset.downloadCount || 0)),
      viewCount: Math.max(0, Math.round(asset.viewCount || 0)),
      remixCount: Math.max(0, Math.round(asset.remixCount || 0)),
      trendingScore: Math.max(0, Number(asset.trendingScore || 30)),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Reconstructs a full playable & downloadable MemeAsset from a Firestore `/public_assets` document
 * so any friend or visitor opening the published link sees newly uploaded items immediately.
 */
export function reconstructMemeAssetFromFirestore(
  docData: Record<string, unknown>
): MemeAsset {
  const id = String(docData.id || '');
  const title = String(docData.title || 'Community Upload');
  const fileName = String(docData.originalFileName || `${id}.mp3`);
  const mimeType = String(docData.originalMimeType || 'audio/mpeg');
  const sizeBytes = Number(docData.originalSizeBytes || 24000);
  const durationMs = Number(docData.durationMs || 2800);
  const sha256Hash = String(docData.sha256Hash || `sha256-${id}`);
  const mediaType = (docData.mediaType as MediaType) || 'AUDIO_DIALOGUE';

  const autoLang = autoDetectAssetLanguageAndRegion({
    title,
    fileName,
    transcriptDeva: String(docData.transcriptDeva || ''),
    transcriptRoman: String(docData.transcriptRoman || ''),
    mediaType,
  });

  const language = (docData.language as LanguageCode) || autoLang.language;
  const region = (docData.region as RegionCode) || autoLang.region;

  const baseAsset = buildAutoApprovedSoundboardAsset({
    id,
    fileName,
    mimeType,
    sizeBytes,
    sha256Hash,
    mediaDataUrl: mediaMemoryCache.get(id),
    thumbnailDataUrl: thumbMemoryCache.get(id),
    durationMs,
    title,
    language,
    region,
    mediaType,
    category: String(docData.category || 'Community Upload'),
    emotion: String(docData.emotion || 'Reaction'),
    transcriptDeva: String(docData.transcriptDeva || title),
    transcriptRoman: String(docData.transcriptRoman || title),
    uploaderUid: String(docData.uploaderUid || 'usr_creator_aarav'),
    uploaderName: String(docData.uploaderName || 'Creator'),
    uploaderHandle: String(docData.uploaderHandle || 'creator_np'),
  });

  return {
    ...baseAsset,
    slug: String(docData.slug || baseAsset.slug),
    englishContextNote: String(docData.englishContextNote || baseAsset.englishContextNote),
    viewCount: Number(docData.viewCount ?? 1),
    downloadCount: Number(docData.downloadCount ?? 0),
    likeCount: Number(docData.likeCount ?? 1),
    favoriteCount: Number(docData.favoriteCount ?? 0),
    shareCount: Number(docData.shareCount ?? 0),
    remixCount: Number(docData.remixCount ?? 0),
    trendingScore: Number(docData.trendingScore ?? 32),
  };
}

export function subscribeApprovedFirestoreAssets(
  onAssetsSnapshot: (cloudRecords: Array<Record<string, unknown>>) => void
): () => void {
  const path = 'public_assets';
  const q = query(
    collection(db, 'public_assets'),
    where('moderationStatus', '==', 'APPROVED_PUBLIC')
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const records = snapshot.docs.map((d) => d.data() as Record<string, unknown>);
      onAssetsSnapshot(records);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}
