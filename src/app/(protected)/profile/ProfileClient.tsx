"use client"

import { useState, useEffect, useRef } from "react"
import { useAuth } from "@/context/auth-context"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { User } from "@/types/user"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Toaster, toast } from "react-hot-toast"
import ImageCropModal from "@/components/utils/ImageCropModal"
import { Textarea } from "@/components/ui/textarea"
import { Timestamp } from "firebase/firestore"
import { updateProfile, updateUserAvatar } from "@/services/user-service"

export default function ProfileClient() {
  const { user: authUser } = useAuth()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showCropModal, setShowCropModal] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  useEffect(() => {
    const fetchUserData = async () => {
      if (!authUser || !authUser.uid) {
        setLoading(false)
        setError("User not authenticated")
        return
      }
      setLoading(true)
      try {
        const userDoc = await getDoc(doc(db, "users", authUser.uid))
        if (userDoc.exists()) {
          const userData = userDoc.data() as User
          setUser({
            id: userDoc.id,
            uid: authUser.uid,
            email: userData.email || "",
            displayName: userData.displayName || "",
            groupIds: userData.groupIds || [],
            role: userData.role || "user",
            avatarUrl: userData.avatarUrl || "/img/avatar/default-avatar.png",
            introduction: userData.introduction || "",
            xUsername: userData.xUsername || "",
            youtubeChannel: userData.youtubeChannel || "",
            tiktokUsername: userData.tiktokUsername || "",
            birthday: userData.birthday,
            emailVerified: authUser.emailVerified,
          })
        } else {
          setError("User data not found")
        }
      } catch (err) {
        console.error("Error fetching user data:", err)
        setError("Failed to fetch user data")
      } finally {
        setLoading(false)
      }
    }

    fetchUserData()
  }, [authUser])

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    try {
      const updates: Partial<User> = {}
      if (user.displayName) updates.displayName = user.displayName
      if (user.introduction !== undefined) updates.introduction = user.introduction
      if (user.xUsername !== undefined) updates.xUsername = user.xUsername
      if (user.youtubeChannel !== undefined) updates.youtubeChannel = user.youtubeChannel
      if (user.tiktokUsername !== undefined) updates.tiktokUsername = user.tiktokUsername
      if (user.birthday) updates.birthday = user.birthday

      await updateProfile(user.id, updates)
      toast.success("プロフィールを更新しました")
    } catch (err) {
      console.error("Error updating profile:", err)
      toast.error("プロフィールの更新に失敗しました")
    }
  }

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const img = new Image()
    img.onload = () => {
      if (img.width !== img.height) {
        setSelectedFile(file)
        setShowCropModal(true)
      } else {
        uploadAvatar(file)
      }
    }
    img.src = URL.createObjectURL(file)
  }

  const handleBirthdayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) return
    const date = new Date(e.target.value)
    setUser({
      ...user,
      birthday: Timestamp.fromDate(date),
    })
  }

  const uploadAvatar = async (file: File) => {
    if (!user) return

    setUploadingAvatar(true)
    try {
      // user-serviceを使用してアバターをアップロード
      const avatarUrl = await updateUserAvatar(user.id, file)
      
      // ユーザー状態を更新
      setUser({ ...user, avatarUrl })
      toast.success("アバターを更新しました")
    } catch (err) {
      console.error("Error uploading avatar:", err)
      toast.error("アバターの更新に失敗しました")
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleCroppedImage = (croppedImage: Blob) => {
    setShowCropModal(false)
    uploadAvatar(new File([croppedImage], "cropped_avatar.jpg", { type: "image/jpeg" }))
  }

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>
  if (!user) return <div>No user data available</div>

  // avatarUrlがhttpで始まるかどうかをチェックし、そうでない場合はデフォルト画像を使用
  const avatarSrc = user.avatarUrl && user.avatarUrl.startsWith("http") 
    ? user.avatarUrl 
    : "/img/avatar/default-avatar.png"

  return (
    <div className="container mx-auto px-4 py-8">
      <Toaster />
      
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-6">プロフィール</h1>
          <div className="flex flex-col items-center mb-6">
            <Avatar className="w-24 h-24 cursor-pointer" onClick={handleAvatarClick}>
              <AvatarImage src={avatarSrc} alt={user.displayName ?? "ユーザーアバター"} />
              <AvatarFallback>{user.displayName?.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
            <Button variant="link" onClick={handleAvatarClick} className="mt-2" disabled={uploadingAvatar}>
              {uploadingAvatar ? "アップロード中..." : "アバターを変更"}
            </Button>
          </div>
        </div>
      <div className="mt-8">
        <form onSubmit={handleUpdateProfile} className="space-y-6">
          <div>
            <Label htmlFor="displayName">表示名</Label>
            <Input
              type="text"
              id="displayName"
              placeholder="表示名を入力"
              value={user.displayName ?? ""} // null を空文字に変換
              onChange={(e) => setUser({ ...user, displayName: e.target.value })}
            />
          </div>
          
          <div>
            <Label htmlFor="birthday">誕生日</Label>
            <Input
              type="date"
              id="birthday"
              value={user.birthday ? new Date(user.birthday.toDate()).toISOString().split("T")[0] : ""}
              onChange={handleBirthdayChange}
            />
          </div>
          
          <div>
            <Label htmlFor="introduction">自己紹介 (400文字まで)</Label>
            <Textarea
              id="introduction"
              placeholder="自己紹介を入力"
              value={user.introduction}
              onChange={(e) => setUser({ ...user, introduction: e.target.value })}
              maxLength={400}
            />
          </div>
          
          <div className="pt-4 border-t border-gray-200">
            <h3 className="text-lg font-medium mb-4">SNSアカウント</h3>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="xUsername">X (Twitter) ユーザー名</Label>
                <Input
                  type="text"
                  id="xUsername"
                  placeholder="@username"
                  value={user.xUsername}
                  onChange={(e) => setUser({ ...user, xUsername: e.target.value })}
                />
              </div>
              
              <div>
                <Label htmlFor="youtubeChannel">YouTube チャンネル URL</Label>
                <Input
                  type="text"
                  id="youtubeChannel"
                  placeholder="@playtune_official"
                  value={user.youtubeChannel}
                  onChange={(e) => setUser({ ...user, youtubeChannel: e.target.value })}
                />
              </div>
              
              <div>
                <Label htmlFor="tiktokUsername">TikTok ユーザー名</Label>
                <Input
                  type="text"
                  id="tiktokUsername"
                  placeholder="@username"
                  value={user.tiktokUsername}
                  onChange={(e) => setUser({ ...user, tiktokUsername: e.target.value })}
                />
              </div>
            </div>
          </div>
          
          <div className="pt-4">
            <Button 
              type="submit" 
              className="w-full md:w-auto bg-black hover:bg-gray-700 text-white"
            >
              プロフィールを更新
            </Button>
          </div>
        </form>
      </div>
      
      {showCropModal && selectedFile && (
        <ImageCropModal file={selectedFile} onCrop={handleCroppedImage} onClose={() => setShowCropModal(false)} />
      )}
    </div>
  )
}