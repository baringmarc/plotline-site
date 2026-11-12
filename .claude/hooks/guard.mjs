#!/usr/bin/env node
// PreToolUse hook: blocks mistakes before they happen, instead of catching them afterwards.
//
// Edit / Write / MultiEdit (everyone):
//   - harness files (.claude/hooks, settings, harness.json, eslint config, the failure log…) are read-only
//     unless the user has unlocked them (see UNLOCK below)
//   - migrations that already exist in HEAD are append-only: make a new migration instead
//   - test files may not gain .skip / .only / .todo / fixme (or pgTAP skip/todo)
//   - no service-role or secret keys under src/
// Builder only (the main session):
//   - tests written by the test-writer for the current task are locked until it's committed: write a Test dispute instead
//   - existing tests may not lose assertions
// Agents:
//   - test-writer may only write test files; each file it writes is locked for the current task
//   - reviewer is read-only: no edits, and Bash is limited to an allowlist of read/test commands
// Bash (everyone):
//   - no force push, git reset --hard, git clean -f, amend, or remote database reset (plain `git push` is allowed)
//   - `git commit` only after a full verify passed on exactly the current changes
//     (`node .claude/hooks/verify-gate.mjs --full`)
//   - no shell writes to protected files, applied migrations or locked tests
//
// UNLOCK: when the user wants Claude to change the harness itself, they run
//   `touch .claude/state/unlock-harness` themselves. Protected files are then editable for 2 hours.
//
// A blocked call gets a "deny" with the reason, which Claude reads and adjusts to. Every block is logged to
// .claude/retro/failures.jsonl for /retro.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  codeFingerprint,
  config,
  currentTask,
  existsInHead,
  existsSync,
  git,
  harnessUnlocked,
  logEvent,
  matchesAny,
  paths,
  readJson,
  rel,
  root,
  uiFingerprint,
  writeJson,
} from './lib/harness.mjs'

const input = JSON.parse(readFileSync(0, 'utf8') || '{}')
const tool = input.tool_name
const args = input.tool_input ?? {}
const agent = input.agent_type ?? 'main'

function allow() {
  process.exit(0)
}

function deny(rule, reason, detail = {}) {
  logEvent({ source: 'guard', category: rule, agent, ...detail })
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: `[guard:${rule}] ${reason}`,
      },
    }),
  )
  process.exit(0)
}

// ---------- helpers ----------

