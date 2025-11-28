import Link from "next/link"
import Image from "next/image"

const Footer = () => {
  return (
    <footer className="bg-black text-black py-12">
      <div className="container mx-auto px-4">
        {/* Logo and Company Info */}
        <div className="mb-8">
          <Link href="/">
            <Image src="/logo_white.png" alt="PLAYTUNE STORE" width={200} height={50} />
          </Link>
        </div>

        {/* Menu Links */}
        <div className="mb-8">
          {/* Store Related Links */}
          <ul className="flex flex-wrap gap-x-6 gap-y-2 mb-4">
            <li>
              <Link href="/" className="hover:underline text-white">
                Home
              </Link>
            </li>
            <li>
              <Link href="/group" className="hover:underline text-white">
                Talents
              </Link>
            </li>
            <li>
              <Link href="/store" className="hover:underline text-white">
                Store
              </Link>
            </li>
            <li>
              <Link href="/membership" className="hover:underline text-white">
                Membership
              </Link>
            </li>
            <li>
              <Link href="https://audition.playtune.jp" target="_blank" rel="noopener noreferrer"className="hover:underline text-white">
                Audition
              </Link>
            </li>
          </ul>

          {/* Policy and Company Links */}
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {/* <li>
              <Link href="/concept" className="hover:underline text-white">
                2.9次元アイドルとは
              </Link>
            </li> */}
            <li>
              <Link href="/privacy-policy" className="hover:underline text-white">
                プライバシーポリシー
              </Link>
            </li>
            <li>
              <Link href="/terms-of-service" className="hover:underline text-white">
                利用規約
              </Link>
            </li>
            <li>
              <Link href="/legal" className="hover:underline text-white">
                特定商取引法に基づく表記
              </Link>
            </li>
            <li>
              <Link href="https://paradigmai.co.jp" className="hover:underline text-white">
                運営会社
              </Link>
            </li>
            <li>
              <Link href="/contact" className="hover:underline text-white">
                お問い合わせ
              </Link>
            </li>
          </ul>
        </div>
        <div className="text-sm text-white">
          <p>&copy; {new Date().getFullYear()} PLAY TUNE / Paradigm AI Inc. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}

export default Footer

