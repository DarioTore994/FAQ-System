
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./views/**/*.html", "./public/**/*.js"],
  theme: {
    extend: {
      colors: {
        'primary-black': '#ffffff',
        'accent-yellow': '#2b6cb0',
        'accent-dark': '#1d4ed8',
        'accent-light': '#60a5fa',
        'dark-gray': '#000000',
        'text-primary': '#0d2b45',
        'text-secondary': '#1e4976',
      }
    }
  },
  plugins: [],
}