const SKIP_JS = /\.(skip|only|todo|fixme)\s*\(|\b(xit|xdescribe|xtest|fit|fdescribe)\s*\(/g
const SKIP_SQL = /\b(skip|todo|todo_start)\s*\(/gi
const ASSERT_JS = /\bexpect(\.soft)?\s*\(/g
const ASSERT_SQL =
  /\b(ok|is|isnt|is_empty|isnt_empty|results_eq|results_ne|set_eq|bag_eq|row_eq|cmp_ok|matches|throws_ok|throws_like|throws_matching|lives_ok|policies_are|policy_cmd_is|policy_roles_are|fk_ok|has_[a-z_]+|hasnt_[a-z_]+|col_[a-z_]+|function_returns|is_definer|isnt_definer)\s*\(/gi

const count = (text, re) => (text.match(re) ?? []).length
const isSql = (p) => p.endsWith('.sql')
const isTest = (p) => matchesAny(p, config.tests)
const isProtected = (p) => matchesAny(p, config.protected)
const isMigration = (p) => new RegExp(config.migrations).test(p)

// A test-writer's tests stay locked until the task changes or the next commit (which ends the task).
function headCommitMs() {
  try {
    return Number(git(['log', '-1', '--format=%ct']).trim()) * 1000
  } catch {
    return 0
  }
}

function lockedTests() {
  const locks = readJson(paths.lockedTests, { task: null, files: {} })
  if (locks.task !== currentTask() || Array.isArray(locks.files)) return []
  const since = headCommitMs()
  return Object.entries(locks.files)
    .filter(([, ts]) => Date.parse(ts) > since)
    .map(([p]) => p)
}

function lockTest(p) {
  const task = currentTask()
  const locks = readJson(paths.lockedTests, { task, files: {} })
  const files = locks.task === task && !Array.isArray(locks.files) ? locks.files : {}
  files[p] = new Date().toISOString()
  writeJson(paths.lockedTests, { task, files })
}

/** The file content before and after this Edit/Write/MultiEdit. */
function contents(p) {
  const abs = join(root, p)
  const before = existsSync(abs) ? readFileSync(abs, 'utf8') : ''
  let after = before
  if (tool === 'Write') after = args.content ?? ''
  const edits = tool === 'MultiEdit' ? args.edits ?? [] : tool === 'Edit' ? [args] : []
  for (const e of edits) {
    if (typeof e.old_string !== 'string') continue
    after = e.replace_all
      ? after.split(e.old_string).join(e.new_string ?? '')
      : after.replace(e.old_string, () => e.new_string ?? '')
  }
  return { before, after }
}

// ---------- file edits ----------

function checkFileEdit() {
  const p = rel(args.file_path ?? args.notebook_path)
  if (!p) return allow() // outside the repo: not ours to judge

  if (agent === 'reviewer') deny('reviewer-readonly', 'The reviewer is read-only. Report the problem as a finding instead.', { path: p })

  if (isProtected(p) && !harnessUnlocked()) {
    deny(
      'protected-file',
      `${p} is part of the harness and is read-only for Claude. If it really needs changing, stop and ask the user ` +
        '(they can unlock harness edits for 2 hours with `touch .claude/state/unlock-harness`).',
      { path: p },
    )
  }

  if (isMigration(p) && existsInHead(p)) {
    deny(
      'applied-migration',
      `${p} is already committed, so it may already be applied. Never edit it: create a new migration with ` +
        '`npx supabase migration new <name>` that changes what you need.',
      { path: p },
    )
  }

  if (agent === 'test-writer' && !isTest(p)) {
    deny('test-writer-scope', `The test-writer only writes test files. ${p} is not one. Leave the implementation to the builder.`, { path: p })
  }

  const { before, after } = contents(p)

  if (isTest(p)) {
    const skip = isSql(p) ? SKIP_SQL : SKIP_JS
    if (count(after, skip) > count(before, skip)) {
      deny(
        'test-skip',
        `This edit adds a skip/only/todo to ${p}. Tests are never skipped to get verify passing. Fix the code, ` +
          'or if the test itself is wrong, write a Test dispute under the task in TASKS.md and stop.',
        { path: p },
      )
    }

    if (agent === 'main' && lockedTests().includes(p)) {
      deny(
        'locked-test',
        `${p} was written by the test-writer from the acceptance criteria and is locked for ${currentTask()}. ` +
          'Make the code pass it. If you believe the test contradicts SPEC or the task, add a "Test dispute:" line ' +
          'under the task in TASKS.md (which test, why, what SPEC says) and let the reviewer settle it.',
        { path: p },
      )
    }

    if (agent === 'main' && existsInHead(p)) {
      const assert = isSql(p) ? ASSERT_SQL : ASSERT_JS
      const lost = count(before, assert) - count(after, assert)
      if (lost > 0) {
        deny(
          'test-weakened',
          `This edit removes ${lost} assertion(s) from ${p}, an existing test. Don't weaken tests. If behavior changed ` +
            'on purpose (SPEC says so), replace each removed assertion with one for the new behavior in the same edit. ' +
            'If the test is wrong, write a Test dispute under the task in TASKS.md.',
          { path: p },
        )
      }
    }
  }

  const scan = config.secretScan
  if (scan && matchesAny(p, scan.paths) && !matchesAny(p, scan.except)) {
    const hit = scan.patterns.find((re) => new RegExp(re).test(after) && !new RegExp(re).test(before))
    if (hit) {
      deny(
        'secret-in-client',
        `This edit puts a secret or service-role reference into ${p} (matched /${hit}/). Client code may only use ` +
          'the publishable key. Secrets belong in Edge Function env vars.',
        { path: p },
      )
    }
  }

  if (agent === 'test-writer') lockTest(p)
  allow()
}

// ---------- Bash ----------

const WRITE_OPS = /(^|[^0-9&])>>?(?!&)|\btee\b|\bsed\s+(-[a-zA-Z]*i|--in-place)|\bperl\s+-[a-zA-Z]*i|\brm\b|\bmv\b|\bcp\b|\btruncate\b|\bchmod\b|\bln\b|writeFile|appendFile|\bunlink\b/

// The harness's own scripts write to protected state on purpose (the failure log, the verify state).
const HARNESS_SCRIPT = {
  test: (seg) =>
    /^node\s+(\.\/)?\.claude\/hooks\/(verify-gate|log-event)\.mjs(\s|$)/.test(seg) &&
    !/(^|[^0-9&])>>?(?!&)|\btee\b/.test(seg.replace(/'[^']*'|"[^"]*"/g, '')),
}

/**
 * Splits a command on &&, ||, ;, |, & and newlines **outside quotes**, so `grep -n "a\|b" f` stays one segment
 * while `grep x f | tee g` is two (T1.12). A `&` that is part of a redirect (`2>&1`, `&>`) doesn't split.
 */
function segments(cmd) {
  const out = []
  let cur = ''
  let quote = null
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i]
    if (quote) {
      cur += c
      if (c === '\\' && quote === '"' && i + 1 < cmd.length) cur += cmd[++i]
      else if (c === quote) quote = null
      continue
    }
    if (c === '\\' && i + 1 < cmd.length) {
      cur += c + cmd[++i]
      continue
    }
    if (c === "'" || c === '"') {
      quote = c
      cur += c
      continue
    }
    const redirectAmp = c === '&' && (cmd[i - 1] === '>' || cmd[i + 1] === '>')
    if (c === '\n' || c === ';' || c === '|' || (c === '&' && !redirectAmp)) {
      out.push(cur)
      cur = ''
      if ((c === '|' || c === '&') && cmd[i + 1] === c) i++
      continue
    }
    cur += c
  }
  out.push(cur)
  return out.map((s) => s.trim()).filter(Boolean)
}

/**
 * The command with quoted text blanked, scanning left to right like `segments()` so a `'` inside `"…"` doesn't
 * open a quote: `'…'` always, and `"…"` too unless `keepDouble` (where `$(…)` still runs).
 */
function unquoted(cmd, keepDouble = false) {
  let out = ''
  let quote = null
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i]
    if (quote) {
      if (c === '\\' && quote === '"' && i + 1 < cmd.length) {
        if (keepDouble) out += c + cmd[i + 1]
        i++
      } else if (c === quote) {
        quote = null
        out += c
      } else if (quote === '"' && keepDouble) out += c
      continue
    }
    if (c === '\\' && i + 1 < cmd.length) {
      out += c + cmd[++i]
      continue
    }
    if (c === "'" || c === '"') quote = c
    out += c
  }
  return out
}

const GIT_READ = '(diff|status|log|show|blame|ls-files|rev-parse|cat-file|merge-base)'

const REVIEWER_ALLOWED = [
  // read-only git, also as `git -C <path> …`; `--output` writes a file
  new RegExp(`^git(\\s+-C\\s+\\S+)?\\s+${GIT_READ}\\b(?!.*--output)`),
  /^(ls|cat|grep|head|tail|wc|nl|cut|jq|echo|pwd|pgrep|file|stat|diff|cmp|shasum)\b/,
  /^rg\b(?!.*--pre\b)/,
  // `uniq in out` writes `out`: at most one file argument
  /^uniq(\s+-\S+)*(\s+[^\s-]\S*)?$/,
  /^sort\b(?!.*(\s-[a-zA-Z]*o|--output))/,
  // `sed -n` that prints only: no -i, and no `w` command or `e` in the script
  /^sed\s+-n\b(?!.*(\s-[a-zA-Z]*i|--in-place|[0-9;{'"/$]\s*[we]\b))/,
  // an awk program that can't run commands or write: no system(), getline, > or |
  /^awk\b(?!.*(\bsystem\b|\bgetline\b|[>|]))/,
  /^find\b(?!.*(-delete|-exec|-ok|-fprint|-fls))/,
  /^npm(\s+--prefix\s+\S+)?\s+run\s+(test|test:db|typecheck|lint|check:drift)(\s|$)/,
  /^npx\s+vitest\s+run\b(?!.*(\s-u\b|--update|--outputFile))/,
  /^cd\s/,
  // loop scaffolding: the commands inside `do …` are checked on their own
  /^for\s+\w+\s+in\b/,
  /^done$/,
]

/** A segment as the allow list sees it: a loop body's leading `do` is dropped. */
const reviewerSegment = (seg) => seg.replace(/^do\s+/, '')

function checkBash() {
  const cmd = String(args.command ?? '')

  if (agent === 'reviewer') {
    const bad = segments(cmd)
      .map(reviewerSegment)
      .find((s) => !REVIEWER_ALLOWED.some((re) => re.test(s)))
    // Command substitution runs inside double quotes too, so only single-quoted text is ignored for it.
    const substitution = /\$\(|`|[<>]\(/.test(unquoted(cmd, true))
    // Any `>` that writes a file, including `2>err` and `&>out`; only `2>/dev/null`, `2>&1` and `>&2` are fine (`>&out` writes a file).
    const redirect = /(^|[^&])>(?!&[0-9-])|&>/.test(unquoted(cmd).replace(/2>\/dev\/null|2>&1/g, ''))
    if (bad || substitution || redirect) {
      deny('reviewer-readonly', `The reviewer is read-only; "${bad ?? cmd}" isn't on its allowed command list.`, { command: cmd.slice(0, 200) })
    }
  }

  const gitCmd = /\bgit\b(\s+-[cC]\s+\S+)*\s+/
  if (new RegExp(gitCmd.source + 'push\\b').test(cmd) && /(\s--force(-with-lease)?\b|\s-[a-zA-Z]*f\b|\s\+\S+)/.test(cmd)) {
    deny('force-push', 'Force pushes can overwrite history on the remote. Plain `git push` is fine; force pushes are for the user to do.', { command: cmd.slice(0, 200) })
  }
  if (new RegExp(gitCmd.source + 'reset\\b.*--hard').test(cmd) || new RegExp(gitCmd.source + 'clean\\b.*-[a-zA-Z]*f').test(cmd)) {
    deny('destructive-git', 'git reset --hard and git clean -f throw away work that may not be yours. Ask the user instead.', { command: cmd.slice(0, 200) })
  }
  if (new RegExp(gitCmd.source + 'commit\\b.*--amend').test(cmd)) {
    deny('amend', 'Never amend or rewrite history. Make a new commit.', { command: cmd.slice(0, 200) })
  }
  if (/\bsupabase\b.*\bdb\s+reset\b/.test(cmd) && /--linked|--db-url/.test(cmd)) {
    deny('remote-db-reset', 'Resetting the linked or a remote database wipes real data. Only `npm run db:reset:local` is allowed.', { command: cmd.slice(0, 200) })
  }

  if (/unlock-harness/.test(cmd)) {
    deny('protected-file', 'Only the user may unlock the harness.', { command: cmd.slice(0, 200) })
  }

  // Pipes are kept inside a segment here, so `cat x | tee .claude/hooks/y` is still seen as one write.
  for (const seg of cmd.split(/&&|\|\||;|\n/).map((s) => s.trim())) {
    if (!WRITE_OPS.test(seg)) continue
    const mentioned = (seg.match(/[\w./@-]+/g) ?? []).map((t) => rel(t)).filter(Boolean)
    for (const p of mentioned) {
      if (isProtected(p) && !harnessUnlocked() && !HARNESS_SCRIPT.test(seg)) {
        deny('protected-file', `This command would change ${p}, which is part of the harness. Ask the user.`, { command: cmd.slice(0, 200) })
      }
      if (isMigration(p) && existsInHead(p)) {
        deny('applied-migration', `This command would change ${p}, an applied migration. Create a new migration instead.`, { command: cmd.slice(0, 200) })
      }
      if (agent === 'main' && lockedTests().includes(p)) {
        deny('locked-test', `This command would change ${p}, a locked test for ${currentTask()}. Write a Test dispute instead.`, { command: cmd.slice(0, 200) })
      }
    }
  }

  if (new RegExp(gitCmd.source + 'commit\\b').test(cmd)) checkCommit(cmd)

  allow()
}

/** Commits need a full verify (and e2e when UI files changed) that passed on exactly the current changes. */
function checkCommit(cmd) {
  const state = readJson(paths.verifyState, {})
  const code = codeFingerprint()
  const ui = uiFingerprint()
  const fullOk = code.empty || state.fullPassed === code.hash
  const e2eOk = !config.e2e || ui.empty || state.e2ePassed === ui.hash
  if (fullOk && e2eOk) return
  const missing = [!fullOk && 'the full verify', !e2eOk && 'the e2e run (UI files changed)'].filter(Boolean).join(' and ')
  deny(
    'commit-before-full-verify',
    `No passing ${missing} for the current changes. Run \`node .claude/hooks/verify-gate.mjs --full\`, fix anything it ` +
      'reports, then commit. (Edits after a passing run need a new run.)',
    { command: cmd.slice(0, 200) },
  )
}

// ---------- dispatch ----------

if (!existsSync(join(root, '.git'))) allow()
if (['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(tool)) checkFileEdit()
if (tool === 'Bash') checkBash()
allow()
