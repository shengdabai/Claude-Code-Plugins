// 高置信度凭据规则：宁可漏报也不误伤代码。顺序有意义，先具体后泛化。
// 规则源码里避免出现能被 sync-plugins 预推扫描命中的完整字面量（PEM 头用 -{5} 写）。
// 性能约束：每条规则都必须线性——不用无上限 lookahead，不用跨全文的懒惰匹配。

type Rule = {
  kind: string
  re: RegExp
  // 有前缀组时：m[1] 保留、m[2] 是值
  hasPrefix?: boolean
  // 值的额外校验；返回 false 则原样放过
  accept?: (value: string) => boolean
}

const hasDigitAndLetter = (v: string) => /\d/.test(v) && /[A-Za-z]/.test(v)
const hasUpperAndDigit = (v: string) => /\d/.test(v) && /[A-Z]/.test(v)

// 明显是占位符、变量引用或已遮蔽的值
const PLACEHOLDER = /^(?:your|xxx|<|\*|placeholder|changeme|example|dummy|redacted|\[redacted)/i

export const RULES: Rule[] = [
  { kind: 'anthropic', re: /\bsk-ant-[A-Za-z0-9_-]{24,}/g },
  // 先整段取候选，再在回调里校验大写+数字，避免每个 sk- 起点都向后扫描（O(n²)）
  // 前面是 / . - 或单词字符时不算（路径段、分支名）
  {
    kind: 'openai',
    re: /(?<![\w/.-])sk-(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{32,}/g,
    accept: hasUpperAndDigit,
  },
  { kind: 'github', re: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{50,})/g },
  { kind: 'gitlab', re: /\bglpat-[A-Za-z0-9_-]{20,}/g },
  { kind: 'npm', re: /\bnpm_[A-Za-z0-9]{36}\b/g },
  { kind: 'pypi', re: /\bpypi-AgEIcHlwaS5vcmc[A-Za-z0-9_-]{50,}/g },
  { kind: 'huggingface', re: /\bhf_[A-Za-z0-9]{34,}\b/g },
  { kind: 'sendgrid', re: /\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}\b/g },
  { kind: 'aws-key-id', re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { kind: 'slack', re: /\bxox[abprs]-[A-Za-z0-9-]{10,}/g },
  { kind: 'google', re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { kind: 'stripe', re: /\b[rs]k_live_[0-9A-Za-z]{24,}/g },
  { kind: 'jwt', re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },
  // 以下只替换值，保留前缀
  { kind: 'bearer', re: /(\bBearer\s+)([A-Za-z0-9._~+/-]{24,}=*)/g, hasPrefix: true, accept: hasDigitAndLetter },
  { kind: 'basic-auth', re: /(\bBasic\s+)([A-Za-z0-9+/]{16,}={0,2})/g, hasPrefix: true, accept: hasDigitAndLetter },
  // scheme / 用户名 / 密码都给上限，否则长串 [a-z0-9.-] 会让每个起点回溯到底（O(n²)）
  { kind: 'url-password', re: /(\b[a-z][a-z0-9+.-]{0,15}:\/\/[^\s:/@]{1,128}:)([^\s@/]{6,256})(?=@)/g, hasPrefix: true, accept: hasDigitAndLetter },
  // .env / shell 行：变量名必须以敏感段结尾（_KEY / _SECRET / _TOKEN / _PASSWORD），PUBLIC_KEY 除外
  {
    kind: 'env-secret',
    re: /^(\s*(?:export\s+)?(?![A-Z0-9_]*PUBLIC_KEY\b)(?:[A-Z][A-Z0-9_]*_)?(?:KEY|SECRET|TOKEN|PASSWORD|PASSWD)\s*(?:=|:\s)\s*["']?)([^\s"'$]{12,})/gm,
    hasPrefix: true,
    accept: hasDigitAndLetter,
  },
  // JSON / YAML / 代码里带引号的敏感字段值
  {
    kind: 'json-secret',
    re: /(["']?(?:api[_-]?key|access[_-]?token|refresh[_-]?token|auth[_-]?token|client[_-]?secret|secret[_-]?key|private[_-]?key|password)["']?\s*[:=]\s*["'])([^"'\s]{12,})(?=["'])/gi,
    hasPrefix: true,
    accept: hasDigitAndLetter,
  },
]

const PEM_BEGIN = '-'.repeat(5) + 'BEGIN '
const PEM_TAIL = 'PRIVATE KEY' + '-'.repeat(5)
const PEM_END = '-'.repeat(5) + 'END '
const PEM_MAX = 16 * 1024

// PEM 私钥块用 indexOf 线性扫描：头尾都要是 PRIVATE KEY，块长有上限
function redactPem(input: string): { text: string; hits: number } {
  let out = ''
  let hits = 0
  let from = 0
  // 下一个 END 的位置缓存：单调向前，整体线性（-1 = 后面再没有 END）
  let nextEnd = -2
  const findEnd = (pos: number) => {
    if (nextEnd === -1 || nextEnd >= pos) return nextEnd
    nextEnd = input.indexOf(PEM_END, pos)
    return nextEnd
  }
  for (;;) {
    const begin = input.indexOf(PEM_BEGIN, from)
    if (begin < 0) break
    const skip = () => {
      out += input.slice(from, begin + PEM_BEGIN.length)
      from = begin + PEM_BEGIN.length
    }
    // 头部只在 80 字符窗口内找换行，不向远处扫描（否则同一行多个头会 O(n²)）
    const window = input.slice(begin, begin + 80)
    const nl = window.indexOf('\n')
    const head = nl < 0 ? window : window.slice(0, nl)
    if (!head.trimEnd().endsWith(PEM_TAIL)) {
      skip()
      continue
    }
    const end = findEnd(begin + head.length)
    if (end < 0) break
    const tailAt = end + PEM_END.length
    const tailLine = input.slice(tailAt, tailAt + 40)
    const tailIdx = tailLine.indexOf(PEM_TAIL)
    const stop = tailIdx < 0 ? -1 : tailAt + tailIdx + PEM_TAIL.length
    if (stop < 0 || stop - begin > PEM_MAX) {
      skip()
      continue
    }
    out += input.slice(from, begin) + mask('private-key', stop - begin)
    hits += 1
    from = stop
  }
  return { text: out + input.slice(from), hits }
}

function mask(kind: string, length: number): string {
  return `[REDACTED:${kind} ${length}字符 · secret-shield 已遮蔽，原值非空]`
}

export type Redaction = { text: string; hits: number; kinds: string[] }

export function redact(input: string): Redaction {
  const kinds = new Set<string>()
  const pem = redactPem(input)
  let text = pem.text
  let hits = pem.hits
  if (pem.hits) kinds.add('private-key')

  for (const rule of RULES) {
    text = text.replace(rule.re, (...m: unknown[]) => {
      const whole = String(m[0])
      const prefix = rule.hasPrefix ? String(m[1] ?? '') : ''
      const value = rule.hasPrefix ? String(m[2] ?? '') : whole
      if (rule.hasPrefix && PLACEHOLDER.test(value)) return whole
      if (rule.accept && !rule.accept(value)) return whole

      hits += 1
      kinds.add(rule.kind)
      return prefix + mask(rule.kind, value.length)
    })
  }

  return { text, hits, kinds: [...kinds] }
}

export type Block = { type: string; text?: string; content?: unknown }

// 只有这两个入口是工具输出；其他 door（提示词、模型回复、通知）不动
export const TOOL_DOORS: ReadonlySet<string> = new Set(['tool-result', 'tool-message'])

// 返回改写后的块与命中数；只动 text 块和 tool_result 的 content
export function redactBlocks(blocks: readonly Block[]) {
  let hits = 0
  const kinds = new Set<string>()
  const take = (s: string) => {
    const r = redact(s)
    hits += r.hits
    r.kinds.forEach(k => kinds.add(k))
    return r.text
  }

  const out = blocks.map(block => {
    if (block.type === 'text' && typeof block.text === 'string') {
      return { ...block, text: take(block.text) }
    }
    if (block.type === 'tool_result') {
      if (typeof block.content === 'string') {
        return { ...block, content: take(block.content) }
      }
      if (Array.isArray(block.content)) {
        return {
          ...block,
          content: block.content.map((inner: Block) =>
            inner?.type === 'text' && typeof inner.text === 'string'
              ? { ...inner, text: take(inner.text) }
              : inner,
          ),
        }
      }
    }
    return block
  })

  return { out, hits, kinds: [...kinds] }
}
