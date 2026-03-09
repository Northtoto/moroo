'use client';

import { useState, useRef, useCallback } from 'react';

interface ImageUploaderProps {
  onTextExtracted: (text: string) => void;
  disabled?: boolean;
}

export default function ImageUploader({ onTextExtracted, disabled }: ImageUploaderProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState('');
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processImage = useCallback(async (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (PNG, JPG, GIF, WebP)');
      return;
    }

    // Validate file size
    if (file.size > 5 * 1024 * 1024) {
      alert('Image too large. Maximum size is 5MB.');
      return;
    }

    const url = URL.createObjectURL(file);
    setPreview(url);
    setProcessing(true);
    setProgress(0);
    setOcrText('');

    try {
      // Dynamic import Tesseract.js
      const Tesseract = await import('tesseract.js');
      const result = await Tesseract.recognize(file, 'deu', {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });
      const text = result.data.text.trim();
      setOcrText(text);
      onTextExtracted(text);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      alert(`OCR processing failed: ${errorMsg}. Please try a clearer image.`);
    } finally {
      setProcessing(false);
      URL.revokeObjectURL(url);
    }
  }, [onTextExtracted]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) processImage(file);
  }, [processImage]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImage(file);
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center cursor-pointer hover:border-white/40 transition-colors"
      >
        {preview ? (
          <img src={preview} alt="Uploaded" className="max-h-48 mx-auto rounded-lg" />
        ) : (
          <div className="space-y-2">
            <svg className="w-10 h-10 mx-auto text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-slate-400 text-sm">
              Drop an image here or click to upload
            </p>
            <p className="text-slate-500 text-xs">PNG, JPG up to 5MB</p>
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

      {/* Processing indicator */}
      {processing && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Extracting text...</span>
            <span className="text-slate-400">{progress}%</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Extracted text */}
      {ocrText && !processing && (
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Extracted Text
          </h4>
          <p className="text-slate-300 text-sm whitespace-pre-wrap">{ocrText}</p>
        </div>
      )}
    </div>
  );
}
