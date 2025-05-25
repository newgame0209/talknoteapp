/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./app/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#4F46E5',
          50: '#EBEAFD',
          100: '#D7D5FB',
          200: '#AFABF8',
          300: '#8781F4',
          400: '#5F57F1',
          500: '#4F46E5', // Default
          600: '#2A20D9',
          700: '#211AAB',
          800: '#19137D',
          900: '#100C4F'
        },
        secondary: {
          DEFAULT: '#10B981',
          50: '#E6FAF5',
          100: '#CDF5EB',
          200: '#9BECD6',
          300: '#69E3C2',
          400: '#37DAAD',
          500: '#10B981', // Default
          600: '#0C9269',
          700: '#096C4F',
          800: '#064635',
          900: '#03201B'
        },
        accent: {
          DEFAULT: '#F59E0B',
          50: '#FEF3E2',
          100: '#FDE7C5',
          200: '#FBCF8B',
          300: '#F9B752',
          400: '#F7A018',
          500: '#F59E0B', // Default
          600: '#C27D08',
          700: '#8F5C06',
          800: '#5C3B04',
          900: '#291A02'
        }
      },
      fontFamily: {
        'sans': ['UD-Digi-Kyokasho', 'system-ui', 'sans-serif'],
        'dyslexic': ['OpenDyslexic', 'sans-serif']
      }
    }
  },
  plugins: []
}
