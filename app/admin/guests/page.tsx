import { redirect } from 'next/navigation'

// The separate Guests directory is now folded into the unified /admin/users
// directory.
export default function AdminGuestsRedirect() {
  redirect('/admin/users?role=guest')
}
