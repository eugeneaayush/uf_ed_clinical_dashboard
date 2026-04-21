/**
 * Tailwind config aligned with the UF Dept of Emergency Medicine template.
 * Tokens extracted directly from the template's compiled CSS:
 *   - Body: IBM Plex Sans (300/400/500/600/700)
 *   - Display (hero & KPI numerics): Anybody (bold/extra-bold/black)
 *   - Mono (badges, ticks): IBM Plex Mono
 *   - UF Blue #0021A5 / deep #001470 / UF Orange #FA4616
 *   - Slate ramp from the template: f8fafc → cad5e2 → 62748e → 1d293d → 0f172b
 *   - Large radius scale rounded-4xl..rounded-6xl used for hero cards & CTAs
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '"IBM Plex Sans"',
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "sans-serif",
        ],
        display: [
          "Anybody",
          '"IBM Plex Sans"',
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          '"IBM Plex Mono"',
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
      colors: {
        uf: {
          blue: "#0021A5",
          "blue-deep": "#001470",
          "blue-ink": "#193cb8",
          orange: "#FA4616",
          "orange-deep": "#c73611",
        },
        slate: {
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cad5e2",
          400: "#90a1b9",
          500: "#62748e",
          600: "#45556c",
          700: "#314158",
          800: "#1d293d",
          900: "#0f172b",
        },
        sky: {
          100: "#eff6ff",
          200: "#bedbff",
          300: "#90c5ff",
          400: "#3080ff",
          500: "#155dfc",
        },
        "orange-soft": "#fff7ed",
        chart: {
          1: "#0021A5",
          2: "#FA4616",
          3: "#155dfc",
          4: "#1d293d",
          5: "#3080ff",
          6: "#62748e",
          7: "#c73611",
          8: "#90c5ff",
        },
      },
      borderRadius: {
        "4xl": "2rem",
        "5xl": "2.5rem",
        "6xl": "3rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 23, 43, 0.04), 0 0 0 1px rgba(15, 23, 43, 0.05)",
        "card-hover":
          "0 6px 20px rgba(15, 23, 43, 0.08), 0 0 0 1px rgba(15, 23, 43, 0.06)",
        pop: "0 1px 2px rgba(15, 23, 43, 0.06), 0 10px 30px rgba(0, 33, 165, 0.08)",
      },
      letterSpacing: {
        tighter: "-0.03em",
        display: "-0.02em",
      },
      animation: {
        "fade-up": "fadeUp 0.55s cubic-bezier(0.22, 1, 0.36, 1) both",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
