import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import type { MemberWithProfile } from "@/types/group"
import Image from "next/image"
import { Twitter, Youtube, InstagramIcon as BrandTiktok, Cake, X, Users } from "lucide-react"
import Link from "next/link"

interface MemberDetailModalProps {
  member: MemberWithProfile
  isOpen: boolean
  onClose: () => void
  groupNames: { [key: string]: string }
  groupSlugs?: { [key: string]: string } // グループIDからスラグへのマッピング
}

export function MemberDetailModal({ member, isOpen, onClose, groupNames, groupSlugs = {} }: MemberDetailModalProps) {
  const hasSocialLinks = member.profile?.xUsername || member.profile?.youtubeChannel || member.profile?.tiktokUsername

  const formatBirthday = (timestamp: any) => {
    if (!timestamp) return null
    const date = timestamp.toDate()
    return new Intl.DateTimeFormat("ja-JP", {
      month: "long",
      day: "numeric",
    }).format(date)
  }

  // ユーザーの所属グループを取得 - profile.groupIdsを使用
  // 注: 新しい構造では各グループのmembers配列から逆引きすることもできますが、
  // 移行期間中は両方の方法をサポートするべき
  const userGroupIds = member.profile?.groupIds || []

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[calc(100vw-24px)] sm:max-w-[90vw] md:max-w-[800px] p-0 overflow-hidden bg-white">
        <DialogTitle className="sr-only">{member.name}の詳細</DialogTitle>
        <div className="flex flex-col md:flex-row max-h-[80vh] bg-white shadow-md">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 transition-colors z-10"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Left side - Image */}
          <div className="relative w-full md:w-5/12 flex items-center justify-center p-4">
            <div className="w-full max-w-[320px] mx-auto">
              <div className="relative aspect-square rounded-2xl overflow-hidden">
                <Image
                  src={member.profile?.avatarUrl || "/placeholder.svg"}
                  alt={member.name}
                  fill
                  className="object-cover rounded-2xl"
                  sizes="(max-width: 768px) 100vw, 320px"
                />
              </div>
            </div>
          </div>

          {/* Right side - Content */}
          <div className="w-full md:w-7/12 bg-white text-gray-800 flex flex-col">
            <div className="px-6 py-6 overflow-y-auto max-h-[60vh] md:max-h-[80vh]">
              <h2 className="text-2xl md:text-3xl font-bold mb-4">{member.name}</h2>

              {userGroupIds.length > 0 && (
                <div className="flex items-center gap-2 text-gray-600 mb-4">
                  <Users className="w-5 h-5 flex-shrink-0" />
                  <div className="text-base md:text-lg">
                    {userGroupIds.map((id, index) => (
                      <span key={id}>
                        {index > 0 && <span className="mx-1">/</span>}
                        {groupSlugs[id] ? (
                          <Link 
                            href={`/group/${groupSlugs[id]}`}
                            className="text-blue-600 hover:text-blue-800 hover:underline"
                            onClick={(e) => {
                              // リンククリック時にモーダルを閉じるのを防止
                              e.stopPropagation();
                              // モーダルを閉じる（必要に応じてコメントアウト）
                              onClose();
                            }}
                          >
                            {groupNames[id] || id}
                          </Link>
                        ) : (
                          <span>{groupNames[id] || id}</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {member.profile?.birthday && (
                <div className="flex items-center gap-2 text-gray-600 mb-4">
                  <Cake className="w-5 h-5 flex-shrink-0" />
                  <span>{formatBirthday(member.profile.birthday)}</span>
                </div>
              )}

              {member.profile?.introduction && (
                <div className="mb-6">
                  <h3 className="text-lg md:text-xl font-semibold mb-2">自己紹介</h3>
                  <p className="text-gray-700 whitespace-pre-line">{member.profile.introduction}</p>
                </div>
              )}

              {hasSocialLinks && (
                <div className="mb-4">
                  <h3 className="text-lg md:text-xl font-semibold mb-2">SNS</h3>
                  <div className="flex gap-4">
                    {member.profile?.xUsername && (
                      <a
                        href={`https://twitter.com/${member.profile.xUsername.replace("@", "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-700 hover:text-blue-500 transition-colors"
                        title="X (Twitter)"
                      >
                        <Twitter className="w-6 h-6" />
                      </a>
                    )}

                    {member.profile?.youtubeChannel && (
                      <a
                        href={member.profile.youtubeChannel}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-700 hover:text-red-600 transition-colors"
                        title="YouTube"
                      >
                        <Youtube className="w-6 h-6" />
                      </a>
                    )}

                    {member.profile?.tiktokUsername && (
                      <a
                        href={`https://www.tiktok.com/${member.profile.tiktokUsername}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-700 hover:text-pink-500 transition-colors"
                        title="TikTok"
                      >
                        <BrandTiktok className="w-6 h-6" />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}