/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#1B1611",
        "paper-dark": "#26211A",
        ink: "#EDE4D0",
        "ink-soft": "#A79A80",
        forest: "#6FA36A",
        "forest-dark": "#3C5F3E",
        moss: "#7EA86B",
        ochre: "#D9A544",
        "ochre-dark": "#B8843A",
        rust: "#C15D3F",
        line: "#3A3226",
      },
      fontFamily: {
        display: ['"Bitter"', "serif"],
        sans: ['"Inter"', "sans-serif"],
        mono: ['"IBM Plex Mono"', "monospace"],
      },
    },
  },
  plugins: [],
};
