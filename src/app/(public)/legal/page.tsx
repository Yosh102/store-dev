import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "特定商取引法に基づく表記 | PLAYTUNE STORE",
  description:
    "PLAYTUNE STOREの特定商取引法に基づく表記ページです。販売事業者の情報、商品の販売価格、支払方法、商品の引渡時期、返品・交換について記載しています。",
}

export default function LegalPage() {
  return (
    <div className="container mx-auto px-10 py-10">
      <h1 className="text-3xl font-bold mb-6">特定商取引法に基づく表記</h1>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">販売事業者</h2>
        <p>Paradigm AI株式会社</p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">所在地</h2>
        <p>〒169-0075</p>
        <p>東京都新宿区高田馬場3-1-5-309</p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">運営責任者</h2>
        <p>代表取締役 吉田 泰陽</p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">連絡先</h2>
        <p>contact@playtune.jp</p>
        <p>050-1725-1558</p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">商品の販売価格</h2>
        <p>各商品ページに表示された価格に消費税が含まれています。</p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">支払方法</h2>
        <ul className="list-disc list-inside">
          <li>クレジットカード</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">商品の引渡時期</h2>
        <p>ご注文確認後、通常3〜5営業日以内に発送いたします。</p>
        <p>ただし、予約商品、受注生産商品、お取り寄せ商品の場合等は、商品ページに記載の発送予定日をご確認ください。</p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">返品・交換について</h2>
        <p>商品到着後8日以内に、未使用・未開封の状態であれば返品・交換を承ります。</p>
        <p>ただし、以下の場合は返品・交換をお受けできません：</p>
        <ul className="list-disc list-inside">
          <li>CD、DVD等の音楽・映像商品で開封済みの場合</li>
          <li>お客様のご都合による返品（サイズ違い、イメージ違いなど）</li>
          <li>特別催事品、福袋商品</li>
        </ul>
        <p>返品・交換にかかる送料はお客様のご負担となります。</p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">その他の注意事項</h2>
        <p>当サイトのサービス内容および価格、商品の仕様等は予告なく変更される場合があります。</p>
        <p>また、当サイトに掲載された商品写真は、印刷または製造上の都合により、実際の商品と異なる場合があります。</p>
      </section>
    </div>
  )
}

