import React, { useRef, useState } from 'react';
import {
  autoDetectAssetLanguageAndRegion,
  buildAutoApprovedSoundboardAsset,
  checkDuplicateAssetUpload,
  detectMediaTypeFromFile,
  DuplicateCheckResult,
  LanguageCode,
  LanguageDetectionResult,
  MediaType,
  MemeAsset,
  RegionCode,
  requiresCustomThumbnailOption,
} from '../lib/domain-logic';
import {
  computeBlobSha256Hex,
  extractAudioMetadataAndPeaks,
  readBlobAsDataUrl,
  saveUploadedMediaToDb,
  saveUploadedThumbnailToDb,
} from '../lib/media-storage';
import { AuthenticatedCreatorAccount } from '../lib/firebase-client';
import {
  Upload,
  Mic,
  CheckCircle2,
  FileAudio,
  Film,
  Image as ImageIcon,
  Volume2,
  AlertTriangle,
  Trash2,
  Sparkles,
  UserCheck,
} from 'lucide-react';

export interface QueuedUploadFileItem {
  localId: string;
  file: Blob;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  itemMediaType: MediaType;
  sha256Hash: string;
  dataUrl: string;
  durationMs: number;
  waveformPeaks: number[];
  customTitle: string;
  languageOverride: LanguageCode | 'AUTO';
  autoDetection: LanguageDetectionResult;
  thumbnailDataUrl?: string;
  thumbnailFileName?: string;
  duplicateCheck: DuplicateCheckResult;
}

interface UploadWizardViewProps {
  existingAssets: MemeAsset[];
  currentUser: AuthenticatedCreatorAccount | null;
  onOpenAuthModal: () => void;
  onBatchUploadPublished: (newAssets: MemeAsset[]) => void;
  onNavigateToSoundboard: () => void;
  onNavigateToHome: () => void;
}

