export type LedgerSummary = {
  path: string
  name: string
  done: number
  total: number
  open: string[]
  partial: string[]
  blocked: string[]
  mtimeMs: number
}

declare module 'claude-code' {
  interface PluginState {
    'tony-cockpit': {
      here: LedgerSummary[]
      all: LedgerSummary[]
      isCtxAlarmed: boolean
    }
  }
}
