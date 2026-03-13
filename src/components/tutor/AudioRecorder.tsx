'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface AudioRecorderProps {
  onAudioReady: (blob: Blob, filename: string) => void;
  disabled?: boolean;
}

export default function AudioRecorder({ onAudioReady, disabled }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioURLRef = useRef<string | null>(null);
  const maxDurationRef = useRef<NodeJS.Timeout | null>(null);

  const MAX_DURATION_SECONDS = 300;

  // Clean up blob URL on unmount
  useEffect(() => {
    return () => {
      if (audioURLRef.current) URL.revokeObjectURL(audioURLRef.current);
    };
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Determine supported MIME type
      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        if (MediaRecorder.isTypeSupported('audio/wav')) {
          mimeType = 'audio/wav';
        } else if (MediaRecorder.isTypeSupported('audio/mp3')) {
          mimeType = 'audio/mp3';
        } else {
          // Fallback to default, will attempt recording anyway
          mimeType = '';
        }
      }

      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
        // Revoke previous URL before creating new one (safe — previous render is done)
        if (audioURLRef.current) URL.revokeObjectURL(audioURLRef.current);
        const url = URL.createObjectURL(blob);
        audioURLRef.current = url;
        setAudioURL(url);
        // Determine file extension based on actual MIME type
        let ext = 'webm';
        if (mediaRecorder.mimeType.includes('wav')) ext = 'wav';
        else if (mediaRecorder.mimeType.includes('mp3')) ext = 'mp3';
        else if (mediaRecorder.mimeType.includes('ogg')) ext = 'ogg';
        onAudioReady(blob, `recording.${ext}`);
        stream.getTracks().forEach((t) => t.stop());
        // DO NOT revoke url here — React hasn't rendered <audio src={url}> yet
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setDuration(0);
      setAudioURL(null);

      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);

      maxDurationRef.current = setTimeout(() => {
        stopRecording();
      }, MAX_DURATION_SECONDS * 1000);
    } catch {
      alert('Microphone access denied. Please allow microphone access and try again.');
    }
  }, [onAudioReady]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (maxDurationRef.current) {
      clearTimeout(maxDurationRef.current);
      maxDurationRef.current = null;
    }
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('File too large. Maximum size is 10MB.');
      return;
    }
    // Clean up previous URL using ref
    if (audioURLRef.current) URL.revokeObjectURL(audioURLRef.current);
    const url = URL.createObjectURL(file);
    audioURLRef.current = url;
    setAudioURL(url);
    onAudioReady(file, file.name);
  };

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="space-y-4">
      {/* Record button */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={isRecording ? stopRecording : startRecording}
          disabled={disabled}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-semibold transition-all ${
            isRecording
              ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
              : 'bg-white/10 hover:bg-white/20 text-white'
          } disabled:opacity-50`}
        >
          <span className={`w-3 h-3 rounded-full ${isRecording ? 'bg-white' : 'bg-red-500'}`} />
          {isRecording ? `Stop (${formatTime(duration)})` : 'Record'}
        </button>

        <span className="text-slate-500 text-sm">or</span>

        <label className="flex items-center gap-2 px-5 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-semibold text-white cursor-pointer transition-all">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Upload Audio
          <input
            type="file"
            accept="audio/*"
            onChange={handleFileUpload}
            className="hidden"
            disabled={disabled}
          />
        </label>
      </div>

      {/* Audio preview */}
      {audioURL && (
        <audio controls src={audioURL} className="w-full rounded-lg" />
      )}
    </div>
  );
}
