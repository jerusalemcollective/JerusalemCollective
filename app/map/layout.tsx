// Metadata for /map lives in app/map/page.tsx (a server component that exports
// its own metadata). This layout is a pass-through; duplicating metadata here
// caused a redundant and title-conflicting tag.
export default function MapLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
