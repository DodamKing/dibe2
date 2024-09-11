require('dotenv').config()
import { sendSlackMessage } from './server/utils/slackNotifier'

export default {
  // Global page headers: https://go.nuxtjs.dev/config-head
  head: {
    title: 'dibe2',
    htmlAttrs: {
      lang: 'en',
    },
    meta: [
      { charset: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { hid: 'description', name: 'description', content: '' },
      { name: 'format-detection', content: 'telephone=no' },
    ],
    link: [{ rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }],
  },

  // Global CSS: https://go.nuxtjs.dev/config-css
  css: [],

  // Plugins to run before rendering page: https://go.nuxtjs.dev/config-plugins
  plugins: [
    '~/plugins/error-handler'
  ],

  // Auto import components: https://go.nuxtjs.dev/config-components
  components: true,

  // Modules for dev and build (recommended): https://go.nuxtjs.dev/config-modules
  buildModules: [
    // https://go.nuxtjs.dev/eslint
    '@nuxtjs/eslint-module',
    // https://go.nuxtjs.dev/tailwindcss
    '@nuxtjs/tailwindcss',
  ],

  // Modules: https://go.nuxtjs.dev/config-modules
  modules: [
    // https://go.nuxtjs.dev/axios
    '@nuxtjs/axios',
    '@nuxtjs/tailwindcss',
    '@nuxtjs/toast',
  ],

  // Axios module configuration: https://go.nuxtjs.dev/config-axios
  axios: {
    // Workaround to avoid enforcing hard-coded localhost:3000: https://github.com/nuxt-community/axios-module/issues/308
    baseURL: '/',
    credentials: true
  },

  toast: {
    position: 'top-center',
    duration: 3000
  },

  // Build Configuration: https://go.nuxtjs.dev/config-build
  build: {},

  serverMiddleware: [
    '~/server/middleware/session',
    '~/server/middleware/cron',
    { path: '/api', handler: '~/server/api/index.js' },
  ],

  watchers: {
    webpack: {
      ignored: '/node_modules/',
      poll: 1000
    }
  },

  router: {
    middleware: 'auth'
  },

  server: {
    host: '0.0.0.0'
  },

  hooks: {
    'render:errorMiddleware': (app) => {
      app.use(async (err, req, res, next) => {
        // 서버 사이드 에러 처리 로직
        console.error('서버 에러:', err)
        const formatErrorMessage = (err, req) => {
          const timestamp = new Date().toISOString();
          const stackLines = err.stack.split('\n').slice(0, 3).join('\n');  // 첫 3줄만 포함
        
          return `🚨 *서버 에러 발생*
        - 시간: ${timestamp}
        - URL: ${req.method} ${req.url}
        - 메시지: ${err.message}
        - 스택 (요약):
        \`\`\`
        ${stackLines}
        \`\`\``;
        };
        const errorMessage = formatErrorMessage(err, req);
        sendSlackMessage(errorMessage)
        res.statusCode = 500
        res.end('서버 내부 오류가 발생했습니다.')
      })
    }
  },
}
