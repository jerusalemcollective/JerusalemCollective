import { updateServicesVisibilitySetting } from '@/app/admin/settings/actions'

export function ServicesVisibilityForm({
  enabled,
}: {
  enabled: boolean
}) {
  return (
    <form action={updateServicesVisibilitySetting} className="mt-4">
      <label className="flex items-center justify-between gap-4 rounded-2xl bg-[#F8F5F2] p-4">
        <span>
          <span className="block text-sm font-bold text-stone-950">
            Show Services on the website
          </span>
          <span className="mt-1 block text-xs leading-5 text-stone-500">
            Turn this off until catering, cleaning, and related service pages are launch ready.
          </span>
        </span>
        <input
          type="checkbox"
          name="servicesBarEnabled"
          defaultChecked={enabled}
          className="h-5 w-5 rounded border-stone-300 text-[#c76f55]"
        />
      </label>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-stone-500">
          Current status: {enabled ? 'visible' : 'hidden'}
        </p>
        <button
          type="submit"
          className="rounded-full bg-stone-950 px-5 py-2 text-sm font-bold text-white transition hover:bg-stone-800"
        >
          Save visibility
        </button>
      </div>
    </form>
  )
}
