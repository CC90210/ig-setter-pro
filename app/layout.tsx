import type { Metadata } from "next";
import { Syne, Space_Mono, DM_Sans } from "next/font/google";
import "./globals.css";

const syne = Syne({ subsets: ["latin"], variable: "--font-syne" });
const spaceMono = Space_Mono({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-space-mono" });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans" });

export const metadata: Metadata = {
  title: "PULSE — AI Instagram Command Center · by OASIS",
  description: "The complete ManyChat replacement. AI-powered DM automation, comment-to-DM triggers, follow-gated value delivery, broadcasts, subscriber segmentation, and conversion analytics. Built by OASIS AI.",
  authors: [{ name: "OASIS AI", url: "https://oasisai.work" }],
  keywords: ["Instagram DM automation", "ManyChat alternative", "comment to DM", "Instagram CRM", "AI DM replies"],
  openGraph: {
    title: "PULSE — AI Instagram Command Center",
    description: "Complete ManyChat replacement. AI DMs, comment triggers, broadcasts, analytics. Built by OASIS AI.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${syne.variable} ${spaceMono.variable} ${dmSans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