export const UploadWizardView: React.FC<UploadWizardViewProps> = ({
  existingAssets,
  currentUser,
  onOpenAuthModal,
  onBatchUploadPublished,
  onNavigateToSoundboard,
  onNavigateToHome,
}) => {
  const [languageMode, setLanguageMode] = useState<LanguageCode | 'AUTO'>('AUTO');
  const [region, setRegion] = useState<RegionCode | 'AUTO'>('AUTO');
  const [category, setCategory] = useState('Original Soundboard Upload');
  const [emotion, setEmotion] = useState('Shocked / Confused');
  const [mediaType, setMediaType] = useState<MediaType>('AUDIO_DIALOGUE');
  const [aliasesInput, setAliasesInput] = useState('');

  // Shared default thumbnail specifically for Audio uploads (not needed for GIF or Meme Video)
  const [defaultAudioThumbUrl, setDefaultAudioThumbUrl] = useState<string | undefined>(
    undefined
  );
  const [defaultAudioThumbName, setDefaultAudioThumbName] = useState<string>('');

  // Queued multi-file items with live SHA-256 duplicate status & auto-language detection
  const [queuedFiles, setQueuedFiles] = useState<QueuedUploadFileItem[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);

  // Real Microphone MediaRecorder refs
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);

  const [validationError, setValidationError] = useState<string | null>(null);
  const [publishedBatchResult, setPublishedBatchResult] = useState<{
    publishedAssets: MemeAsset[];
    skippedDuplicates: QueuedUploadFileItem[];
  } | null>(null);

  const ingestFileList = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setIsProcessingFiles(true);
    setValidationError(null);
    setPublishedBatchResult(null);

    const newItems: QueuedUploadFileItem[] = [];
    const seenHashesInQueue = new Set(queuedFiles.map((q) => q.sha256Hash));
    const seenNameSizesInQueue = new Set(
      queuedFiles.map((q) => `${q.fileName.toLowerCase()}::${q.sizeBytes}`)
    );

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      if (file.size > 25 * 1024 * 1024) {
        setValidationError(`Skipped "${file.name}": exceeds maximum 25 MB upload limit.`);
        continue;
      }

      const detectedType = detectMediaTypeFromFile(file.name, file.type);
      const resolvedItemType: MediaType =
        detectedType === 'GIF'
          ? 'GIF'
          : detectedType === 'VIDEO_CLIP'
          ? 'VIDEO_CLIP'
          : detectedType === 'IMAGE_TEMPLATE'
          ? 'IMAGE_TEMPLATE'
          : requiresCustomThumbnailOption(mediaType)
          ? mediaType
          : 'AUDIO_DIALOGUE';

      if (i === 0 && queuedFiles.length === 0) {
        setMediaType(resolvedItemType);
      }

      const isAudioOrVideo =
        resolvedItemType === 'AUDIO_DIALOGUE' ||
        resolvedItemType === 'SOUND_EFFECT' ||
        resolvedItemType === 'VOICE_RECORDING' ||
        resolvedItemType === 'VIDEO_CLIP';

      const [sha256Hash, dataUrl, audioMeta] = await Promise.all([
        computeBlobSha256Hex(file),
        readBlobAsDataUrl(file),
        isAudioOrVideo
          ? extractAudioMetadataAndPeaks(file)
          : Promise.resolve({
              durationMs: 2400,
              waveformPeaks: Array.from({ length: 48 }, (_, k) => 30 + ((k * 17) % 50)),
            }),
      ]);

      const cleanBaseTitle = file.name
        .replace(/\.[^/.]+$/, '')
        .replace(/[-_]+/g, ' ')
        .trim();

      const autoDetection = autoDetectAssetLanguageAndRegion({
        title: cleanBaseTitle,
        fileName: file.name,
        mediaType: resolvedItemType,
      });

      let duplicateCheck = checkDuplicateAssetUpload(
        {
          fileName: file.name,
          sizeBytes: file.size,
          sha256Hash,
          title: cleanBaseTitle,
          durationMs: audioMeta.durationMs,
        },
        existingAssets
      );

      const nameSizeKey = `${file.name.toLowerCase()}::${file.size}`;
      if (
        !duplicateCheck.isDuplicate &&
        (seenHashesInQueue.has(sha256Hash) || seenNameSizesInQueue.has(nameSizeKey))
      ) {
        duplicateCheck = {
          isDuplicate: true,
          reason: 'BATCH_INTERNAL_DUPLICATE',
          matchedAssetTitle: file.name,
        };
      }

      seenHashesInQueue.add(sha256Hash);
      seenNameSizesInQueue.add(nameSizeKey);

      newItems.push({
        localId: `q-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        file,
        fileName: file.name,
        sizeBytes: file.size,
        mimeType:
          file.type ||
          (resolvedItemType === 'GIF'
            ? 'image/gif'
            : resolvedItemType === 'VIDEO_CLIP'
            ? 'video/mp4'
            : 'audio/mpeg'),
        itemMediaType: resolvedItemType,
        sha256Hash,
        dataUrl,
        durationMs: audioMeta.durationMs,
        waveformPeaks: audioMeta.waveformPeaks,
        customTitle: cleanBaseTitle || `Meme Clip ${i + 1}`,
        languageOverride: 'AUTO',
        autoDetection,
        thumbnailDataUrl: requiresCustomThumbnailOption(resolvedItemType)
          ? defaultAudioThumbUrl
          : undefined,
        thumbnailFileName: requiresCustomThumbnailOption(resolvedItemType)
          ? defaultAudioThumbName
          : undefined,
        duplicateCheck,
      });
    }

    setQueuedFiles((prev) => [...prev, ...newItems]);
    setIsProcessingFiles(false);
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await ingestFileList(e.target.files);
      e.target.value = '';
    }
  };

  const handleDropFiles = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await ingestFileList(e.dataTransfer.files);
    }
  };

  const handleDefaultAudioThumbnailSelect = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const thumbDataUrl = await readBlobAsDataUrl(file);
    setDefaultAudioThumbUrl(thumbDataUrl);
    setDefaultAudioThumbName(file.name);

    setQueuedFiles((prev) =>
      prev.map((item) =>
        requiresCustomThumbnailOption(item.itemMediaType) && !item.thumbnailDataUrl
          ? {
              ...item,
              thumbnailDataUrl: thumbDataUrl,
              thumbnailFileName: file.name,
            }
          : item
      )
    );
    e.target.value = '';
  };

  const handleItemAudioThumbnailSelect = async (
    localId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const thumbDataUrl = await readBlobAsDataUrl(file);
    setQueuedFiles((prev) =>
      prev.map((item) =>
        item.localId === localId
          ? {
              ...item,
              thumbnailDataUrl: thumbDataUrl,
              thumbnailFileName: file.name,
            }
          : item
      )
    );
    e.target.value = '';
  };

  const handleUpdateQueuedMediaType = (localId: string, nextType: MediaType) => {
    setQueuedFiles((prev) =>
      prev.map((item) => {
        if (item.localId !== localId) return item;
        const allowThumb = requiresCustomThumbnailOption(nextType);
        const reDetected = autoDetectAssetLanguageAndRegion({
          title: item.customTitle,
          fileName: item.fileName,
          mediaType: nextType,
        });
        return {
          ...item,
          itemMediaType: nextType,
          autoDetection: reDetected,
          thumbnailDataUrl: allowThumb
            ? item.thumbnailDataUrl ?? defaultAudioThumbUrl
            : undefined,
          thumbnailFileName: allowThumb
            ? item.thumbnailFileName ?? defaultAudioThumbName
            : undefined,
        };
      })
    );
  };

  const handleUpdateQueuedLanguageOverride = (
    localId: string,
    override: LanguageCode | 'AUTO'
  ) => {
    setQueuedFiles((prev) =>
      prev.map((item) =>
        item.localId === localId ? { ...item, languageOverride: override } : item
      )
    );
  };

  const handleRecordVoiceToggle = async () => {
    if (isRecordingVoice) {
      setIsRecordingVoice(false);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordedChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) {
          recordedChunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const audioBlob = new Blob(recordedChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        const ext = (recorder.mimeType || 'audio/webm').includes('mp4') ? 'm4a' : 'webm';
        const fileName = `recorded-voice-${Date.now().toString().slice(-4)}.${ext}`;
        const recordedFile = new File([audioBlob], fileName, {
          type: recorder.mimeType || 'audio/webm',
        });
        await ingestFileList([recordedFile]);
      };

      recorder.start();
      setIsRecordingVoice(true);
      setValidationError(null);
    } catch {
      setValidationError(
        'Microphone access was denied or unavailable. Please drag & drop or select files from your device.'
      );
    }
  };

  const handleUpdateQueuedTitle = (localId: string, newTitle: string) => {
    setQueuedFiles((prev) =>
      prev.map((item) => {
        if (item.localId !== localId) return item;
        const reDetected = autoDetectAssetLanguageAndRegion({
          title: newTitle,
          fileName: item.fileName,
          mediaType: item.itemMediaType,
        });
        return {
          ...item,
          customTitle: newTitle,
          autoDetection: reDetected,
        };
      })
    );
  };

  const handleRemoveQueuedItem = (localId: string) => {
    setQueuedFiles((prev) => prev.filter((item) => item.localId !== localId));
  };

  const handlePublishBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onOpenAuthModal();
      return;
    }
    if (queuedFiles.length === 0) {
      setValidationError(
        'Please select or drag & drop at least one Audio, Meme Video, GIF, or Image file first.'
      );
      return;
    }

    const extraAliases = aliasesInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const uniqueItems = queuedFiles.filter((q) => !q.duplicateCheck.isDuplicate);
    const duplicateItems = queuedFiles.filter((q) => q.duplicateCheck.isDuplicate);

    if (uniqueItems.length === 0) {
      setValidationError(
        'All selected files were automatically detected as duplicates of existing assets.'
      );
      return;
    }

    const createdAssets: MemeAsset[] = [];

    for (let i = 0; i < uniqueItems.length; i++) {
      const item = uniqueItems[i];
      const newId = `mc-upload-${Date.now()}-${i}`;

      // Persist exact original binary Blob in IndexedDB locally
      await saveUploadedMediaToDb(newId, item.file);

      const useThumb =
        requiresCustomThumbnailOption(item.itemMediaType) &&
        (item.thumbnailDataUrl || defaultAudioThumbUrl);
      if (useThumb) {
        await saveUploadedThumbnailToDb(newId, useThumb);
      }

      const effectiveLang: LanguageCode =
        item.languageOverride !== 'AUTO'
          ? item.languageOverride
          : languageMode !== 'AUTO'
          ? languageMode
          : item.autoDetection.language;

      const effectiveRegion: RegionCode =
        region !== 'AUTO' ? region : item.autoDetection.region;

      const newAsset = buildAutoApprovedSoundboardAsset({
        id: newId,
        fileName: item.fileName,
        mimeType: item.mimeType,
        sizeBytes: item.sizeBytes,
        sha256Hash: item.sha256Hash,
        mediaDataUrl: item.dataUrl,
        durationMs: item.durationMs,
        waveformPeaks: item.waveformPeaks,
        title: item.customTitle,
        transcriptDeva: item.customTitle,
        transcriptRoman: item.customTitle,
        language: effectiveLang,
        region: effectiveRegion,
        category,
        emotion,
        mediaType: item.itemMediaType,
        thumbnailDataUrl: useThumb,
        thumbnailFileName: item.thumbnailFileName || defaultAudioThumbName || undefined,
        aliases: extraAliases,
        paletteIndex: i,
        uploaderUid: currentUser.uid,
        uploaderName: currentUser.displayName,
        uploaderHandle: currentUser.handle,
      });

      createdAssets.push(newAsset);
    }

    onBatchUploadPublished(createdAssets);
    setPublishedBatchResult({
      publishedAssets: createdAssets,
      skippedDuplicates: duplicateItems,
    });
    setQueuedFiles([]);
  };

  const uniqueCount = queuedFiles.filter((q) => !q.duplicateCheck.isDuplicate).length;
  const duplicateCount = queuedFiles.filter((q) => q.duplicateCheck.isDuplicate).length;
  const showDefaultAudioThumbPicker = requiresCustomThumbnailOption(mediaType);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6 pb-5 border-b border-[#262B36] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs text-[#FFB800] font-medium">
            Auto-Language Detection · Shared Public Cloud Catalog · Audio Thumbnails · GIF & Meme Video
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#F3F4F6] mt-1">
            Upload Public Audio, Meme Videos, Animated GIFs & Templates
          </h1>
        </div>

        {/* Creator Identity Attribution Box */}
        <div className="p-3 rounded-xl bg-[#181B22] border border-[#262B36] flex items-center gap-3 shrink-0">
          <UserCheck className="w-4 h-4 text-[#10B981]" />
          <div className="text-xs">
            {currentUser ? (
              <div>
                <div className="font-bold text-[#F3F4F6]">
                  Uploading as @{currentUser.handle} ({currentUser.role})
                </div>
                <div className="text-[11px] text-[#10B981]">
                  🌐 Shared Publicly with Friends · Gains Likes, Favorites & Downloads
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-[#9CA3AF]">Login to publish to friends</span>
                <button
                  type="button"
                  onClick={onOpenAuthModal}
                  className="px-2.5 py-1 rounded-lg bg-[#FFB800] text-[#0F1115] font-bold cursor-pointer"
                >
                  Login / Register
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {publishedBatchResult && (
        <div
          data-testid="upload-success-banner"
          className="mb-6 p-5 rounded-2xl bg-[#132A1E] border border-[#10B981] text-[#F3F4F6] space-y-3"
        >
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-[#10B981] shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-bold text-[#10B981]">
                Auto-Published {publishedBatchResult.publishedAssets.length} Public Asset
                {publishedBatchResult.publishedAssets.length === 1 ? '' : 's'} & Organized by Language!
              </h2>
              <p className="text-xs text-[#A7F3D0] mt-1">
                Synced to the shared Public Catalog — your friends can now access, play, like, favorite, share, and download your upload from their own accounts!
              </p>
              <div className="text-xs font-mono text-[#E5E7EB] mt-1.5">
                Auto-Organized Languages:{' '}
                {publishedBatchResult.publishedAssets
                  .map((a) => `"${a.title}" → [${a.language} · ${a.region}]`)
                  .join(' · ')}
              </div>
              {publishedBatchResult.skippedDuplicates.length > 0 && (
                <p className="text-xs text-[#FDE68A] mt-1.5">
                  Auto-skipped {publishedBatchResult.skippedDuplicates.length} duplicate file(s):{' '}
                  {publishedBatchResult.skippedDuplicates.map((d) => d.fileName).join(', ')}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-1">
            <button
              type="button"
              onClick={onNavigateToSoundboard}
              className="px-4 py-2 rounded-lg bg-[#FFB800] text-[#0F1115] font-bold text-xs cursor-pointer"
            >
              Open Soundboard →
            </button>
            <button
              type="button"
              onClick={onNavigateToHome}
              className="px-4 py-2 rounded-lg bg-[#232834] text-[#F3F4F6] font-semibold text-xs cursor-pointer"
            >
              View in Public Language Shelves →
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handlePublishBatch} className="space-y-6">
        {/* Step 1: Multi-Format Drag-and-Drop Zone + Mic Recording */}
        <section className="bg-[#181B22] border border-[#262B36] rounded-2xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-[#F3F4F6]">
                01. Drag & Drop or Select Multiple Audio, Meme Video, or GIF Files
              </h2>
              <p className="text-xs text-[#9CA3AF]">
                Language (Nepali, Hindi/Hinglish, English, SFX) and Media Type are auto-detected for every file!
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div
              data-testid="wizard-multi-dropzone"
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingOver(true);
              }}
              onDragLeave={() => setIsDraggingOver(false)}
              onDrop={handleDropFiles}
              className={`md:col-span-2 flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed transition-colors ${
                isDraggingOver
                  ? 'border-[#10B981] bg-[#132A1E]/40'
                  : 'border-[#FFB800]/50 bg-[#0F1115] hover:border-[#FFB800]'
              }`}
            >
              <label className="w-full flex flex-col items-center justify-center cursor-pointer text-center">
                <Upload className="w-7 h-7 text-[#FFB800] mb-2" />
                <span className="text-xs sm:text-sm font-bold text-[#F3F4F6]">
                  {isProcessingFiles
                    ? 'Auto-Detecting Language & Running SHA-256 Duplicate Check...'
                    : 'Drag & Drop Multiple Audio, Meme Video (.MP4), or Animated .GIF Files'}
                </span>
                <span className="text-[11px] text-[#9CA3AF] mt-1 font-mono">
                  Multi-Select Enabled · MP3, WAV, OGG, M4A, MP4, WebM, Animated GIF, PNG, WebP
                </span>
                <input
                  data-testid="wizard-multi-file-input"
                  type="file"
                  multiple
                  accept="audio/*,video/*,image/gif,image/*"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
              </label>
            </div>

            <div className="flex flex-col items-center justify-center p-6 rounded-xl border border-[#262B36] bg-[#0F1115]">
              <Mic
                className={`w-6 h-6 mb-2 ${
                  isRecordingVoice ? 'text-[#FF4D4D]' : 'text-[#9CA3AF]'
                }`}
              />
              <span className="text-xs font-semibold text-[#F3F4F6] text-center">
                {isRecordingVoice
                  ? 'Recording Live Microphone...'
                  : 'Record Voice Directly to Queue'}
              </span>
              <button
                type="button"
                onClick={handleRecordVoiceToggle}
                className={`mt-2 px-4 py-2 rounded-lg text-xs font-bold cursor-pointer ${
                  isRecordingVoice
                    ? 'bg-[#FF4D4D] text-[#0F1115]'
                    : 'bg-[#232834] text-[#F3F4F6] hover:bg-[#2E3545]'
                }`}
              >
                {isRecordingVoice ? 'Stop & Add to Queue' : 'Start Mic Recording'}
              </button>
            </div>
          </div>

          {/* Queued Multi-File Batch List with Per-Item Auto-Detected Language & Audio Thumbnail */}
          {queuedFiles.length > 0 && (
            <div className="pt-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 font-mono-tabular">
                  <span className="font-bold text-[#F3F4F6]">
                    Queued Batch ({queuedFiles.length} file{queuedFiles.length === 1 ? '' : 's'})
                  </span>
                  <span aria-hidden="true" className="text-[#9CA3AF]">·</span>
                  <span className="text-[#10B981] font-semibold">
                    {uniqueCount} Verified Unique
                  </span>
                  {duplicateCount > 0 && (
                    <>
                      <span aria-hidden="true" className="text-[#9CA3AF]">·</span>
                      <span className="text-[#F59E0B] font-semibold">
                        {duplicateCount} Duplicate Auto-Flagged
                      </span>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setQueuedFiles([])}
                  className="text-xs text-[#FF4D4D] hover:underline cursor-pointer"
                >
                  Clear All Queued Files
                </button>
              </div>

              <div className="space-y-2.5">
                {queuedFiles.map((item, idx) => {
                  const isDup = item.duplicateCheck.isDuplicate;
                  const isAudioItem = requiresCustomThumbnailOption(item.itemMediaType);
                  const activeThumb = item.thumbnailDataUrl || defaultAudioThumbUrl;

                  return (
                    <div
                      key={item.localId}
                      data-testid={`queued-upload-item-${idx}`}
                      className={`p-4 rounded-xl border flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 ${
                        isDup
                          ? 'bg-[#2A1810] border-[#F59E0B]/60'
                          : 'bg-[#0F1115] border-[#262B36]'
                      }`}
                    >
                      {/* Left Visual Preview */}
                      <div className="w-16 h-16 rounded-xl bg-[#181B22] border border-[#262B36] overflow-hidden flex items-center justify-center shrink-0">
                        {item.itemMediaType === 'VIDEO_CLIP' ? (
                          <video
                            src={item.dataUrl}
                            muted
                            loop
                            playsInline
                            autoPlay
                            className="w-full h-full object-cover"
                          />
                        ) : item.itemMediaType === 'GIF' ||
                          item.itemMediaType === 'IMAGE_TEMPLATE' ? (
                          <img
                            src={item.dataUrl}
                            alt={item.customTitle}
                            className="w-full h-full object-cover"
                          />
                        ) : activeThumb ? (
                          <img
                            src={activeThumb}
                            alt={`Audio thumbnail for ${item.customTitle}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <FileAudio className="w-6 h-6 text-[#FFB800]" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0 space-y-2 w-full">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          {item.itemMediaType === 'VIDEO_CLIP' ? (
                            <Film className="w-4 h-4 text-[#A855F7] shrink-0" />
                          ) : item.itemMediaType === 'GIF' ? (
                            <ImageIcon className="w-4 h-4 text-[#F97316] shrink-0" />
                          ) : (
                            <FileAudio
                              className={`w-4 h-4 shrink-0 ${
                                isDup ? 'text-[#F59E0B]' : 'text-[#10B981]'
                              }`}
                            />
                          )}
                          <span className="font-bold text-[#F3F4F6] truncate">
                            {item.fileName}
                          </span>
                          <span
                            data-testid={`queued-item-lang-badge-${idx}`}
                            className="px-2 py-0.5 rounded bg-[#181B22] border border-[#FFB800]/50 text-[#FFB800] font-semibold"
                          >
                            {item.autoDetection.badgeLabel}
                          </span>
                          {isDup ? (
                            <span className="text-[#F59E0B] font-bold flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              Duplicate ({item.duplicateCheck.reason} — matches "
                              {item.duplicateCheck.matchedAssetTitle}")
                            </span>
                          ) : (
                            <span className="text-[#10B981] font-bold">
                              ✓ Unique ({item.itemMediaType.replace('_', ' ')})
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5">
                          <input
                            type="text"
                            value={item.customTitle}
                            onChange={(e) =>
                              handleUpdateQueuedTitle(item.localId, e.target.value)
                            }
                            placeholder="Title / dialogue (auto-detects language live)..."
                            className="flex-1 min-w-[180px] px-3 py-1.5 rounded-lg bg-[#181B22] border border-[#262B36] text-xs text-[#F3F4F6]"
                          />

                          <select
                            aria-label={`Language for ${item.fileName}`}
                            value={item.languageOverride}
                            onChange={(e) =>
                              handleUpdateQueuedLanguageOverride(
                                item.localId,
                                e.target.value as LanguageCode | 'AUTO'
                              )
                            }
                            className="px-2.5 py-1.5 rounded-lg bg-[#181B22] border border-[#262B36] text-xs text-[#FFB800] font-semibold"
                          >
                            <option value="AUTO">
                              Auto ({item.autoDetection.language} · {item.autoDetection.region})
                            </option>
                            <option value="NE">🇳🇵 Nepali (NE)</option>
                            <option value="HI">🇮🇳 Hindi (HI)</option>
                            <option value="EN">🇬🇧 English (EN)</option>
                            <option value="NON_VERBAL">🔊 Sound Effect (SFX)</option>
                          </select>

                          <select
                            aria-label={`Format for ${item.fileName}`}
                            value={item.itemMediaType}
                            onChange={(e) =>
                              handleUpdateQueuedMediaType(
                                item.localId,
                                e.target.value as MediaType
                              )
                            }
                            className="px-2.5 py-1.5 rounded-lg bg-[#181B22] border border-[#262B36] text-xs text-[#F3F4F6]"
                          >
                            <option value="AUDIO_DIALOGUE">Audio Dialogue</option>
                            <option value="SOUND_EFFECT">Sound Effect</option>
                            <option value="VOICE_RECORDING">Voice Recording</option>
                            <option value="VIDEO_CLIP">Meme Video (MP4/WebM)</option>
                            <option value="GIF">Animated GIF (.GIF)</option>
                            <option value="IMAGE_TEMPLATE">Meme Template (Image)</option>
                          </select>

                          {/* Thumbnail Picker ONLY for Audio items (not needed for Video or GIF) */}
                          {isAudioItem ? (
                            <label
                              data-testid={`item-audio-thumb-label-${idx}`}
                              className="px-3 py-1.5 rounded-lg bg-[#181B22] hover:bg-[#232834] border border-[#10B981]/60 text-xs font-semibold text-[#10B981] flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                            >
                              <ImageIcon className="w-3.5 h-3.5" />
                              <span>
                                {item.thumbnailFileName
                                  ? `Thumb: ${item.thumbnailFileName.slice(0, 14)}`
                                  : '+ Audio Thumbnail'}
                              </span>
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                onChange={(e) =>
                                  handleItemAudioThumbnailSelect(item.localId, e)
                                }
                                className="hidden"
                              />
                            </label>
                          ) : (
                            <span className="text-[11px] text-[#9CA3AF] font-mono px-2 py-1 rounded bg-[#181B22] border border-[#262B36]">
                              Auto-Preview (No separate thumbnail needed)
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveQueuedItem(item.localId)}
                        aria-label={`Remove ${item.fileName}`}
                        className="p-2 rounded-lg bg-[#181B22] border border-[#262B36] text-[#9CA3AF] hover:text-[#FF4D4D] cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* Step 2: Media Type Options + Auto-Language Mode + Conditional Audio Thumbnail */}
        <section className="bg-[#181B22] border border-[#262B36] rounded-2xl p-6 space-y-5">
          <div>
            <h2 className="text-base font-bold text-[#F3F4F6]">
              02. Auto-Language Organization & Audio Thumbnail Cover
            </h2>
            <p className="text-xs text-[#9CA3AF] mt-0.5">
              Leave Language on "Auto-Detect" so the platform automatically classifies Nepali, Hindi/Hinglish, English, and Sound Effects and places them in their matching language shelf.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#9CA3AF] mb-1.5">
                Media Format
              </label>
              <select
                data-testid="wizard-media-type-select"
                value={mediaType}
                onChange={(e) => setMediaType(e.target.value as MediaType)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F1115] border border-[#262B36] text-sm text-[#F3F4F6]"
              >
                <option value="AUDIO_DIALOGUE">Audio Dialogue (MP3 / WAV)</option>
                <option value="SOUND_EFFECT">Sound Effect (SFX)</option>
                <option value="VOICE_RECORDING">Voice Recording</option>
                <option value="VIDEO_CLIP">Meme Video Clip (MP4 / WebM)</option>
                <option value="GIF">Animated Meme GIF (.GIF)</option>
                <option value="IMAGE_TEMPLATE">Blank Meme Template (PNG / JPG)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#9CA3AF] mb-1.5">
                Language Organization
              </label>
              <select
                data-testid="wizard-language-mode-select"
                value={languageMode}
                onChange={(e) => setLanguageMode(e.target.value as LanguageCode | 'AUTO')}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F1115] border border-[#FFB800]/60 text-sm text-[#FFB800] font-semibold"
              >
                <option value="AUTO">✨ Auto-Detect Language (Recommended)</option>
                <option value="NE">🇳🇵 Force Nepali (नेपाली)</option>
                <option value="HI">🇮🇳 Force Hindi / Hinglish (हिन्दी)</option>
                <option value="EN">🇬🇧 Force South Asian English</option>
                <option value="NON_VERBAL">🔊 Force Non-Verbal / SFX</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#9CA3AF] mb-1.5">
                Region
              </label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value as RegionCode | 'AUTO')}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F1115] border border-[#262B36] text-sm text-[#F3F4F6]"
              >
                <option value="AUTO">✨ Auto-Match Region</option>
                <option value="NP">Nepal (NP)</option>
                <option value="IN">India (IN)</option>
                <option value="SOUTH_ASIA">Pan-South Asia</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#9CA3AF] mb-1.5">
                Reaction Emotion
              </label>
              <select
                value={emotion}
                onChange={(e) => setEmotion(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F1115] border border-[#262B36] text-sm text-[#F3F4F6]"
              >
                <option value="Shocked / Confused">Shocked / Confused</option>
                <option value="Sarcastic / Savage">Sarcastic / Savage</option>
                <option value="Resigned / Relatable">Resigned / Relatable</option>
                <option value="Hype / Celebration">Hype / Celebration</option>
                <option value="Panic / Chaos">Panic / Chaos</option>
              </select>
            </div>
          </div>

          {/* Conditional Audio Thumbnail Upload Section (Shown for Audio, Hidden for Video & GIF) */}
          {showDefaultAudioThumbPicker ? (
            <div
              data-testid="audio-thumbnail-picker"
              className="p-4 rounded-xl bg-[#0F1115] border border-[#10B981]/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3.5">
                {defaultAudioThumbUrl ? (
                  <img
                    src={defaultAudioThumbUrl}
                    alt="Default audio thumbnail preview"
                    className="w-14 h-14 rounded-xl object-cover border border-[#10B981] shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-[#181B22] border border-[#262B36] flex items-center justify-center shrink-0">
                    <ImageIcon className="w-6 h-6 text-[#10B981]" />
                  </div>
                )}
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-[#F3F4F6]">
                    Audio Cover Thumbnail Option (Makes Audio Pads Easy to Find Visually)
                  </h3>
                  <p className="text-xs text-[#9CA3AF] mt-0.5">
                    {defaultAudioThumbName
                      ? `Selected cover image: "${defaultAudioThumbName}" — will be displayed on your Soundboard pad & feed card.`
                      : 'Upload an optional reaction face, movie frame, or icon (JPG/PNG/WebP) so users can recognize this audio clip at a glance.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <label className="px-3.5 py-2 rounded-lg bg-[#132A1E] hover:bg-[#193828] border border-[#10B981] text-xs font-bold text-[#10B981] flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>
                    {defaultAudioThumbUrl ? 'Change Audio Thumbnail' : '+ Upload Audio Thumbnail'}
                  </span>
                  <input
                    data-testid="default-audio-thumbnail-input"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleDefaultAudioThumbnailSelect}
                    className="hidden"
                  />
                </label>
                {defaultAudioThumbUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setDefaultAudioThumbUrl(undefined);
                      setDefaultAudioThumbName('');
                    }}
                    className="px-2.5 py-2 rounded-lg bg-[#181B22] border border-[#262B36] text-xs text-[#9CA3AF] hover:text-[#FF4D4D] cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div
              data-testid="no-thumbnail-needed-notice"
              className="p-4 rounded-xl bg-[#0F1115] border border-[#262B36] flex items-center gap-3 text-xs text-[#9CA3AF]"
            >
              <Film className="w-4 h-4 text-[#FFB800] shrink-0" />
              <span>
                <strong className="text-[#F3F4F6]">
                  {mediaType === 'GIF' ? 'Animated GIF Mode' : 'Meme Video / Image Mode'}:
                </strong>{' '}
                No separate thumbnail upload is necessary — Meme Videos and GIFs automatically render their own live video frames or animated loop directly in the feed.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#9CA3AF] mb-1.5">
                Category
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F1115] border border-[#262B36] text-sm text-[#F3F4F6]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#9CA3AF] mb-1.5">
                Extra Search Aliases (Optional, comma-separated)
              </label>
              <input
                type="text"
                value={aliasesInput}
                onChange={(e) => setAliasesInput(e.target.value)}
                placeholder="e.g., k ho yo, ke ho yo, के हो यो"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F1115] border border-[#262B36] text-sm text-[#F3F4F6]"
              />
            </div>
          </div>
        </section>

        {validationError && (
          <div className="p-4 rounded-xl bg-[#2D161E] border border-[#FF4D4D] text-xs text-[#FF4D4D] font-medium">
            {validationError}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isProcessingFiles}
            className="px-6 py-3.5 rounded-xl bg-[#FFB800] hover:bg-[#e6a600] text-[#0F1115] font-bold text-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            <span>
              Auto-Detect Language & Publish {uniqueCount > 0 ? `${uniqueCount} Public Item(s)` : 'Batch'} Now
            </span>
          </button>
        </div>
      </form>
    </div>
  );
};
