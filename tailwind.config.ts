import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#07080a",
          900: "#0b0c0f",
          800: "#111318",
          700: "#171a21",
          600: "#1e222b",
        },
        paper: {
          DEFAULT: "#ece8dc",
          300: "#c8c3b6",
          500: "#8d8a82",
        },
        trace: {
          DEFAULT: "#6ee7d2",
          200: "#a8f3e4",
        },
        proceed: "#3ee0a0",
        flag: "#e3c25b",
        hold: "#ff5c5c",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
