"use client";
import React, { useState } from 'react';
import { AlertCircle, Mail, Send, CheckCircle2, XCircle } from 'lucide-react';

const TestEmailInterface = () => {
  const [selectedType, setSelectedType] = useState('basic');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Array<{
    id: number;
    timestamp: string;
    type: string;
    recipient: string;
    success: boolean;
    result?: any;
    error?: string;
  }>>([]);
  const [availableTypes, setAvailableTypes] = useState(null);

  // 固定受信者
  const recipient = 'yoshida@paradigmai.co.jp';

  const emailTypes = [
    { value: 'basic', label: 'SES接続テスト', description: 'SES経由の基本メール送信テスト' },
    { value: 'order_confirmation', label: '注文確認メール', description: '商品注文の確認メール（実際のデザイン）' },
    { value: 'bank_transfer', label: '銀行振込案内', description: '銀行振込の案内メール' },
    { value: 'payment_success', label: '決済成功通知', description: '決済完了の通知メール' },
    { value: 'subscription_welcome', label: 'サブスク開始', description: 'サブスクリプション開始メール' },
    { value: 'password_reset', label: 'パスワードリセット', description: 'パスワードリセット案内' },
    { value: 'content_update', label: 'コンテンツ更新', description: '新しいコンテンツの通知' },
    { value: 'maintenance_notice', label: 'メンテナンス通知', description: 'システムメンテナンスの案内' }
  ];

  const [customParams, setCustomParams] = useState({
    name: '吉田様',
    message: 'SES動作確認テスト',
    groupName: 'PLAY TUNE プレミアム',
    paymentType: 'card'
  });

  const sendTestEmail = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/test/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: selectedType,
          ...customParams
        }),
      });

      const result = await response.json();
      
      const newResult = {
        id: Date.now(),
        timestamp: new Date().toLocaleString('ja-JP'),
        type: selectedType,
        recipient,
        success: result.success,
        result: result.result,
        error: result.error
      };

      setResults(prev => [newResult, ...prev.slice(0, 9)]); // 最新10件を保持

      if (result.success) {
        alert(`✅ テストメールを ${recipient} に送信しました`);
      } else {
        alert(`❌ 送信に失敗しました: ${result.error}`);
      }

    } catch (error) {
      console.error('Test email error:', error);
      const errorMessage = error instanceof Error ? error.message : '不明なエラーが発生しました';
      alert(`❌ エラーが発生しました: ${errorMessage}`);
      
      const errorResult = {
        id: Date.now(),
        timestamp: new Date().toLocaleString('ja-JP'),
        type: selectedType,
        recipient,
        success: false,
        error: error instanceof Error ? error.message : '不明なエラーが発生しました'
      };
      
      setResults(prev => [errorResult, ...prev.slice(0, 9)]);
    } finally {
      setLoading(false);
    }
  };

  const sendAllTests = async () => {
    if (!confirm(`すべてのテストメールを ${recipient} に送信しますか？（8通のメールが送信されます）`)) {
      return;
    }

    setLoading(true);
    try {
      const promises = emailTypes.map(async (emailType) => {
        try {
          const response = await fetch('/api/admin/test/email', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              type: emailType.value,
              ...customParams
            }),
          });

          const result = await response.json();
          return {
            id: Date.now() + Math.random(),
            timestamp: new Date().toLocaleString('ja-JP'),
            type: emailType.value,
            recipient,
            success: result.success,
            result: result.result,
            error: result.error
          };
        } catch (error) {
          return {
            id: Date.now() + Math.random(),
            timestamp: new Date().toLocaleString('ja-JP'),
            type: emailType.value,
            recipient,
            success: false,
            error: error instanceof Error ? error.message : '不明なエラーが発生しました'
          };
        }
      });

      const allResults = await Promise.all(promises);
      setResults(prev => [...allResults, ...prev].slice(0, 20));
      
      const successCount = allResults.filter(r => r.success).length;
      alert(`📧 ${successCount}/${allResults.length} のテストメールを ${recipient} に送信しました`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '不明なエラーが発生しました';
      alert(`❌ 一括送信でエラーが発生しました: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const getAvailableTypes = async () => {
    try {
      const response = await fetch('/api/admin/test/email');
      const data = await response.json();
      setAvailableTypes(data);
    } catch (error) {
      console.error('Failed to get available types:', error);
    }
  };

  React.useEffect(() => {
    getAvailableTypes();
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          <AlertCircle className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-blue-900">SESテストメール送信システム</h2>
        </div>
        <p className="text-blue-700 mt-2">
          AWS SES経由で <code className="bg-blue-100 px-2 py-1 rounded text-sm">noreply@secure.playtune.jp</code> から{' '}
          <code className="bg-blue-100 px-2 py-1 rounded text-sm">{recipient}</code> にテストメールを送信します。
        </p>
      </div>

      {/* 送信設定 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">送信設定</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              送信元
            </label>
            <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-gray-600">
              noreply@secure.playtune.jp
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              受信者（固定）
            </label>
            <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-gray-600">
              {recipient}
            </div>
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              メールタイプ
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {emailTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* カスタムパラメータ */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            カスタムパラメータ
          </label>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={customParams.name}
              onChange={(e) => setCustomParams(prev => ({ ...prev, name: e.target.value }))}
              placeholder="名前"
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
            <input
              type="text"
              value={customParams.groupName}
              onChange={(e) => setCustomParams(prev => ({ ...prev, groupName: e.target.value }))}
              placeholder="グループ名"
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={sendTestEmail}
            disabled={loading}
            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            <span>{loading ? '送信中...' : '選択したメールを送信'}</span>
          </button>
          
          <button
            onClick={sendAllTests}
            disabled={loading}
            className="flex items-center space-x-2 bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 disabled:opacity-50"
          >
            <Mail className="h-4 w-4" />
            <span>全タイプを送信（8通）</span>
          </button>
        </div>
      </div>

      {/* メールタイプ一覧 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">利用可能なメールタイプ</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {emailTypes.map(type => (
            <div
              key={type.value}
              className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                selectedType === type.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setSelectedType(type.value)}
            >
              <div className="font-medium text-sm">{type.label}</div>
              <div className="text-xs text-gray-600 mt-1">{type.description}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 送信結果履歴 */}
      {results.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">送信結果履歴</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {results.map(result => (
              <div key={result.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0 mt-1">
                  {result.success ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 text-sm">
                    <span className="font-medium">{result.type}</span>
                    <span className="text-gray-500">→</span>
                    <span className="text-gray-700">{result.recipient}</span>
                    <span className="text-xs text-gray-500">{result.timestamp}</span>
                  </div>
                  {result.success ? (
                    <div className="text-xs text-green-700 mt-1">
                      ✅ 送信成功
                      {result.result?.messageId && (
                        <span className="ml-2 text-gray-600">ID: {result.result.messageId}</span>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-red-700 mt-1">
                      ❌ 送信失敗: {result.error}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TestEmailInterface;