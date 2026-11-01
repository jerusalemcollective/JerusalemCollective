// Guards for the check-in/check-out and cancellation helpers in lib/stay-terms.ts.
// Run: `node --test lib/utils/stay-terms.test.mjs`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CANCELLATION_POLICIES,
  CANCELLATION_POLICY_PRESETS,
  cancellationPreset,
  formatStayTime,
  isMissingColumnError,
  parseStayTime,
  readStayTerms,
  readStayTermsFromForm,
  stayTimesLine,
  toTimeInputValue,
  writeWithStayTermsFallback,
} from '../stay-terms.ts'

test('the four presets match the migration check constraint', () => {
  assert.deepEqual([...CANCELLATION_POLICIES], ['flexible', 'moderate', 'strict', 'non_refundable'])
  for (const key of CANCELLATION_POLICIES) {
    const preset = CANCELLATION_POLICY_PRESETS[key]
    assert.ok(preset.label && preset.hostExplanation && preset.guestSentence && preset.summary, key)
  }
  assert.match(CANCELLATION_POLICY_PRESETS.flexible.summary, /24 hours/)
  assert.match(CANCELLATION_POLICY_PRESETS.moderate.summary, /5 days/)
  assert.match(CANCELLATION_POLICY_PRESETS.strict.summary, /50%.*7 days/)
  assert.equal(cancellationPreset('nope'), null)
  assert.equal(cancellationPreset(null), null)
})

test('formatStayTime renders 12-hour times', () => {
  assert.equal(formatStayTime('15:00:00'), '3:00 pm')
  assert.equal(formatStayTime('11:00'), '11:00 am')
  assert.equal(formatStayTime('00:30'), '12:30 am')
  assert.equal(formatStayTime('12:05'), '12:05 pm')
  assert.equal(formatStayTime(''), null)
  assert.equal(formatStayTime(null), null)
  assert.equal(formatStayTime('25:00'), null)
})

test('time input helpers', () => {
  assert.equal(toTimeInputValue('15:00:00'), '15:00')
  assert.equal(toTimeInputValue(null), '')
  assert.equal(parseStayTime('9:30'), '09:30')
  assert.equal(parseStayTime('15:00:00'), '15:00')
  assert.equal(parseStayTime(''), null)
  assert.equal(parseStayTime('3pm'), null)
})

test('stayTimesLine shows only the parts that are set', () => {
  assert.equal(stayTimesLine('15:00', '11:00'), 'Check-in from 3:00 pm · Check-out by 11:00 am')
  assert.equal(stayTimesLine('15:00', null), 'Check-in from 3:00 pm')
  assert.equal(stayTimesLine(null, '10:00:00'), 'Check-out by 10:00 am')
  assert.equal(stayTimesLine(null, null), null)
})

test('readStayTerms tolerates rows without the columns', () => {
  assert.deepEqual(readStayTerms({ id: 'x' }), {
    check_in_time: null,
    check_out_time: null,
    cancellation_policy: null,
    cancellation_policy_notes: null,
  })
  assert.equal(readStayTerms({ cancellation_policy: 'bogus' }).cancellation_policy, null)
  assert.equal(readStayTerms({ cancellation_policy: 'strict' }).cancellation_policy, 'strict')
})

test('readStayTermsFromForm needs the marker field', () => {
  const form = (entries) => ({ get: (name) => (name in entries ? entries[name] : null) })
  assert.equal(readStayTermsFromForm(form({ checkInTime: '15:00' })), null)
  assert.deepEqual(
    readStayTermsFromForm(
      form({
        stayTermsShown: '1',
        checkInTime: '15:00',
        checkOutTime: '',
        cancellationPolicy: '',
        cancellationPolicyNotes: '  Free date changes  ',
      }),
    ),
    {
      check_in_time: '15:00',
      check_out_time: null,
      cancellation_policy: null,
      cancellation_policy_notes: 'Free date changes',
    },
  )
})

test('missing-column errors are recognised and retried without the columns', async () => {
  assert.equal(isMissingColumnError({ code: '42703' }), true)
  assert.equal(isMissingColumnError({ code: 'PGRST204' }), true)
  assert.equal(isMissingColumnError({ code: '23514' }), false)
  assert.equal(isMissingColumnError(null), false)

  const seen = []
  const result = await writeWithStayTermsFallback({ title: 'A', check_in_time: '15:00' }, async (payload) => {
    seen.push(payload)
    return { error: 'check_in_time' in payload ? { code: 'PGRST204' } : null }
  })
  assert.equal(result.error, null)
  assert.deepEqual(seen, [{ title: 'A', check_in_time: '15:00' }, { title: 'A' }])

  // Other errors are not retried.
  let calls = 0
  const failed = await writeWithStayTermsFallback({ check_in_time: '15:00' }, async () => {
    calls += 1
    return { error: { code: '23514' } }
  })
  assert.equal(calls, 1)
  assert.deepEqual(failed.error, { code: '23514' })
})

