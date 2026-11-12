// @vitest-environment node
// T1.12: the reviewer stays read-only without being blocked on plain read commands.
// Runs guard.mjs as a subprocess (as Claude Code does) against a throwaway project dir,
// so denials are logged there and never into the real .claude/retro/failures.jsonl.
import { spawnSync, execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const GUARD = join(here, 'guard.mjs')
const HARNESS_JSON = join(here, '..', 'harness.json')

let project = ''

beforeAll(() => {
  project = mkdtempSync(join(tmpdir(), 'guard-test-'))
  execFileSync('git', ['init', '-q'], { cwd: project })
  mkdirSync(join(project, '.claude', 'retro'), { recursive: true })
  mkdirSync(join(project, '.claude', 'state'), { recursive: true })
  copyFileSync(HARNESS_JSON, join(project, '.claude', 'harness.json'))
})

afterAll(() => {
  if (project) rmSync(project, { recursive: true, force: true })
})

type Result = { denied: boolean; rule: string | null; reason: string; status: number | null }

function runGuard(command: string, agent: 'reviewer' | 'main'): Result {
  const res = spawnSync('node', [GUARD], {
    cwd: project,
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command }, agent_type: agent }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: project },
    encoding: 'utf8',
  })
  const out = res.stdout.trim()
  if (!out) return { denied: false, rule: null, reason: '', status: res.status }
  const parsed = JSON.parse(out) as {
    hookSpecificOutput?: { permissionDecision?: string; permissionDecisionReason?: string }
  }
  const reason = parsed.hookSpecificOutput?.permissionDecisionReason ?? ''
  return {
    denied: parsed.hookSpecificOutput?.permissionDecision === 'deny',
    rule: reason.match(/^\[guard:([\w-]+)\]/)?.[1] ?? null,
    reason,
    status: res.status,
  }
}

const REPO = '/Users/someone/Projects/plotline-site'

describe('guard: reviewer read-only commands it was wrongly blocked on are allowed', () => {
  const allowed: [string, string][] = [
    // git -C <path> before read-only subcommands
    ['git -C status', `git -C ${REPO} status --porcelain`],
    ['git -C diff --stat', `git -C ${REPO} diff HEAD --stat`],
    ['git -C diff a path', `git -C ${REPO} diff HEAD -- src/a.ts`],
    ['git -C log', `git -C ${REPO} log --oneline -3`],
    // | ; inside quotes are not command separators
    ['grep with \\| in double quotes', 'grep -n "a\\|b" file'],
    ['grep -E with | in double quotes', 'grep -nE "a|b|c" file'],
    ['grep with ; in single quotes', "grep -n 'x;y' file"],
    ['grep -rn quoted alternation piped to grep -v', 'grep -rn "a\\|b" src --include=*.ts | grep -v test'],
    // npm --prefix <path> run test|typecheck|lint, and check:drift
    ['npm --prefix run test', `npm --prefix ${REPO} run test`],
    ['npm --prefix run typecheck', `npm --prefix ${REPO} run typecheck`],
    ['npm --prefix run lint', `npm --prefix ${REPO} run lint`],
    ['npm run check:drift', 'npm run check:drift'],
    ['npm --prefix run check:drift', `npm --prefix ${REPO} run check:drift`],
    // other read-only tools
    ['cmp', 'cmp a b'],
    ['shasum', 'shasum a b'],
    ['awk range print', "awk '/^### T5.6/,/^## M6/' TASKS.md"],
    // read-only for loops
    ['for loop of cat', 'for f in a.ts b.ts; do cat "$f"; done'],
    ['for loop of echo and cat', 'for f in a b; do echo "=== $f"; cat "$f"; done'],
    // cd and stderr-to-null
    ['cd then grep', 'cd /some/path && grep -n x f'],
    ['ls 2>/dev/null piped to head', 'ls -la dist 2>/dev/null | head -30'],
    // still allowed as before
    ['plain git diff', 'git diff HEAD --stat'],
    ['sed -n', 'sed -n 1,40p TASKS.md'],
    ['npx vitest run', 'npx vitest run src/a.test.ts'],
  ]

  it.each(allowed)('allows the reviewer: %s', (_name, command) => {
    const r = runGuard(command, 'reviewer')
    expect(r.reason).toBe('')
    expect(r.denied).toBe(false)
    expect(r.status).toBe(0)
  })
})

describe('guard: reviewer writes, redirects and tee are still denied', () => {
  const denied: [string, string][] = [
    ['real pipe into tee', 'grep x f | tee g'],
    ['redirect >', 'cat a > b'],
    ['append >>', 'echo hi >> f'],
    ['redirect after a quoted |', 'grep "a|b" f > out'],
    ['rm inside a for loop', 'for f in a; do rm "$f"; done'],
    ['command substitution $()', 'echo $(rm -rf x)'],
    ['command substitution inside double quotes', 'cat "$(touch x)"'],
    ['backtick substitution', 'echo `touch x`'],
    ['process substitution', 'diff <(rm x) y'],
    ['awk system()', `awk '{ system("rm x") }' f`],
    ['awk print > file', `awk '{ print > "out" }' f`],
    ['awk print | command', `awk '{ print | "sh" }' f`],
    ['git diff --output=', 'git diff --output=x'],
    ['git -C diff --output', 'git -C . diff --output x'],
    ['sort -o', 'sort -o out f'],
    ['npm --prefix run build', 'npm --prefix . run build'],
    ['npm --prefix install', 'npm --prefix . install'],
    ['git -C commit', 'git -C . commit -m x'],
    ['git -C checkout', 'git -C . checkout x'],
    ['sed -i', 'sed -i s/a/b/ f'],
    ['find -delete', 'find . -delete'],
  ]

  it.each(denied)('denies the reviewer: %s', (_name, command) => {
    const r = runGuard(command, 'reviewer')
    expect(r.denied).toBe(true)
    expect(['reviewer-readonly', 'protected-file']).toContain(r.rule)
  })

  it('a real pipe into tee is denied as reviewer-readonly and logged in the project dir', () => {
    const r = runGuard('grep x f | tee g', 'reviewer')
    expect(r.denied).toBe(true)
    expect(r.rule).toBe('reviewer-readonly')
    const log = join(project, '.claude', 'retro', 'failures.jsonl')
    expect(existsSync(log)).toBe(true)
    const events = readFileSync(log, 'utf8')
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l) as { category: string; agent: string; command?: string })
    expect(events).toContainEqual(
      expect.objectContaining({ category: 'reviewer-readonly', agent: 'reviewer', command: 'grep x f | tee g' }),
    )
  })
})

describe('guard: the main session is unaffected', () => {
  it('allows a plain read command for main', () => {
    const r = runGuard('grep -n "a\\|b" file', 'main')
    expect(r.denied).toBe(false)
    expect(r.status).toBe(0)
  })

  it('allows git -C status for main', () => {
    const r = runGuard(`git -C ${REPO} status --porcelain`, 'main')
    expect(r.denied).toBe(false)
  })

  it('still denies a force push for main', () => {
    const r = runGuard('git push --force origin develop', 'main')
    expect(r.denied).toBe(true)
    expect(r.rule).toBe('force-push')
  })

  it('still denies a force push through git -C for main', () => {
    const r = runGuard('git -C . push -f', 'main')
    expect(r.denied).toBe(true)
    expect(r.rule).toBe('force-push')
  })

  it('still denies git reset --hard for main', () => {
    const r = runGuard('git reset --hard HEAD~1', 'main')
    expect(r.denied).toBe(true)
    expect(r.rule).toBe('destructive-git')
  })
})
