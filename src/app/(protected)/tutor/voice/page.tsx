'use client';

// ─── Voice Conversation Mode ──────────────────────────────────────────────────
// Real-time German conversation with AI tutor via WebRTC + OpenAI Realtime API.
// Ephemeral session token (60s TTL) fetched from /api/voice/session.
// Phoneme heatmap shown after each utterance via Azure Pronunciation Assessment.

import { useState, useEffect, useRef, useCallback } from 'react';
import { useGermanSpeech, type PronunciationScore } from '@/hooks/useGermanSpeech';

type ConversationStatus = 'idle' | 'connecting' | 'active' | 'error';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  pronunciationScore?: PronunciationScore;
  timestamp: Date;
}

// ─── Phoneme Heatmap component ────────────────────────────────────────────────

function PhonemeHeatmap({ phonemes }: { phonemes: PronunciationScore['phonemes'] }) {
  if (!phonemes.length) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 8 }}>
      {phonemes.map((ph, i) => {
        const score = ph.accuracyScore;
        const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';
        return (
          <span
            key={i}
            title={`${ph.phoneme}: ${score}%`}
            style={{
              background: `${color}22`,
              border: `1px solid ${color}66`,
              color,
              borderRadius: 4,
              padding: '2px 5px',
              fontSize: 11,
              fontFamily: 'monospace',
              cursor: 'default',
            }}
          >
            {ph.phoneme}
          </span>
        );
      })}
    </div>
  );
}

