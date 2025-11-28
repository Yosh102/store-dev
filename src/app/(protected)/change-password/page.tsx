// app/(protected)/cart/page.tsx
import { Metadata } from 'next';
import PasswordChangeClient from './PasswordChangeClient';

export const metadata: Metadata = {
  title: 'パスワード変更 | PLAY TUNE オフィシャルサイト',
  description: 'PLAY TUNE オフィシャルストア',
};

export default function CartPage() {
  return <PasswordChangeClient />;
}