import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { LedgerSummary } from '../types'
import { clip, ledgerName, parseLedger } from './ledger.ts'

// 都放 host 的 $.state：热重载不丢，写入即重绘读者
const here = atom({ plugin: 'tony-cockpit', key: 'here' } as const, [] as LedgerSummary[])
const all = atom({ plugin: 'tony-cockpit', key: 'all' } as const, [] as LedgerSummary[])
const isCtxAlarmed = atom({ plugin: 'tony-cockpit', key: 'isCtxAlarmed' } as const, false)

const PANE = 'tony-ledger'
const DAY = 24 * 60 * 60 * 1000
const OPEN_PER_DIR = 8
const MAX_FUTURE_MS = 60 * 1000
const CTX_ALARM = 80
const CTX_RESET = 60

// 解析缓存：path → mtime+size 未变就复用；模块变量，热重载后重建一次即可
const parsedCache = new Map<string, { stamp: string; parsed: ReturnType<typeof parseLedger> }>()

// 先按 mtime 排序遍历全部候选、解析后再对"未完成"限量（只截文件会漏掉更早的未完成 ledger）
async function scan($: EngineInterface, dir: string, maxAgeMs: number): Promise<LedgerSummary[]> {
  const entries = await $.fs.list(dir).catch(() => [])
  const now = Date.now()
  const candidates = entries
    .filter(f => {
      const age = now - f.mtimeMs
      return f.kind === 'file' && f.name.endsWith('-todo.md') && age >= -MAX_FUTURE_MS && age <= maxAgeMs
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs)

  const out: LedgerSummary[] = []
  for (const f of candidates) {
    if (out.length >= OPEN_PER_DIR) break
    const path = `${dir}/${f.name}`
    const stamp = `${f.mtimeMs}:${f.size}`
    let parsed = parsedCache.get(path)?.stamp === stamp ? parsedCache.get(path)?.parsed : undefined
    if (!parsed) {
      const md = await $.fs.read(path).catch(() => '')
      parsed = parseLedger(typeof md === 'string' ? md : '')
      parsedCache.set(path, { stamp, parsed })
    }
    if (parsed.total > 0 && parsed.open.length + parsed.blocked.length > 0) {
      out.push({ path, name: ledgerName(f.name), done: parsed.done, total: parsed.total, open: parsed.open, partial: parsed.partial, blocked: parsed.blocked, mtimeMs: f.mtimeMs })
    }
  }
  return out
}

// 同一时刻的多次刷新合并成一次
let inFlight: Promise<void> | undefined

function refresh($: EngineInterface): Promise<void> {
  inFlight ??= doRefresh($).finally(() => {
    inFlight = undefined
  })
  return inFlight
}

async function doRefresh($: EngineInterface) {
  const cwd = await $.session.cwd()
  const home = await $.env.get('HOME')
  const mine = await scan($, `${cwd}/.omc/plans`, 14 * DAY)
  const global = home && home !== cwd ? await scan($, `${home}/.omc/plans`, 7 * DAY) : []
  const seen = new Set(mine.map(l => l.path))
  const merged = [...mine, ...global.filter(l => !seen.has(l.path))]

  // 内容没变就不写，避免无谓重绘
  if (JSON.stringify(await read($, here)) !== JSON.stringify(mine)) await update($, here, () => mine)
  if (JSON.stringify(await read($, all)) !== JSON.stringify(merged)) await update($, all, () => merged)
}

async function checkContext($: EngineInterface) {
  const { context } = await $.session.usage()
  const pct = context?.percent
  if (typeof pct !== 'number') return
  const isAlarmed = await read($, isCtxAlarmed)
  if (pct >= CTX_ALARM && !isAlarmed) {
    await update($, isCtxAlarmed, () => true)
    $.ui.toast(`上下文已用 ${pct}%：compact 前先落盘改动文件清单、ledger 路径和验证命令`, { timeoutMs: 8000 })
  } else if (pct < CTX_RESET && isAlarmed) {
    await update($, isCtxAlarmed, () => false)
  }
}

const MD_BUDGET = 9500

// 按整块拼接，超出预算就停在块边界，不在 Markdown 语法中间切断
function paneMarkdown(list: LedgerSummary[]): string {
  if (list.length === 0) return '_本项目 14 天内、~/.omc/plans 7 天内都没有未完成的 ledger。_'
  let text = ''
  let shown = 0
  for (const l of list) {
    const row = (mark: string, t: string) => `${mark} ${clip(t, 90).replace(/^(\d+)[.)]\s*/, '$1、')}  `
    const open = l.open ?? []
    const partial = new Set(l.partial ?? [])
    const blockedAll = l.blocked ?? []
    // ☐ 未做 / ◐ 部分完成 / ⚠ 阻塞
    const items = open.slice(0, 10).map(t => row(partial.has(t) ? '◐' : '☐', t))
    const more = open.length > 10 ? [`…还有 ${open.length - 10} 项  `] : []
    const blocked = blockedAll.slice(0, 5).map(t => row('⚠', t))
    const moreBlocked = blockedAll.length > 5 ? [`…另有 ${blockedAll.length - 5} 项阻塞  `] : []
    const head = `### ${clip(l.name, 60)}  ${l.done}/${l.total}${blockedAll.length ? ` · 阻 ${blockedAll.length}` : ''}`
    // 每行末尾两个空格 = Markdown 硬换行，避免被当成列表或合并成段落
    const block = [head, `\`${l.path}\``, '', ...items, ...more, ...blocked, ...moreBlocked].join('\n')
    const next = text ? `${text}\n\n${block}` : block
    if (next.length > MD_BUDGET) break
    text = next
    shown += 1
  }
  return shown < list.length ? `${text}\n\n_…另有 ${list.length - shown} 个 ledger 未显示_` : text
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await $.command.register({
      name: 'ledger',
      description: '在侧栏列出未完成的 ledger(本项目 + ~/.omc/plans 近 7 天)',
    })
    await refresh($)
    return result
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (!e.agentId) {
      await refresh($)
      await checkContext($)
    }
    return result
  })

  // 改 ledger 文件时即时刷新进度带
  on('tool.call', { tool: 'Edit' }, async ($, e, next) => {
    const result = await next(e)
    if (typeof e.file_path === 'string' && e.file_path.endsWith('-todo.md')) await refresh($)
    return result
  })
  on('tool.call', { tool: 'Write' }, async ($, e, next) => {
    const result = await next(e)
    if (typeof e.file_path === 'string' && e.file_path.endsWith('-todo.md')) await refresh($)
    return result
  })

  on('command.run', { command: 'ledger' }, async $ => {
    await refresh($)
    const list = await read($, all)
    await $.ui.open({ id: PANE, title: 'Ledger', focus: true, closeOnEscape: true })
    const open = list.reduce((n, l) => n + l.open.length + l.blocked.length, 0)
    return { text: list.length ? `${list.length} 个未完成 ledger，共 ${open} 项待办` : '没有未完成的 ledger' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Markdown } = $.ui.resolve(e)
    const list = await read($, all)
    return (
      <Box flexDirection="column" paddingX={1}>
        <Markdown text={paneMarkdown(list)} />
      </Box>
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const list = await read($, here)
    const raw = list[0]
    if (e.props.hasSurvey || !raw) return next(e)
    // 热重载后旧 state 可能缺新字段
    const top = { ...raw, open: raw.open ?? [], partial: raw.partial ?? [], blocked: raw.blocked ?? [] }

    const { Box, Text } = $.ui.resolve(e)
    // 宽度交给引擎布局：首尾固定不收缩，中间"下一项"可伸缩并由 truncate-end 裁剪
    // 引擎在带右端画自己的控件（约 3 格），留 4 格
    const width = Math.max(0, e.props.bodyColumns - 4)
    const head = `▤ ${clip(top.name, Math.max(8, Math.floor(width / 3)))} `
    const count = `${top.done}/${top.total}`
    const blocked = top.blocked.length > 0 ? ` 阻${top.blocked.length}` : ''
    const extra = width < 48 ? '' : list.length > 1 ? `  +${list.length - 1} · /ledger` : '  · /ledger'
    const nextItem = width >= 48 ? (top.open[0] ? ` › 下一项 ${top.open[0]}` : ` › 全部阻塞：${top.blocked[0] ?? ''}`) : ''

    return (
      <Box flexDirection="row" width={width} paddingX={1} overflow="hidden">
        <Box flexShrink={0}>
          <Text color="cyan" bold>{head}</Text>
          <Text>{count}</Text>
          <Text color="yellow">{blocked}</Text>
        </Box>
        <Box flexGrow={1} flexShrink={1} overflow="hidden">
          <Text dimColor wrap="truncate-end">{nextItem}</Text>
        </Box>
        <Box flexShrink={0}>
          <Text dimColor>{extra}</Text>
        </Box>
      </Box>
    )
  })
}
