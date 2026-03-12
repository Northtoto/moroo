'use client';

import { useCallback } from 'react';

interface CorrectionDisplayProps {
  original: string;
  corrected: string;
  explanation: string;
  transcription?: string;
  inputType: 'text' | 'audio' | 'image';
}

export default function CorrectionDisplay({
  original,
  corrected,
  explanation,
  transcription,
  inputType,
}: CorrectionDisplayProps) {
  const speak = useCallback((text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'de-DE';
    speechSynthesis.cancel(); // stop any ongoing speech first
    speechSynthesis.speak(utterance);
  }, []);

  return (
    <div className="space-y-4">
      {/* Transcription (audio/image only) */}
      {transcription && (
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            {inputType === 'audio' ? 'Transcription' : 'OCR Text'}
          </h4>
          <p className="text-slate-300 text-sm leading-relaxed">{transcription}</p>
        </div>
      )}

      {/* Side-by-side comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-red-500/5 rounded-xl p-4 border border-red-500/20">
          <h4 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">
            Original
          </h4>
          <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{original}</p>
        </div>
        <div className="bg-green-500/5 rounded-xl p-4 border border-green-500/20">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-green-400 uppercase tracking-wider">
              Corrected
            </h4>
            <button
              type="button"
              onClick={() => speak(corrected)}
              className="flex items-center gap-1.5 text-xs text-green-400 hover:text-green-300 transition-colors"
              title="Listen to corrected German (de-DE)"
            >
              🔊 Listen
            </button>
          </div>
          <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{corrected}</p>
        </div>
      </div>

      {/* Explanation */}
      <div className="bg-blue-500/5 rounded-xl p-4 border border-blue-500/20">
        <h4 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2">
          Explanation
        </h4>
        <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{explanation}</p>
      </div>
    </div>
  );
}
