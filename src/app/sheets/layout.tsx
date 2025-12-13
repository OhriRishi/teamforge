'use client'

import { SheetsProvider } from '@/components/SheetsProvider'

export default function SheetsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SheetsProvider>
      {children}
    </SheetsProvider>
  )
}
