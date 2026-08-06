import { updatePaymentRouteSettings } from '@/app/admin/settings/actions'

export function PaymentRouteControlsForm({
  jlmPaymentsEnabled,
  directPaymentsEnabled,
}: {
  jlmPaymentsEnabled: boolean
  directPaymentsEnabled: boolean
}) {
  return (
    <form action={updatePaymentRouteSettings} className="mt-4 space-y-3">
      <label className="flex items-center justify-between gap-4 rounded-2xl bg-[#F8F5F2] p-4">
        <span>
          <span className="block text-sm font-bold text-stone-950">
            Allow JLM-collected online payments
          </span>
          <span className="mt-1 block text-xs leading-5 text-stone-500">
            Turn this off to hide Book now payments across the website, even if hosts enabled them.
          </span>
        </span>
        <input
          type="checkbox"
          name="jlmPaymentsEnabled"
          defaultChecked={jlmPaymentsEnabled}
          className="relative h-7 w-12 shrink-0 cursor-pointer appearance-none rounded-full bg-stone-300 p-1 transition checked:bg-[#c76f55] after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition checked:after:translate-x-5"
        />
      </label>

      <label className="flex items-center justify-between gap-4 rounded-2xl bg-[#F8F5F2] p-4">
        <span>
          <span className="block text-sm font-bold text-stone-950">
            Allow direct-to-host payments
          </span>
          <span className="mt-1 block text-xs leading-5 text-stone-500">
            Turn this off to stop hosts offering direct payment instructions.
          </span>
        </span>
        <input
          type="checkbox"
          name="directPaymentsEnabled"
          defaultChecked={directPaymentsEnabled}
          className="relative h-7 w-12 shrink-0 cursor-pointer appearance-none rounded-full bg-stone-300 p-1 transition checked:bg-[#c76f55] after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition checked:after:translate-x-5"
        />
      </label>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-stone-500">
          JLM payments: {jlmPaymentsEnabled ? 'enabled' : 'off'} / direct payments:{' '}
          {directPaymentsEnabled ? 'enabled' : 'off'}
        </p>
        <button
          type="submit"
          className="rounded-full bg-stone-950 px-5 py-2 text-sm font-bold text-white transition hover:bg-stone-800"
        >
          Save payment controls
        </button>
      </div>
    </form>
  )
}

