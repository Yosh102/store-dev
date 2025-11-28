import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
  DocumentData,
  Timestamp,
} from "firebase/firestore";
import type { LiveSchedule } from "@/types/live";

export async function fetchUpcomingAndOngoingLives(): Promise<LiveSchedule[]> {
  const now = new Date();
  const q = query(
    collection(db, "live_schedule"),
    where("endTime", ">=", Timestamp.fromDate(now)), // まだ終わっていない
    orderBy("startTime", "asc")
  );

  const snap = await getDocs(q);
  return snap.docs.map(
    (d) => ({ id: d.id, ...(d.data() as DocumentData) }) as LiveSchedule
  );
}
