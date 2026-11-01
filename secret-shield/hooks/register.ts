import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { ShieldStats } from '../types'
import { redactBlocks, TOOL_DOORS, type Block } from './redact.ts'

// 存在 host 的 $.state 里，热重载不丢
const stats = atom({ plugin: 'secret-shield', key: 'stats' } as const, {
  isOff: false,
  hits: 0,
  kinds: [],
} as ShieldStats)

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await $.command.register({
      name: 'secret-shield',
      description: '工具输出凭据遮蔽：on / off / status（仅本会话）',
    })
    return result
  })

  on('command.run', { command: 'secret-shield' }, async ($, e) => {
    const arg = String(e.args ?? '').trim().toLowerCase()
    if (arg === 'off' || arg === 'on') {
      await update($, stats, s => ({ ...s, isOff: arg === 'off' }))
    }
    const now = await read($, stats)
    const state = now.isOff ? '已关闭（本会话工具输出不再遮蔽）' : '开启'
    const kinds = now.kinds.length ? `，类型：${now.kinds.join(', ')}` : ''
    return { text: `secret-shield ${state}；本会话累计遮蔽 ${now.hits} 处${kinds}` }
  })

  // 安全组件按 fail-closed 排序：先把遮蔽后的行交给 next 落盘，再 best-effort 记账和提示；
  // 读开关失败按"开启"处理，记账/提示失败都不影响已提交的遮蔽结果
  on('session.append', async ($, e, next) => {
    if (!TOOL_DOORS.has(e.door)) return next(e)
    const isOff = await read($, stats).then(s => s.isOff, () => false)
    if (isOff) return next(e)

    const { out, hits, kinds } = redactBlocks(e.message.content as unknown as Block[])
    if (hits === 0) return next(e)

    const stored = await next({ ...e, message: { ...e.message, content: out as typeof e.message.content } })

    try {
      await update($, stats, s => ({
        ...s,
        hits: s.hits + hits,
        kinds: [...new Set([...s.kinds, ...kinds])],
      }))
      const tool = e.origin && 'tool' in e.origin ? String(e.origin.tool) : '工具'
      $.ui.toast(`secret-shield：${tool} 输出里遮蔽了 ${hits} 处凭据（${kinds.join(', ')}）`)
    } catch {
      // 记账失败不影响遮蔽
    }
    return stored
  })
}
