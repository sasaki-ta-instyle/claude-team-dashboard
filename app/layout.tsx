import type { Metadata } from "next";
import "./globals.css";

const SITE_URL = "https://app.instyle.group/claude-team-dashboard";
const ASSETS = "https://app.instyle.group/_shared/static";
const TITLE = "Claude Team Dashboard";
const DESCRIPTION = "Anthropic Claude Team プランのメンバー使用量モニタリング & seat 配分判断ダッシュボード";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  icons: { icon: `${ASSETS}/favicon.png`, apple: `${ASSETS}/favicon.png` },
  openGraph: {
    type: "website",
    siteName: "INSTYLE GROUP",
    locale: "ja_JP",
    url: SITE_URL,
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: `${ASSETS}/ogp.jpg`, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [`${ASSETS}/ogp.jpg`],
  },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
