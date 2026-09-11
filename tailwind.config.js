/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        stride: {
          bg: "#E8ECF4",
          surface: "#E8ECF4",
          ink: "#1E2633",
          muted: "#667085",
          accent: "#6C7CFF",
          accentSoft: "#DDE2FF"
        }
      }
    }
  },
  plugins: []
};
