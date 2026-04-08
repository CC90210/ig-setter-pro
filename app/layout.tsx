import type { Metadata } from "next";
import { Syne, Space_Mono, DM_Sans } from "next/font/google";
import "./globals.css";

const syne = Syne({ subsets: ["latin"], variable: "--font-syne" });
const spaceMono = Space_Mono({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-space-mono" });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans" });

export const metadata: Metadata = {
  title: "ig-setter-pro — AI Instagram DM Command Center",
  description: "Next-gen Instagram DM automation with AI-powered replies, multi-account support, NEPQ sales framework, automation rules, and sequence flows.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${syne.variable} ${spaceMono.variable} ${dmSans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
