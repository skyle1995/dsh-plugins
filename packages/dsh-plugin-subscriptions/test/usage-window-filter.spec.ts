import { test } from 'node:test'
import assert from 'node:assert/strict'
import { visibleUsageWindows } from '../src/client/usage-window-filter.js'
import type { UsageWindow } from '../src/client/SubscriptionsSection.js'
import { en, zh } from '../src/client/locales.js'

const windows: UsageWindow[] = [
  { kind: 'other', scope: 'gemini-3-flash', usedPercent: 20, resetsAt: 123 },
  { kind: 'weekly', scope: 'gemini-3-flash', usedPercent: 40 },
  { kind: 'other', scope: 'claude-sonnet-4-6', usedPercent: 70 },
  { kind: 'other', scope: 'tab_jump_flash_lite_preview', usedPercent: 0 },
]

test('Google usage follows exact saved model IDs, retaining ordinary and weekly windows', () => {
  const before = structuredClone(windows)
  assert.deepEqual(visibleUsageWindows('antigravity', windows, ['gemini-3-flash']), windows.slice(0, 2))
  assert.deepEqual(visibleUsageWindows('antigravity', windows, ['claude-sonnet-4-6']), [windows[2]])
  assert.deepEqual(visibleUsageWindows('antigravity', windows, ['gemini-3']), [])
  assert.deepEqual(windows, before, 'presentation filtering must not mutate raw quotas')
})

test('automatic visibility shows all models; empty and unavailable selections show none', () => {
  assert.strictEqual(visibleUsageWindows('antigravity', windows, undefined), windows)
  assert.deepEqual(visibleUsageWindows('antigravity', windows, []), [])
  assert.deepEqual(visibleUsageWindows('antigravity', windows, ['unavailable-model']), [])
  assert.deepEqual(visibleUsageWindows('antigravity', undefined, ['gemini-3-flash']), [])
  assert.deepEqual(visibleUsageWindows('antigravity', [], undefined), [])
})

test('visibility never removes account-wide windows or other providers family quotas', () => {
  const unscoped: UsageWindow[] = [
    { kind: 'session', usedPercent: 10 },
    { kind: 'weekly', scope: '', usedPercent: 30 },
  ]
  assert.deepEqual(visibleUsageWindows('antigravity', [...windows, ...unscoped], []), unscoped)
  for (const provider of ['codex', 'claude', 'grok', 'copilot'] as const) {
    assert.strictEqual(visibleUsageWindows(provider, windows, []), windows)
  }
})

test('filtered-empty usage has distinct bilingual copy from missing upstream quotas', () => {
  for (const locale of [en, zh]) {
    assert.ok(locale.usageNoVisibleModels)
    assert.notEqual(locale.usageNoVisibleModels, locale.usageEmpty)
  }
})

test('catalog names resolve family scopes: a disabled family loses its windows, an enabled one keeps them', () => {
  const family: UsageWindow[] = [
    { kind: 'weekly', scope: 'Opus', usedPercent: 55 },
    { kind: 'weekly', scope: 'Sonnet 4.6', usedPercent: 12 },
  ]
  const models = [
    { id: 'claude-opus-4-6', name: 'Opus 4.6' },
    { id: 'claude-opus-4-5', name: 'Opus 4.5' },
    { id: 'claude-sonnet-4-6', name: 'Sonnet 4.6' },
  ]
  assert.deepEqual(
    visibleUsageWindows('claude', family, ['claude-sonnet-4-6'], models),
    [family[1]],
    'every Opus model disabled -> the Opus family window leaves the list',
  )
  assert.deepEqual(
    visibleUsageWindows('claude', family, ['claude-opus-4-5', 'claude-sonnet-4-6'], models),
    family,
    'one enabled Opus member keeps the shared family window',
  )
  assert.deepEqual(
    visibleUsageWindows('claude', family, ['claude-opus-4-6'], models),
    [family[0]],
    'an exact display-name scope follows its own model',
  )
})

test('other providers drop id-scoped windows of disabled models once the catalog names them', () => {
  const scoped: UsageWindow[] = [
    { kind: 'other', scope: 'gemini-3-flash', usedPercent: 30 },
    { kind: 'session', usedPercent: 5 },
  ]
  const catalog = [{ id: 'gemini-3-flash', name: 'Gemini 3 Flash' }]
  // Without a catalog a non-Antigravity scope cannot be attributed: keep it.
  assert.deepEqual(visibleUsageWindows('antigravity', scoped, ['gemini-3-pro']), [scoped[1]])
  assert.deepEqual(
    visibleUsageWindows('antigravity', scoped, ['gemini-3-pro'], catalog),
    [scoped[1]],
    'catalog resolution must not resurrect a disabled model',
  )
  assert.deepEqual(
    visibleUsageWindows('antigravity', scoped, ['gemini-3-flash', 'gemini-3-pro'], catalog),
    scoped,
  )
})

test('an account-level model list hides its own deselected models, intersecting the picker', () => {
  // The account manager's model checkboxes save `poolModels`; a deselected model
  // must lose its quota windows even when the provider picker still lists it.
  assert.deepEqual(
    visibleUsageWindows('antigravity', windows, undefined, undefined, ['gemini-3-flash']),
    windows.slice(0, 2),
  )
  assert.deepEqual(
    visibleUsageWindows('antigravity', windows, undefined, undefined, []),
    [],
    'an empty account list disables every model-scoped window',
  )
  // Intersection: enabled only where BOTH lists agree.
  assert.deepEqual(
    visibleUsageWindows('antigravity', windows, ['gemini-3-flash', 'claude-sonnet-4-6'], undefined, ['gemini-3-flash']),
    windows.slice(0, 2),
  )
  // An account list that names nothing the picker allows hides everything.
  assert.deepEqual(
    visibleUsageWindows('antigravity', windows, ['gemini-3-flash'], undefined, ['claude-sonnet-4-6']),
    [],
  )
  // Account-wide windows survive either selection.
  const unscoped: UsageWindow[] = [{ kind: 'session', usedPercent: 10 }]
  assert.deepEqual(visibleUsageWindows('antigravity', unscoped, undefined, undefined, []), unscoped)
})
