// app/(authenticated)/notifications/page.tsx
import { Metadata } from 'next'
import NotificationSettingsClient from './NotificationSettingsClient'

export const metadata: Metadata = {
  title: 'メール通知設定 | PLAY TUNE',
  description: 'メール通知の設定を管理します',
  robots: {
    index: false,
    follow: false,
  },
}

export default function NotificationsPage() {
  return <NotificationSettingsClient />
}