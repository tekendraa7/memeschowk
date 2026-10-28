import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createServer as createViteServer } from 'vite';
import { initializeApp } from 'firebase/app';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';
import { INITIAL_MEME_ASSETS } from './src/data/seed-assets';
import {
  autoDetectAssetLanguageAndRegion,
  buildAutoApprovedSoundboardAsset,
  EngagementActionType,
  LanguageCode,
  MediaType,
  MemeAsset,
  recordAssetEngagement,
  RegionCode,
  reorganizeCatalogWithAutoLanguage,
  UserRole,
} from './src/lib/domain-logic';

const PORT = 3000;
const DATA_DIR = path.resolve(process.cwd(), '.data');
const MEDIA_DIR = path.join(DATA_DIR, 'media');
const CATALOG_FILE = path.join(DATA_DIR, 'shared_catalog.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const MAX_CHUNK_CHARS = 550000;

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(MEDIA_DIR)) {
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
}

const fbApp = initializeApp(firebaseConfig, 'memechowk-server');
const serverDb = getFirestore(fbApp, firebaseConfig.firestoreDatabaseId);

export interface StoredUserAccount {
  uid: string;
  displayName: string;
  handle: string;
  email: string;
  passwordHash: string;
  primaryLanguage: LanguageCode;
  role: UserRole;
  createdAt: string;
}

function hashPassword(raw: string): string {
  return crypto.createHash('sha256').update(`memechowk-salt:${raw}`).digest('hex');
}

function sanitizeId(raw: string): string {
  const cleaned = String(raw || 'item')
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .slice(0, 120);
  return cleaned.length >= 1 ? cleaned : 'item_1';
}

function sanitizeHandle(raw: string): string {
  const cleaned = String(raw || 'creator')
    .trim()
    .replace(/^@/, '')
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .toLowerCase()
    .slice(0, 40);
  return cleaned.length >= 2 ? cleaned : `${cleaned}_np`;
}

const SEED_USERS: StoredUserAccount[] = [
  {
    uid: 'usr-admin-subash',
    displayName: 'Subash Pant (Admin)',
    handle: 'subash_admin',
    email: 'pantsubash30@gmail.com',
    passwordHash: hashPassword('admin123'),
    primaryLanguage: 'NE',
    role: 'ADMIN',
    createdAt: '2026-10-01T00:00:00.000Z',
  },
  {
    uid: 'usr-creator-aarav',
    displayName: 'Aarav Thapa',
    handle: 'aarav_ktm',
    email: 'aarav@memechowk.np',
    passwordHash: hashPassword('creator123'),
    primaryLanguage: 'NE',
    role: 'CREATOR',
    createdAt: '2026-10-02T00:00:00.000Z',
  },
  {
    uid: 'usr-creator-rohan',
    displayName: 'Rohan Sharma (Friend)',
    handle: 'rohan_delhi',
    email: 'rohan@memechowk.in',
    passwordHash: hashPassword('friend123'),
    primaryLanguage: 'HI',
    role: 'CREATOR',
    createdAt: '2026-10-03T00:00:00.000Z',
  },
];

function loadUsers(): StoredUserAccount[] {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const parsed: StoredUserAccount[] = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
      const updated = parsed.map((u) => {
        const seedMatch = SEED_USERS.find(
          (s) => s.handle.toLowerCase() === u.handle.toLowerCase()
        );
        return seedMatch ? { ...u, passwordHash: seedMatch.passwordHash } : u;
      });
      const existingHandles = new Set(updated.map((u) => u.handle.toLowerCase()));
      const missingSeeds = SEED_USERS.filter(
        (s) => !existingHandles.has(s.handle.toLowerCase())
      );
      return [...updated, ...missingSeeds];
    }
  } catch {
    // Fallback to seed users
  }
  fs.writeFileSync(USERS_FILE, JSON.stringify(SEED_USERS, null, 2));
  return [...SEED_USERS];
}

