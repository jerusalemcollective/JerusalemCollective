import { redirect } from 'next/navigation'

// The real saved-stays list lives in the guest account. Logged-out visitors are
// sent on to the login page by the account layout.
export default function SavedPage() {
  redirect('/account/saved')
}
