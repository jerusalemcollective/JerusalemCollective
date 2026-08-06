// Metadata for /stays lives in app/stays/page.tsx (a server component that
// exports its own richer metadata incl. openGraph/twitter). This layout is a
// pass-through; duplicating metadata here caused a redundant/conflicting tag.
export default function StaysLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
