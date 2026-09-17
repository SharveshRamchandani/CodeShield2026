/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class", '[data-theme="dark"]'],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: "var(--color-base)",
        panel: "var(--color-panel)",
        hairline: "var(--color-hairline)",
        amber: "var(--color-amber)",
        cyan: "var(--color-cyan)",
        "cyan-hover": "var(--color-cyan-hover)",
        content: "var(--color-content)",
        muted: "var(--color-muted)",
        subtle: "var(--color-subtle)",
      },
      fontFamily: {
        mono: ["'JetBrains Mono'", "monospace"],
        sans: ["'Space Grotesk'", "sans-serif"],
      },
    },
  },
  plugins: [],
};
