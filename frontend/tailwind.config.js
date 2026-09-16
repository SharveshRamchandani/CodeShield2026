/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        base: "#0B0F14",
        panel: "#131A24",
        hairline: "#1C2633",
        amber: "#FFB100",
        cyan: "#22D3EE",
        content: "#E7EDF3",
      },
      fontFamily: {
        mono: ["'JetBrains Mono'", "monospace"],
        sans: ["'Space Grotesk'", "sans-serif"],
      },
    },
  },
  plugins: [],
};
