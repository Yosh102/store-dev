// app/(protected)/cart/page.tsx
import { Metadata } from 'next';
import LoginClient from './LoginClient';

export const metadata: Metadata = {
  title: 'ログイン | PLAY TUNE オフィシャルサイト',
  description: 'PLAY TUNE オフィシャルストア',
};

export default function GroupListPage() {
  return <LoginClient />;
}