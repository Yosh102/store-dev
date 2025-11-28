import type { Timestamp } from "firebase/firestore";

export interface LiveSchedule {
  id: string;
  title: string;
  description: string;
  startTime: Timestamp;
  endTime: Timestamp;
  platform: string;
  url: string;
  thumbnailUrl?: string;
  streamers: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}
