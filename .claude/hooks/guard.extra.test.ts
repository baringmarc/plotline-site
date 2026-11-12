// @vitest-environment node
// T1.12 edge cases found while building (mine; guard.test.ts is the test-writer's): background `&`, `||`, an
// escaped quote inside a quoted pattern, and redirects that write a file (`2>err`, `&>out`).
import { spawnSync, execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
let project = ''

beforeAll(() => {
  project = mkdtempSync(join(tmpdir(), 'guard-extra-'))
  execFileSync('git', ['init', '-q'], { cwd: project })
  mkdirSync(join(project, '.claude', 'retro'), { recursive: true })
  mkdirSync(join(project, '.claude', 'state'), { recursive: true })
  copyFileSync(join(here, '..', 'harness.json'), join(project, '.claude', 'harness.json'))
})

afterAll(() => rmSync(project, { recursive: true, force: true }))

function denied(command: string): boolean {
  const res = spawnSync('node', [join(here, 'guard.mjs')], {
    cwd: project,
    env: { ...process.env, CLAUDE_PROJECT_DIR: project },
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command }, agent_type: 'reviewer' }),
    encoding: 'utf8',
  })
  return res.stdout.includes('"deny"')
}

describe('guard: reviewer edge cases', () => {
  it.each(['cat a & rm b', 'grep x f || rm y', 'git -C . diff HEAD; rm x', 'git diff HEAD &>out', 'cat a 2>err', 'grep "a" f 2> err'])(
    'denies %s',
    (cmd) => expect(denied(cmd)).toBe(true),
  )

  it.each(['grep "a\\"; rm x" f', 'cat a 2>&1 | head', 'grep -rn x src 2>/dev/null | head -5', "grep -n 'a > b' f"])(
    'allows %s',
    (cmd) => expect(denied(cmd)).toBe(false),
  )
})

describe('guard: review round 1 gaps', () => {
  it.each([
    `grep -n "don't" a > out; grep "it's" b`,
    `echo "it's" $(touch x) "don't"`,
    'echo hi >&out',
    'sed -n -i s/a/b/ f',
    "sed -n '1w out' f",
    'uniq in out',
    'find . -fprint out',
    'rg --pre ./run x',
    'npx vitest run -u',
    'npx vitest run --outputFile=x.json',
  ])('denies %s', (cmd) => expect(denied(cmd)).toBe(true))

  it.each([`grep -n "don't" a`, 'echo hi >&2', "sed -n '1,40p' f", 'sort f | uniq -c', 'uniq f', 'npx vitest run src/a.test.ts'])(
    'allows %s',
    (cmd) => expect(denied(cmd)).toBe(false),
  )
})
