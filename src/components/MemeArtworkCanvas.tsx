import React from 'react';
import { MemeAsset, requiresCustomThumbnailOption } from '../lib/domain-logic';
import {
  loadUploadedMediaFromDb,
  loadUploadedThumbnailFromDb,
} from '../lib/media-storage';

export interface TextLayerConfig {
  id: string;
  text: string;
  xPercent: number; // 0..100
  yPercent: number; // 0..100
  fontSize: number;
  fontFamily: 'Mukta' | 'Noto Sans Devanagari' | 'Impact' | 'Plus Jakarta Sans';
  textColor: string;
  strokeColor: string;
  strokeWidth: number;
  highlightBox: boolean;
  highlightColor: string;
  uppercase: boolean;
}

/**
 * Draws the procedural character/scene illustration for any MemeAsset onto a 2D Canvas context
 * so the Image Meme Editor (/editor) and PNG downloads produce high-resolution, self-contained images.
 */
export function drawAssetIllustrationToCanvas(
  ctx: CanvasRenderingContext2D,
  asset: MemeAsset,
  width: number,
  height: number,
  includeDefaultCaption = false
) {
  const { bgPrimary, bgSecondary, accent, illustrationType } = asset.posterPalette;

  // 1. Studio radial/diagonal gradient background
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, bgPrimary);
  grad.addColorStop(1, bgSecondary);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Subtle geometric mandala / chowk courtyard grid pattern
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = Math.max(1, width * 0.002);
  const step = width / 8;
  for (let x = step; x < width; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = step; y < height; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.restore();

  const cx = width * 0.5;
  const cy = height * 0.52;
  const scale = width / 600;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  // Glow backdrop circle
  const glow = ctx.createRadialGradient(0, 0, 20, 0, 0, 175);
  glow.addColorStop(0, `${accent}44`);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 175, 0, Math.PI * 2);
  ctx.fill();

  // Character / Scene Illustration based on illustrationType
  if (illustrationType === 'shocked_student') {
    // Dhaka topi hat + wide shocked eyes + question paper
    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.arc(0, -15, 72, 0, Math.PI * 2);
    ctx.fill();

    // Traditional Nepali Dhaka Topi geometric hat
    ctx.fillStyle = '#DC2626';
    ctx.beginPath();
    ctx.moveTo(-64, -55);
    ctx.lineTo(58, -108);
    ctx.lineTo(66, -55);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#FFB800';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Shocked wide eyes
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(-25, -20, 18, 0, Math.PI * 2);
    ctx.arc(25, -20, 18, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0F1115';
    ctx.beginPath();
    ctx.arc(-25, -20, 6, 0, Math.PI * 2);
    ctx.arc(25, -20, 6, 0, Math.PI * 2);
    ctx.fill();

    // Open shocked mouth
    ctx.fillStyle = '#7F1D1D';
    ctx.beginPath();
    ctx.ellipse(0, 22, 22, 28, 0, 0, Math.PI * 2);
    ctx.fill();

    // Exam question paper with "???"
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(-85, 65, 170, 70);
    ctx.fillStyle = '#EF4444';
    ctx.font = 'bold 26px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TU EXAM: Q1 ???', 0, 108);
  } else if (illustrationType === 'life_sigh') {
    // Late night window, crescent moon, student leaning on desk with teacup
    ctx.fillStyle = '#FDE047';
    ctx.beginPath();
    ctx.arc(95, -95, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = bgPrimary;
    ctx.beginPath();
    ctx.arc(106, -102, 24, 0, Math.PI * 2);
    ctx.fill();

    // Laptop silhouette + glowing screen
    ctx.fillStyle = '#38BDF8';
    ctx.fillRect(-105, 5, 95, 62);
    ctx.fillStyle = '#94A3B8';
    ctx.fillRect(-115, 67, 115, 10);

    // Person silhouette sighing
    ctx.fillStyle = '#E2E8F0';
    ctx.beginPath();
    ctx.arc(45, -10, 46, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 4;
    // Closed tired eyes
    ctx.beginPath();
    ctx.arc(28, -12, 10, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(62, -12, 10, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
    // Flat sigh mouth
    ctx.beginPath();
    ctx.moveTo(30, 16);
    ctx.lineTo(60, 12);
    ctx.stroke();
  } else if (illustrationType === 'panic_bro') {
    // Gaming headset + microphone + red alert waves
    ctx.strokeStyle = '#FF4D4D';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(0, -10, 84, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();

    // Ear cups
    ctx.fillStyle = '#EF4444';
    ctx.fillRect(-94, -22, 22, 52);
    ctx.fillRect(72, -22, 22, 52);

    // Face
    ctx.fillStyle = '#FBBF24';
    ctx.beginPath();
    ctx.arc(0, 0, 68, 0, Math.PI * 2);
    ctx.fill();

    // Glasses
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 5;
    ctx.strokeRect(-46, -24, 38, 26);
    ctx.strokeRect(8, -24, 38, 26);
    ctx.beginPath();
    ctx.moveTo(-8, -12);
    ctx.lineTo(8, -12);
    ctx.stroke();

    // Shouting mouth
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.roundRect(-30, 16, 60, 32, 12);
    ctx.fill();
  } else if (illustrationType === 'money_rain') {
    // Smiling character with sunglasses & flying NPR / INR notes
    ctx.fillStyle = '#10B981';
    for (let i = -2; i <= 2; i++) {
      ctx.save();
      ctx.translate(i * 55, -85 + Math.abs(i) * 18);
      ctx.rotate(i * 0.18);
      ctx.fillRect(-32, -16, 64, 32);
      ctx.strokeStyle = '#A7F3D0';
      ctx.lineWidth = 2;
      ctx.strokeRect(-28, -12, 56, 24);
      ctx.fillStyle = '#064E3B';
      ctx.font = 'bold 14px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('रू 1000', 0, 5);
      ctx.restore();
      ctx.fillStyle = '#10B981';
    }

    ctx.fillStyle = '#FBBF24';
    ctx.beginPath();
    ctx.arc(0, 20, 64, 0, Math.PI * 2);
    ctx.fill();

    // Cool dark sunglasses
    ctx.fillStyle = '#0F1115';
    ctx.fillRect(-48, -2, 42, 22);
    ctx.fillRect(6, -2, 42, 22);
    ctx.fillRect(-6, 3, 12, 5);

    // Big grin
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(0, 34, 32, 0, Math.PI);
    ctx.fill();
  } else if (illustrationType === 'dal_bhat') {
    // Brass Thakali Kansa Thali with steaming rice, black lentil dal, and tarkari bowls
    ctx.fillStyle = '#D97706';
    ctx.beginPath();
    ctx.arc(0, 5, 110, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.arc(0, 5, 96, 0, Math.PI * 2);
    ctx.fill();

    // Steaming white bhat mound in center
    ctx.fillStyle = '#F8FAFC';
    ctx.beginPath();
    ctx.arc(0, 22, 46, 0, Math.PI * 2);
    ctx.fill();

    // Kalo dal, saag, tarkari, achar bowls around rim
    const bowlColors = ['#292524', '#15803D', '#DC2626', '#EA580C'];
    bowlColors.forEach((col, i) => {
      const angle = -Math.PI * 0.8 + i * (Math.PI * 0.52);
      const bx = Math.cos(angle) * 62;
      const by = Math.sin(angle) * 58;
      ctx.fillStyle = '#B45309';
      ctx.beginPath();
      ctx.arc(bx, by, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(bx, by, 19, 0, Math.PI * 2);
      ctx.fill();
    });
  } else {
    // Expressive stylized waveform + megaphone / tea glass emblem
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.roundRect(-85, -55, 170, 110, 24);
    ctx.fill();

    ctx.fillStyle = '#0F1115';
    const bars = 9;
    for (let i = 0; i < bars; i++) {
      const bh = 24 + ((i * 23) % 56);
      ctx.fillRect(-64 + i * 15, -bh / 2, 9, bh);
    }
  }

  ctx.restore();

  if (includeDefaultCaption) {
    // Draw bottom translucent scrim with Devanagari + Romanized transcript
    const scrimGrad = ctx.createLinearGradient(0, height * 0.65, 0, height);
    scrimGrad.addColorStop(0, 'rgba(15, 17, 21, 0)');
    scrimGrad.addColorStop(0.45, 'rgba(15, 17, 21, 0.85)');
    scrimGrad.addColorStop(1, 'rgba(15, 17, 21, 0.96)');
    ctx.fillStyle = scrimGrad;
    ctx.fillRect(0, height * 0.65, width, height * 0.35);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFB800';
    ctx.font = `700 ${Math.round(width * 0.044)}px "Mukta", "Noto Sans Devanagari", sans-serif`;
    ctx.fillText(asset.transcriptDeva.slice(0, 38), width * 0.5, height * 0.84);

    ctx.fillStyle = '#E5E7EB';
    ctx.font = `600 ${Math.round(width * 0.028)}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillText(`"${asset.transcriptRoman.slice(0, 48)}"`, width * 0.5, height * 0.91);
  }
}

/**
 * Renders an asset template + custom user text layers onto an HTML5 Canvas
 */
export function renderMemeEditorCanvas(
  canvas: HTMLCanvasElement,
  asset: MemeAsset,
  layers: TextLayerConfig[]
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;

  drawAssetIllustrationToCanvas(ctx, asset, width, height, false);

  // Render each text layer with optional highlight box & stroke outline
  for (const layer of layers) {
    if (!layer.text.trim()) continue;
    const displayText = layer.uppercase ? layer.text.toUpperCase() : layer.text;
    const x = (layer.xPercent / 100) * width;
    const y = (layer.yPercent / 100) * height;
    const scaledFontPx = Math.round((layer.fontSize / 600) * width);

    ctx.save();
    ctx.font = `800 ${scaledFontPx}px "${layer.fontFamily}", "Mukta", "Noto Sans Devanagari", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Wrap text if longer than canvas width * 0.88
    const words = displayText.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > width * 0.86 && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);

    const lineHeight = scaledFontPx * 1.32;
    const totalBlockHeight = lines.length * lineHeight;
    const startY = y - totalBlockHeight / 2 + lineHeight / 2;

    lines.forEach((lineText, idx) => {
      const ly = startY + idx * lineHeight;
      const textWidth = ctx.measureText(lineText).width;

      if (layer.highlightBox) {
        ctx.fillStyle = layer.highlightColor;
        const padX = scaledFontPx * 0.35;
        const padY = scaledFontPx * 0.16;
        ctx.beginPath();
        ctx.roundRect(
          x - textWidth / 2 - padX,
          ly - scaledFontPx * 0.55 - padY,
          textWidth + padX * 2,
          scaledFontPx * 1.1 + padY * 2,
          8
        );
        ctx.fill();
      }

      if (layer.strokeWidth > 0) {
        ctx.strokeStyle = layer.strokeColor;
        ctx.lineWidth = (layer.strokeWidth / 600) * width * 2.2;
        ctx.lineJoin = 'round';
        ctx.strokeText(lineText, x, ly);
      }

      ctx.fillStyle = layer.textColor;
      ctx.fillText(lineText, x, ly);
    });

    ctx.restore();
  }

  // Subtle watermark in bottom-right corner
  ctx.save();
  ctx.font = `600 ${Math.round(width * 0.02)}px "JetBrains Mono", monospace`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.textAlign = 'right';
  ctx.fillText('memechowk.np', width - 16, height - 14);
  ctx.restore();
}

interface MemeArtworkCardPreviewProps {
  asset: MemeAsset;
  isPlaying?: boolean;
  progress?: number;
  dataSaver?: boolean;
  className?: string;
}

export const MemeArtworkCardPreview: React.FC<MemeArtworkCardPreviewProps> = ({
  asset,
  isPlaying = false,
  progress = 0,
  dataSaver = false,
  className = '',
}) => {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [resolvedThumbUrl, setResolvedThumbUrl] = React.useState<string | null>(
    asset.thumbnailDataUrl ?? null
  );
  const [resolvedMediaUrl, setResolvedMediaUrl] = React.useState<string | null>(
    asset.mediaDataUrl ?? null
  );

  React.useEffect(() => {
    let active = true;
    let objectUrlToRevoke: string | null = null;

    if (asset.thumbnailDataUrl) {
      setResolvedThumbUrl(asset.thumbnailDataUrl);
    } else if (requiresCustomThumbnailOption(asset.mediaType)) {
      loadUploadedThumbnailFromDb(asset.id).then((storedThumb) => {
        if (active && storedThumb) {
          setResolvedThumbUrl(storedThumb);
        }
      });
    } else {
      setResolvedThumbUrl(null);
    }

    if (asset.mediaDataUrl) {
      setResolvedMediaUrl(asset.mediaDataUrl);
    } else if (
      asset.mediaType === 'GIF' ||
      asset.mediaType === 'VIDEO_CLIP' ||
      asset.mediaType === 'IMAGE_TEMPLATE' ||
      asset.mediaType === 'MEME_IMAGE'
    ) {
      loadUploadedMediaFromDb(asset.id).then((storedMedia) => {
        if (!active || !storedMedia) return;
        if (typeof storedMedia === 'string') {
          setResolvedMediaUrl(storedMedia);
        } else if (storedMedia instanceof Blob) {
          objectUrlToRevoke = URL.createObjectURL(storedMedia);
          setResolvedMediaUrl(objectUrlToRevoke);
        }
      });
    } else {
      setResolvedMediaUrl(null);
    }

    return () => {
      active = false;
      if (objectUrlToRevoke) {
        URL.revokeObjectURL(objectUrlToRevoke);
      }
    };
  }, [asset.id, asset.mediaType, asset.thumbnailDataUrl, asset.mediaDataUrl]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawAssetIllustrationToCanvas(ctx, asset, canvas.width, canvas.height, true);
  }, [asset]);

  const isAudioPrimary = requiresCustomThumbnailOption(asset.mediaType);
  const showDirectVideo =
    asset.mediaType === 'VIDEO_CLIP' && Boolean(resolvedMediaUrl);
  const showDirectImageOrGif =
    (asset.mediaType === 'GIF' ||
      asset.mediaType === 'IMAGE_TEMPLATE' ||
      asset.mediaType === 'MEME_IMAGE') &&
    Boolean(resolvedMediaUrl);
  const showCustomAudioThumb = isAudioPrimary && Boolean(resolvedThumbUrl);

  return (
    <div
      className={`relative w-full aspect-square overflow-hidden bg-[#12151C] select-none ${className}`}
    >
      {showDirectVideo && resolvedMediaUrl ? (
        <video
          src={resolvedMediaUrl}
          muted={!isPlaying}
          loop
          playsInline
          autoPlay={!dataSaver}
          className="w-full h-full object-cover block"
        />
      ) : showDirectImageOrGif && resolvedMediaUrl ? (
        <img
          src={resolvedMediaUrl}
          alt={asset.title}
          className="w-full h-full object-cover block"
        />
      ) : showCustomAudioThumb && resolvedThumbUrl ? (
        <div className="relative w-full h-full">
          <img
            src={resolvedThumbUrl}
            alt={`Audio thumbnail for ${asset.title}`}
            className="w-full h-full object-cover block"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0F1115] via-[#0F1115]/85 to-transparent p-3 pt-8 text-center">
            <p className="text-sm font-bold font-deva text-[#FFB800] truncate">
              {asset.transcriptDeva}
            </p>
            <p className="text-[11px] text-[#E5E7EB] truncate">
              "{asset.transcriptRoman}"
            </p>
          </div>
        </div>
      ) : (
        <canvas
          ref={canvasRef}
          width={dataSaver ? 320 : 480}
          height={dataSaver ? 320 : 480}
          className="w-full h-full object-cover block"
        />
      )}

      {/* Format overlay for GIF and Meme Video cards (No custom thumbnail needed) */}
      {(asset.mediaType === 'GIF' || asset.mediaType === 'VIDEO_CLIP') && (
        <div className="absolute top-3 left-3 bg-[#0F1115]/90 border border-[#262B36] rounded-md px-2 py-1 text-[10px] font-mono-tabular font-bold text-[#FFB800]">
          {asset.mediaType === 'GIF'
            ? 'GIF · ANIMATED LOOP'
            : `VIDEO · ${((asset.durationMs ?? 3500) / 1000).toFixed(1)}s`}
        </div>
      )}

      {/* Lightweight 32-bar Waveform overlay for Audio/Soundboard items */}
      {isAudioPrimary && (
        <div className="absolute inset-x-3 top-3 bg-[#0F1115]/85 border border-[#262B36] rounded-lg px-2.5 py-2 flex items-center gap-1.5">
          <div className="flex items-end gap-[2px] h-6 flex-1" aria-hidden="true">
            {(Array.isArray(asset.waveformPeaks) && asset.waveformPeaks.length > 0
              ? asset.waveformPeaks
              : Array.from({ length: 32 }, (_, i) => 28 + ((i * 17) % 60))
            )
              .slice(0, 32)
              .map((peak, idx) => {
                const barRatio = idx / 32;
                const isPlayed = isPlaying && barRatio <= progress;
                return (
                  <div
                    key={idx}
                    className="flex-1 rounded-t transition-colors duration-75"
                    style={{
                      height: `${Math.max(18, peak)}%`,
                      backgroundColor: isPlayed ? '#FF4D4D' : '#FFB800',
                      opacity: isPlayed ? 1 : 0.65,
                    }}
                  />
                );
              })}
          </div>
          <span className="font-mono-tabular text-[11px] text-[#F3F4F6] shrink-0">
            0:0{Math.max(1, Math.round((asset.durationMs ?? 3000) / 1000))}
          </span>
        </div>
      )}
    </div>
  );
};
