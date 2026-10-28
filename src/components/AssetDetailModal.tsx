import React, { useState } from 'react';
import {
  AssetReport,
  AssetVariant,
  evaluateAssetRights,
  MemeAsset,
  requiresCustomThumbnailOption,
  verifyDownloadEligibility,
} from '../lib/domain-logic';
import {
  drawAssetIllustrationToCanvas,
  MemeArtworkCardPreview,
} from './MemeArtworkCanvas';
import { resolveDownloadableAudioBlob } from '../lib/audio-controller';
import {
  extractAudioMetadataAndPeaks,
  readBlobAsDataUrl,
  saveUploadedMediaToDb,
  saveUploadedThumbnailToDb,
} from '../lib/media-storage';
import {
  X,
  Play,
  Square,
  Download,
  Sparkles,
  Bookmark,
  Flag,
  Share2,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Image as ImageIcon,
  Heart,
} from 'lucide-react';

interface AssetDetailModalProps {
  asset: MemeAsset;
  isPlaying: boolean;
  audioProgress: number;
  isSaved: boolean;
  isLiked?: boolean;
  onClose: () => void;
  onTogglePlay: (asset: MemeAsset) => void;
  onToggleSave: (assetId: string) => void;
  onToggleLike?: (assetId: string) => void;
  onRecordShare?: (assetId: string) => void;
  onOpenInEditor: (asset: MemeAsset) => void;
  onRecordDownload: (assetId: string) => void;
  onAttachCustomAudio: (
    assetId: string,
    mediaDataUrl: string,
    fileName: string,
    mimeType: string,
    sizeBytes: number,
    durationMs: number,
    waveformPeaks: number[]
  ) => void;
  onAttachAudioThumbnail?: (
    assetId: string,
    thumbnailDataUrl: string,
    thumbnailFileName: string
  ) => void;
  onSubmitReport: (
    assetId: string,
    reasonCategory: AssetReport['reasonCategory'],
    details: string
  ) => void;
}

