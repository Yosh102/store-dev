import Link from "next/link"
import Image from "next/image"
import { ArrowRight } from "lucide-react"

interface PromoCardProps {
  title: string
  description: string
  href: string
  className?: string
  imageUrl: string
  descriptionClassName?: string
}

export function PromoCard({
  title,
  description,
  href,
  className = "",
  imageUrl,
  descriptionClassName = "",
}: PromoCardProps) {
  return (
    <Link
      href={href}
      className={`
        group block overflow-hidden
        rounded-2xl
        transition-all duration-300
        hover:shadow-lg hover:translate-y-[-4px]
        ${className}
      `}
    >
      <div className="flex flex-row h-full">
        {/* テキストコンテンツ部分 - スマホでは幅100% */}
        <div className="w-full md:w-2/3 p-5 md:p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-white mb-1 md:mb-2">{title}</h2>
            <p className={`text-white/90 mb-3 md:mb-4 text-sm line-clamp-1 md:line-clamp-2 ${descriptionClassName}`}>
              {description}
            </p>
          </div>
          <span className="inline-flex items-center text-white text-sm font-medium">
            詳しくはこちら
            <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </span>
        </div>
        
        {/* 画像部分 - スマホでは非表示 */}
        {/* <div className="hidden md:block md:w-1/3 relative">
          <div className="h-full">
            <Image 
              src={imageUrl || "/placeholder.svg"} 
              alt={title} 
              fill 
              style={{ objectFit: "cover" }}
              sizes="(max-width: 768px) 0vw, 33vw"
            />
          </div>
        </div> */}
      </div>
    </Link>
  )
}