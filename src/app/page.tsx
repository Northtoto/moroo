'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

const WORDS = ['Lernen.', 'Korrigieren.', 'Wachsen.', 'Verstehen.', 'Sprechen.'];

const FEATURES = [
  {
    icon: '🧠',
    title: 'KI-Korrektur',
    desc: 'Azure GPT-4o analysiert deinen Text, deine Stimme oder dein Foto in Echtzeit.',
  },
  {
    icon: '🔥',
    title: 'Gamification',
    desc: 'XP, Serien, Abzeichen und Liga-Rangliste — Lernen fühlt sich wie spielen an.',
  },
  {
    icon: '📊',
    title: 'CEFR-Tracking',
    desc: 'Vom Anfänger zum Experten. Dein Fortschritt von A1 bis C2 immer im Blick.',
  },
];

const CEFR_LEVELS = [
  { level: 'A1', label: 'Anfänger', cls: 'cefr-a1' },
  { level: 'A2', label: 'Grundlagen', cls: 'cefr-a2' },
  { level: 'B1', label: 'Mittelstufe', cls: 'cefr-b1' },
  { level: 'B2', label: 'Oberstufe', cls: 'cefr-b2' },
  { level: 'C1', label: 'Fortgeschr.', cls: 'cefr-c1' },
  { level: 'C2', label: 'Meister', cls: 'cefr-c2' },
];

function AnimatedWord() {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const cycle = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % WORDS.length);
        setVisible(true);
      }, 350);
    }, 2400);
    return () => clearInterval(cycle);
  }, []);

  return (
    <span
      className="inline-block transition-all duration-300"
      style={{
        color: 'var(--amber)',
        fontFamily: 'var(--font-display)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(-10px)',
      }}
    >
      {WORDS[idx]}
    </span>
  );
}

function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const c = canvas.getContext('2d');
    if (!c) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const pts: { x: number; y: number; vx: number; vy: number; r: number; a: number }[] = [];
    for (let i = 0; i < 80; i++) {
      pts.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 1.5 + 0.5,
        a: Math.random(),
      });
    }

    let raf: number;
    function draw() {
      raf = requestAnimationFrame(draw);
      c!.clearRect(0, 0, canvas!.width, canvas!.height);

      pts.forEach((p) => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = canvas!.width;
        if (p.x > canvas!.width) p.x = 0;
        if (p.y < 0) p.y = canvas!.height;
        if (p.y > canvas!.height) p.y = 0;
        c!.beginPath();
        c!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        c!.fillStyle = `rgba(245,158,11,${p.a * 0.35})`;
        c!.fill();
      });

      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x;
          const dy = pts[i].y - pts[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 100) {
            c!.beginPath();
            c!.moveTo(pts[i].x, pts[i].y);
            c!.lineTo(pts[j].x, pts[j].y);
            c!.strokeStyle = `rgba(245,158,11,${0.07 * (1 - d / 100)})`;
            c!.lineWidth = 0.5;
            c!.stroke();
          }
        }
      }
    }
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  return (
    <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" style={{ zIndex: 1 }} />
  );
}

