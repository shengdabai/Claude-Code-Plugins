import { describe, expect, mock, test } from 'claude-code/testing'

import { cells, clip, ledgerName, parseLedger } from '../hooks/ledger.ts'

const LEDGER = [
  '# 2026-10-02 示例 ledger',
  '- [x] 1. 调研',
  '- [x] 2. 写 secret-shield',
  '- [ ] 3. 写 tony-cockpit 进度带',
  '- [ ] 4. Codex 审核',
  '  * [X] 子项也算完成',
  '普通段落 - [ ] 不在行首不算',
].join('\n')

describe('ledger 解析', () => {
  test('数完成/未完成，保留待办文字', async () => {
    const p = parseLedger(LEDGER)
    expect(p.done).toBe(3)
    expect(p.total).toBe(5)
    expect(p.open).toEqual(['3. 写 tony-cockpit 进度带', '4. Codex 审核'])
  })

  test('编号项、[~] 部分完成、[!] 阻塞、[-] 跳过', async () => {
    const p = parseLedger(['1. [x] 核实', '2) [ ] 备份', '- [~] 部分', '- [!] 等 Tony 放行', '- [-] 跳过', '+ [X] 加号也行'].join('\n'))
    expect(p.done).toBe(2)
    expect(p.open).toEqual(['备份', '部分'])
    expect(p.partial).toEqual(['部分'])
    expect(p.blocked).toEqual(['等 Tony 放行'])
    expect(p.total).toBe(5)
  })

  test('文件名去日期前缀和 -todo.md', async () => {
    expect(ledgerName('20261002-storage-cleanup-todo.md')).toBe('storage-cleanup')
    expect(ledgerName('xiaolai-fiction-skill-todo.md')).toBe('xiaolai-fiction-skill')
  })

  test('CJK 按两格计宽，裁剪不超宽', async () => {
    expect(cells('ab中文')).toBe(6)
    const c = clip('一二三四五六七八九十', 9)
    expect(cells(c) <= 9).toBe(true)
    expect(c.endsWith('…')).toBe(true)
  })
})

describe('Codex 审核回归（解析）', () => {
  test('代码围栏里的示例任务不计数', async () => {
    const p = parseLedger(['- [ ] 真任务', '```md', '- [ ] 示例', '- [x] 示例', '```', '~~~', '- [ ] 也是示例', '~~~'].join('\n'))
    expect(p.total).toBe(1)
    expect(p.open).toEqual(['真任务'])
  })

  test('emoji / 组合符 / ZWJ 序列按终端格宽计算', async () => {
    expect(cells('🙂')).toBe(2)
    expect(cells('e\u0301')).toBe(1)
    expect(cells('👨\u200d👩\u200d👧')).toBe(2)
    expect(cells('𠀀')).toBe(2)
  })
})

function stubWorld(on: any, files: Record<string, string>, percent = 30, mtimeOf?: (name: string, now: number) => number) {
  const now = Date.now()
  on('session.start', () => ({ cwd: '/work' }))
  on('command.register', () => ({ value: undefined }) as any)
  on('session.cwd', () => ({ value: '/work' }))
  mock.env(on, { HOME: '/home/tony' })
  on('fs.list', ($: any, e: any) => {
    const dir = String(e.path)
    const names = Object.keys(files).filter(p => p.startsWith(dir + '/')).map(p => p.slice(dir.length + 1))
    return { value: names.map(name => ({ name, kind: 'file', size: 1, mtimeMs: mtimeOf ? mtimeOf(name, now) : now, isLink: false })) }
  })
  on('fs.read', ($: any, e: any) => ({ value: files[String(e.path)] ?? '' }))
  on('session.usage', () => ({ value: { startedAt: 0, rateLimits: [], context: { tokens: percent * 2000, window: 200_000, percent } } }))
}

const BAND = {
  plugin: 'tony-cockpit',
  surface: 'terminal',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 120 },
} as const

describe('进度带', () => {
  test('有未完成 ledger 时显示名字、进度和下一项', async ($, on) => {
    stubWorld(on, { '/work/.omc/plans/20261002-mods-todo.md': LEDGER })
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' } as any)
    const ui = await $.ui.mount(BAND as any)
    expect(await ui.find({ type: 'Text', text: /mods/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /3\/5/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /下一项 3\. 写 tony-cockpit/ })).toBeDefined()
    await ui.unmount()
  })

  test('全部完成或没有 ledger 时让位', async ($, on) => {
    stubWorld(on, { '/work/.omc/plans/done-todo.md': '- [x] a\n- [x] b' })
    on('ui.render', () => ({ type: 'Text', props: {}, children: ['engine-own'] }))
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' } as any)
    const ui = await $.ui.mount(BAND as any)
    expect(await ui.find({ type: 'Text', text: /engine-own/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /done/ })).toBeUndefined()
    await ui.unmount()
  })
})

