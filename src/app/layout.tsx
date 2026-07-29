import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Academy — Secure learning platform", description: "A secure, teacher-led platform for lessons, exams, and learning progress." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" dir="ltr"><body>{children}</body></html>;
}
