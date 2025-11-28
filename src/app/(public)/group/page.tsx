// app/(protected)/cart/page.tsx
import { Metadata } from 'next';
import GroupListClient from './GroupListClient';

export const metadata: Metadata = {
  title: '所属グループ一覧 | PLAY TUNE オフィシャルサイト',
  description: 'PLAY TUNE オフィシャルストア',
};

export default function GroupListPage() {
  return <GroupListClient />;
}