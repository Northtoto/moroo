'use client';

// ─── Pricing Page ─────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

interface Plan {
  id: 'free' | 'pro' | 'premium';
  name: string;
  price: string;
  priceId: string | null;
  period: string;
  description: string;
  features: string[];
  limits: string[];
  highlight: boolean;
  badge?: string;
}

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price: '0€',
    priceId: null,
    period: 'für immer',
    description: 'Perfekt zum Ausprobieren',
    features: [
      '10 Text-Korrekturen / Tag',
      '3 Audio-Korrekturen / Tag',
      '2 OCR-Korrekturen / Tag',
      'FSRS-Vokabelkarten',
      'Lernfortschritt-Dashboard',
    ],
    limits: [],
    highlight: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '8€',
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO ?? '',
    period: 'pro Monat',
    description: 'Für ernsthafte Lernende',
    badge: 'Beliebt',
    features: [
      '100 Text-Korrekturen / Tag',
      '30 Audio-Korrekturen / Tag',
      '20 OCR-Korrekturen / Tag',
      'Theory-of-Mind Lernprofil',
      'Aussprache-Bewertung',
      'WhatsApp-Tages-Bot',
      'Fortschritt-Export (Sheets)',
    ],
    limits: [],
    highlight: true,
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '18€',
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PREMIUM ?? '',
    period: 'pro Monat',
    description: 'Unbegrenzt + Voice-Modus',
    features: [
      'Unbegrenzte Korrekturen',
      'Echtzeit-Sprachgespräch (KI)',
      'Phonem-Heatmap-Analyse',
      'Adaptive Übungsempfehlungen',
      'Deutsche Nachrichten (CEFR)',
      'Priority Support',
    ],
    limits: [],
    highlight: false,
  },
];

