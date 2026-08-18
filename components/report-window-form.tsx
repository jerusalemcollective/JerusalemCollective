import { updateReportWindowSetting } from '@/app/admin/settings/actions'

export function ReportWindowForm({ days }: { days: number }) {
  return (
    <form action={updateReportWindowSetting} className="mt-4 flex flex-wrap items-end gap-3">
      <label className="text-sm font-semibold text-stone-700">
        Days after checkout
        <input
          type="number"
          name="reportWindowDays"
          min={1}
          max={365}
          defaultValue={days}
          className="mt-2 block w-32 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900"
        />
      </label>
      <button
        type="submit"
        className="rounded-full bg-stone-950 px-5 py-2 text-sm font-bold text-white transition hover:bg-stone-800"
      >
        Save window
      </button>
    </form>
  )
}
