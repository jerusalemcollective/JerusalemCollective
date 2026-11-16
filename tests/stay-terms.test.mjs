// Guards for the cancellation rule and stay-terms form parsing.
// Run: `node --test tests/stay-terms.test.mjs`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  cancellationRuleSentence,
  guestCancellationSummary,
  guestCancellationText,
  parseFreeDays,
  presetAsRule,
  readStayTerms,
  readStayTermsFromForm,
} from '../lib/stay-terms.ts'
import { hostCurrencyFromProfile } from '../lib/currencies.ts'

const form = (values) => ({ get: (name) => (name in values ? values[name] : null) })

test('rule sentences', () => {
  assert.equal(
    cancellationRuleSentence(14, 'deposit'),
    'Free cancellation until 14 days before check-in. After that, the host keeps the deposit.',
  )
  assert.equal(
    cancellationRuleSentence(1, 'all'),
    'Free cancellation until 1 day before check-in. After that, the host keeps what you have paid.',
  )
  assert.equal(cancellationRuleSentence(0, 'deposit'), 'There is no free cancellation. If you cancel, the host keeps the deposit.')
  assert.equal(cancellationRuleSentence(null, 'deposit'), null)
})

test('free days are clamped whole numbers', () => {
  assert.equal(parseFreeDays('7'), 7)
  assert.equal(parseFreeDays('7.9'), 7)
  assert.equal(parseFreeDays('-3'), 0)
  assert.equal(parseFreeDays('900'), 365)
  assert.equal(parseFreeDays(''), null)
  assert.equal(parseFreeDays('abc'), null)
})

test('the new rule wins over an older preset on the listing page', () => {
  const terms = readStayTerms({ cancellation_policy: 'flexible', cancellation_free_days: 5, cancellation_keep: 'all' })
  assert.match(guestCancellationText(terms), /until 5 days/)
  assert.equal(guestCancellationSummary(terms), 'free until 5 days before check-in')
})

test('listings still on a preset keep the preset wording', () => {
  const terms = readStayTerms({ cancellation_policy: 'moderate' })
  assert.equal(guestCancellationText(terms), 'Cancel at least 5 days before check-in for a full refund.')
  assert.deepEqual(presetAsRule('moderate'), { freeDays: 5, keep: 'all' })
  assert.equal(guestCancellationText(readStayTerms({})), null)
})

test('form values: read only when the marker is present, preset left alone', () => {
  assert.equal(readStayTermsFromForm(form({ cancellationFreeDays: '7' })), null)
  const values = readStayTermsFromForm(
    form({ stayTermsShown: '1', checkInTime: '15:00', cancellationFreeDays: '7', cancellationKeep: 'all' }),
  )
  assert.equal(values.check_in_time, '15:00')
  assert.equal(values.cancellation_free_days, 7)
  assert.equal(values.cancellation_keep, 'all')
  assert.equal('cancellation_policy' in values, false)
  const bogusKeep = readStayTermsFromForm(form({ stayTermsShown: '1', cancellationFreeDays: '0', cancellationKeep: 'x' }))
  assert.equal(bogusKeep.cancellation_keep, 'deposit')
})

test('host currency comes from the profile', () => {
  assert.deepEqual(hostCurrencyFromProfile('usd'), { currency: 'USD', supported: true })
  assert.deepEqual(hostCurrencyFromProfile('JPY'), { currency: 'ILS', supported: false })
  assert.deepEqual(hostCurrencyFromProfile(null), { currency: 'ILS', supported: false })
})
