/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#f7f8fb",
        ink: {
          50: "#f6f7f9",
          100: "#eceef2",
          200: "#d6dbe4",
          300: "#b4bece",
          400: "#8a97ab",
          500: "#6b788e",
          600: "#556176",
          700: "#465064",
          800: "#343d50",
          900: "#1b2435",
          950: "#0d1526"
        },
        iris: {
          50: "#f5f3ff",
          100: "#ece7ff",
          200: "#dcd3ff",
          300: "#c1b0fe",
          400: "#a184fb",
          500: "#8460f4",
          600: "#7442e8",
          700: "#6432cc",
          800: "#532ba7",
          900: "#452787",
          950: "#2a165e"
        }
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif"
        ]
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 23, 42, 0.04), 0 12px 32px -18px rgba(15, 23, 42, 0.22)",
        lift: "0 2px 4px rgba(15, 23, 42, 0.05), 0 20px 44px -20px rgba(15, 23, 42, 0.28)"
      },
      borderRadius: {
        xl2: "1.125rem"
      },
      keyframes: {
        shimmer: {
          "100%": { transform: "translateX(100%)" }
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        "hero-rise": {
          "0%": { opacity: "0", transform: "translateY(12px)", filter: "blur(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)", filter: "blur(0)" }
        },
        "hero-media": {
          "0%": { opacity: "0", transform: "translateY(24px)", filter: "blur(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)", filter: "blur(0)" }
        }
      },
      animation: {
        shimmer: "shimmer 1.8s infinite",
        "fade-in": "fade-in 0.25s ease-out",
        "hero-rise": "hero-rise 0.5s cubic-bezier(0.22, 1, 0.36, 1) both",
        "hero-media": "hero-media 0.6s cubic-bezier(0.22, 1, 0.36, 1) both"
      }
    }
  },
  plugins: []
};
