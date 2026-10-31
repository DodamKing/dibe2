/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [],
  theme: {
    extend: {
      colors: {
        // 바탕(0) → 헤더·플레이어(1) → 카드·빈 커버(2). 순회색 대신 보라 기운을 아주 살짝
        surface: { 0: '#0f0d13', 1: '#17141d', 2: '#231f2b' },
      },
      fontFamily: {
        sans: ['Pretendard', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

