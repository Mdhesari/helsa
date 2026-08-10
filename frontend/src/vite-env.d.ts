/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Absolute API origin, e.g. "https://helsa.example.com". Empty on the web
   * (same-origin nginx proxy); required for the native iOS build, whose UI is
   * served from capacitor://localhost.
   */
  readonly VITE_API_ORIGIN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
