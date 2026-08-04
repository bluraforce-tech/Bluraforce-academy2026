import type { Metadata } from "next";
import "./globals.css";
import {SessionHistoryGuard} from "@/components/session-history-guard";

export const metadata: Metadata = {
  metadataBase: new URL("https://bluraforce-academy2026.vercel.app"),
  title: "High Achievers — Learn, Grow, Achieve",
  description: "A secure, teacher-led platform for lessons, exams, and learning progress.",
  openGraph: {
    title: "High Achievers — Learn, Grow, Achieve",
    description: "A secure, teacher-led platform for lessons, exams, and learning progress.",
    url: "/",
    siteName: "High Achievers",
    images: [
      {
        url: "/high-achievers-icon.png",
        width: 512,
        height: 512,
        alt: "High Achievers logo",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "High Achievers — Learn, Grow, Achieve",
    description: "A secure, teacher-led platform for lessons, exams, and learning progress.",
    images: ["/high-achievers-icon.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" dir="ltr"><body><SessionHistoryGuard/>{children}</body></html>;
}
