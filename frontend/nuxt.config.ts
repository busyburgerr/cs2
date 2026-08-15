export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: false },
  devServer: { host: '127.0.0.1', port: 3000 },
  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt'],
  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:4000/api',
      currency: process.env.NUXT_PUBLIC_CURRENCY || 'USD',
    },
  },

  app: {
    head: {
      htmlAttrs: { lang: 'ru' },
      title: 'CS2 Cases — открытие кейсов',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#0a0b0f' },
        {
          name: 'description',
          content: 'Открытие кейсов CS2 с проверяемой честностью (provably fair).',
        },
        { property: 'og:title', content: 'CS2 Cases' },
        {
          property: 'og:description',
          content: 'Кейсы CS2 с публичными шансами и проверяемым результатом каждого открытия.',
        },
        { property: 'og:type', content: 'website' },
      ],
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    },
  },
})
