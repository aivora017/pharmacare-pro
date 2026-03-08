/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { 50:"#eff6ff", 100:"#dbeafe", 500:"#3b82f6", 600:"#2563eb", 700:"#1d4ed8", 900:"#1e3a8a" },
        success: { DEFAULT:"#16a34a", light:"#dcfce7" },
        warning: { DEFAULT:"#d97706", light:"#fef3c7" },
        danger:  { DEFAULT:"#dc2626", light:"#fee2e2" },
      },
      spacing: { touch: "44px" },
      minHeight: { touch: "44px" },
    }
  },
  plugins: [require("tailwindcss-animate")],
};
