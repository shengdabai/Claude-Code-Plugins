export type ShieldStats = { isOff: boolean; hits: number; kinds: string[] }

declare module 'claude-code' {
  interface PluginState {
    'secret-shield': { stats: ShieldStats }
  }
}