export const AssetDetailModal: React.FC<AssetDetailModalProps> = ({
  asset,
  isPlaying,
  audioProgress,
  isSaved,
  isLiked = false,
  onClose,
  onTogglePlay,
  onToggleSave,
  onToggleLike,
  onRecordShare,
  onOpenInEditor,
  onRecordDownload,
  onAttachCustomAudio,
  onAttachAudioThumbnail,
  onSubmitReport,
}) => {
  const [downloadFeedback, setDownloadFeedback] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportCategory, setReportCategory] = useState<AssetReport['reasonCategory']>(
    'COPYRIGHT_OR_UNCREDITED_CREATOR'
  );
  const [reportDetails, setReportDetails] = useState('');
  const [reportSubmittedMsg, setReportSubmittedMsg] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

  const rightsEval = evaluateAssetRights({
    sourceDeclaration: asset.rightsRecord.sourceDeclaration,
    moderatorVerifiedRights: asset.rightsRecord.moderatorVerifiedRights,
    requestedReuseTier: asset.rightsRecord.reuseTier,
  });

  const readyVariants = asset.variants.filter((v) => v.isReady);

  const handleDownloadVariant = async (variant: AssetVariant) => {
    const check = verifyDownloadEligibility(asset, variant.id);
    if (!check.allowed) {
      setDownloadError(check.reason ?? `HTTP ${check.httpStatus} Download Blocked`);
      setDownloadFeedback(null);
      return;
    }

    setDownloadError(null);

    if (variant.mimeType.startsWith('audio/') || variant.mimeType.startsWith('video/')) {
      const { blob, filename } = await resolveDownloadableAudioBlob(asset);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      onRecordDownload(asset.id);
      setDownloadFeedback(`Downloaded original audio file "${filename}"`);
      return;
    }

    // Generate clean EXIF-stripped PNG from procedural canvas
    const offscreen = document.createElement('canvas');
    offscreen.width = variant.width ?? 1080;
    offscreen.height = variant.height ?? 1080;
    const ctx = offscreen.getContext('2d');
    if (ctx) {
      drawAssetIllustrationToCanvas(ctx, asset, offscreen.width, offscreen.height, true);
      offscreen.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `memechowk-${asset.slug}-${variant.kind.toLowerCase()}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }, 'image/png');
    }

    onRecordDownload(asset.id);
    setDownloadFeedback(
      `Downloaded ${variant.label} (filename="memechowk-${asset.slug}.${variant.extension}")`
    );
  };

  const handleReplaceCardAudioFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await saveUploadedMediaToDb(asset.id, file);
    const meta = await extractAudioMetadataAndPeaks(file);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onAttachCustomAudio(
          asset.id,
          reader.result,
          file.name,
          file.type || 'audio/mpeg',
          file.size,
          meta.durationMs,
          meta.waveformPeaks
        );
        setDownloadFeedback(`Attached original audio "${file.name}" to this meme!`);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAttachThumbnailFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await readBlobAsDataUrl(file);
    await saveUploadedThumbnailToDb(asset.id, dataUrl);
    if (onAttachAudioThumbnail) {
      onAttachAudioThumbnail(asset.id, dataUrl, file.name);
    }
    setDownloadFeedback(`Updated custom audio thumbnail ("${file.name}")!`);
    e.target.value = '';
  };

  const handleReportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportDetails.trim()) return;
    onSubmitReport(asset.id, reportCategory, reportDetails.trim());
    setReportSubmittedMsg(
      'Report logged. Note: 3+ Private Person / Non-Consensual reports automatically lock the asset into UNDER_EMERGENCY_REVIEW.'
    );
    setReportDetails('');
    setShowReportForm(false);
  };

  const handleShareIntent = () => {
    const shareUrl = `${window.location.origin}/?asset=${asset.slug}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl).catch(() => {});
    }
    if (onRecordShare) {
      onRecordShare(asset.id);
    }
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 3000);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="asset-detail-heading"
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
    >
      <div className="bg-[#181B22] border border-[#262B36] rounded-2xl max-w-4xl w-full overflow-hidden my-auto shadow-2xl">
        {/* Top Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#262B36]">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-[#9CA3AF]">
              <span>Permanent Route: /a/{asset.slug}</span>
              <span aria-hidden="true">·</span>
              <span className="text-[#FFB800] font-semibold">Language: {asset.language}</span>
              <span aria-hidden="true">·</span>
              <span>By @{asset.uploaderHandle}</span>
            </div>
            <h2
              id="asset-detail-heading"
              className="text-lg sm:text-xl font-bold text-[#F3F4F6] truncate mt-0.5"
            >
              {asset.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close asset detail"
            className="p-2 rounded-lg bg-[#0F1115] text-[#9CA3AF] hover:text-[#F3F4F6] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Content Grid */}
        <div className="p-5 grid grid-cols-1 md:grid-cols-12 gap-6 max-h-[82vh] overflow-y-auto">
          {/* Left 5 Cols: Media Preview + Audio Playback Control */}
          <div className="md:col-span-5 space-y-3">
            <div className="rounded-xl overflow-hidden border border-[#262B36]">
              <MemeArtworkCardPreview
                asset={asset}
                isPlaying={isPlaying}
                progress={audioProgress}
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onTogglePlay(asset)}
                className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                  isPlaying
                    ? 'bg-[#FF4D4D] text-[#0F1115]'
                    : 'bg-[#FFB800] text-[#0F1115] hover:bg-[#e6a600]'
                }`}
              >
                {isPlaying ? (
                  <>
                    <Square className="w-4 h-4 fill-current" />
                    <span>Stop Audio</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>
                      {asset.mediaDataUrl || asset.originalFileName
                        ? `Play Original (${asset.originalFileName || 'Uploaded Audio'})`
                        : 'Play Audio Preview'}
                    </span>
                  </>
                )}
              </button>
            </div>

            {/* Public Engagement Bar: Like, Favorite, Share & Downloads */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => onToggleLike?.(asset.id)}
                className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                  isLiked
                    ? 'bg-[#F43F5E]/15 border-[#F43F5E] text-[#F43F5E]'
                    : 'bg-[#0F1115] border-[#262B36] text-[#E5E7EB] hover:border-[#F43F5E]'
                }`}
              >
                <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} />
                <span>Like ({asset.likeCount ?? 0})</span>
              </button>

              <button
                type="button"
                onClick={() => onToggleSave(asset.id)}
                className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                  isSaved
                    ? 'bg-[#FFB800]/15 border-[#FFB800] text-[#FFB800]'
                    : 'bg-[#0F1115] border-[#262B36] text-[#E5E7EB] hover:border-[#FFB800]'
                }`}
              >
                <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-current' : ''}`} />
                <span>Fav ({asset.favoriteCount ?? 0})</span>
              </button>

              <button
                type="button"
                onClick={handleShareIntent}
                className="py-2 px-3 rounded-xl bg-[#0F1115] border border-[#262B36] hover:border-[#38BDF8] text-[#E5E7EB] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5 text-[#38BDF8]" />
                <span>Share ({asset.shareCount ?? 0})</span>
              </button>
            </div>

            {/* Option to attach/replace with a real MP3/WAV file right on this card */}
            <label className="w-full py-2 px-3 rounded-xl bg-[#0F1115] border border-dashed border-[#374151] hover:border-[#FFB800] text-xs text-[#E5E7EB] flex items-center justify-center gap-2 cursor-pointer transition-colors">
              <Upload className="w-3.5 h-3.5 text-[#FFB800]" />
              <span>Attach / Replace Original MP3 or WAV Audio</span>
              <input
                type="file"
                accept="audio/*,video/*"
                onChange={handleReplaceCardAudioFile}
                className="hidden"
              />
            </label>

            {/* Custom Thumbnail Option ONLY for Audio Assets (Not necessary for GIF or Meme Video) */}
            {requiresCustomThumbnailOption(asset.mediaType) ? (
              <label
                data-testid="modal-audio-thumbnail-upload"
                className="w-full py-2 px-3 rounded-xl bg-[#0F1115] border border-dashed border-[#10B981]/60 hover:border-[#10B981] text-xs text-[#A7F3D0] flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <ImageIcon className="w-3.5 h-3.5 text-[#10B981]" />
                <span>
                  {asset.thumbnailDataUrl || asset.thumbnailFileName
                    ? `Change Audio Thumbnail (${asset.thumbnailFileName || 'Custom Cover'})`
                    : '+ Upload Custom Audio Thumbnail (Easy Visual Finder)'}
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleAttachThumbnailFile}
                  className="hidden"
                />
              </label>
            ) : (
              <div className="py-1.5 px-3 rounded-lg bg-[#0F1115] border border-[#262B36] text-[11px] text-[#9CA3AF] text-center">
                {asset.mediaType === 'GIF' || asset.mediaType === 'VIDEO_CLIP'
                  ? 'Live Video / Animated GIF auto-preview active (separate thumbnail not required)'
                  : 'Image template preview active'}
              </div>
            )}

            {shareCopied && (
              <p className="text-xs text-[#10B981] font-mono-tabular">
                Copied link (share_intent_clicked logged honestly)
              </p>
            )}

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenInEditor(asset);
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-[#232834] hover:bg-[#2E3545] text-[#F3F4F6] font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-[#FFB800]" />
              <span>Open Blank Template in Meme Editor</span>
            </button>
          </div>

          {/* Right 7 Cols: Bilingual Transcript, Rights Ledger & Verified Downloads */}
          <div className="md:col-span-7 space-y-4">
            {/* Bilingual Dialogue & Transcript Box */}
            <div className="p-4 rounded-xl bg-[#0F1115] border border-[#262B36] space-y-2">
              <div className="text-xs font-semibold text-[#9CA3AF]">
                Bilingual Dialogue Transcript & Cultural Context
              </div>
              <p className="text-base sm:text-lg font-bold font-deva text-[#FFB800]">
                "{asset.transcriptDeva}"
              </p>
              <p className="text-sm font-medium text-[#F3F4F6]">
                "{asset.transcriptRoman}"
              </p>
              <p className="text-xs text-[#9CA3AF] pt-1 border-t border-[#262B36]">
                Context: {asset.englishContextNote}
              </p>
            </div>

            {/* Honest Rights & Attribution Ledger */}
            <div className="p-4 rounded-xl bg-[#0F1115] border border-[#262B36] space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#F3F4F6]">
                  Permission Basis & Reuse Tier
                </span>
                <span className="font-mono-tabular text-[#9CA3AF]">
                  Creator: {asset.rightsRecord.creatorAttributionName}
                </span>
              </div>
              <p
                className={`text-xs font-semibold ${
                  asset.rightsRecord.commercialEligible
                    ? 'text-[#10B981]'
                    : 'text-[#F59E0B]'
                }`}
              >
                {rightsEval.badgeText}
              </p>
              {asset.parentAssetTitle && (
                <p className="text-xs text-[#38BDF8]">
                  Remix Lineage: Remixed from "{asset.parentAssetTitle}"
                </p>
              )}
              <div className="text-[11px] font-mono-tabular text-[#9CA3AF] pt-1">
                Search Aliases:{' '}
                {asset.searchAliases.map((a) => a.rawAlias).join(' · ')}
              </div>
            </div>

            {/* Verified Download Matrix (Only Ready Variants) */}
            <div className="p-4 rounded-xl bg-[#0F1115] border border-[#262B36] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#F3F4F6]">
                  Verified Download Variants ({readyVariants.length} Ready)
                </span>
                <span className="text-[11px] font-mono-tabular text-[#9CA3AF]">
                  Rate Limit: 30 / 10m
                </span>
              </div>

              {downloadFeedback && (
                <div
                  role="status"
                  className="p-2.5 rounded-lg bg-[#132A1E] border border-[#10B981]/50 text-xs text-[#A7F3D0] flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
                  <span>{downloadFeedback}</span>
                </div>
              )}

              {downloadError && (
                <div
                  role="alert"
                  className="p-2.5 rounded-lg bg-[#2D161E] border border-[#FF4D4D] text-xs text-[#FCA5A5] flex items-center gap-2"
                >
                  <AlertTriangle className="w-4 h-4 text-[#FF4D4D] shrink-0" />
                  <span>{downloadError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {readyVariants.map((variant) => (
                  <button
                    key={variant.id}
                    type="button"
                    onClick={() => handleDownloadVariant(variant)}
                    className="p-3 rounded-xl bg-[#181B22] hover:bg-[#232834] border border-[#262B36] hover:border-[#FFB800] text-left transition-colors flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[#F3F4F6] truncate">
                        {variant.label}
                      </div>
                      <div className="text-[11px] font-mono-tabular text-[#9CA3AF]">
                        .{variant.extension.toUpperCase()} ·{' '}
                        {Math.max(1, Math.round(variant.sizeBytes / 1024))} KB
                      </div>
                    </div>
                    <Download className="w-4 h-4 text-[#FFB800] shrink-0" />
                  </button>
                ))}
              </div>
            </div>

            {/* Report / Claim Rights Toggle */}
            <div className="pt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono-tabular text-[#9CA3AF]">
                  {asset.viewCount.toLocaleString()} views ·{' '}
                  {asset.downloadCount.toLocaleString()} downloads ·{' '}
                  {asset.remixCount} remixes
                </span>
                <button
                  type="button"
                  onClick={() => setShowReportForm((prev) => !prev)}
                  className="text-xs text-[#9CA3AF] hover:text-[#FF4D4D] flex items-center gap-1 cursor-pointer"
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span>Report / Claim Rights</span>
                </button>
              </div>

              {reportSubmittedMsg && (
                <p className="mt-2 text-xs text-[#10B981]">{reportSubmittedMsg}</p>
              )}

              {showReportForm && (
                <form
                  onSubmit={handleReportSubmit}
                  className="mt-3 p-3.5 rounded-xl bg-[#0F1115] border border-[#FF4D4D]/40 space-y-3"
                >
                  <div className="text-xs font-bold text-[#F3F4F6]">
                    Report Copyright, Uncredited Creator, or Private Person Abuse
                  </div>
                  <select
                    value={reportCategory}
                    onChange={(e) =>
                      setReportCategory(
                        e.target.value as AssetReport['reasonCategory']
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg bg-[#181B22] border border-[#262B36] text-xs text-[#F3F4F6]"
                  >
                    <option value="COPYRIGHT_OR_UNCREDITED_CREATOR">
                      Copyright Infringement / Uncredited Original Creator
                    </option>
                    <option value="PRIVATE_PERSON_OR_NON_CONSENSUAL">
                      Private Individual / Non-Consensual Voice or Photo (Urgent)
                    </option>
                    <option value="HARASSMENT_OR_HATE_SPEECH">
                      Harassment / Targeted Bullying
                    </option>
                    <option value="NSFW_OR_VIOLENCE">NSFW or Graphic Content</option>
                  </select>
                  <input
                    type="text"
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
                    placeholder="Provide source link or reason for takedown..."
                    className="w-full px-3 py-2 rounded-lg bg-[#181B22] border border-[#262B36] text-xs text-[#F3F4F6]"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowReportForm(false)}
                      className="px-3 py-1.5 rounded-lg text-xs text-[#9CA3AF] cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-3.5 py-1.5 rounded-lg bg-[#FF4D4D] text-[#0F1115] font-bold text-xs cursor-pointer"
                    >
                      Submit Report
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
