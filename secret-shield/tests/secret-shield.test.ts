import { describe, expect, test } from 'claude-code/testing'

import { redact, redactBlocks, TOOL_DOORS } from '../hooks/redact.ts'

// 假凭据一律拼接生成，源码里不出现完整字面量
const FAKE = {
  anthropic: 'sk-' + 'ant-api03-' + 'Ab3dEf6hIj9kLm2nOp5qRs8tUv1wXy4z',
  github: 'gh' + 'p_' + 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8',
  aws: 'AK' + 'IA' + 'ABCDEFGH12345678',
  pem: '-'.repeat(5) + 'BEGIN RSA PRIVATE KEY' + '-'.repeat(5) + '\nMIIEabc\n' + '-'.repeat(5) + 'END RSA PRIVATE KEY' + '-'.repeat(5),
}

describe('redact', () => {
  test('遮蔽常见凭据并报告类型', async () => {
    const r = redact(`a ${FAKE.anthropic} b ${FAKE.github} c ${FAKE.aws}\n${FAKE.pem}`)
    expect(r.hits).toBe(4)
    expect(r.text).not.toContain(FAKE.anthropic)
    expect(r.text).not.toContain(FAKE.github)
    expect(r.text).not.toContain('MIIEabc')
    expect(r.kinds).toContain('anthropic')
    expect(r.text).toContain('原值非空')
  })

  test('env 行只遮值、保留变量名；占位符和变量引用不动', async () => {
    const env = [
      'export OPENAI_API_KEY=' + 'Zx9' + 'q'.repeat(20),
      'GITHUB_TOKEN=YOUR_KEY_HERE',
      'DB_PASSWORD=${DB_PASSWORD_FROM_VAULT}',
      'MAX_TOKENS=4096',
    ].join('\n')
    const r = redact(env)
    expect(r.hits).toBe(1)
    expect(r.text).toContain('export OPENAI_API_KEY=[REDACTED:env-secret')
    expect(r.text).toContain('GITHUB_TOKEN=YOUR_KEY_HERE')
    expect(r.text).toContain('${DB_PASSWORD_FROM_VAULT}')
  })

  test('普通代码不误伤', async () => {
    const code = [
      'const apiKey = getKeyFromVault(config)',
      'git checkout sk-feature-branch-with-a-very-long-name-here',
      'tokenizer.encode("hello world")',
      'postgres://user@localhost/db',
    ].join('\n')
    const r = redact(code)
    expect(r.hits).toBe(0)
    expect(r.text).toBe(code)
  })

  test('URL 内嵌密码与 Bearer 只遮值', async () => {
    const r = redact('postgres://admin:S3cretPass99@db.local/x\nAuthorization: Bearer ' + 'abcDEF123'.repeat(4))
    expect(r.hits).toBe(2)
    expect(r.text).toContain('postgres://admin:[REDACTED:url-password')
    expect(r.text).toContain('Bearer [REDACTED:bearer')
  })
})

describe('Codex 审核回归', () => {
  test('变量名仅含 KEY 子串、公钥指纹、路径里的 sk- 段都不误伤', async () => {
    const text = [
      'MONKEY_COUNT=Build20261001',
      'PUBLIC_KEY_FINGERPRINT=' + 'a1b2c3d4'.repeat(5),
      'docs/sk-' + 'FEATURE20261001' + 'A'.repeat(20) + '/notes',
      'ACCESS_TOKEN_EXPIRES_IN=3600seconds1',
    ].join('\n')
    const r = redact(text)
    expect(r.hits).toBe(0)
    expect(r.text).toBe(text)
  })

  test('补齐 JSON 字段、Basic、GitLab、Hugging Face', async () => {
    const r = redact([
      '{"access_token":"' + 'Ab12'.repeat(5) + '"}',
      'Authorization: Basic ' + 'dXNlcjpwYXNzd29yZDEyMw==',
      'gl' + 'pat-' + 'Ab1Cd2Ef3Gh4Ij5Kl6Mn',
      'h' + 'f_' + 'Ab1Cd2Ef3Gh4Ij5Kl6Mn7Op8Qr9St0Uv1Wx2',
    ].join('\n'))
    expect(r.hits).toBe(4)
    expect(r.kinds).toContain('json-secret')
    expect(r.kinds).toContain('basic-auth')
    expect(r.kinds).toContain('gitlab')
    expect(r.kinds).toContain('huggingface')
    expect(r.text).toContain('"access_token":"[REDACTED:json-secret')
  })

  test('对抗输入保持线性（不再二次退化）', async () => {
    const heads = ('-'.repeat(5) + 'BEGIN RSA PRIVATE KEY' + '-'.repeat(5) + '\n').repeat(20000)
    const sks = ('s' + 'k-aaaa-').repeat(40000)
    const t0 = Date.now()
    redact(heads)
    redact(sks)
    expect(Date.now() - t0 < 500).toBe(true)
  })

  test('同一行堆满 PEM 头、末尾才换行也保持线性', async () => {
    const oneLine = ('-'.repeat(5) + 'BEGIN RSA PRIVATE KEY' + '-'.repeat(5) + ' ').repeat(160000) + '\n'
    const t0 = Date.now()
    redact(oneLine)
    expect(Date.now() - t0 < 500).toBe(true)
  })

  test('只改写工具输出的 door', async () => {
    expect(TOOL_DOORS.has('tool-result')).toBe(true)
    expect(TOOL_DOORS.has('tool-message')).toBe(true)
    for (const door of ['prompt', 'response', 'note', 'notice', 'compaction']) {
      expect(TOOL_DOORS.has(door)).toBe(false)
    }
  })
})

describe('redactBlocks', () => {
  test('改写 tool_result 字符串、数组内容和 text 块，其余块原样', async () => {
    const blocks = [
      { type: 'tool_result', content: `key=${FAKE.anthropic}` },
      { type: 'tool_result', content: [{ type: 'text', text: FAKE.github }, { type: 'image', source: {} }] },
      { type: 'text', text: 'nothing here' },
      { type: 'tool_use', input: { x: FAKE.aws } },
    ]
    const r = redactBlocks(blocks)
    expect(r.hits).toBe(2)
    expect(JSON.stringify(r.out[0])).not.toContain(FAKE.anthropic)
    expect(JSON.stringify(r.out[1])).not.toContain(FAKE.github)
    expect(JSON.stringify(r.out[1])).toContain('image')
    expect(r.out[2]).toEqual(blocks[2])
    expect(r.out[3]).toBe(blocks[3])
  })
})

describe('/secret-shield 命令', () => {
  test('status / off / on 切换本会话开关', async ($, on) => {
    on('session.start', () => ({ cwd: '/work' }))
    on('command.register', () => ({ value: undefined }) as any)
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' } as any)

    expect((await $.command.run({ command: 'secret-shield', args: '' } as any)).text).toContain('开启')
    expect((await $.command.run({ command: 'secret-shield', args: 'off' } as any)).text).toContain('已关闭')
    expect((await $.command.run({ command: 'secret-shield', args: 'on' } as any)).text).toContain('累计遮蔽 0 处')
  })
})
