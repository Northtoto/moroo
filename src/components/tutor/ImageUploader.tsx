'use client';

import { useState, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';

interface ImageUploaderProps {
  onTextExtracted: (text: string) => void;
  disabled?: boolean;
}

interface OCRLine {
  text: string;
  confidence: number;
}

export default function ImageUploader({ onTextExtracted, disabled }: ImageUploaderProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState('');
  const [ocrLines, setOcrLines] = useState<OCRLine[]>([]);
  const [overallConfidence, setOverallConfidence] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);

  const processImage = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) {
        toast.error('Bitte lade eine Bilddatei hoch (PNG, JPG, WebP)');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Bild zu groß. Maximum 5MB.');
        return;
      }

      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      const url = URL.createObjectURL(file);
      previewUrlRef.current = url;
      setPreview(url);
      setProcessing(true);
      setProgress(0);
      setOcrText('');
      setOcrLines([]);
      setOverallConfidence(0);

      try {
        const Tesseract = await import('tesseract.js');
        const result = await Tesseract.recognize(file, 'deu', {
          logger: (m: { status: string; progress: number }) => {
            if (m.status === 'recognizing text') {
              setProgress(Math.round(m.progress * 100));
            }
          },
        });

        // Extract per-word confidence and build confidence-tracked lines
        const words = result.data.words || [];
        const confidences = words.map((w: any) => w.confidence / 100);
        const overallConf = confidences.length > 0
          ? Math.round((confidences.reduce((a, b) => a + b, 0) / confidences.length) * 100) / 100
          : 0;
        setOverallConfidence(overallConf);

        // Extract text with per-line confidence tracking
        const lines = result.data.lines || [];
        const lineData: OCRLine[] = lines.map((line: any) => ({
          text: line.text.trim(),
          confidence: line.confidence / 100,
        })).filter((l: OCRLine) => l.text.length > 0);
        setOcrLines(lineData);

        // Cleanup: trim, merge hyphenated words, normalize whitespace
        let text = result.data.text.trim();
        text = text.replace(/\s+/g, ' '); // Normalize whitespace
        text = text.replace(/(\w)-\n(\w)/g, '$1$2'); // Merge hyphenated words across lines
        text = text.replace(/(\w)-\s(\w)/g, '$1$2'); // Merge hyphenated words with spaces

        setOcrText(text);
        onTextExtracted(text);
        toast.success(`Text erfolgreich extrahiert! (${Math.round(overallConf * 100)}% Genauigkeit)`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unbekannter Fehler';
        toast.error(`OCR fehlgeschlagen: ${msg}`);
      } finally {
        setProcessing(false);
      }
    },
    [onTextExtracted]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file?.type.startsWith('image/')) processImage(file);
    },
    [processImage]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImage(file);
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onClick={() => !disabled && !processing && fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Bild hochladen"
        className={`rounded-2xl transition-all duration-300 cursor-pointer overflow-hidden ${
          dragging ? 'dropzone-active' : ''
        }`}
        style={{
          border: `2px dashed ${dragging ? 'var(--amber)' : 'rgba(255,255,255,0.15)'}`,
          background: dragging ? 'var(--amber-glow)' : 'var(--glass-bg)',
          minHeight: '180px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          boxShadow: dragging ? '0 0 30px var(--amber-glow)' : 'none',
        }}
      >
        {preview ? (
          <div className="relative w-full flex justify-center">
            <img
              src={preview}
              alt="Vorschau"
              className="max-h-48 rounded-xl object-contain"
              style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}
            />
            {!processing && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPreview(null);
                  setOcrText('');
                  if (previewUrlRef.current) { URL.revokeObjectURL(previewUrlRef.current); previewUrlRef.current = null; }
                }}
                className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center transition-colors hover:bg-white/20"
                style={{ background: 'rgba(0,0,0,0.5)', color: 'var(--text-muted)' }}
                aria-label="Bild entfernen"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-center">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: dragging ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.06)', border: '1px solid var(--glass-border)' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-7 h-7" style={{ color: dragging ? 'var(--amber)' : 'var(--text-muted)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: dragging ? 'var(--amber)' : 'var(--text-primary)' }}>
                {dragging ? 'Loslassen zum Hochladen' : 'Bild hierher ziehen'}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                oder klicken · PNG, JPG bis 5MB
              </p>
            </div>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
          disabled={disabled || processing}
        />
      </div>

      {/* Progress */}
      {processing && (
        <div className="space-y-2 animate-slide-down">
          <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
            <span>Text wird extrahiert...</span>
            <span style={{ color: 'var(--amber)' }}>{progress}%</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div
              className="xp-bar-fill h-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Extracted text preview with confidence */}
      {ocrText && !processing && (
        <div
          className="rounded-xl p-4 animate-slide-up space-y-3"
          style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Erkannter Text
            </p>
            {overallConfidence > 0 && (
              <span
                className="text-xs px-2 py-1 rounded-full font-semibold"
                style={{
                  background: overallConfidence > 0.8 ? 'rgba(34,197,94,0.15)' : overallConfidence > 0.6 ? 'rgba(251,146,60,0.15)' : 'rgba(239,68,68,0.15)',
                  color: overallConfidence > 0.8 ? '#22c55e' : overallConfidence > 0.6 ? '#fb923c' : '#ef4444',
                  border: overallConfidence > 0.8 ? '1px solid rgba(34,197,94,0.25)' : overallConfidence > 0.6 ? '1px solid rgba(251,146,60,0.25)' : '1px solid rgba(239,68,68,0.25)',
                }}
              >
                {overallConfidence > 0.8 ? '✓' : overallConfidence > 0.6 ? '⚠' : '?'} {Math.round(overallConfidence * 100)}%
              </span>
            )}
          </div>
          <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
            {ocrText}
          </p>
          {ocrLines.length > 0 && (
            <div className="border-t border-white/10 pt-3 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Zeilengenauigkeit
              </p>
              <div className="space-y-1 max-h-32 overflow-y-auto text-xs" style={{ color: 'var(--text-muted)' }}>
                {ocrLines.map((line, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2">
                    <span className="truncate">{line.text.substring(0, 40)}...</span>
                    <span className="shrink-0 font-mono">{Math.round(line.confidence * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
