import { db } from './firebase';
import { collection, addDoc, doc, getDoc, setDoc, getDocs, updateDoc } from 'firebase/firestore';

import { Product } from '@/types/product';

export async function getUserRole(uid: string): Promise<string | null> {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      return userDoc.data().role || null;
    }
    return null;
  } catch (error) {
    // console.error('Error getting user role:', error);
    return null;
  }
}

export async function setUserRole(uid: string, role: string): Promise<void> {
  try {
    await setDoc(doc(db, 'users', uid), { role }, { merge: true });
  } catch (error) {
    // console.error('Error setting user role:', error);
    throw error;
  }
}
