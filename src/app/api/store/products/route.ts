import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query as fsQuery,
  where,
  orderBy,
} from "firebase/firestore";
import type { Timestamp } from "firebase/firestore";

export const revalidate = 60; // 1分ごと

interface ProductData {
  status?: string;
  publishStartDate?: Timestamp;
  publishEndDate?: Timestamp;
  tags?: string[];
  [key: string]: any;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const tagParam = searchParams.get("tag");
    const limitParam = searchParams.get("limit");
    const normalizedTag = tagParam?.trim().toLowerCase();

    // ✅ published のみを取得
    const colRef = collection(db, "products");
    const q = fsQuery(
      colRef,
      where("status", "==", "published"),
      orderBy("createdAt", "desc")
    );

    const snap = await getDocs(q);
    const now = new Date();

    let products = snap.docs
      .map((d) => {
        const { id: _, ...data } = d.data() as ProductData & { id?: string }; // ✅ dataからidを除外
        return {
          id: d.id, // ドキュメントIDを使用
          ...data,
          tags: Array.isArray(data.tags) ? data.tags : [],
        };
      })
      // ✅ 公開日時のフィルタリング
      .filter((product) => {
        // publishStartDate のチェック
        if (product.publishStartDate) {
          const startDate = product.publishStartDate.toDate();
          if (now < startDate) {
            console.log(
              `[FILTERED OUT] ${product.id} - not yet started (start: ${startDate.toISOString()})`
            );
            return false;
          }
        }

        // publishEndDate のチェック
        if (product.publishEndDate) {
          const endDate = product.publishEndDate.toDate();
          if (now > endDate) {
            console.log(
              `[FILTERED OUT] ${product.id} - already ended (end: ${endDate.toISOString()})`
            );
            return false;
          }
        }

        return true;
      });

    console.log("[/api/store/products] published & date-valid products:", products.length);

    // タグでフィルタ
    if (normalizedTag) {
      products = products.filter((p) =>
        p.tags.some(
          (t: any) =>
            typeof t === "string" && t.trim().toLowerCase() === normalizedTag
        )
      );
      console.log(
        `[/api/store/products] filtered by tag="${normalizedTag}":`,
        products.length
      );
    }

    // limit の適用
    if (limitParam) {
      const n = parseInt(limitParam, 10);
      if (!Number.isNaN(n) && n > 0) {
        products = products.slice(0, n);
      }
    }

    return NextResponse.json({ products });
  } catch (error) {
    console.error("Error fetching products:", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}