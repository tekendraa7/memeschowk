import React, { useEffect, useRef, useState } from 'react';
import { MemeAsset } from '../lib/domain-logic';
import {
  renderMemeEditorCanvas,
  TextLayerConfig,
} from './MemeArtworkCanvas';
import { Download, Plus, Trash2, Sparkles, CheckCircle2, Type } from 'lucide-react';

interface MemeEditorStudioProps {
  templates: MemeAsset[];
  initialTemplate?: MemeAsset | null;
  onPublishRemix: (remixAsset: MemeAsset) => void;
}

const DEFAULT_LAYERS: TextLayerConfig[] = [
  {
    id: 'layer-top',
    text: 'के हो यो भाई?!',
    xPercent: 50,
    yPercent: 14,
    fontSize: 44,
    fontFamily: 'Mukta',
    textColor: '#FFFFFF',
    strokeColor: '#0F1115',
    strokeWidth: 6,
    highlightBox: true,
    highlightColor: 'rgba(15, 17, 21, 0.82)',
    uppercase: false,
  },
  {
    id: 'layer-bottom',
    text: 'WHEN SYLLABUS CHANGES 1 NIGHT BEFORE EXAM',
    xPercent: 50,
    yPercent: 86,
    fontSize: 30,
    fontFamily: 'Plus Jakarta Sans',
    textColor: '#FFB800',
    strokeColor: '#0F1115',
    strokeWidth: 5,
    highlightBox: true,
    highlightColor: 'rgba(15, 17, 21, 0.88)',
    uppercase: true,
  },
];

const QUICK_DEVANAGARI_PRESETS = [
  { deva: 'के हो यो भाई?!', bottom: 'WHEN TU SYLLABUS CHANGES OVERNIGHT' },
  { deva: 'यस्तै छ जिन्दगी...', bottom: 'FRIENDS IN AUSTRALIA, ME FIXING CSS' },
  { deva: 'पैसा ही पैसा होगा!', bottom: 'WHEN ₹150 STIPEND FINALLY CREDITS' },
  { deva: 'दाल भात पावर २४ आवर', bottom: 'READY FOR 8 HOUR CODING MARATHON' },
  { deva: 'अरे भाई भाई रुक जा!', bottom: 'JUNIOR DEV PUSHING TO MAIN ON FRIDAY' },
];

