// src/app/api/store/products/[id]/route.ts
import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";

type ProductDoc = {
  status?: "draft" | "published" | "archived";
  publishStartDate?: FirebaseFirestore.Timestamp | null;
  publishEndDate?: FirebaseFirestore.Timestamp | null;
  isMembersOnly?: boolean;
  groups?: string[];
  [key: string]: any;
};

function isWithinPublishWindow(p?: ProductDoc) {
  if (!p) return false;
  const now = new Date();
  if (p.publishStartDate && p.publishStartDate.toDate() > now) return false;
  if (p.publishEndDate && p.publishEndDate.toDate() <= now) return false;
  return true;
}

async function userHasActiveMembership(uid: string, product: ProductDoc) {
  if (!product.isMembersOnly) return true;
  const groups = Array.isArray(product.groups) ? product.groups : [];
  if (groups.length === 0) return false;

  const userSnap = await adminDb.collection("users").doc(uid).get();
  const user = userSnap.exists ? (userSnap.data() as any) : null;
  const subs = user?.subscriptions || {};
  return groups.some((gid: string) => subs?.[gid]?.status === "active");
}

export async function GET(req: Request, context: any) {
  // ★ ここで安全に型アサート（パラメータ自体には注釈を付けない）
  const { params } = context as { params: { id: string } };

  try {
    const id = params.id;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const snap = await adminDb.collection("products").doc(id).get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const data = snap.data() as ProductDoc;

    if (data.status !== "published" || !isWithinPublishWindow(data)) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    if (data.isMembersOnly) {
      const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
      const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;

      if (!token) {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
      }

      let uid: string;
      try {
        const decoded = await adminAuth.verifyIdToken(token);
        uid = decoded.uid;
      } catch {
        return NextResponse.json({ error: "Invalid token" }, { status: 401 });
      }

      const allowed = await userHasActiveMembership(uid, data);
      if (!allowed) {
        return NextResponse.json({ error: "Membership required" }, { status: 403 });
      }
    }

    const product = { id: snap.id, ...data };
    const headers =
      data.isMembersOnly
        ? { "Cache-Control": "no-store" }
        : { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" };

    return NextResponse.json({ product }, { status: 200, headers });
  } catch (err) {
    console.error("[GET /api/store/products/[id]]", err);
    return NextResponse.json({ error: "Failed to fetch product" }, { status: 500 });
  }
}