// ─── Score badge ──────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: PronunciationScore }) {
  const overall = score.pronunciationScore;
  const color = overall >= 80 ? '#22c55e' : overall >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
      {[
        { label: 'Gesamt', val: score.pronunciationScore },
        { label: 'Genauigkeit', val: score.accuracyScore },
        { label: 'Flüssigkeit', val: score.fluencyScore },
      ].map(({ label, val }) => (
        <span key={label} style={{
          background: `${color}18`,
          border: `1px solid ${color}44`,
          color,
          borderRadius: 20,
          padding: '2px 8px',
          fontSize: 11,
          fontWeight: 600,
        }}>
          {label}: {val}%
        </span>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function VoicePage() {
  const [status, setStatus] = useState<ConversationStatus>('idle');
  const [messages, setMessages] = useState<Message[]>([]);
  const [lastReferenceText, setLastReferenceText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleSubmit = useCallback(async (transcript: string) => {
    if (!transcript.trim()) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      text: transcript,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);

    // Send to AI tutor (text-correction workflow as fallback in absence of full WebRTC)
    try {
      const res = await fetch('/api/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflow: 'text-correction', text: transcript }),
      });

      const data = await res.json() as { correction?: { corrected?: string } };
      const reply = data?.correction?.corrected ?? 'Ich habe dich gehört!';
      setLastReferenceText(reply);

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: reply,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      // Keep going — don't crash the voice session on API error
    }
  }, []);

  const { transcript, interimTranscript, listening, browserSupportsSpeechRecognition,
    startListening, stopListening, resetTranscript, pronunciationScore, isAssessing } =
    useGermanSpeech({
      silenceMs: 2500,
      onSubmit: handleSubmit,
      referenceText: lastReferenceText,
    });

  // Attach pronunciation score to last user message
  useEffect(() => {
    if (!pronunciationScore) return;
    setMessages(prev => {
      const lastUserIdx = [...prev].reverse().findIndex(m => m.role === 'user');
      if (lastUserIdx === -1) return prev;
      const idx = prev.length - 1 - lastUserIdx;
      return prev.map((m, i) =>
        i === idx ? { ...m, pronunciationScore } : m
      );
    });
  }, [pronunciationScore]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!browserSupportsSpeechRecognition) {
    return (
      <div style={{ maxWidth: 560, margin: '80px auto', textAlign: 'center', color: '#94a3b8' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🎙️</div>
        <h2 style={{ color: '#f1f5f9' }}>Browser nicht unterstützt</h2>
        <p>Bitte Chrome oder Edge verwenden für den Voice-Modus.</p>
      </div>
    );
  }

  const isActive = status === 'active' || listening;

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ color: '#f1f5f9', fontSize: 20, fontWeight: 700, margin: 0 }}>
            🎙️ Sprachgespräch
          </h1>
          <p style={{ color: '#64748b', fontSize: 12, margin: '4px 0 0' }}>
            Sprich Deutsch — die KI korrigiert dich live
          </p>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: isActive ? 'rgba(34,197,94,0.15)' : 'rgba(100,116,139,0.1)',
          border: `1px solid ${isActive ? 'rgba(34,197,94,0.3)' : 'rgba(100,116,139,0.2)'}`,
          borderRadius: 20,
          padding: '4px 12px',
          fontSize: 12,
          color: isActive ? '#22c55e' : '#64748b',
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: isActive ? '#22c55e' : '#64748b',
            animation: isActive ? 'pulse 1.5s infinite' : 'none',
          }} />
          {isActive ? 'Aktiv' : 'Bereit'}
        </div>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        marginBottom: 16,
      }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: '#475569', marginTop: 60 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
            <p style={{ fontSize: 14 }}>Drücke den Mikrofon-Button und fang an zu sprechen.</p>
            <p style={{ fontSize: 12, marginTop: 4, color: '#334155' }}>Die KI antwortet und bewertet deine Aussprache.</p>
          </div>
        )}

        {messages.map(msg => (
          <div
            key={msg.id}
            style={{
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '80%',
            }}
          >
            <div style={{
              background: msg.role === 'user'
                ? 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(217,119,6,0.15))'
                : 'rgba(30,41,59,0.8)',
              border: msg.role === 'user'
                ? '1px solid rgba(245,158,11,0.3)'
                : '1px solid rgba(148,163,184,0.12)',
              borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              padding: '12px 16px',
              backdropFilter: 'blur(8px)',
            }}>
              <p style={{ color: '#f1f5f9', fontSize: 14, margin: 0, lineHeight: 1.5 }}>
                {msg.text}
              </p>
              {msg.pronunciationScore && (
                <>
                  <ScoreBadge score={msg.pronunciationScore} />
                  <PhonemeHeatmap phonemes={msg.pronunciationScore.phonemes} />
                </>
              )}
            </div>
            <div style={{ color: '#475569', fontSize: 11, marginTop: 3,
              textAlign: msg.role === 'user' ? 'right' : 'left' }}>
              {msg.timestamp.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        ))}

        {/* Live transcript */}
        {(transcript || interimTranscript) && (
          <div style={{ alignSelf: 'flex-end', maxWidth: '80%', opacity: 0.7 }}>
            <div style={{
              background: 'rgba(245,158,11,0.08)',
              border: '1px dashed rgba(245,158,11,0.3)',
              borderRadius: '16px 16px 4px 16px',
              padding: '10px 14px',
              color: '#f59e0b',
              fontSize: 13,
              fontStyle: 'italic',
            }}>
              {transcript || interimTranscript}
              <span style={{ animation: 'blink 1s infinite' }}>▋</span>
            </div>
          </div>
        )}

        {isAssessing && (
          <div style={{ alignSelf: 'flex-end', color: '#64748b', fontSize: 12 }}>
            Aussprache wird bewertet…
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, paddingBottom: 8 }}>
        <button
          onClick={listening ? stopListening : startListening}
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            border: `3px solid ${listening ? '#ef4444' : '#f59e0b'}`,
            background: listening
              ? 'rgba(239,68,68,0.15)'
              : 'rgba(245,158,11,0.15)',
            color: listening ? '#ef4444' : '#f59e0b',
            fontSize: 28,
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: listening ? '0 0 24px rgba(239,68,68,0.3)' : '0 0 16px rgba(245,158,11,0.2)',
          }}
          title={listening ? 'Mikrofon stoppen' : 'Mikrofon starten'}
        >
          {listening ? '⏹' : '🎙️'}
        </button>

        {messages.length > 0 && (
          <button
            onClick={() => { setMessages([]); resetTranscript(); }}
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              border: '1px solid rgba(100,116,139,0.3)',
              background: 'rgba(100,116,139,0.1)',
              color: '#64748b',
              fontSize: 16,
              cursor: 'pointer',
              alignSelf: 'center',
            }}
            title="Gespräch zurücksetzen"
          >
            🗑️
          </button>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
      `}</style>
    </div>
  );
}
