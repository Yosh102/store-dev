"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from "@/components/ui/button"
import { db } from "@/lib/firebase"
import { doc, updateDoc, serverTimestamp, getDoc } from "firebase/firestore"
import { type MemberWithProfile } from "@/types/group"
import { type User, type FavoriteMember } from "@/types/user"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, Heart, AlertTriangle } from "lucide-react"
import { CelebrationPopup } from "@/components/group/CelebrationPopup"

// Helper function to resolve image URLs
const resolveImageUrl = (imageUrl: string | undefined): string => {
  if (!imageUrl) return "/placeholder.svg";
  
  // If it's a Firebase Storage URL, use it directly
  if (imageUrl && typeof imageUrl === 'string' && imageUrl.includes('firebasestorage.googleapis.com')) {
    return imageUrl;
  }
  
  // If it starts with a slash, it's a local path
  if (imageUrl.startsWith('/')) {
    return imageUrl;
  }
  
  // Otherwise, add a slash prefix
  return `/${imageUrl}`;
}

interface FavoriteMemberModalProps {
  isOpen: boolean
  onClose: () => void
  members: MemberWithProfile[]
  groupId: string
  groupName: string
  user: User
  onSelected: (member: FavoriteMember) => void
}

export function FavoriteMemberModal({
  isOpen,
  onClose,
  members,
  groupId,
  groupName,
  user,
  onSelected
}: FavoriteMemberModalProps) {
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [alreadySelected, setAlreadySelected] = useState(false)
  const [existingFavoriteMember, setExistingFavoriteMember] = useState<FavoriteMember | null>(null)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [selectedMemberInfo, setSelectedMemberInfo] = useState<MemberWithProfile | null>(null)
  const [showCelebration, setShowCelebration] = useState(false)
  const [newFavoriteMember, setNewFavoriteMember] = useState<FavoriteMember | null>(null)

  // 初期ロード時にFirestoreから既存の推しメン情報を確認
  useEffect(() => {
    const checkExistingFavorite = async () => {
      setChecking(true);
      try {
        // ユーザードキュメントを取得
        const userRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          
          // 既に推しメンが選択されているか確認
          if (userData.favoriteMembers && userData.favoriteMembers[groupId]) {
            setAlreadySelected(true);
            setExistingFavoriteMember(userData.favoriteMembers[groupId]);
          } else {
            setAlreadySelected(false);
            setExistingFavoriteMember(null);
          }
        }
      } catch (err) {
        console.error("Error checking existing favorite member:", err);
        setError("推しメン情報の取得中にエラーが発生しました");
      } finally {
        setChecking(false);
      }
    };
    
    if (isOpen && user) {
      checkExistingFavorite();
    }
  }, [groupId, user, isOpen]);

  // 選択したメンバーの確認画面を表示
  const handleConfirmSelection = () => {
    if (!selectedMemberId) {
      setError("推しメンを選択してください");
      return;
    }

    const member = members.find(m => m.id === selectedMemberId);
    if (member) {
      setSelectedMemberInfo(member);
      setShowConfirmation(true);
    } else {
      setError("選択されたメンバーが見つかりません");
    }
  };

  const handleSelectMember = async () => {
    if (!selectedMemberId) {
      setError("推しメンを選択してください");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 念のため再度Firestoreを確認して既に選択済みでないことを確認
      const userRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        
        if (userData.favoriteMembers && userData.favoriteMembers[groupId]) {
          setAlreadySelected(true);
          setError("このグループでは既に推しメンを選択済みです");
          setLoading(false);
          return;
        }
      }

      const selectedMember = members.find(m => m.id === selectedMemberId);
      
      if (!selectedMember) {
        throw new Error("選択されたメンバーが見つかりません");
      }

      const favoriteMember: FavoriteMember = {
        memberId: selectedMember.id,
        memberName: selectedMember.name,
        groupId: groupId,
        selectedAt: serverTimestamp() as any
      };

      // Firestoreのユーザードキュメントに推しメン情報を追加
      await updateDoc(userRef, {
        [`favoriteMembers.${groupId}`]: favoriteMember
      });

      // セレブレーションポップアップを表示するための準備
      setNewFavoriteMember(favoriteMember);
      setShowCelebration(true);
      setLoading(false);
      
      // 親コンポーネントに選択完了を通知
      onSelected(favoriteMember);
    } catch (err) {
      console.error("Error selecting favorite member:", err);
      setError("推しメンの選択中にエラーが発生しました。再度お試しください。");
      setLoading(false);
    }
  };

  // 確認画面と選択画面の後に、セレブレーションポップアップを追加
  return (
    <>
      {/* メイン選択ダイアログ */}
      <Dialog 
        open={isOpen && !showCelebration} 
        onOpenChange={(open) => {
          if (!open && !showCelebration) {
            onClose();
          }
        }}
      >
        <DialogContent 
          className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto mx-auto z-50"
        >
          {!checking && alreadySelected && existingFavoriteMember ? (
            // 既に推しメンを選択済みの場合の表示
            <>
              <DialogHeader>
                <DialogTitle>推しメンは既に選択済みです</DialogTitle>
                <DialogDescription>
                  {groupName}では既に推しメンを選択済みです。推しメンは各グループにつき一度だけ選択できます。
                </DialogDescription>
              </DialogHeader>

              {members.find(m => m.id === existingFavoriteMember.memberId) && (
                <div className="flex flex-col items-center p-6">
                  <div className="relative w-24 h-24 mb-4 rounded-full overflow-hidden border-4 border-pink-400">
                    <Image
                      src={resolveImageUrl(members.find(m => m.id === existingFavoriteMember.memberId)?.profile?.avatarUrl)}
                      alt={existingFavoriteMember.memberName}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <h3 className="text-lg font-bold text-pink-600">{existingFavoriteMember.memberName}</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {existingFavoriteMember.selectedAt ? 
                      `選択日: ${new Date(existingFavoriteMember.selectedAt.seconds * 1000).toLocaleDateString()}` :
                      ''}
                  </p>
                </div>
              )}

              <Button
                onClick={onClose}
                className="w-full mt-4"
              >
                閉じる
              </Button>
            </>
          ) : showConfirmation && selectedMemberInfo ? (
            // 確認画面の表示
            <>
              <DialogHeader>
                <DialogTitle className="text-center">推しメンの確認</DialogTitle>
                <DialogDescription className="text-center">
                  推しメンは一度選ぶと変更できません。本当にこのメンバーを選びますか？
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-col items-center p-6">
                <div className="bg-pink-50 p-5 rounded-lg border border-pink-200 mb-4 w-full">
                  <div className="flex items-center mb-4">
                    <AlertTriangle className="h-5 w-5 text-pink-500 mr-2" />
                    <span className="text-sm font-medium text-pink-700">一度決めたら変更できません</span>
                  </div>
                  <p className="text-xs text-gray-600">
                    推しメンは各グループにつき一度だけ選ぶことができます。選択後は変更できませんので、慎重に選んでください。
                  </p>
                </div>
                
                <div className="relative w-32 h-32 mb-4 rounded-full overflow-hidden border-4 border-pink-400">
                  <Image
                    src={resolveImageUrl(selectedMemberInfo.profile?.avatarUrl)}
                    alt={selectedMemberInfo.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <h3 className="text-xl font-bold text-pink-600 mb-2">{selectedMemberInfo.name}</h3>
                <p className="text-sm text-gray-600 mb-6">
                  このメンバーを推しメンとして登録します。この選択は変更できません。
                </p>
              </div>

              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>エラー</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex flex-col space-y-3">
                <Button
                  onClick={handleSelectMember}
                  className="w-full rounded-full bg-gradient-to-r from-pink-500 to-pink-400 text-white hover:from-pink-600 hover:to-pink-500"
                  disabled={loading}
                >
                  {loading ? '保存中...' : 'はい、この推しメンで決定する'}
                </Button>
                
                <Button
                  onClick={() => setShowConfirmation(false)}
                  variant="outline"
                  className="w-full"
                >
                  選び直す
                </Button>
              </div>
            </>
          ) : (
            // メンバー選択画面（通常表示）
            <>
              <DialogHeader>
                <DialogTitle>推しメンを選ぶ</DialogTitle>
                <DialogDescription>
                  {groupName}のメンバーから、あなたの推しメンを選んでください。一度選ぶと変更できませんのでご注意ください。
                </DialogDescription>
              </DialogHeader>

              {checking ? (
                <div className="flex justify-center items-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 my-4">
                    {members.map((member) => (
                      <div
                        key={member.id}
                        className={`relative flex flex-col items-center p-3 border rounded-lg cursor-pointer transition-all ${
                          selectedMemberId === member.id 
                            ? 'border-pink-500 bg-pink-50' 
                            : 'border-gray-200 hover:border-pink-300'
                        }`}
                        onClick={() => setSelectedMemberId(member.id)}
                      >
                        <div className="relative w-24 h-24 mb-2 rounded-full overflow-hidden">
                          <Image
                            src={resolveImageUrl(member.profile?.avatarUrl)}
                            alt={member.name}
                            fill
                            className="object-cover"
                          />
                          {selectedMemberId === member.id && (
                            <div className="absolute inset-0 flex items-center justify-center bg-pink-500 bg-opacity-30">
                              <Heart className="w-10 h-10 text-white" />
                            </div>
                          )}
                        </div>
                        <span className="text-sm font-medium">{member.name}</span>
                      </div>
                    ))}
                  </div>

                  {error && (
                    <Alert variant="destructive" className="mb-4">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>エラー</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <Button
                    onClick={handleConfirmSelection}
                    className="w-full rounded-full bg-gradient-to-r from-pink-500 to-pink-400 text-white hover:from-pink-600 hover:to-pink-500"
                    disabled={loading || !selectedMemberId}
                  >
                    {loading ? '保存中...' : '推しメンを決定する'}
                  </Button>
                </>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* お祝いポップアップ - 別のダイアログとして表示 */}
      {showCelebration && newFavoriteMember && selectedMemberInfo && (
        <CelebrationPopup
          isOpen={showCelebration}
          onClose={() => {
            setShowCelebration(false);
            onClose();
          }}
          member={newFavoriteMember}
          avatarUrl={selectedMemberInfo.profile?.avatarUrl}
          groupName={groupName}
        />
      )}
    </>
  );
}