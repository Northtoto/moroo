'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';

interface AudioRecorderProps {
  onAudioReady: (blob: Blob, filename: string) => void;
  disabled?: boolean;
}

const CANVAS_SIZE = 180; // Base size; responsive via CSS scaling

function drawWaveform(
  canvas: HTMLCanvasElement,
  analyser: AnalyserNode,
  isRecording: boolean,
  animRef: React.MutableRefObject<number>
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const c = ctx; // capture non-null in closure
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  function draw() {
    animRef.current = requestAnimationFrame(draw);
    analyser.getByteTimeDomainData(dataArray);

    c.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Background glow ring
    const gradient = c.createRadialGradient(
      CANVAS_SIZE / 2, CANVAS_SIZE / 2, 20,
      CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE / 2 - 4
    );
    gradient.addColorStop(0, 'rgba(245,158,11,0.05)');
    gradient.addColorStop(1, 'rgba(245,158,11,0.15)');
    c.beginPath();
    c.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE / 2 - 4, 0, Math.PI * 2);
    c.fillStyle = gradient;
    c.fill();

    // Waveform as circular bars
    const centerX = CANVAS_SIZE / 2;
    const centerY = CANVAS_SIZE / 2;
    const radius = 55;
    const barCount = 64;

    for (let i = 0; i < barCount; i++) {
      const dataIndex = Math.floor((i / barCount) * bufferLength);
      const value = dataArray[dataIndex] / 128.0;
      const barHeight = isRecording ? Math.max(3, (value - 0.5) * 40 + 3) : 3;

      const angle = (i / barCount) * Math.PI * 2 - Math.PI / 2;
      const innerX = centerX + Math.cos(angle) * radius;
      const innerY = centerY + Math.sin(angle) * radius;
      const outerX = centerX + Math.cos(angle) * (radius + barHeight);
      const outerY = centerY + Math.sin(angle) * (radius + barHeight);

      c.beginPath();
      c.moveTo(innerX, innerY);
      c.lineTo(outerX, outerY);
      c.strokeStyle = isRecording
        ? `rgba(245,158,11,${0.5 + (value - 0.5) * 1.5})`
        : 'rgba(255,255,255,0.15)';
      c.lineWidth = 2;
      c.lineCap = 'round';
      c.stroke();
    }

    // Center mic icon placeholder ring
    c.beginPath();
    c.arc(centerX, centerY, 24, 0, Math.PI * 2);
    c.strokeStyle = isRecording ? 'rgba(245,158,11,0.6)' : 'rgba(255,255,255,0.15)';
    c.lineWidth = 1.5;
    c.stroke();
  }

  draw();
}

