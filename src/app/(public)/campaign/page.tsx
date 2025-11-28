import CampaignClient from './CampaignCient';
import { Metadata } from 'next';


export const metadata: Metadata = {
  title: '「Feel it」リリース記念キャンペーン | PLAY TUNE オフィシャルサイト',
  description: 'PLAY TUNE オフィシャルストア',
};

export default function CartPage() {
  return <CampaignClient />;
}