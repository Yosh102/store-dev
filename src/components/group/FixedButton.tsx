import React, { useState, useEffect } from 'react';
import Link from 'next/link';

const PlayTuneBackButton = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    // メニューの状態を監視する関数
    const checkMenuState = () => {
      // メニューが開いているかどうかを判定
      // 通常のハンバーガーメニューのクラスや属性を確認
      const menuButton = document.querySelector('[aria-expanded="true"]');
      const mobileMenu = document.querySelector('.mobile-menu-open');
      const bodyOverflow = document.body.style.overflow === 'hidden';
      
      setIsMenuOpen(!!(menuButton || mobileMenu || bodyOverflow));
    };

    // 初期チェック
    checkMenuState();

    // MutationObserverでDOM変更を監視
    const observer = new MutationObserver(checkMenuState);
    
    // body要素とその子要素の変更を監視
    observer.observe(document.body, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ['aria-expanded', 'class', 'style']
    });

    // リサイズイベントでもチェック
    window.addEventListener('resize', checkMenuState);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', checkMenuState);
    };
  }, []);

  return (
    <div
      className={`fixed bottom-6 right-6 z-40 transition-all duration-300 ease-in-out ${
        isMenuOpen ? 'opacity-0 pointer-events-none scale-95' : 'opacity-100 pointer-events-auto scale-100'
      }`}
    >
      <Link
        href="https://playtune.jp"
        className="group flex items-center justify-center w-14 h-14 bg-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
        target="_self"
        rel="noopener noreferrer"
      >
        <div className="text-center">
          <div className="text-xs font-bold text-black leading-tight">
            PLAY TUNE
          </div>
        </div>
        
        {/* ホバー時のツールチップ */}
        <div className="absolute bottom-full right-0 mb-2 px-3 py-1 bg-black text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
          トップへ戻る
          <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-black"></div>
        </div>
      </Link>
    </div>
  );
};

export default PlayTuneBackButton;