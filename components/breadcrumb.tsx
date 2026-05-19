import Link from 'next/link'

type BreadcrumbItem = {
  label: string
  href?: string
}

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <div className="mb-6 flex items-center gap-2 text-sm text-stone-500">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="flex items-center gap-2">
          {index > 0 && <span>/</span>}
          {item.href ? (
            <Link href={item.href} className="hover:text-[#c76f55]">
              {item.label}
            </Link>
          ) : (
            <span className="text-stone-900">{item.label}</span>
          )}
        </span>
      ))}
    </div>
  )
}
