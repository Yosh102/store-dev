import { Timestamp } from "firebase/firestore";

export interface Category {
  id: string;
  name: string;
  slug: string;
  createdAt: Timestamp;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
  createdAt: Timestamp;
}

