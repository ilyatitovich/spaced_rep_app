/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />
/// <reference types="vite-plugin-pwa/react" />

declare module 'sql.js/dist/sql-asm.js' {
  import type { InitSqlJsStatic } from 'sql.js'
  const initSqlJs: InitSqlJsStatic
  export default initSqlJs
}

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_GOOGLE_CLIENT_ID: string
  readonly VITE_TURNSTILE_SITE_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