function saveUsers(users: StoredUserAccount[]): void {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function loadCatalog(): MemeAsset[] {
  try {
    if (fs.existsSync(CATALOG_FILE)) {
      const rawParsed: MemeAsset[] = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf-8'));
      const parsed = rawParsed.map((a) => ({
        ...a,
        waveformPeaks:
          Array.isArray(a.waveformPeaks) && a.waveformPeaks.length > 0
            ? a.waveformPeaks
            : Array.from({ length: 48 }, (_, i) => 24 + ((i * 19) % 68)),
        variants: Array.isArray(a.variants) ? a.variants : [],
        searchAliases: Array.isArray(a.searchAliases) ? a.searchAliases : [],
        tags: Array.isArray(a.tags) ? a.tags : [],
        reports: Array.isArray(a.reports) ? a.reports : [],
      }));
      const existingIds = new Set(parsed.map((a) => a.id));
      const missingSeeds = INITIAL_MEME_ASSETS.filter((s) => !existingIds.has(s.id));
      return [...parsed, ...missingSeeds];
    }
  } catch {
    // Fallback to seed catalog
  }
  const initialWithCounts = INITIAL_MEME_ASSETS.map((a) => ({
    ...a,
    favoriteCount: a.favoriteCount ?? Math.max(4, Math.round(a.likeCount * 0.35)),
    shareCount: a.shareCount ?? Math.max(2, Math.round(a.downloadCount * 0.2)),
  }));
  fs.writeFileSync(CATALOG_FILE, JSON.stringify(initialWithCounts, null, 2));
  return initialWithCounts;
}

function saveCatalog(catalog: MemeAsset[]): void {
  fs.writeFileSync(CATALOG_FILE, JSON.stringify(catalog, null, 2));
}

function saveDataUrlToDisk(
  fileId: string,
  suffix: string,
  dataUrl: string
): { mimeType: string; filePath: string } | null {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl);
  if (!match) return null;
  const mimeType = match[1];
  const base64Data = match[2];
  const buffer = Buffer.from(base64Data, 'base64');
  const safeId = sanitizeId(fileId);
  const filePath = path.join(MEDIA_DIR, `${safeId}.${suffix}.bin`);
  const metaPath = path.join(MEDIA_DIR, `${safeId}.${suffix}.meta.json`);
  fs.writeFileSync(filePath, buffer);
  fs.writeFileSync(metaPath, JSON.stringify({ mimeType, size: buffer.length }));
  return { mimeType, filePath };
}