export const MemeEditorStudio: React.FC<MemeEditorStudioProps> = ({
  templates,
  initialTemplate,
  onPublishRemix,
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<MemeAsset>(
    initialTemplate ?? templates[0]
  );
  const [layers, setLayers] = useState<TextLayerConfig[]>(DEFAULT_LAYERS);
  const [activeLayerId, setActiveLayerId] = useState<string>('layer-top');
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [remixPublishedBanner, setRemixPublishedBanner] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (initialTemplate) {
      setSelectedTemplate(initialTemplate);
    }
  }, [initialTemplate]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !selectedTemplate) return;
    renderMemeEditorCanvas(canvas, selectedTemplate, layers);
  }, [selectedTemplate, layers]);

  const activeLayer = layers.find((l) => l.id === activeLayerId) ?? layers[0];

  const updateActiveLayer = (patch: Partial<TextLayerConfig>) => {
    if (!activeLayer) return;
    setLayers((prev) =>
      prev.map((layer) => (layer.id === activeLayer.id ? { ...layer, ...patch } : layer))
    );
  };

  const handleAddLayer = () => {
    const newId = `layer-${Date.now()}`;
    const newLayer: TextLayerConfig = {
      id: newId,
      text: 'नयाँ संवाद / NEW CAPTION',
      xPercent: 50,
      yPercent: 50,
      fontSize: 34,
      fontFamily: 'Mukta',
      textColor: '#FFFFFF',
      strokeColor: '#0F1115',
      strokeWidth: 5,
      highlightBox: true,
      highlightColor: 'rgba(15, 17, 21, 0.80)',
      uppercase: false,
    };
    setLayers((prev) => [...prev, newLayer]);
    setActiveLayerId(newId);
  };

  const handleDeleteLayer = (id: string) => {
    if (layers.length <= 1) return;
    const remaining = layers.filter((l) => l.id !== id);
    setLayers(remaining);
    setActiveLayerId(remaining[0].id);
  };

  const handleExportImage = (format: 'png' | 'jpeg') => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    renderMemeEditorCanvas(canvas, selectedTemplate, layers);

    const mime = format === 'png' ? 'image/png' : 'image/jpeg';
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `memechowk-${selectedTemplate.slug}-${Date.now()}.${format}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        setExportStatus(
          `Exported ${format.toUpperCase()} (${Math.round(blob.size / 1024)} KB, 1080×1080)`
        );
      },
      mime,
      0.92
    );
  };

  const handlePublishRemixToChowk = () => {
    const topText = layers[0]?.text || 'Custom Meme Remix';
    const bottomText = layers[1]?.text || '';
    const newId = `mc-remix-${Date.now()}`;
    const newRemix: MemeAsset = {
      ...selectedTemplate,
      id: newId,
      slug: `remix-${selectedTemplate.slug}-${Date.now().toString().slice(-4)}`,
      title: `Remix: ${topText.slice(0, 32)}`,
      mediaType: 'MEME_IMAGE',
      transcriptDeva: topText,
      transcriptRoman: bottomText || selectedTemplate.transcriptRoman,
      englishContextNote: `Community remix created in MemeChowk Canvas Studio from "${selectedTemplate.title}".`,
      parentAssetId: selectedTemplate.id,
      parentAssetTitle: selectedTemplate.title,
      uploaderName: 'You (Chowk Creator)',
      uploaderHandle: 'chowk_creator',
      moderationStatus: 'APPROVED_PUBLIC',
      publishedAt: new Date().toISOString(),
      viewCount: 1,
      downloadCount: 0,
      likeCount: 1,
      remixCount: 0,
      trendingScore: 68.5,
    };
    onPublishRemix(newRemix);
    setRemixPublishedBanner(
      `Published Remix "${newRemix.title}" with attribution linked to parent template "${selectedTemplate.title}".`
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 pb-5 border-b border-[#262B36]">
        <div>
          <p className="text-xs text-[#FFB800] font-medium">
            Zero-Install HTML5 Canvas Studio · Devanagari & Latin Matra-Safe Rendering
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#F3F4F6] mt-1">
            Image Meme Editor & Template Remixer
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => handleExportImage('png')}
            className="px-4 py-2.5 rounded-lg bg-[#FFB800] text-[#0F1115] font-bold text-xs hover:bg-[#e6a600] transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export PNG (1080×1080)</span>
          </button>
          <button
            type="button"
            onClick={() => handleExportImage('jpeg')}
            className="px-3.5 py-2.5 rounded-lg bg-[#181B22] border border-[#262B36] text-[#F3F4F6] font-medium text-xs hover:border-[#FFB800] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Export JPEG
          </button>
          <button
            type="button"
            onClick={handlePublishRemixToChowk}
            className="px-3.5 py-2.5 rounded-lg bg-[#10B981] text-[#0F1115] font-bold text-xs hover:bg-[#059669] transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Publish Remix to Chowk</span>
          </button>
        </div>
      </div>

      {exportStatus && (
        <div
          role="status"
          className="mb-5 px-4 py-3 rounded-xl bg-[#132A1E] border border-[#10B981]/40 text-xs text-[#A7F3D0] flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
            <span>{exportStatus}</span>
          </div>
          <button
            type="button"
            onClick={() => setExportStatus(null)}
            className="text-xs underline ml-4 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {remixPublishedBanner && (
        <div
          role="status"
          className="mb-5 px-4 py-3 rounded-xl bg-[#181B22] border border-[#FFB800]/50 text-xs text-[#F3F4F6] flex items-center justify-between"
        >
          <span>{remixPublishedBanner}</span>
          <button
            type="button"
            onClick={() => setRemixPublishedBanner(null)}
            className="text-xs text-[#FFB800] underline ml-4 cursor-pointer"
          >
            Close
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Live 1080x1080 HTML5 Canvas Viewport */}
        <div className="lg:col-span-6 bg-[#181B22] border border-[#262B36] rounded-2xl p-4">
          <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-[#0F1115] border border-[#262B36]">
            <canvas
              ref={canvasRef}
              width={1080}
              height={1080}
              data-testid="meme-editor-canvas"
              className="w-full h-full object-contain block"
            />
          </div>

          <div className="mt-4 flex items-center justify-between text-xs text-[#9CA3AF]">
            <span>
              Base Template: <strong className="text-[#F3F4F6]">{selectedTemplate.title}</strong>
            </span>
            <span className="font-mono-tabular">1080 × 1080 px · EXIF Clean</span>
          </div>

          {/* Template Picker Strip */}
          <div className="mt-4 pt-4 border-t border-[#262B36]">
            <p className="text-xs font-semibold text-[#F3F4F6] mb-2.5">
              Switch Blank Regional Template
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {templates.slice(0, 8).map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => setSelectedTemplate(tpl)}
                  className={`px-2.5 py-2 rounded-lg text-left border text-xs transition-colors cursor-pointer ${
                    selectedTemplate.id === tpl.id
                      ? 'bg-[#232834] border-[#FFB800] text-[#F3F4F6]'
                      : 'bg-[#0F1115] border-[#262B36] text-[#9CA3AF] hover:text-[#F3F4F6]'
                  }`}
                >
                  <div className="font-semibold truncate text-[#F3F4F6]">{tpl.title}</div>
                  <div className="text-[11px] font-deva text-[#FFB800] truncate mt-0.5">
                    {tpl.transcriptDeva}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Layer Controls, Devanagari Presets & Typography */}
        <div className="lg:col-span-6 bg-[#181B22] border border-[#262B36] rounded-2xl p-5 space-y-5">
          {/* Quick One-Tap Regional Caption Presets */}
          <div>
            <p className="text-xs font-semibold text-[#F3F4F6] mb-2">
              1-Tap Devanagari + Hinglish Caption Presets
            </p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_DEVANAGARI_PRESETS.map((preset, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setLayers((prev) =>
                      prev.map((l, idx) =>
                        idx === 0
                          ? { ...l, text: preset.deva }
                          : idx === 1
                          ? { ...l, text: preset.bottom }
                          : l
                      )
                    );
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-[#0F1115] border border-[#262B36] hover:border-[#FFB800] text-xs font-deva text-[#F3F4F6] transition-colors cursor-pointer"
                >
                  {preset.deva}
                </button>
              ))}
            </div>
          </div>

          {/* Layer Selector Tabs */}
          <div className="pt-4 border-t border-[#262B36]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-[#F3F4F6] flex items-center gap-1.5">
                <Type className="w-4 h-4 text-[#FFB800]" />
                <span>Text Layers ({layers.length})</span>
              </span>
              <button
                type="button"
                onClick={handleAddLayer}
                className="px-3 py-1.5 rounded-lg bg-[#232834] text-[#F3F4F6] hover:bg-[#2E3545] text-xs font-medium flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Text Layer</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              {layers.map((layer, index) => (
                <div key={layer.id} className="flex items-center">
                  <button
                    type="button"
                    onClick={() => setActiveLayerId(layer.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                      activeLayer?.id === layer.id
                        ? 'bg-[#FFB800] text-[#0F1115] border-[#FFB800] font-bold'
                        : 'bg-[#0F1115] text-[#9CA3AF] border-[#262B36] hover:text-[#F3F4F6]'
                    }`}
                  >
                    Layer {index + 1}: {layer.text.slice(0, 14) || 'Empty'}
                  </button>
                  {layers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteLayer(layer.id)}
                      aria-label={`Delete Layer ${index + 1}`}
                      className="ml-1 p-1.5 text-[#9CA3AF] hover:text-[#FF4D4D] cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {activeLayer && (
              <div className="space-y-4 bg-[#0F1115] border border-[#262B36] rounded-xl p-4">
                <div>
                  <label
                    htmlFor="meme-layer-text-input"
                    className="block text-xs font-medium text-[#9CA3AF] mb-1.5"
                  >
                    Caption Text (Supports Devanagari के हो यो & Latin)
                  </label>
                  <input
                    id="meme-layer-text-input"
                    type="text"
                    value={activeLayer.text}
                    onChange={(e) => updateActiveLayer({ text: e.target.value })}
                    placeholder="Type Devanagari or English caption..."
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#181B22] border border-[#262B36] text-sm font-deva text-[#F3F4F6] focus:outline-none focus:border-[#FFB800]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="meme-font-select"
                      className="block text-xs font-medium text-[#9CA3AF] mb-1"
                    >
                      Font Family (Matra-Safe)
                    </label>
                    <select
                      id="meme-font-select"
                      value={activeLayer.fontFamily}
                      onChange={(e) =>
                        updateActiveLayer({
                          fontFamily: e.target.value as TextLayerConfig['fontFamily'],
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg bg-[#181B22] border border-[#262B36] text-xs text-[#F3F4F6]"
                    >
                      <option value="Mukta">Mukta ExtraBold (Devanagari + Latin)</option>
                      <option value="Noto Sans Devanagari">Noto Sans Devanagari Bold</option>
                      <option value="Plus Jakarta Sans">Plus Jakarta Sans Black</option>
                      <option value="Impact">Impact Classic Meme</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="meme-fontsize-range"
                      className="block text-xs font-medium text-[#9CA3AF] mb-1"
                    >
                      Font Size ({activeLayer.fontSize}px)
                    </label>
                    <input
                      id="meme-fontsize-range"
                      type="range"
                      min={18}
                      max={72}
                      value={activeLayer.fontSize}
                      onChange={(e) =>
                        updateActiveLayer({ fontSize: parseInt(e.target.value, 10) })
                      }
                      className="w-full accent-[#FFB800]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="meme-pos-x"
                      className="block text-xs font-medium text-[#9CA3AF] mb-1"
                    >
                      Horizontal X ({activeLayer.xPercent}%)
                    </label>
                    <input
                      id="meme-pos-x"
                      type="range"
                      min={10}
                      max={90}
                      value={activeLayer.xPercent}
                      onChange={(e) =>
                        updateActiveLayer({ xPercent: parseInt(e.target.value, 10) })
                      }
                      className="w-full accent-[#FFB800]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="meme-pos-y"
                      className="block text-xs font-medium text-[#9CA3AF] mb-1"
                    >
                      Vertical Y ({activeLayer.yPercent}%)
                    </label>
                    <input
                      id="meme-pos-y"
                      type="range"
                      min={8}
                      max={92}
                      value={activeLayer.yPercent}
                      onChange={(e) =>
                        updateActiveLayer({ yPercent: parseInt(e.target.value, 10) })
                      }
                      className="w-full accent-[#FFB800]"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-[#262B36]">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#9CA3AF]">Text Color:</span>
                    {['#FFFFFF', '#FFB800', '#FF4D4D', '#10B981', '#38BDF8'].map((col) => (
                      <button
                        key={col}
                        type="button"
                        onClick={() => updateActiveLayer({ textColor: col })}
                        aria-label={`Select color ${col}`}
                        className={`w-6 h-6 rounded-full border ${
                          activeLayer.textColor === col
                            ? 'border-white scale-110'
                            : 'border-transparent'
                        }`}
                        style={{ backgroundColor: col }}
                      />
                    ))}
                  </div>

                  <label className="flex items-center gap-2 text-xs text-[#F3F4F6] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activeLayer.highlightBox}
                      onChange={(e) =>
                        updateActiveLayer({ highlightBox: e.target.checked })
                      }
                      className="accent-[#FFB800]"
                    />
                    <span>Dark Backdrop Box</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
