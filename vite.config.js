import { defineConfig } from 'vite'
import { sentryVitePlugin } from '@sentry/vite-plugin'

export default defineConfig({
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    chunkSizeWarningLimit: 1000,
    sourcemap: true, // required for Sentry to map minified stack traces back to source
  },
  define: {
    // Matches the release name the plugin below uploads source maps under —
    // without this, Sentry.init()'s release tag can drift from what actually
    // has maps attached, and stack traces stay unmapped even after upload.
    __SENTRY_RELEASE__: JSON.stringify(process.env.VERCEL_GIT_COMMIT_SHA || 'dev'),
  },
  plugins: [
    // Only uploads (and requires an auth token) when SENTRY_AUTH_TOKEN is set —
    // safe to leave in for local/PR builds where it's absent, it just no-ops.
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      release: { name: process.env.VERCEL_GIT_COMMIT_SHA || undefined },
      disable: !process.env.SENTRY_AUTH_TOKEN,
    }),
  ],
})
