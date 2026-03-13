import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Deutsche Meister — AI-Powered German Tutoring",
    template: "%s | Deutsche Meister",
  },
  description:
    "Master German with AI-powered text correction, speech analysis, and OCR homework checking. Join our community of German learners.",
  keywords: ["German learning", "AI tutor", "Deutsch lernen", "German grammar", "language learning"],
  openGraph: {
    title: "Deutsche Meister — AI-Powered German Tutoring",
    description: "Master German with AI-powered corrections for text, audio, and handwritten homework.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de-DE">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
