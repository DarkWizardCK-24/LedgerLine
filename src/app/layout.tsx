import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], display: "swap", axes: ["opsz"] });

export const metadata: Metadata = {
  title: "Ledgerline",
  description: "Double-entry accounting: journal, ledger, trial balance, profit & loss and balance sheet.",
  manifest: "/manifest.webmanifest",
  icons: { icon: [{ url: "/glyph.svg", type: "image/svg+xml" }, { url: "/icon-192.png", sizes: "192x192", type: "image/png" }], apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }] },
  appleWebApp: { capable: true, title: "Ledgerline", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // lets the app draw under the notch; safe-area padding keeps controls clear of it
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f3ec" },
    { media: "(prefers-color-scheme: dark)", color: "#0a1511" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
