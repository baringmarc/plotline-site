#!/usr/bin/env node
// Stop hook: Claude can't finish a turn while `npm run verify` fails.
//
// Runs only when code changed since the last passing verify. The fingerprint covers tracked and
// untracked changes, excluding *.md and .claude/, so Q&A and doc-only turns end instantly.
// Failures block the stop and feed the output back to Claude. After MAX_ATTEMPTS consecutive blocks
// in one turn it lets Claude stop, which must then report the failure. That state isn't retried
// until the code changes.
//
// State lives in .claude/.verify-state.json (gitignored).

import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const MAX_ATTEMPTS = 3
const EXCLUDES = [':(exclude)*.md', ':(exclude).claude/**']

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd()
const statePath = join(root, '.claude', '.verify-state.json')

const input = JSON.parse(readFileSync(0, 'utf8') || '{}')

function git(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
}

/** Hash of the working-tree changes vs HEAD (tracked diff + untracked file contents). */
function fingerprint() {
  const diff = git(['diff', 'HEAD', '--', '.', ...EXCLUDES])
  const untracked = git(['ls-files', '--others', '--exclude-standard', '--', '.', ...EXCLUDES]).trim()
  const blobs = untracked
    ? execFileSync('git', ['hash-object', '--stdin-paths'], { cwd: root, input: untracked, encoding: 'utf8' })
    : ''
  return createHash('sha256').update(diff).update(untracked).update(blobs).digest('hex')
}

function loadState() {
  try {
    return JSON.parse(readFileSync(statePath, 'utf8'))
  } catch {
    return {}
  }
}

function saveState(state) {
  writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n')
}

function respond(obj) {
  if (obj) process.stdout.write(JSON.stringify(obj))
  process.exit(0)
}

function run(script) {
  const result = spawnSync('npm', ['run', script, '--silent'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim()
  return { ok: result.status === 0, tail: output.split('\n').slice(-60).join('\n') }
}

if (!existsSync(join(root, '.git')) || !existsSync(join(root, 'node_modules'))) respond()

const state = loadState()
const hash = fingerprint()
if (hash === state.passed) respond()

if (hash === state.gaveUp) {
  respond({ systemMessage: 'verify-gate: verify is still failing for the current changes (gave up earlier). Not re-running until code changes.' })
}

// A new user turn resets the attempt counter; a continuation after our own block keeps counting.
const attempts = input.stop_hook_active ? (state.attempts ?? 0) : 0

const verify = run('verify')
if (verify.ok) {
  saveState({ passed: hash })
  respond({ systemMessage: 'verify-gate: npm run verify passed.' })
}

if (attempts + 1 >= MAX_ATTEMPTS) {
  saveState({ ...state, attempts: 0, gaveUp: hash })
  respond({ systemMessage: `verify-gate: npm run verify still failing after ${MAX_ATTEMPTS} attempts; allowing stop.` })
}
saveState({ ...state, attempts: attempts + 1 })
respond({
  decision: 'block',
  reason:
    `npm run verify failed (attempt ${attempts + 1}/${MAX_ATTEMPTS}). The task is not done. ` +
    `Fix the failures below, then finish again. Do not weaken tests or lint rules to make it pass.` +
    (attempts + 2 >= MAX_ATTEMPTS
      ? ' This is the last attempt: if it still fails, stop and tell the user exactly what fails. Do not say the task is done.'
      : '') +
    `\n\n${verify.tail}`,
})
