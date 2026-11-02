/**
 * Run the compiled specs under an empty DSH home.
 *
 * The adapters honour whatever the *installed* DSH home configures — a saved
 * plugin proxy makes `proxiedFetch` dial through an undici ProxyAgent, which
 * bypasses the `globalThis.fetch` mocks the specs install and sends real
 * requests instead. The suite is not meant to read the user's `~/.dsh`, so the
 * runner gives every spec process a throwaway home unless one was passed in.
 *
 * Concurrency defaults to one: several specs wait on 1 s stream-idle watchdogs,
 * and on a loaded desktop the runner's default (one process per core) lets those
 * timers fire before the mocked responses resolve — failing tests that pass when
 * run serially. Override with `DSH_TEST_CONCURRENCY=N` on an idle machine.
 *
 * Usage: `node scripts/run-tests.mjs` (the package's `test` script).
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Never inherit an ambient DSH_HOME: the host process usually exports the real
// one (`~/.dsh`), and reading it is exactly what this runner exists to prevent.
// Point DSH_TEST_HOME at a fixture home when a spec needs a prepared store.
const home = process.env.DSH_TEST_HOME ?? mkdtempSync(join(tmpdir(), 'dsh-subscriptions-test-'))
const owns = process.env.DSH_TEST_HOME === undefined
const concurrency = process.env.DSH_TEST_CONCURRENCY ?? '1'
const child = spawn(process.execPath, ['--test', `--test-concurrency=${concurrency}`, 'lib-test/test/**/*.spec.js'], {
  stdio: 'inherit',
  env: { ...process.env, DSH_HOME: home },
})
child.on('exit', (code, signal) => {
  if (owns) rmSync(home, { recursive: true, force: true })
  if (signal !== null) process.kill(process.pid, signal)
  else process.exit(code ?? 1)
})
