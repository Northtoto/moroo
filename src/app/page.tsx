import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Nav */}
      <nav className="border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between h-16 items-center">
          <span className="text-xl font-bold">Deutsche Meister</span>
          <div className="flex gap-3">
            <Link
              href="/login"
              className="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16 text-center">
        <div className="inline-block px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-xs font-medium mb-6">
          AI-Powered German Tutoring
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight max-w-3xl mx-auto leading-tight">
          Master German with
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400"> Intelligent AI</span>
        </h1>
        <p className="text-lg text-slate-400 mt-6 max-w-2xl mx-auto leading-relaxed">
          Get instant corrections on your writing, speaking, and homework.
          Our AI tutor understands context, explains mistakes, and helps you improve faster.
        </p>
        <div className="flex gap-4 justify-center mt-8">
          <Link
            href="/signup"
            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl font-semibold transition-colors text-base"
          >
            Start Learning Free
          </Link>
          <Link
            href="/login"
            className="px-8 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-semibold transition-colors text-base"
          >
            Sign In
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <h3 className="text-white font-semibold text-lg">Text Correction</h3>
            <p className="text-slate-400 mt-2 text-sm leading-relaxed">
              Write German text and get instant grammar, spelling, and word order corrections with clear explanations.
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            <h3 className="text-white font-semibold text-lg">Audio Analysis</h3>
            <p className="text-slate-400 mt-2 text-sm leading-relaxed">
              Record yourself speaking or upload audio files. AI transcribes and corrects your German pronunciation.
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-white font-semibold text-lg">Homework OCR</h3>
            <p className="text-slate-400 mt-2 text-sm leading-relaxed">
              Snap a photo of your handwritten homework. OCR extracts the text and AI corrects your German.
            </p>
          </div>
        </div>
      </section>

      {/* Levels */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-2xl font-bold text-center mb-8">All Levels, A1 to C2</h2>
        <div className="flex flex-wrap justify-center gap-3">
          {['A1 Beginner', 'A2 Elementary', 'B1 Intermediate', 'B2 Upper-Intermediate', 'C1 Advanced', 'C2 Mastery'].map((level) => (
            <span
              key={level}
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-full text-sm text-slate-300"
            >
              {level}
            </span>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <h2 className="text-3xl font-bold">Start Improving Your German Today</h2>
        <p className="text-slate-400 mt-3 max-w-lg mx-auto">
          Free to start. No credit card required.
        </p>
        <Link
          href="/signup"
          className="inline-block mt-6 px-8 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl font-semibold transition-colors"
        >
          Create Free Account
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-slate-500 text-sm">
          Deutsche Meister &mdash; AI-Powered German Tutoring
        </div>
      </footer>
    </div>
  );
}
