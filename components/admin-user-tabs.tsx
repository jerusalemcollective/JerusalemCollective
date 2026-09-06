'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'

type Tab = { key: string; label: string; content: ReactNode }

// Client tabs wrapper for the admin user profile. Server-rendered panel content
// (including the host action forms) is passed in as ReactNode and toggled with
// `hidden`, so switching tabs is instant and the forms still post as normal.
export function AdminUserTabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(tabs[0]?.key ?? '')

  return (
    <div>
      <div role="tablist" className="mb-5 flex flex-wrap gap-2 border-b border-stone-200 pb-3">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active === tab.key}
            onClick={() => setActive(tab.key)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              active === tab.key ? 'bg-stone-950 text-white' : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div key={tab.key} role="tabpanel" hidden={active !== tab.key}>
          {tab.content}
        </div>
      ))}
    </div>
  )
}