export default function AudioRecorder({ onAudioReady, disabled }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioURLRef = useRef<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    return () => {
      if (audioURLRef.current) URL.revokeObjectURL(audioURLRef.current);
      cancelAnimationFrame(animFrameRef.current);
      audioCtxRef.current?.close();
    };
  }, []);

  // Draw idle waveform on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frame: number;
    let angle = 0;

    function drawIdle() {
      frame = requestAnimationFrame(drawIdle);
      ctx!.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      const centerX = CANVAS_SIZE / 2;
      const centerY = CANVAS_SIZE / 2;
      const radius = 55;
      const barCount = 64;

      for (let i = 0; i < barCount; i++) {
        const a = (i / barCount) * Math.PI * 2 - Math.PI / 2;
        const wave = Math.sin(angle + i * 0.3) * 2 + 3;
        const innerX = centerX + Math.cos(a) * radius;
        const innerY = centerY + Math.sin(a) * radius;
        const outerX = centerX + Math.cos(a) * (radius + wave);
        const outerY = centerY + Math.sin(a) * (radius + wave);
        ctx!.beginPath();
        ctx!.moveTo(innerX, innerY);
        ctx!.lineTo(outerX, outerY);
        ctx!.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx!.lineWidth = 2;
        ctx!.lineCap = 'round';
        ctx!.stroke();
      }

      ctx!.beginPath();
      ctx!.arc(centerX, centerY, 24, 0, Math.PI * 2);
      ctx!.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx!.lineWidth = 1.5;
      ctx!.stroke();

      angle += 0.03;
    }

    drawIdle();
    return () => cancelAnimationFrame(frame);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Set up audio analyser
      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      if (canvasRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        drawWaveform(canvasRef.current, analyser, true, animFrameRef);
      }

      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = MediaRecorder.isTypeSupported('audio/wav') ? 'audio/wav' : '';
      }

      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
        if (audioURLRef.current) URL.revokeObjectURL(audioURLRef.current);
        const url = URL.createObjectURL(blob);
        audioURLRef.current = url;
        setAudioURL(url);
        let ext = 'webm';
        if (mediaRecorder.mimeType.includes('wav')) ext = 'wav';
        else if (mediaRecorder.mimeType.includes('ogg')) ext = 'ogg';
        onAudioReady(blob, `aufnahme.${ext}`);
        stream.getTracks().forEach((t) => t.stop());
        cancelAnimationFrame(animFrameRef.current);
        audioCtx.close();
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setDuration(0);
      setAudioURL(null);

      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } catch {
      toast.error('Mikrofonzugriff verweigert. Bitte erlaube den Zugriff.');
    }
  }, [onAudioReady]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validAudioTypes = ['audio/webm', 'audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/ogg', 'audio/mp4', 'audio/x-m4a', 'audio/flac'];
    if (!validAudioTypes.some(t => file.type.startsWith(t.split('/')[0]) && file.type.includes(t.split('/')[1])) && !file.type.startsWith('audio/')) {
      toast.error('Ungültiges Dateiformat. Bitte lade eine Audiodatei hoch.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Datei zu groß. Maximum 10MB.');
      return;
    }
    if (audioURLRef.current) URL.revokeObjectURL(audioURLRef.current);
    const url = URL.createObjectURL(file);
    audioURLRef.current = url;
    setAudioURL(url);
    onAudioReady(file, file.name);
  };

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="flex flex-col items-center gap-4 sm:gap-6 w-full">
      {/* Waveform canvas - responsive size */}
      <div className="relative flex justify-center w-full">
        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          id="waveform-canvas"
          className="rounded-full max-w-xs sm:max-w-none"
          style={{
            width: 'auto',
            height: 'auto',
            maxWidth: '140px',
            background: 'radial-gradient(circle, rgba(245,158,11,0.05) 0%, transparent 70%)',
            border: isRecording ? '1px solid rgba(245,158,11,0.4)' : '1px solid var(--glass-border)',
            boxShadow: isRecording ? '0 0 24px rgba(245,158,11,0.3)' : 'none',
            transition: 'box-shadow 0.3s ease, border-color 0.3s ease',
          }}
        />
        {/* Center mic icon */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          <div
            className={isRecording ? 'animate-record' : ''}
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: isRecording ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: isRecording ? '1px solid rgba(239,68,68,0.4)' : '1px solid var(--glass-border)',
            }}
          >
            {isRecording ? (
              <span className="w-3 h-3 rounded-sm" style={{ background: 'var(--danger)' }} />
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5" style={{ color: 'var(--text-muted)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            )}
          </div>
        </div>

        {/* Duration */}
        {isRecording && (
          <div
            className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-xs font-mono px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.3)' }}
          >
            {formatTime(duration)}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap w-full sm:w-auto justify-center">
        <button
          type="button"
          onClick={isRecording ? stopRecording : startRecording}
          disabled={disabled}
          className="flex items-center gap-2 px-4 sm:px-5 py-3 sm:py-2.5 h-12 sm:h-auto rounded-xl font-semibold text-sm transition-all flex-1 sm:flex-none justify-center sm:justify-start min-w-[120px] sm:min-w-0"
          style={{
            background: isRecording ? 'rgba(239,68,68,0.15)' : 'var(--amber-glow)',
            color: isRecording ? 'var(--danger)' : 'var(--amber)',
            border: isRecording ? '1px solid rgba(239,68,68,0.30)' : '1px solid rgba(245,158,11,0.30)',
            fontFamily: 'var(--font-display)',
            opacity: disabled ? 0.5 : 1,
            cursor: disabled ? 'not-allowed' : 'pointer',
            boxShadow: isRecording ? '0 0 20px rgba(239,68,68,0.2)' : '0 0 20px var(--amber-glow)',
          }}
          aria-label={isRecording ? 'Aufnahme stoppen' : 'Aufnahme starten'}
        >
          {isRecording ? (
            <>
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: 'var(--danger)' }} />
              Stopp
            </>
          ) : (
            <>
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--amber)' }} />
              Aufnehmen
            </>
          )}
        </button>

        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>oder</span>

        <label
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium cursor-pointer transition-colors hover:bg-white/10"
          style={{
            color: 'var(--text-muted)',
            border: '1px solid var(--glass-border)',
            opacity: disabled ? 0.5 : 1,
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Hochladen
          <input
            type="file"
            accept="audio/*"
            onChange={handleFileUpload}
            className="hidden"
            disabled={disabled || isRecording}
          />
        </label>
      </div>

      {/* Audio preview */}
      {audioURL && (
        <div className="w-full animate-slide-up">
          <audio
            controls
            src={audioURL}
            className="w-full"
            style={{ borderRadius: '12px', background: 'var(--glass-bg)' }}
          />
        </div>
      )}
    </div>
  );
}
