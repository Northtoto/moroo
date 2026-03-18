import Image from 'next/image';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: 'var(--bg-base)' }}
    >
      {/* Background glow orbs */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: '-20%', left: '-10%',
          width: '60vw', height: '60vw',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(245,158,11,0.06) 0%, transparent 70%)',
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: '-20%', right: '-10%',
          width: '50vw', height: '50vw',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(186,230,253,0.04) 0%, transparent 70%)',
        }}
      />

      {/* Logo top-left */}
      <div className="absolute top-6 left-8">
        <div style={{
          background: '#fff',
          borderRadius: 10,
          padding: '5px 10px',
          display: 'inline-flex',
          alignItems: 'center',
          boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
        }}>
          <Image src="/logo.jpeg" alt="Marodeutsch" width={80} height={28} style={{ height: 28, width: 'auto', display: 'block' }} />
        </div>
      </div>

      <div className="w-full max-w-md px-4 relative z-10">{children}</div>
    </div>
  );
}
