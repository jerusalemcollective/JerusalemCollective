import { redirect } from 'next/navigation'

// The separate Hosts directory is now folded into the unified /admin/users
// directory (host management moved to each user's detail page).
export default function AdminHostsRedirect() {
  redirect('/admin/users?role=host')
}
