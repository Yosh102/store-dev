"use client"

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useCart } from '@/lib/CartContext';
import { useAuth } from '@/context/auth-context';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, Minus, Truck, Tag } from 'lucide-react';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Group } from '@/types/group'; // Group型をインポート

// PlayTuneBackButton コンポーネント
const PlayTuneBackButton = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [groupInfo, setGroupInfo] = useState<{ name: string; logoUrl?: string; slug: string } | null>(null);
    const searchParams = useSearchParams();
    
    // URLパラメータから戻り先を取得
    const from = searchParams.get('from');
    const groupSlug = searchParams.get('groupSlug');

    useEffect(() => {
        // グループ情報を取得
        const fetchGroupInfo = async () => {
            if ((from === 'group-store' || from === 'group') && groupSlug) {
                try {
                    const groupQuery = query(
                        collection(db, 'groups'),
                        where('slug', '==', groupSlug)
                    );
                    const groupSnap = await getDocs(groupQuery);
                    
                    if (!groupSnap.empty) {
                        // Group型として取得したデータをキャスト
                        const groupData = groupSnap.docs[0].data() as Group;
                        
                        setGroupInfo({
                            name: groupData.name || 'Unknown Group', // デフォルト値を設定
                            logoUrl: groupData.logoUrl, // undefinedの可能性を許可
                            slug: groupSlug
                        });
                    }
                } catch (error) {
                    console.error('Error fetching group info:', error);
                    // エラー時にもデフォルト値を設定
                    setGroupInfo({
                        name: 'Unknown Group',
                        logoUrl: undefined,
                        slug: groupSlug
                    });
                }
            }
        };

        fetchGroupInfo();
    }, [from, groupSlug]);

    useEffect(() => {
        // メニューの状態を監視する関数
        const checkMenuState = () => {
            const menuButton = document.querySelector('[aria-expanded="true"]');
            const mobileMenu = document.querySelector('.mobile-menu-open');
            const bodyOverflow = document.body.style.overflow === 'hidden';
            
            setIsMenuOpen(!!(menuButton || mobileMenu || bodyOverflow));
        };

        checkMenuState();

        const observer = new MutationObserver(checkMenuState);
        observer.observe(document.body, {
            attributes: true,
            childList: true,
            subtree: true,
            attributeFilter: ['aria-expanded', 'class', 'style']
        });

        window.addEventListener('resize', checkMenuState);

        return () => {
            observer.disconnect();
            window.removeEventListener('resize', checkMenuState);
        };
    }, []);

    // リンク先とコンテンツを決定
    const getBackButtonConfig = () => {
        if (from === 'group-store' && groupInfo) {
            return {
                href: `/group/${groupInfo.slug}/store`,
                content: groupInfo.logoUrl ? (
                    <div className="w-8 h-8 relative">
                        <Image
                            src={groupInfo.logoUrl}
                            alt={`${groupInfo.name} logo`}
                            fill
                            className="object-contain"
                        />
                    </div>
                ) : (
                    <div className="text-center">
                        <div className="text-xs font-bold text-white leading-tight">
                            {groupInfo.name}
                        </div>
                    </div>
                ),
                tooltip: `${groupInfo.name}ストアに戻る`
            };
        }
        
        if (from === 'group' && groupInfo) {
            return {
                href: `/group/${groupInfo.slug}`,
                content: groupInfo.logoUrl ? (
                    <div className="w-8 h-8 relative">
                        <Image
                            src={groupInfo.logoUrl}
                            alt={`${groupInfo.name} logo`}
                            fill
                            className="object-contain"
                        />
                    </div>
                ) : (
                    <div className="text-center">
                        <div className="text-xs font-bold text-white leading-tight">
                            {groupInfo.name}
                        </div>
                    </div>
                ),
                tooltip: `${groupInfo.name}に戻る`
            };
        }
        
        // デフォルト: PLAY TUNEトップページ
        return {
            href: 'https://playtune.jp',
            content: (
                <div className="text-center">
                    <div className="text-xs font-bold text-white leading-tight">
                        PLAY TUNE
                    </div>
                </div>
            ),
            tooltip: 'トップへ戻る'
        };
    };

    const config = getBackButtonConfig();

    return (
        <div
            className={`fixed bottom-6 right-6 z-40 transition-all duration-300 ease-in-out ${
                isMenuOpen ? 'opacity-0 pointer-events-none scale-95' : 'opacity-100 pointer-events-auto scale-100'
            }`}
        >
            <Link
                href={config.href}
                className="group flex items-center justify-center w-14 h-14 bg-black rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                target="_self"
                rel="noopener noreferrer"
            >
                {config.content}
                
                {/* ホバー時のツールチップ */}
                <div className="absolute bottom-full right-0 mb-2 px-3 py-1 bg-white text-black text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
                    {config.tooltip}
                    <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white"></div>
                </div>
            </Link>
        </div>
    );
};

export default PlayTuneBackButton;