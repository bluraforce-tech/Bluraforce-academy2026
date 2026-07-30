import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://bluraforce-academy2026.vercel.app"),
  title: "BluraForce Academy — Secure learning platform",
  description: "A secure, teacher-led platform for lessons, exams, and learning progress.",
  openGraph: {
    title: "BluraForce Academy — Secure learning platform",
    description: "A secure, teacher-led platform for lessons, exams, and learning progress.",
    url: "/",
    siteName: "BluraForce Academy",
    images: [
      {
        url: "/bluraforce-icon.png",
        width: 512,
        height: 512,
        alt: "BluraForce logo",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BluraForce Academy — Secure learning platform",
    description: "A secure, teacher-led platform for lessons, exams, and learning progress.",
    images: ["/bluraforce-icon.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" dir="ltr"><body>{children}</body></html>;
}
