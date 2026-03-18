import type { Metadata, Viewport } from "next";
import { Syne, DM_Sans, JetBrains_Mono } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Morodeutsch — Your AI German Tutor",
  description:
    "AI-powered German tutor with Theory-of-Mind personalization. Correct your German, track your progress, master the language.",
  keywords: ["German", "tutor", "AI", "language learning", "CEFR", "spaced repetition"],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Morodeutsch",
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover', // Notch support for iOS 11+
  themeColor: "#f59e0b",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" className="dark">
      <body
        className={`${syne.variable} ${dmSans.variable} ${jetbrainsMono.variable} antialiased`}
        style={{ fontFamily: "var(--font-body)" }}
      >
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "var(--bg-surface)",
              color: "var(--text-primary)",
              border: "1px solid var(--glass-border)",
              borderRadius: "12px",
              fontFamily: "var(--font-body)",
              fontSize: "14px",
            },
            success: {
              iconTheme: { primary: "#10B981", secondary: "transparent" },
            },
            error: {
              iconTheme: { primary: "#EF4444", secondary: "transparent" },
            },
          }}
        />
      </body>
    </html>
  );
}
