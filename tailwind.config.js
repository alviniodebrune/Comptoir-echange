/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#ECEEEA",
        ink: "#1C2A2E",
        inksoft: "#4B5A5C",
        amber: "#D98E2B",
        amberdark: "#B5721B",
        teal: "#2F6E63",
        line: "#B7BFB9",
        red: "#B34632",
      },
      fontFamily: {
        display: ["'Barlow Condensed'", "sans-serif"],
        body: ["Inter", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};