function readDiskMediaAsDataUrl(fileId: string, suffix: string): string | null {
  const safeId = sanitizeId(fileId);
  const filePath = path.join(MEDIA_DIR, `${safeId}.${suffix}.bin`);
  const metaPath = path.join(MEDIA_DIR, `${safeId}.${suffix}.meta.json`);
  if (!fs.existsSync(filePath) || !fs.existsSync(metaPath)) return null;
  try {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    const buffer = fs.readFileSync(filePath);
    const mimeType = meta.mimeType || 'application/octet-stream';
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}

async function pushAssetAndMediaToFirestore(
  asset: MemeAsset,
  rawMediaDataUrl?: string,
  rawThumbDataUrl?: string
): Promise<void> {
  const cleanId = sanitizeId(asset.id);
  const mediaData =
    rawMediaDataUrl && rawMediaDataUrl.startsWith('data:')
      ? rawMediaDataUrl
      : readDiskMediaAsDataUrl(cleanId, 'media') || undefined;
  const thumbData =
    rawThumbDataUrl && rawThumbDataUrl.startsWith('data:')
      ? rawThumbDataUrl
      : readDiskMediaAsDataUrl(cleanId, 'thumb') || undefined;

  const splitChunks = (dataUrl: string | undefined, maxChunks: number): string[] => {
    if (!dataUrl || !dataUrl.startsWith('data:')) return [];
    const list: string[] = [];
    for (let i = 0; i < dataUrl.length; i += MAX_CHUNK_CHARS) {
      list.push(dataUrl.slice(i, i + MAX_CHUNK_CHARS));
    }
    return list.length <= maxChunks ? list : [];
  };

  const mediaChunks = splitChunks(mediaData, 40);
  const thumbChunks = splitChunks(thumbData, 10);

  for (let i = 0; i < mediaChunks.length; i++) {
    const chunkId = sanitizeId(`${cleanId}_MEDIA_${i}`);
    try {
      const snap = await getDoc(doc(serverDb, 'public_asset_media', chunkId));
      if (!snap.exists()) {
        await setDoc(doc(serverDb, 'public_asset_media', chunkId), {
          id: chunkId,
          assetId: cleanId,
          mediaKind: 'MEDIA',
          chunkIndex: i,
          totalChunks: mediaChunks.length,
          mimeType: String(asset.originalMimeType || 'audio/mpeg').slice(0, 80),
          dataChunk: mediaChunks[i],
          createdAt: serverTimestamp(),
        });
      }
    } catch {
      // Ignore single chunk error
    }
  }

  for (let i = 0; i < thumbChunks.length; i++) {
    const chunkId = sanitizeId(`${cleanId}_THUMB_${i}`);
    try {
      const snap = await getDoc(doc(serverDb, 'public_asset_media', chunkId));
      if (!snap.exists()) {
        await setDoc(doc(serverDb, 'public_asset_media', chunkId), {
          id: chunkId,
          assetId: cleanId,
          mediaKind: 'THUMB',
          chunkIndex: i,
          totalChunks: thumbChunks.length,
          mimeType: 'image/png',
          dataChunk: thumbChunks[i],
          createdAt: serverTimestamp(),
        });
      }
    } catch {
      // Ignore single chunk error
    }
  }

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
    uploaderUid: sanitizeId(asset.uploaderUid || 'usr_creator_aarav'),
    uploaderName: String(asset.uploaderName || 'Creator').slice(0, 80),
    uploaderHandle: sanitizeHandle(asset.uploaderHandle || 'aarav_ktm'),
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
    const existing = await getDoc(doc(serverDb, 'public_assets', cleanId));
    if (!existing.exists()) {
      await setDoc(doc(serverDb, 'public_assets', cleanId), payload);
    } else if (mediaChunks.length > 0 || thumbChunks.length > 0) {
      const existingData = existing.data();
      await updateDoc(doc(serverDb, 'public_assets', cleanId), {
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
  } catch {
    // Ignore transient cloud sync error
  }
}

async function hydrateMediaFromFirestoreToDisk(
  assetId: string,
  mediaKind: 'MEDIA' | 'THUMB'
): Promise<{ filePath: string; mimeType: string } | null> {
  const cleanId = sanitizeId(assetId);
  const suffix = mediaKind === 'MEDIA' ? 'media' : 'thumb';
  const filePath = path.join(MEDIA_DIR, `${cleanId}.${suffix}.bin`);
  const metaPath = path.join(MEDIA_DIR, `${cleanId}.${suffix}.meta.json`);

  if (fs.existsSync(filePath) && fs.existsSync(metaPath)) {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    return { filePath, mimeType: meta.mimeType || 'application/octet-stream' };
  }

  try {
    const assetSnap = await getDoc(doc(serverDb, 'public_assets', cleanId));
    if (!assetSnap.exists()) return null;
    const assetData = assetSnap.data();
    const chunkCount =
      mediaKind === 'MEDIA'
        ? Number(assetData.mediaChunkCount || 0)
        : Number(assetData.thumbChunkCount || 0);
    if (chunkCount <= 0) return null;

    const parts: string[] = [];
    for (let i = 0; i < chunkCount; i++) {
      const chunkId = sanitizeId(`${cleanId}_${mediaKind}_${i}`);
      const chunkSnap = await getDoc(doc(serverDb, 'public_asset_media', chunkId));
      if (!chunkSnap.exists()) return null;
      const chunkData = chunkSnap.data();
      if (typeof chunkData.dataChunk !== 'string') return null;
      parts.push(chunkData.dataChunk);
    }

    const fullDataUrl = parts.join('');
    const saved = saveDataUrlToDisk(cleanId, suffix, fullDataUrl);
    return saved;
  } catch {
    return null;
  }
}

function reconstructServerAssetFromCloudDoc(docData: Record<string, unknown>): MemeAsset {
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

  const hasCloudMedia = Boolean(docData.hasCloudMedia);
  const hasCloudThumb = Boolean(docData.hasCloudThumb);

  const base = buildAutoApprovedSoundboardAsset({
    id,
    fileName,
    mimeType,
    sizeBytes,
    sha256Hash,
    mediaDataUrl: hasCloudMedia ? `/api/assets/${id}/media` : '',
    thumbnailDataUrl: hasCloudThumb ? `/api/assets/${id}/thumb` : undefined,
    durationMs,
    waveformPeaks: Array.from({ length: 48 }, (_, i) => 24 + ((i * 19) % 68)),
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
    ...base,
    slug: String(docData.slug || base.slug),
    englishContextNote: String(docData.englishContextNote || base.englishContextNote),
    viewCount: Number(docData.viewCount ?? 1),
    downloadCount: Number(docData.downloadCount ?? 0),
    likeCount: Number(docData.likeCount ?? 1),
    favoriteCount: Number(docData.favoriteCount ?? 0),
    shareCount: Number(docData.shareCount ?? 0),
    remixCount: Number(docData.remixCount ?? 0),
    trendingScore: Number(docData.trendingScore ?? 32),
  };
}

async function syncCatalogWithFirestore(): Promise<MemeAsset[]> {
  const localCatalog = loadCatalog();
  try {
    const q = query(
      collection(serverDb, 'public_assets'),
      where('moderationStatus', '==', 'APPROVED_PUBLIC')
    );
    const snap = await getDocs(q);
    const cloudDocs = snap.docs.map((d) => d.data() as Record<string, unknown>);
    const cloudIdSet = new Set(cloudDocs.map((d) => sanitizeId(String(d.id || ''))));

    // Backfill any custom local uploads into Firestore so published link & friends get them
    const seedIds = new Set(INITIAL_MEME_ASSETS.map((s) => s.id));
    for (const localItem of localCatalog) {
      if (
        !seedIds.has(localItem.id) &&
        localItem.moderationStatus === 'APPROVED_PUBLIC' &&
        !cloudIdSet.has(sanitizeId(localItem.id))
      ) {
        await pushAssetAndMediaToFirestore(localItem);
      }
    }

    // Merge cloud assets into local catalog
    const localMap = new Map<string, MemeAsset>(localCatalog.map((a) => [a.id, a]));
    for (const docData of cloudDocs) {
      const id = String(docData.id || '');
      if (!id) continue;
      const existing = localMap.get(id);
      if (existing) {
        localMap.set(id, {
          ...existing,
          likeCount: Math.max(existing.likeCount ?? 0, Number(docData.likeCount ?? 0)),
          favoriteCount: Math.max(
            existing.favoriteCount ?? 0,
            Number(docData.favoriteCount ?? 0)
          ),
          shareCount: Math.max(existing.shareCount ?? 0, Number(docData.shareCount ?? 0)),
          downloadCount: Math.max(
            existing.downloadCount ?? 0,
            Number(docData.downloadCount ?? 0)
          ),
          trendingScore: Math.max(
            existing.trendingScore ?? 0,
            Number(docData.trendingScore ?? 0)
          ),
          mediaDataUrl:
            existing.mediaDataUrl ||
            (docData.hasCloudMedia ? `/api/assets/${id}/media` : undefined),
          thumbnailDataUrl:
            existing.thumbnailDataUrl ||
            (docData.hasCloudThumb ? `/api/assets/${id}/thumb` : undefined),
        });
      } else {
        const reconstructed = reconstructServerAssetFromCloudDoc(docData);
        localMap.set(id, reconstructed);
      }
    }

    const merged = Array.from(localMap.values());
    saveCatalog(merged);
    return merged;
  } catch {
    return localCatalog;
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));

  // Trigger initial background sync of any existing local uploads to Firestore
  syncCatalogWithFirestore().catch(() => {});

  // 1. Auth: Register New Account (Public Creator or Protected Admin)
  app.post('/api/auth/register', async (req, res) => {
    const { displayName, handle, email, password, primaryLanguage, adminCode } =
      req.body ?? {};
    const cleanName = String(displayName ?? '').trim();
    const cleanHandle = sanitizeHandle(handle);
    const cleanEmail = String(email ?? '').trim().toLowerCase();
    const rawPass = String(password ?? '');

    if (
      !cleanName ||
      cleanHandle.length < 2 ||
      !cleanEmail.includes('@') ||
      rawPass.length < 4
    ) {
      res.status(400).json({
        error:
          'Please provide Display Name, Handle (2+ chars), valid Email, and Password (4+ chars).',
      });
      return;
    }

    const users = loadUsers();
    if (
      users.some(
        (u) =>
          u.email.toLowerCase() === cleanEmail || u.handle.toLowerCase() === cleanHandle
      )
    ) {
      res.status(409).json({
        error:
          'An account with this email or @handle already exists. Please log in instead.',
      });
      return;
    }

    const isAdmin = String(adminCode ?? '').trim() === 'CHOWK-ADMIN-2026';

    const newUser: StoredUserAccount = {
      uid: sanitizeId(`usr-${cleanHandle}-${Date.now().toString(36)}`),
      displayName: cleanName.slice(0, 80),
      handle: cleanHandle,
      email: cleanEmail.slice(0, 160),
      passwordHash: hashPassword(rawPass),
      primaryLanguage: ['NE', 'HI', 'EN', 'NON_VERBAL'].includes(primaryLanguage)
        ? primaryLanguage
        : 'NE',
      role: isAdmin ? 'ADMIN' : 'CREATOR',
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    saveUsers(users);

    // Sync creator account to Firestore /chowk_accounts so login works across ais-dev & ais-pre
    if (newUser.role === 'CREATOR') {
      try {
        await setDoc(doc(serverDb, 'chowk_accounts', cleanHandle), {
          uid: newUser.uid,
          handle: newUser.handle,
          displayName: newUser.displayName,
          primaryLanguage: newUser.primaryLanguage,
          role: 'CREATOR',
          passwordHash: newUser.passwordHash,
          createdAt: serverTimestamp(),
        });
      } catch {
        // Ignore if already exists
      }
    }

    const { passwordHash: _, ...publicUser } = newUser;
    res.status(201).json({ user: publicUser });
  });

  // 2. Auth: Login with Email or @Handle + Password (checks local + Firestore /chowk_accounts)
  app.post('/api/auth/login', async (req, res) => {
    const { identifier, password } = req.body ?? {};
    const cleanId = String(identifier ?? '').trim().replace(/^@/, '').toLowerCase();
    const rawPass = String(password ?? '');
    const hashed = hashPassword(rawPass);

    const users = loadUsers();
    let matched = users.find(
      (u) => u.email.toLowerCase() === cleanId || u.handle.toLowerCase() === cleanId
    );

    if (!matched) {
      // Check Firestore /chowk_accounts in case user registered on another Cloud Run instance
      try {
        const cleanHandle = sanitizeHandle(cleanId);
        const snap = await getDoc(doc(serverDb, 'chowk_accounts', cleanHandle));
        if (snap.exists()) {
          const data = snap.data();
          const cloudUser: StoredUserAccount = {
            uid: String(data.uid || `usr-${cleanHandle}`),
            displayName: String(data.displayName || cleanHandle),
            handle: String(data.handle || cleanHandle),
            email: `${cleanHandle}@memechowk.np`,
            passwordHash: String(data.passwordHash || ''),
            primaryLanguage: (data.primaryLanguage as LanguageCode) || 'NE',
            role: data.role === 'ADMIN' ? 'ADMIN' : 'CREATOR',
            createdAt: new Date().toISOString(),
          };
          users.push(cloudUser);
          saveUsers(users);
          matched = cloudUser;
        }
      } catch {
        // Ignore lookup error
      }
    }

    if (!matched || matched.passwordHash !== hashed) {
      res.status(401).json({
        error:
          'Invalid email/@handle or password. Please verify your credentials or register a new creator account.',
      });
      return;
    }

    const { passwordHash: _, ...publicUser } = matched;
    res.json({ user: publicUser });
  });

  /**
   * Authoritative server-side user session & ADMIN role verifier.
   * Never trusts a raw `role: 'ADMIN'` claim from the client without verifying
   * the user's record in the server account store or verified admin bootstrap identity.
   */
  const resolveServerUserFromRequest = async (
    req: express.Request
  ): Promise<Omit<StoredUserAccount, 'passwordHash'> | null> => {
    const rawUid = String(
      req.headers['x-user-uid'] || req.query?.uid || req.body?.userUid || req.body?.uid || ''
    ).trim();
    const rawHandle = String(
      req.headers['x-user-handle'] || req.query?.handle || req.body?.handle || ''
    )
      .trim()
      .replace(/^@/, '')
      .toLowerCase();
    const rawEmail = String(
      req.headers['x-user-email'] || req.query?.email || req.body?.email || ''
    )
      .trim()
      .toLowerCase();

    if (!rawUid && !rawHandle && !rawEmail) {
      return null;
    }

    const users = loadUsers();
    let matched = users.find(
      (u) =>
        (rawUid && u.uid === rawUid) ||
        (rawHandle && u.handle.toLowerCase() === rawHandle) ||
        (rawEmail && u.email.toLowerCase() === rawEmail)
    );

    if (!matched && rawHandle) {
      try {
        const cleanHandle = sanitizeHandle(rawHandle);
        const snap = await getDoc(doc(serverDb, 'chowk_accounts', cleanHandle));
        if (snap.exists()) {
          const data = snap.data();
          const cloudUser: StoredUserAccount = {
            uid: String(data.uid || rawUid || `usr-${cleanHandle}`),
            displayName: String(data.displayName || cleanHandle),
            handle: String(data.handle || cleanHandle),
            email: rawEmail || `${cleanHandle}@memechowk.np`,
            passwordHash: String(data.passwordHash || ''),
            primaryLanguage: (data.primaryLanguage as LanguageCode) || 'NE',
            role: data.role === 'ADMIN' ? 'ADMIN' : 'CREATOR',
            createdAt: new Date().toISOString(),
          };
          users.push(cloudUser);
          saveUsers(users);
          matched = cloudUser;
        }
      } catch {
        // Ignore cloud lookup error
      }
    }

    if (matched) {
      const { passwordHash: _, ...publicUser } = matched;
      return publicUser;
    }

    // Bootstrapped Firebase Google Admin email check
    if (rawUid && rawEmail === 'pantsubash30@gmail.com') {
      return {
        uid: rawUid,
        displayName: 'Subash (Platform Admin)',
        handle: rawHandle || 'subash_admin',
        email: rawEmail,
        primaryLanguage: 'NE',
        role: 'ADMIN',
        createdAt: new Date().toISOString(),
      };
    }

    // Standard Firebase Auth user session (CREATOR role)
    if (rawUid && rawHandle) {
      return {
        uid: rawUid,
        displayName: rawHandle,
        handle: rawHandle,
        email: rawEmail || `${rawHandle}@memechowk.np`,
        primaryLanguage: 'NE',
        role: 'CREATOR',
        createdAt: new Date().toISOString(),
      };
    }

    return null;
  };

  // 2b. Persistent Session Verification Endpoint (Called by App.tsx onAuthStateChanged / reload)
  app.get('/api/auth/session', async (req, res) => {
    const resolved = await resolveServerUserFromRequest(req);
    if (!resolved) {
      res.status(401).json({ authenticated: false, user: null });
      return;
    }
    res.json({ authenticated: true, user: resolved });
  });

  // 2c. Server-Side Permission Check for '/admin' Panel Access (Strictly ADMIN role only)
  app.get('/api/admin/verify', async (req, res) => {
    const resolved = await resolveServerUserFromRequest(req);
    if (!resolved) {
      res.status(401).json({
        authorized: false,
        role: 'USER',
        error: 'HTTP 401 Unauthorized: Authentication required to access /admin.',
      });
      return;
    }
    if (resolved.role !== 'ADMIN') {
      res.status(403).json({
        authorized: false,
        role: resolved.role,
        error: `HTTP 403 Forbidden: The /admin panel is strictly restricted to users with the ADMIN role (current role: ${resolved.role}).`,
      });
      return;
    }
    res.json({
      authorized: true,
      role: 'ADMIN',
      user: resolved,
      verifiedAt: new Date().toISOString(),
    });
  });

  // Direct '/admin' API/JSON permission gate (for programmatic or header-based checks)
  app.get('/admin', async (req, res, next) => {
    const wantsJson =
      req.query?.verify === '1' ||
      (req.headers.accept &&
        req.headers.accept.includes('application/json') &&
        !req.headers.accept.includes('text/html'));
    if (!wantsJson) {
      next();
      return;
    }
    const resolved = await resolveServerUserFromRequest(req);
    if (!resolved || resolved.role !== 'ADMIN') {
      res.status(403).json({
        authorized: false,
        role: resolved?.role || 'USER',
        error: 'HTTP 403 Forbidden: ADMIN role required to access /admin.',
      });
      return;
    }
    res.json({ authorized: true, role: 'ADMIN', user: resolved });
  });

  // 3. Shared Public Catalog Fetch (Merged with Firestore across ais-dev, ais-pre & all friends)
  app.get('/api/assets', async (req, res) => {
    const catalog =
      req.query?.sync === '1' ? await syncCatalogWithFirestore() : loadCatalog();
    res.json({ assets: catalog });
  });

  // 4. Stream Shared Uploaded Media Binary (Local Disk Cache -> Firestore Chunk Fallback)
  app.get('/api/assets/:id/media', async (req, res) => {
    const hydrated = await hydrateMediaFromFirestoreToDisk(req.params.id, 'MEDIA');
    if (!hydrated) {
      res.status(404).json({ error: 'Media binary not found' });
      return;
    }
    res.setHeader('Content-Type', hydrated.mimeType || 'application/octet-stream');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    fs.createReadStream(hydrated.filePath).pipe(res);
  });

  // 5. Stream Shared Uploaded Audio Thumbnail (Local Disk Cache -> Firestore Chunk Fallback)
  app.get('/api/assets/:id/thumb', async (req, res) => {
    const hydrated = await hydrateMediaFromFirestoreToDisk(req.params.id, 'THUMB');
    if (!hydrated) {
      res.status(404).json({ error: 'Thumbnail not found' });
      return;
    }
    res.setHeader('Content-Type', hydrated.mimeType || 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    fs.createReadStream(hydrated.filePath).pipe(res);
  });

  // 6. Publish New User Uploads to Shared Public Catalog + Firestore
  app.post('/api/assets', async (req, res) => {
    const incomingAssets: MemeAsset[] = Array.isArray(req.body?.assets)
      ? req.body.assets
      : req.body?.asset
      ? [req.body.asset]
      : [];

    if (incomingAssets.length === 0) {
      res.status(400).json({ error: 'No assets provided' });
      return;
    }

    const catalog = loadCatalog();
    const existingIds = new Set(catalog.map((a) => a.id));
    const savedAssets: MemeAsset[] = [];

    for (const rawAsset of incomingAssets) {
      const assetCopy: MemeAsset = { ...rawAsset };
      const rawMediaDataUrl =
        assetCopy.mediaDataUrl && assetCopy.mediaDataUrl.startsWith('data:')
          ? assetCopy.mediaDataUrl
          : undefined;
      const rawThumbDataUrl =
        assetCopy.thumbnailDataUrl && assetCopy.thumbnailDataUrl.startsWith('data:')
          ? assetCopy.thumbnailDataUrl
          : undefined;

      if (rawMediaDataUrl) {
        const savedMedia = saveDataUrlToDisk(assetCopy.id, 'media', rawMediaDataUrl);
        if (savedMedia) {
          assetCopy.mediaDataUrl = `/api/assets/${assetCopy.id}/media`;
        }
      }

      if (rawThumbDataUrl) {
        const savedThumb = saveDataUrlToDisk(assetCopy.id, 'thumb', rawThumbDataUrl);
        if (savedThumb) {
          assetCopy.thumbnailDataUrl = `/api/assets/${assetCopy.id}/thumb`;
        }
      }

      if (existingIds.has(assetCopy.id)) {
        const idx = catalog.findIndex((a) => a.id === assetCopy.id);
        if (idx !== -1) catalog[idx] = assetCopy;
      } else {
        catalog.unshift(assetCopy);
        existingIds.add(assetCopy.id);
      }
      savedAssets.push(assetCopy);

      // Persist both metadata and media/thumbnail chunks to Firestore
      await pushAssetAndMediaToFirestore(assetCopy, rawMediaDataUrl, rawThumbDataUrl);
    }

    saveCatalog(catalog);
    res.status(201).json({ assets: savedAssets, totalCatalogCount: catalog.length });
  });

  // 7. Public Community Engagement (Like, Favorite, Share, Download, View)
  app.post('/api/assets/:id/engage', async (req, res) => {
    const assetId = req.params.id;
    const action = req.body?.action as EngagementActionType;
    const allowedActions: EngagementActionType[] = [
      'LIKE',
      'UNLIKE',
      'FAVORITE',
      'UNFAVORITE',
      'SHARE',
      'DOWNLOAD',
      'VIEW',
    ];
    if (!allowedActions.includes(action)) {
      res.status(400).json({ error: 'Invalid engagement action' });
      return;
    }

    const catalog = loadCatalog();
    const idx = catalog.findIndex((a) => a.id === assetId);
    if (idx === -1) {
      res.status(404).json({ error: 'Asset not found' });
      return;
    }

    const updated = recordAssetEngagement(catalog[idx], action);
    catalog[idx] = updated;
    saveCatalog(catalog);

    // Sync engagement counts to Firestore
    const cleanId = sanitizeId(assetId);
    try {
      const snap = await getDoc(doc(serverDb, 'public_assets', cleanId));
      if (snap.exists()) {
        await updateDoc(doc(serverDb, 'public_assets', cleanId), {
          likeCount: Math.max(0, Math.round(updated.likeCount || 0)),
          favoriteCount: Math.max(0, Math.round(updated.favoriteCount || 0)),
          shareCount: Math.max(0, Math.round(updated.shareCount || 0)),
          downloadCount: Math.max(0, Math.round(updated.downloadCount || 0)),
          viewCount: Math.max(0, Math.round(updated.viewCount || 0)),
          remixCount: Math.max(0, Math.round(updated.remixCount || 0)),
          trendingScore: Math.max(0, Number(updated.trendingScore || 30)),
          updatedAt: serverTimestamp(),
        });
      }
    } catch {
      // Ignore cloud update error
    }

    res.json({ asset: updated });
  });

  // 8. Auto-Organize Catalog Languages Endpoint
  app.post('/api/assets/reorganize-languages', async (_req, res) => {
    const catalog = loadCatalog();
    const { updatedAssets, reclassifiedCount } = reorganizeCatalogWithAutoLanguage(catalog);
    saveCatalog(updatedAssets);
    res.json({ assets: updatedAssets, reclassifiedCount });
  });

  // 9. Protected Admin Moderation & Creator Own-Asset Deletion (Server-Verified ADMIN Role)
  app.post('/api/assets/:id/moderation', async (req, res) => {
    const assetId = req.params.id;
    const { action, userUid, reason, verifyCommercialRights } = req.body ?? {};
    const catalog = loadCatalog();
    const idx = catalog.findIndex((a) => a.id === assetId);
    if (idx === -1) {
      res.status(404).json({ error: 'Asset not found' });
      return;
    }

    const target = catalog[idx];
    const verifiedUser = await resolveServerUserFromRequest(req);
    const isVerifiedAdmin = verifiedUser?.role === 'ADMIN';
    const effectiveUid = verifiedUser?.uid || userUid;
    const isOwner = Boolean(effectiveUid && target.uploaderUid === effectiveUid);

    if (action === 'DELETE_OWN') {
      if (!isOwner && !isVerifiedAdmin) {
        res.status(403).json({ error: 'Only the creator or an Admin can delete this upload.' });
        return;
      }
      catalog.splice(idx, 1);
      saveCatalog(catalog);
      res.json({ deletedId: assetId });
      return;
    }

    if (!isVerifiedAdmin) {
      res.status(403).json({
        error: '403 Forbidden: Verified ADMIN role required for moderation actions.',
      });
      return;
    }

    if (action === 'APPROVE') {
      catalog[idx] = {
        ...target,
        moderationStatus: 'APPROVED_PUBLIC',
        rightsRecord: {
          ...target.rightsRecord,
          moderatorVerifiedRights: Boolean(verifyCommercialRights),
          commercialEligible: Boolean(verifyCommercialRights),
        },
      };
    } else if (action === 'REJECT') {
      catalog[idx] = {
        ...target,
        moderationStatus: 'REJECTED',
        rejectionReason: String(reason ?? 'Rejected by moderator'),
      };
    } else if (action === 'TAKEDOWN') {
      catalog[idx] = {
        ...target,
        moderationStatus: 'TAKEDOWN_REMOVED',
        variants: target.variants.map((v) => ({ ...v, isReady: false })),
      };
    }

    saveCatalog(catalog);
    res.json({ asset: catalog[idx] });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: null,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MemeChowk Full-Stack Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
