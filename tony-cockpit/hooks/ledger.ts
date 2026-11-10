// ledger 解析与终端宽度工具：纯函数，测试直接导入

// 支持 `- [ ]` / `* [ ]` / `1. [ ]` / `1) [ ]`；标记：空格=未做，~=部分完成（算未完成），
// x/X=完成，!=阻塞/待人工（单独计数），-=跳过（不计）
const ITEM = /^\s*(?:[-*+]|\d+[.)])\s+\[([ xX~!\-])\]\s*(.*)$/
const FENCE = /^\s*(`{3,}|~{3,})/

export type Parsed = { done: number; total: number; open: string[]; partial: string[]; blocked: string[] }

// 代码围栏里的示例任务不算
export function parseLedger(md: string): Parsed {
  let done = 0
  const open: string[] = []
  const partial: string[] = []
  const blocked: string[] = []
  let fence = ''
  for (const line of md.split('\n')) {
    const f = FENCE.exec(line)
    if (f) {
      const mark = f[1] ?? ''
      if (!fence) fence = mark
      else if (mark[0] === fence[0] && mark.length >= fence.length && !line.slice(f[0].length).trim()) fence = ''
      continue
    }
    if (fence) continue
    const m = ITEM.exec(line)
    if (!m) continue
    const mark = m[1]
    const text = (m[2] ?? '').trim()
    if (mark === ' ' || mark === '~') {
      open.push(text)
      if (mark === '~') partial.push(text)
    }
    else if (mark === '!') blocked.push(text)
    else if (mark === 'x' || mark === 'X') done += 1
  }
  return { done, total: done + open.length + blocked.length, open, partial, blocked }
}

// 20261002-storage-cleanup-todo.md → storage-cleanup
export function ledgerName(file: string): string {
  return file.replace(/-todo\.md$/, '').replace(/^\d{8}-/, '')
}

// 终端格宽：组合符 / 零宽 / 变体选择符 0 格；CJK、全角、emoji 2 格
function cellsOf(c: number): number {
  if (
    (c >= 0x0300 && c <= 0x036f) ||
    (c >= 0x200b && c <= 0x200f) ||
    (c >= 0xfe00 && c <= 0xfe0f) ||
    (c >= 0x1f3fb && c <= 0x1f3ff) ||
    (c >= 0xe0100 && c <= 0xe01ef)
  ) {
    return 0
  }
  if (
    (c >= 0x1100 && c <= 0x115f) ||
    (c >= 0x2e80 && c <= 0xa4cf) ||
    (c >= 0xac00 && c <= 0xd7a3) ||
    (c >= 0xf900 && c <= 0xfaff) ||
    (c >= 0xfe30 && c <= 0xfe4f) ||
    (c >= 0xff00 && c <= 0xff60) ||
    (c >= 0xffe0 && c <= 0xffe6) ||
    (c >= 0x1f300 && c <= 0x1faff) ||
    (c >= 0x20000 && c <= 0x3fffd)
  ) {
    return 2
  }
  return 1
}

// 按码点走；ZWJ 连接的 emoji 序列只算第一个字形
function* glyphs(s: string): Generator<[string, number]> {
  let joined = false
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0
    if (c === 0x200d) {
      joined = true
      yield [ch, 0]
      continue
    }
    yield [ch, joined ? 0 : cellsOf(c)]
    joined = false
  }
}

export function cells(s: string): number {
  let n = 0
  for (const [, w] of glyphs(s)) n += w
  return n
}

export function clip(s: string, max: number): string {
  if (max <= 0) return ''
  if (cells(s) <= max) return s
  let out = ''
  let n = 0
  for (const [ch, w] of glyphs(s)) {
    if (n + w > max - 1) break
    out += ch
    n += w
  }
  return out + '…'
}
