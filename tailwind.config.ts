import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Editorial monochrome — fashion-magazine palette
        ink: { 0: "#0a0a0a", 1: "#262626", 2: "#525252", 3: "#a3a3a3" },
        bg: { 0: "#f0eee9", 1: "#e8e5de", 2: "#dcd8d0" },  // warm off-white / paper tones
        rule: "#cfcac0",
        accent: "#0a0a0a", // accents are pure ink black
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto"],
        display: ["Fraunces", "ui-serif", "Cambria", "Georgia"],
        serif: ["Fraunces", "ui-serif", "Cambria", "Georgia"],
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
export default config;
