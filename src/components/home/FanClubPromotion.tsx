import Link from "next/link"

export function FanClubPromotion() {
  return (
    <section className="bg-gray-100 text-black py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl">
          <h2 className="text-3xl font-bold mb-4">メンバーシップ(FC)に参加しよう！</h2>
          <p className="text-lg mb-6">
            限定コンテンツ、先行チケット予約、メンバーとの特別イベントなど、 様々な特典をお楽しみいただけます。
          </p>
          <Link href="/membership" className="text-xl font-bold">
            メンバーシップ(FC)について→
          </Link>
        </div>
      </div>
    </section>
  )
}

