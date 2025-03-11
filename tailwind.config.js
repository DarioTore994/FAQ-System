
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./views/**/*.html", "./public/**/*.js"],
  theme: {
    extend: {
      colors: {
        'primary-black': '#ffffff',
        'accent-yellow': '#2b6cb0',
        'dark-gray': '#f5f7fa',
      }
    }
  },
  plugins: [],
}
