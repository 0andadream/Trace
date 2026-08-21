import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#0A0219",
          900: "#0D0520",
          800: "#14082C",
          700: "#1B0C3A",
          600: "#24124A",
        },
        paper: {
          DEFAULT: "#FBFBFB",
          300: "#C9C3D8",
          500: "#7E7894",
        },
        trace: {
          DEFAULT: "#7828E8",
          200: "#9B5CFF",
        },
        proceed: "#3EE0A0",
        flag: "#E3C25B",
        hold: "#FF5C7A",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        panel: "1.1rem",
      },
    },
  },
  plugins: [],
};

export default config;