describe('Codex 审核回归（扫描）', () => {
  test('最新 8 个都已完成时，仍能找到第 9 个未完成 ledger', async ($, on) => {
    const files: Record<string, string> = {}
    for (let i = 0; i < 8; i++) files[`/work/.omc/plans/done${i}-todo.md`] = '- [x] ok'
    files['/work/.omc/plans/old-open-todo.md'] = '- [ ] 还没做'
    // 让未完成的那个最旧
    stubWorld(on, files, 30, (name, now) => (name.startsWith('old') ? now - 1000 : now))
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' } as any)
    const ui = await $.ui.mount(BAND as any)
    expect(await ui.find({ type: 'Text', text: /old-open/ })).toBeDefined()
    await ui.unmount()
  })

  test('窄终端不超宽也不报错', async ($, on) => {
    stubWorld(on, { '/work/.omc/plans/20261002-一个特别特别长的中文名字的账本-todo.md': LEDGER })
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' } as any)
    const ui = await $.ui.mount({ ...BAND, props: { ...BAND.props, bodyColumns: 18 } } as any)
    expect(await ui.find({ type: 'Text', text: /3\/5/ })).toBeDefined()
    await ui.unmount()
  })
})

describe('阻塞场景', () => {
  test('纯阻塞 ledger 仍显示，带上 0/N、阻N 和"全部阻塞"', async ($, on) => {
    const md = Array.from({ length: 6 }, (_, i) => `- [!] 阻塞项${i + 1}`).join('\n')
    stubWorld(on, { '/work/.omc/plans/blocked-todo.md': md })
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' } as any)
    const ui = await $.ui.mount(BAND as any)
    expect(await ui.find({ type: 'Text', text: /0\/6/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /阻6/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /全部阻塞：阻塞项1/ })).toBeDefined()
    await ui.unmount()
  })

  test('侧栏阻塞总数用完整长度，超过 5 条有提示', async ($, on) => {
    const md = Array.from({ length: 6 }, (_, i) => `- [!] 阻塞项${i + 1}`).join('\n') + '\n- [~] 半成品'
    stubWorld(on, { '/work/.omc/plans/blocked-todo.md': md })
    on('ui.open', () => ({ value: { isPlaced: true } }))
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' } as any)
    await $.command.run({ command: 'ledger', args: '' } as any)
    const ui = await $.ui.mount({ plugin: 'tony-cockpit', surface: 'terminal', component: 'Pane', requestId: 'tony-ledger', props: { title: 'Ledger', bodyColumns: 100 } } as any)
    const md1 = await ui.find({ type: 'Markdown' })
    const text = String((md1 as any)?.props?.text ?? (md1 as any)?.text ?? '')
    expect(text).toContain('阻 6')
    expect(text).toContain('另有 1 项阻塞')
    expect(text).toContain('◐ 半成品')
    await ui.unmount()
  })
})

describe('/ledger 与上下文提醒', () => {
  test('/ledger 合并本项目与全局 ledger 并打开侧栏', async ($, on) => {
    const opened: string[] = []
    stubWorld(on, {
      '/work/.omc/plans/a-todo.md': LEDGER,
      '/home/tony/.omc/plans/b-todo.md': '- [ ] 全局待办',
    })
    on('ui.open', ($: any, e: any) => {
      opened.push(e.id)
      return { value: { isPlaced: true } }
    })
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' } as any)
    const answer = await $.command.run({ command: 'ledger', args: '' } as any)
    expect(answer.text).toBe('2 个未完成 ledger，共 3 项待办')
    expect(opened).toEqual(['tony-ledger'])
  })

  test('上下文到 80% 只提醒一次', async ($, on) => {
    const toasts: string[] = []
    stubWorld(on, {}, 85)
    on('ui.toast', ($: any, e: any) => {
      toasts.push(e.text)
      return { value: undefined }
    })
    on('turn.complete', () => ({ text: '' }))
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' } as any)
    const turn = { turnId: 't', answer: 'ok', durationMs: 1, isAborted: false, usage: null } as any
    await $.turn.complete(turn)
    await $.turn.complete(turn)
    expect(toasts.length).toBe(1)
    expect(toasts[0]).toContain('上下文已用 85%')
  })
})
