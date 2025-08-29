// components/SignOutButton.tsx
'use client'
import { logout } from '@/actions/auth'

export function SignOutButton() {
  return (
    <form action={logout}>
      <button className="text-sm opacity-70 hover:opacity-100">Sign out</button>
    </form>
  )
}