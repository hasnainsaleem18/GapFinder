import type { Metadata } from "next";
import { Geist, Geist_Mono, Source_Serif_4 } from "next/font/google";
import "./globals.css";

// Body: Geist (clean, precise). Headings: Source Serif 4 — a restrained serif
// that suits a requirements-document tool. Wired to --font-sans / --font-display,
// which globals.css maps to the `font-sans` / `font-heading` utilities.
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
      {/* suppressHydrationWarning: browser extensions inject attributes into
          <body> before hydration; this silences only attribute mismatches on
          this element, not real errors in the app tree. */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
