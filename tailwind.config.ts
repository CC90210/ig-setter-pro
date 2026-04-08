import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        mint: "#00FFAB",
        "mint-dim": "#00cc88",
        panel: "#0a0a0a",
        "panel-hover": "#111111",
        border: "#1a1a1a",
        "border-hover": "#2a2a2a",
        "text-primary": "#fafafa",
        "text-secondary": "#888888",
        "text-muted": "#555555",
      },
      fontFamily: {
        display: ["var(--font-syne)", "sans-serif"],
        mono: ["var(--font-space-mono)", "monospace"],
        body: ["var(--font-dm-sans)", "sans-serif"],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-up": "fadeUp 0.4s ease-out forwards",
        "typing-dot": "typingDot 1.4s infinite ease-in-out",
        "glow-pulse": "glowPulse 2s ease-in-out infinite",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        typingDot: {
          "0%, 80%, 100%": { opacity: "0.3", transform: "scale(0.8)" },
          "40%": { opacity: "1", transform: "scale(1)" },
        },
        glowPulse: {
          "0%, 100%": { boxShadow: "0 0 8px rgba(0, 255, 171, 0.3)" },
          "50%": { boxShadow: "0 0 20px rgba(0, 255, 171, 0.6)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
