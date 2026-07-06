import type { Metadata } from "next";
import { Geist, Geist_Mono, Source_Serif_4 } from "next/font/google";
import "./globals.css";

// geist for body, source serif for headings — the serif makes it feel like
// a document tool instead of yet another dashboard. globals.css maps these
// vars to the font-sans / font-heading utilities.
const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const sourceSerif = Source_Serif_4({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "GapFinder — AI requirements analyst",
  description:
    "Describe a product idea; GapFinder interviews you like a business analyst, tracks a live requirements checklist, and writes the spec — without guessing.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${sourceSerif.variable} h-full antialiased`}
    >
      {/* browser extensions (password managers etc.) inject attributes into
          <body> before react hydrates and it screams about the mismatch.
          this only mutes attribute diffs on body — real bugs still surface. */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