interface SubscriptionStatus {
  tier: string;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

export default function PricingPage() {
  const searchParams = useSearchParams();
  const success = searchParams.get('success');
  const canceled = searchParams.get('canceled');

  const [currentSub, setCurrentSub] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  useEffect(() => {
    fetchStatus();
  }, []);

  async function fetchStatus() {
    try {
      const res = await fetch('/api/stripe/status');
      if (res.ok) setCurrentSub(await res.json() as SubscriptionStatus);
    } finally {
      setStatusLoading(false);
    }
  }

  async function handleSubscribe(plan: Plan) {
    if (!plan.priceId) return;
    setLoading(plan.id);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price_id: plan.priceId }),
      });
      const { url, error } = await res.json() as { url?: string; error?: string };
      if (error || !url) throw new Error(error ?? 'No URL');
      window.location.href = url;
    } catch (err) {
      console.error(err);
      alert('Fehler beim Starten des Checkouts. Bitte erneut versuchen.');
    } finally {
      setLoading(null);
    }
  }

  async function handlePortal() {
    setLoading('portal');
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      const { url } = await res.json() as { url?: string };
      if (url) window.location.href = url;
    } finally {
      setLoading(null);
    }
  }

  const activeTier = currentSub?.tier ?? 'free';
  const reason = searchParams.get('reason');

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 16px' }}>
      {/* Toast messages */}
      {success && (
        <div style={toastStyle('#22c55e')}>
          🎉 Abonnement erfolgreich! Willkommen im Pro-Klub.
        </div>
      )}
      {canceled && (
        <div style={toastStyle('#f59e0b')}>
          Checkout abgebrochen. Du kannst jederzeit upgraden.
        </div>
      )}

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <h1 style={{ color: '#f1f5f9', fontSize: 32, fontWeight: 800, marginBottom: 12 }}>
          Wähle deinen Plan
        </h1>
        <p style={{ color: '#94a3b8', fontSize: 16 }}>
          Lerne Deutsch schneller mit KI-gestütztem personalisierten Feedback
        </p>
        {!statusLoading && activeTier !== 'free' && (
          <div style={{ marginTop: 16 }}>
            <span style={{
              background: 'rgba(34,197,94,0.15)',
              color: '#22c55e',
              border: '1px solid rgba(34,197,94,0.3)',
              borderRadius: 20,
              padding: '4px 14px',
              fontSize: 13,
              fontWeight: 600,
            }}>
              Aktuell: {activeTier.charAt(0).toUpperCase() + activeTier.slice(1)}
            </span>
          </div>
        )}
      </div>

      {/* Plans grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
        {PLANS.map(plan => {
          const isActive = activeTier === plan.id;
          const isHighlighted = plan.highlight;

          return (
            <div
              key={plan.id}
              style={{
                background: isHighlighted
                  ? 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(30,41,59,0.9))'
                  : 'rgba(30,41,59,0.8)',
                border: isHighlighted
                  ? '1px solid rgba(245,158,11,0.4)'
                  : isActive
                    ? '1px solid rgba(34,197,94,0.4)'
                    : '1px solid rgba(148,163,184,0.12)',
                borderRadius: 16,
                padding: '28px 24px',
                position: 'relative',
                backdropFilter: 'blur(8px)',
              }}
            >
              {/* Badge */}
              {plan.badge && (
                <div style={{
                  position: 'absolute',
                  top: -12,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: '#f59e0b',
                  color: '#0f172a',
                  borderRadius: 20,
                  padding: '3px 14px',
                  fontSize: 12,
                  fontWeight: 700,
                }}>
                  {plan.badge}
                </div>
              )}

              {/* Plan header */}
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ color: '#f1f5f9', fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
                  {plan.name}
                </h2>
                <p style={{ color: '#64748b', fontSize: 13, marginBottom: 12 }}>{plan.description}</p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ color: '#f1f5f9', fontSize: 36, fontWeight: 800 }}>{plan.price}</span>
                  <span style={{ color: '#64748b', fontSize: 13 }}>{plan.period}</span>
                </div>
              </div>

              {/* Features */}
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {plan.features.map(f => (
                  <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#cbd5e1' }}>
                    <span style={{ color: '#22c55e', flexShrink: 0 }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              {isActive ? (
                <div>
                  <div style={{
                    background: 'rgba(34,197,94,0.1)',
                    border: '1px solid rgba(34,197,94,0.3)',
                    borderRadius: 10,
                    padding: '10px',
                    textAlign: 'center',
                    color: '#22c55e',
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: activeTier !== 'free' ? 8 : 0,
                  }}>
                    Dein aktueller Plan
                  </div>
                  {activeTier !== 'free' && (
                    <button
                      onClick={handlePortal}
                      disabled={loading === 'portal'}
                      style={secondaryBtnStyle}
                    >
                      {loading === 'portal' ? 'Weiterleitung…' : 'Abo verwalten'}
                    </button>
                  )}
                </div>
              ) : plan.priceId ? (
                <button
                  onClick={() => handleSubscribe(plan)}
                  disabled={!!loading}
                  style={isHighlighted ? primaryBtnStyle : secondaryBtnStyle}
                >
                  {loading === plan.id ? 'Weiterleitung…' : `${plan.name} wählen`}
                </button>
              ) : (
                <div style={{ height: 40 }} />
              )}
            </div>
          );
        })}
      </div>

      {/* FAQ */}
      <div style={{ marginTop: 64, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
        <p>Alle Pläne beinhalten eine 7-tägige Geld-zurück-Garantie.</p>
        <p style={{ marginTop: 4 }}>Fragen? <a href="mailto:support@morodeutsch.com" style={{ color: '#f59e0b' }}>support@morodeutsch.com</a></p>
      </div>

      {/* Skool community block — shown when redirected from a premium-gated page */}
      {reason === 'premium_required' && (
        <div className="mt-8 p-6 border border-blue-200 rounded-xl bg-blue-50 text-center max-w-lg mx-auto">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            Bereits Mitglied der Skool-Community?
          </h3>
          <p className="text-blue-700 text-sm mb-4">
            Wenn du in unserer Skool-Community «marodeutsh» bezahlt hast,
            erstelle deinen Account mit <strong>derselben E-Mail-Adresse</strong>.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href={process.env.NEXT_PUBLIC_SKOOL_COMMUNITY_URL ?? 'https://www.skool.com/marodeutsh'}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
            >
              Zur Skool-Community →
            </a>
            <a
              href="/welcome?source=skool"
              className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg text-sm font-medium"
            >
              Account verknüpfen
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

const primaryBtnStyle: React.CSSProperties = {
  width: '100%',
  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
  border: 'none',
  borderRadius: 10,
  color: '#0f172a',
  padding: '12px',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
};

const secondaryBtnStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(148,163,184,0.08)',
  border: '1px solid rgba(148,163,184,0.2)',
  borderRadius: 10,
  color: '#94a3b8',
  padding: '12px',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  marginTop: 8,
};

function toastStyle(color: string): React.CSSProperties {
  return {
    background: `${color}18`,
    border: `1px solid ${color}44`,
    borderRadius: 10,
    padding: '12px 20px',
    color,
    fontSize: 14,
    marginBottom: 24,
    textAlign: 'center',
  };
}
