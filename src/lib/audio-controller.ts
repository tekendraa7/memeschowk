import { MemeAsset } from './domain-logic';
import { loadUploadedMediaFromDb } from './media-storage';

type AudioStateListener = (activeAssetId: string | null, progress: number) => void;

/**
 * Singleton AudioController for MemeChowk Soundboard & Previews:
 * - Plays the user's EXACT original uploaded or microphone-recorded audio/video file
 *   using native HTMLAudioElement (<audio>) without altering or replacing it with synth notes.
 * - Enforces Single-Active-Sound Cutoff: tapping Pad B immediately pauses and resets Pad A.
 * - For built-in seed demo items (that don't have a user-uploaded audio file attached yet),
 *   uses Web Speech API (SpeechSynthesis) to speak the regional transcript naturally,
 *   never playing synthetic "dan tan tan" oscillator melodies.
 */
class MemeChowkAudioController {
  private activeAssetId: string | null = null;
  private activeHtmlAudio: HTMLAudioElement | null = null;
  private activeObjectUrl: string | null = null;
  private timerId: number | null = null;
  private startTime = 0;
  private durationMs = 3000;
  private listeners = new Set<AudioStateListener>();

  public subscribe(listener: AudioStateListener): () => void {
    this.listeners.add(listener);
    listener(this.activeAssetId, 0);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(assetId: string | null, progress: number) {
    for (const listener of this.listeners) {
      listener(assetId, progress);
    }
  }

  public getActiveAssetId(): string | null {
    return this.activeAssetId;
  }

  /**
   * Immediately stops any active HTMLAudioElement or speech playback and resets progress to 0
   */
  public stopAll(): void {
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }

    if (this.activeHtmlAudio) {
      try {
        this.activeHtmlAudio.pause();
        this.activeHtmlAudio.currentTime = 0;
        this.activeHtmlAudio.src = '';
      } catch {
        // Ignore cleanup errors
      }
      this.activeHtmlAudio = null;
    }

    if (this.activeObjectUrl) {
      URL.revokeObjectURL(this.activeObjectUrl);
      this.activeObjectUrl = null;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore
      }
    }

    this.activeAssetId = null;
    this.notify(null, 0);
  }

  /**
   * Plays an asset's original uploaded audio/video file, or speaks the transcript for seed demos.
   */
  public async playAsset(asset: MemeAsset, restartIfSame = false): Promise<void> {
    if (this.activeAssetId === asset.id && !restartIfSame) {
      this.stopAll();
      return;
    }

    // Immediate single-active-audio cutoff
    this.stopAll();
    this.activeAssetId = asset.id;
    this.notify(asset.id, 0.02);

    // 1. Check for user-uploaded or recorded original audio in memory or IndexedDB
    let mediaSource: string | null = asset.mediaDataUrl ?? null;

    if (!mediaSource) {
      const stored = await loadUploadedMediaFromDb(asset.id);
      // Verify the user hasn't stopped or switched to another clip while awaiting IndexedDB
      if (this.activeAssetId !== asset.id) return;

      if (stored instanceof Blob) {
        this.activeObjectUrl = URL.createObjectURL(stored);
        mediaSource = this.activeObjectUrl;
      } else if (typeof stored === 'string') {
        mediaSource = stored;
      }
    }

    // If this asset has real uploaded/recorded audio or video, play the exact original sound!
    if (
      mediaSource &&
      (asset.originalMimeType.startsWith('audio/') ||
        asset.originalMimeType.startsWith('video/') ||
        mediaSource.startsWith('data:audio/') ||
        mediaSource.startsWith('data:video/') ||
        mediaSource.startsWith('blob:') ||
        mediaSource.startsWith('/api/assets/'))
    ) {
      try {
        const audio = new Audio(mediaSource);
        audio.preload = 'auto';
        this.activeHtmlAudio = audio;

        audio.onended = () => {
          if (this.activeAssetId === asset.id) {
            this.stopAll();
          }
        };

        audio.onerror = () => {
          if (this.activeAssetId === asset.id) {
            this.stopAll();
          }
        };

        await audio.play();

        this.timerId = window.setInterval(() => {
          if (!this.activeHtmlAudio || this.activeAssetId !== asset.id) {
            this.stopAll();
            return;
          }
          const dur =
            Number.isFinite(this.activeHtmlAudio.duration) && this.activeHtmlAudio.duration > 0
              ? this.activeHtmlAudio.duration
              : (asset.durationMs ?? 3000) / 1000;
          const progress = Math.min(1, this.activeHtmlAudio.currentTime / dur);
          this.notify(asset.id, progress);
        }, 50);

        return;
      } catch {
        // Fall through if browser blocked playback
      }
    }

    // 2. For built-in seed demo assets (no user file uploaded yet), use natural Web Speech dialogue
    // instead of synthetic oscillator "dan tan tan" notes.
    this.startTime = performance.now();
    this.durationMs = Math.max(1500, asset.durationMs ?? 3000);

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        const utterance = new SpeechSynthesisUtterance(
          asset.transcriptDeva || asset.transcriptRoman || asset.title
        );
        utterance.lang = asset.language === 'HI' ? 'hi-IN' : asset.language === 'NE' ? 'ne-NP' : 'en-IN';
        utterance.rate = 1.05;
        window.speechSynthesis.speak(utterance);
      } catch {
        // Ignore if speechSynthesis is unsupported
      }
    }

    this.timerId = window.setInterval(() => {
      const elapsed = performance.now() - this.startTime;
      const progress = Math.min(1, elapsed / this.durationMs);
      if (progress >= 1) {
        this.stopAll();
      } else {
        this.notify(this.activeAssetId, progress);
      }
    }, 50);
  }
}

export const audioController = new MemeChowkAudioController();

/**
 * Resolves the downloadable Blob for an asset:
 * - If the user uploaded or recorded an original file, returns their EXACT original file!
 * - Otherwise generates a valid RIFF WAVE file for seed demo items.
 */
export async function resolveDownloadableAudioBlob(
  asset: MemeAsset
): Promise<{ blob: Blob; filename: string }> {
  // 1. Check in-memory mediaDataUrl
  if (asset.mediaDataUrl) {
    try {
      const res = await fetch(asset.mediaDataUrl);
      const blob = await res.blob();
      const filename =
        asset.originalFileName || `memechowk-${asset.slug}.${blob.type.split('/')[1] || 'mp3'}`;
      return { blob, filename };
    } catch {
      // Continue to IndexedDB check
    }
  }

  // 2. Check IndexedDB stored original Blob / DataURL
  const stored = await loadUploadedMediaFromDb(asset.id);
  if (stored instanceof Blob) {
    const ext = stored.type.split('/')[1]?.split(';')[0] || 'wav';
    return {
      blob: stored,
      filename: asset.originalFileName || `memechowk-${asset.slug}.${ext}`,
    };
  }
  if (typeof stored === 'string') {
    const res = await fetch(stored);
    const blob = await res.blob();
    const ext = blob.type.split('/')[1]?.split(';')[0] || 'wav';
    return {
      blob,
      filename: asset.originalFileName || `memechowk-${asset.slug}.${ext}`,
    };
  }

  // 3. Fallback silent/clean WAV container only for built-in seed demos
  const sampleRate = 22050;
  const durationSec = Math.min(Math.max((asset.durationMs ?? 2500) / 1000, 1.0), 4.0);
  const numSamples = Math.floor(sampleRate * durationSec);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  return {
    blob: new Blob([buffer], { type: 'audio/wav' }),
    filename: `memechowk-${asset.slug}.wav`,
  };
}
