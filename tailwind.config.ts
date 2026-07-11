import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        accent: "#00677e",
        surface: "#f9f9f9",
        "surface-container": "#eeeeee",
        "surface-container-low": "#f3f3f3",
        "surface-container-lowest": "#ffffff",
        "on-surface-variant": "#4c4546",
        "outline-variant": "#cfc4c5"
      },
      fontFamily: {
        event: [
          "var(--font-event-dashboard)",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif"
        ],
        "register-body": ["var(--font-register-body)", "ui-sans-serif", "system-ui", "sans-serif"],
        "register-display": ["var(--font-register-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        "register-mono": ["var(--font-register-mono)", "ui-monospace", "monospace"]
      }
    }
  },
  plugins: []
};

export default config;
