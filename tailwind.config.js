
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./views/**/*.html", "./public/**/*.js"],
  theme: {
    extend: {
      colors: {
        'primary-black': '#0a0a0a',
        'accent-yellow': '#FFD700',
        'dark-gray': '#1a1a1a',
      }
    }
  },
  plugins: [],
}
