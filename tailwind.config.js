/**
 * Tailwind config — dark-mode premium palette for the UF ED Dashboard.
 *
 * Brand tokens (UF blue / UF orange) and the IBM Plex + Anybody font stack are
 * preserved verbatim so parallel workers compile against the same references.
 *
 *  - Body surface: `bg-zinc-950`
 *  - Cards: `bg-zinc-900` + `ring-zinc-800`
 *  - Text: zinc-100 / zinc-400 / zinc-500
 *  - Accents: UF blue (#0021A5), blue-400, UF orange (#FA4616, sparingly)
 *  - Chart palette preserves UF blue + UF orange as leads; supporting hues
 *    (cyan/violet/emerald) are available via standard Tailwind tokens.
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
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
        // Legacy slate ramp kept for any surviving references, but the app
        // now lives on the zinc ramp that ships with Tailwind.
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
        // Semantic surface tokens wired to CSS vars — handy for one-off
        // overrides without grinding through every Tailwind class.
        surface: {
          canvas: "var(--canvas)",
          raised: "var(--surface)",
          overlay: "var(--surface-2)",
        },
        // Chart palette: UF blue + UF orange remain the lead series; the
        // supporting hues shift cool-to-warm so they render readably on the
        // zinc canvas without fighting the brand marks.
        chart: {
          1: "#0021A5", // UF blue — primary
          2: "#FA4616", // UF orange — attention
          3: "#67e8f9", // cyan-300
          4: "#c4b5fd", // violet-300
          5: "#6ee7b7", // emerald-300
          6: "#3080ff", // sky-400
          7: "#f0abfc", // fuchsia-300
          8: "#fde68a", // amber-200
        },
      },
      borderRadius: {
        "4xl": "2rem",
        "5xl": "2.5rem",
        "6xl": "3rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.04)",
        "card-hover":
          "0 6px 20px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.08)",
        pop: "0 1px 2px rgba(0, 0, 0, 0.45), 0 10px 30px rgba(0, 33, 165, 0.25)",
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
