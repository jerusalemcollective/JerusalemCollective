import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { AUDIT_ACTION_LABELS, describeAuditAction } from '../lib/audit.ts'

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(name) ? [path] : []
  })
}

test('every fixed audit action string has a plain-English label', () => {
  const missing = []
  for (const file of sourceFiles('app')) {
    const source = readFileSync(file, 'utf8')
    const plain = /logAdminAction\(\s*supabase,\s*'([a-z_]+)',\s*'([a-z]+)'/g
    const ternary = /logAdminAction\(\s*supabase,\s*[^,?]+\?\s*'([a-z_]+)'\s*:\s*'([a-z_]+)',\s*'([a-z]+)'/g
    for (const [, action, type] of source.matchAll(plain)) {
      if (!AUDIT_ACTION_LABELS[`${type}:${action}`]) missing.push(`${type}:${action}`)
    }
    for (const [, a, b, type] of source.matchAll(ternary)) {
      for (const action of [a, b]) {
        if (!AUDIT_ACTION_LABELS[`${type}:${action}`]) missing.push(`${type}:${action}`)
      }
    }
  }
  assert.deepEqual(missing, [])
})

test('describeAuditAction uses labels and falls back to readable text', () => {
  assert.equal(describeAuditAction('application', 'approve_application'), 'Approved application')
  assert.equal(describeAuditAction('listing', 'set_is_published_false'), 'Hid listing from site')
  assert.equal(describeAuditAction('listing', 'something_new'), 'Something new')
})
