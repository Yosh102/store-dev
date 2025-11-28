// app/(protected)/cart/page.tsx
import { Metadata } from 'next';
import PasswordResetClient from './PasswordResetClient';

export const metadata: Metadata = {
  title: 'パスワードを忘れた | PLAY TUNE オフィシャルサイト',
  description: 'PLAY TUNE オフィシャルストア',
};

export default function CartPage() {
  return <PasswordResetClient />;
}