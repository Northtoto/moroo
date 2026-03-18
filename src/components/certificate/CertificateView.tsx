'use client';

import { useRef } from 'react';

interface CertificateViewProps {
  studentName: string;
  level: string;
  levelTitle: string;
  honorsTitle: string;
  totalXp: number;
  totalCorrections: number;
  bestStreak: number;
  memberSince: string;
  certificateDate: string;
  certificateId: string;
}

export default function CertificateView({
  studentName,
  level,
  levelTitle,
  honorsTitle,
  totalXp,
  totalCorrections,
  bestStreak,
  memberSince,
  certificateDate,
  certificateId,
}: CertificateViewProps) {
  const certRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex-1 flex flex-col items-center p-6 gap-6">
      {/* Action bar — hidden in print */}
      <div className="print:hidden flex items-center gap-4 w-full max-w-4xl">
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-xl transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Print / Save as PDF
        </button>
        <p className="text-slate-500 text-sm">
          Use your browser&apos;s print dialog to save as PDF
        </p>
      </div>

      {/* ═══════════════════════════════════════════
          THE CERTIFICATE — print-optimized
          ═══════════════════════════════════════════ */}
      <div
        ref={certRef}
        className="certificate-page w-full max-w-4xl bg-white rounded-2xl print:rounded-none shadow-2xl print:shadow-none overflow-hidden"
      >
        {/* Ornamental top border */}
        <div className="h-3 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400" />

        <div className="p-12 sm:p-16 space-y-8 text-center relative">
          {/* Corner ornaments */}
          <div className="absolute top-6 left-6 text-amber-300 text-4xl opacity-30 select-none">❧</div>
          <div className="absolute top-6 right-6 text-amber-300 text-4xl opacity-30 select-none rotate-180">❧</div>
          <div className="absolute bottom-6 left-6 text-amber-300 text-4xl opacity-30 select-none rotate-180">❧</div>
          <div className="absolute bottom-6 right-6 text-amber-300 text-4xl opacity-30 select-none">❧</div>

          {/* Inner decorative border */}
          <div className="absolute inset-8 border-2 border-amber-200/40 rounded-lg pointer-events-none" />
          <div className="absolute inset-10 border border-amber-200/20 rounded-lg pointer-events-none" />

          {/* Logo & Institution */}
          <div className="space-y-2 relative">
            <div className="text-5xl mb-2">🏛️</div>
            <h2 className="text-sm font-semibold tracking-[0.3em] uppercase text-amber-700">
              Morodeutsch Academy
            </h2>
            <p className="text-xs text-gray-400 tracking-widest uppercase">
              AI-Powered German Language Institute
            </p>
          </div>

          {/* Divider */}
          <div className="flex items-center justify-center gap-4">
            <div className="h-px w-20 bg-gradient-to-r from-transparent to-amber-300" />
            <div className="text-amber-400 text-lg">✦</div>
            <div className="h-px w-20 bg-gradient-to-l from-transparent to-amber-300" />
          </div>

          {/* Title */}
          <div className="space-y-1">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
              {honorsTitle}
            </h1>
            <p className="text-gray-500 text-sm italic">
              Common European Framework of Reference for Languages
            </p>
          </div>

          {/* Presented to */}
          <div className="space-y-2 py-4">
            <p className="text-sm text-gray-500 tracking-wide uppercase">
              This is to certify that
            </p>
            <h2
              className="text-4xl sm:text-5xl font-bold text-gray-900 py-2"
              style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
            >
              {studentName}
            </h2>
            <div className="w-48 h-px bg-gray-300 mx-auto" />
          </div>

          {/* Achievement description */}
          <div className="max-w-xl mx-auto space-y-3">
            <p className="text-gray-600 leading-relaxed">
              has demonstrated outstanding proficiency in the German language,
              achieving <strong className="text-gray-900">CEFR Level {level}</strong> —{' '}
              <em>{levelTitle}</em> — through dedicated practice and continuous improvement
              with the Morodeutsch AI Tutor platform.
            </p>
          </div>

          {/* CEFR Badge */}
          <div className="flex justify-center py-4">
            <div className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-300 rounded-xl">
              <span className="text-4xl">🏆</span>
              <div className="text-left">
                <div className="text-3xl font-black text-amber-700 tracking-wider">{level}</div>
                <div className="text-xs text-amber-600 font-medium">{levelTitle}</div>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4 max-w-md mx-auto py-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{totalXp.toLocaleString()}</div>
              <div className="text-xs text-gray-500 uppercase tracking-wider">Total XP</div>
            </div>
            <div className="text-center border-x border-gray-200">
              <div className="text-2xl font-bold text-gray-900">{totalCorrections}</div>
              <div className="text-xs text-gray-500 uppercase tracking-wider">Corrections</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{bestStreak} 🔥</div>
              <div className="text-xs text-gray-500 uppercase tracking-wider">Best Streak</div>
            </div>
          </div>

          {/* Date and signatures */}
          <div className="flex items-end justify-between pt-8 px-4">
            <div className="text-center">
              <div className="w-40 border-b border-gray-300 mb-1 pb-1">
                <span className="text-sm text-gray-700">{certificateDate}</span>
              </div>
              <p className="text-xs text-gray-500">Date of Issue</p>
            </div>

            <div className="text-center">
              <div className="w-40 border-b border-gray-300 mb-1 pb-1">
                <span className="text-sm text-gray-700 italic" style={{ fontFamily: 'Georgia, serif' }}>
                  Morodeutsch AI
                </span>
              </div>
              <p className="text-xs text-gray-500">Authorized Signature</p>
            </div>
          </div>

          {/* Certificate ID */}
          <div className="pt-6">
            <p className="text-[10px] text-gray-400 tracking-wider">
              Certificate ID: {certificateId} · Member since {memberSince}
            </p>
          </div>
        </div>

        {/* Ornamental bottom border */}
        <div className="h-3 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400" />
      </div>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          /* Hide the sidebar nav */
          nav, aside, header {
            display: none !important;
          }
          main {
            margin: 0 !important;
            padding: 0 !important;
          }
          .certificate-page {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }
          @page {
            size: A4 landscape;
            margin: 0;
          }
        }
      `}</style>
    </div>
  );
}