export default function LandingPage() {
  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh', color: 'var(--text-primary)' }}>

      {/* ══ HERO ══ */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
        <ParticleCanvas />

        {/* Ambient orbs */}
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }}>
          <div className="absolute" style={{ top: '15%', left: '20%', width: '40vw', height: '40vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,158,11,0.07) 0%, transparent 65%)' }} />
          <div className="absolute" style={{ bottom: '10%', right: '15%', width: '30vw', height: '30vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(186,230,253,0.04) 0%, transparent 65%)' }} />
        </div>

        {/* Nav */}
        <nav className="absolute top-0 left-0 right-0 flex items-center justify-between px-8 py-5" style={{ zIndex: 10 }}>
          <span className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--amber)' }}>
            Moro<span style={{ color: 'var(--text-primary)' }}>deutsch</span>
          </span>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium transition-opacity hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
              Einloggen
            </Link>
            <Link
              href="/signup"
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{ background: 'var(--amber)', color: '#0a0c12', fontFamily: 'var(--font-display)' }}
            >
              Kostenlos starten
            </Link>
          </div>
        </nav>

        {/* Hero content */}
        <div className="relative text-center px-4 max-w-4xl mx-auto" style={{ zIndex: 2 }}>
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-8 animate-fade-up"
            style={{ background: 'var(--amber-glow)', border: '1px solid rgba(245,158,11,0.25)', color: 'var(--amber)', fontFamily: 'var(--font-display)', animationDelay: '0ms' }}
          >
            🇲🇦 × 🇩🇪 &nbsp;·&nbsp; KI-gestützter Deutsch-Tutor
          </div>

          <h1
            className="text-5xl md:text-7xl font-black leading-tight mb-4 animate-fade-up text-glow-amber"
            style={{ fontFamily: 'var(--font-display)', animationDelay: '80ms' }}
          >
            Morodeutsch
          </h1>

          <p className="text-xl md:text-2xl mb-3 animate-fade-up" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)', animationDelay: '160ms' }}>
            Your AI-Powered German Tutor.
          </p>

          <div className="text-lg md:text-xl mb-10 animate-fade-up" style={{ animationDelay: '240ms', minHeight: '2rem' }}>
            <AnimatedWord />
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-up" style={{ animationDelay: '320ms' }}>
            <Link
              href="/signup"
              className="px-8 py-3.5 rounded-2xl text-base font-bold transition-all animate-pulse-glow"
              style={{ background: 'var(--amber)', color: '#0a0c12', fontFamily: 'var(--font-display)', boxShadow: '0 0 30px rgba(245,158,11,0.3)' }}
            >
              Starte kostenlos →
            </Link>
            <Link
              href="/login"
              className="px-8 py-3.5 rounded-2xl text-base font-medium transition-all hover:bg-white/5"
              style={{ border: '1px solid var(--glass-border)', color: 'var(--text-muted)' }}
            >
              Einloggen
            </Link>
          </div>

          <p className="mt-8 text-sm animate-fade-up" style={{ color: 'var(--text-muted)', animationDelay: '400ms' }}>
            <span style={{ color: 'var(--amber)' }}>127 Studenten</span> · 98% Verbesserungsrate
          </p>
        </div>

        {/* Scroll chevron */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-fade-up" style={{ zIndex: 2, animationDelay: '600ms', color: 'var(--text-muted)' }}>
          <span className="text-xs">Mehr entdecken</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4 animate-bounce">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </section>

      {/* ══ FEATURES ══ */}
      <section className="px-4 py-24 max-w-5xl mx-auto">
        <p className="text-center text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>
          Warum Morodeutsch?
        </p>
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-14" style={{ fontFamily: 'var(--font-display)' }}>
          Alles was du brauchst
        </h2>
        <div className="grid md:grid-cols-3 gap-5">
          {FEATURES.map((f, i) => (
            <div
              key={i}
              className="rounded-2xl p-6 animate-fade-up transition-all hover:scale-[1.02]"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--glass-border)', animationDelay: `${i * 80}ms` }}
            >
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mb-4" style={{ background: 'var(--amber-glow)', border: '1px solid rgba(245,158,11,0.2)' }}>
                {f.icon}
              </div>
              <h3 className="text-base font-bold mb-2" style={{ fontFamily: 'var(--font-display)' }}>{f.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══ CEFR PATH ══ */}
      <section className="px-4 py-20" style={{ background: 'var(--bg-surface)' }}>
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>
            Dein Lernpfad
          </p>
          <h2 className="text-3xl font-bold mb-12" style={{ fontFamily: 'var(--font-display)' }}>Von A1 bis C2</h2>
          <div className="flex items-center justify-center gap-1 md:gap-3 flex-wrap">
            {CEFR_LEVELS.map(({ level, label, cls }, i) => (
              <div key={level} className="flex items-center gap-1 md:gap-3">
                <div className="flex flex-col items-center animate-fade-up" style={{ animationDelay: `${i * 80}ms` }}>
                  <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-sm ${cls}`}
                    style={{ fontFamily: 'var(--font-display)', color: '#fff' }}
                  >
                    {level}
                  </div>
                  <span className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>{label}</span>
                </div>
                {i < CEFR_LEVELS.length - 1 && (
                  <div className="hidden md:block w-8 h-px" style={{ background: 'linear-gradient(90deg, rgba(245,158,11,0.4), rgba(245,158,11,0.1))' }} />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ CTA ══ */}
      <section className="px-4 py-24 text-center">
        <h2 className="text-4xl md:text-5xl font-black mb-4" style={{ fontFamily: 'var(--font-display)' }}>
          Bereit anzufangen?
        </h2>
        <p className="text-base mb-8" style={{ color: 'var(--text-muted)' }}>
          Kostenlos starten. Keine Kreditkarte erforderlich.
        </p>
        <Link
          href="/signup"
          className="inline-block px-10 py-4 rounded-2xl text-lg font-bold transition-all animate-pulse-glow"
          style={{ background: 'var(--amber)', color: '#0a0c12', fontFamily: 'var(--font-display)', boxShadow: '0 0 40px rgba(245,158,11,0.25)' }}
        >
          Jetzt kostenlos registrieren →
        </Link>
      </section>

      {/* ══ FOOTER ══ */}
      <footer className="text-center py-8 text-xs" style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--glass-border)' }}>
        © 2025 Morodeutsch · AI German Tutor
      </footer>
    </div>
  );
}
