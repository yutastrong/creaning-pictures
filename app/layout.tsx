import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "現場写真共有アプリ",
  description: "現場で撮影した写真を、作業・現場・撮影者ごとにすぐ共有できる業務アプリ",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "現場写真共有",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#1467e9",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><body>{children}</body></html>;
}
