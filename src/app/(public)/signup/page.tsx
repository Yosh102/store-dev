// app/(protected)/cart/page.tsx
import { Metadata } from 'next';
import SignUpClient from './SignupClient';

export const metadata: Metadata = {
  title: '会員登録 | PLAY TUNE オフィシャルサイト',
  description: 'PLAY TUNE オフィシャルストア',
};

export default function GroupListPage() {
  return <SignUpClient />;
}