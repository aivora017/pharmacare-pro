/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html","./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { 50:"#eff6ff",100:"#dbeafe",200:"#bfdbfe",500:"#3b82f6",600:"#2563eb",700:"#1d4ed8",900:"#1e3a8a" },
      },
      minHeight: { touch: "44px" },
      boxShadow: { card: "0 1px 3px 0 rgb(0 0 0/0.06),0 1px 2px -1px rgb(0 0 0/0.06)" },
      animation: { "fade-in":"fadeIn .15s ease-out","slide-up":"slideUp .2s ease-out" },
      keyframes: {
        fadeIn:  { "0%":{ opacity:"0" }, "100%":{ opacity:"1" } },
        slideUp: { "0%":{ opacity:"0",transform:"translateY(6px)" }, "100%":{ opacity:"1",transform:"translateY(0)" } },
      },
    },
  },
  plugins: [],
}
