// app/(protected)/cart/page.tsx
import { Metadata } from 'next';
import SchedulePage from './ScheduleClient';

export const metadata: Metadata = {
  title: '配信スケジュール | PLAY TUNE オフィシャルサイト',
  description: 'PLAY TUNE所属タレントの生配信予定一覧です。',
};

export default function CartPage() {
  return <SchedulePage />;
}