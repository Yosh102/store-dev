import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc, Timestamp } from 'firebase/firestore';
import { Product } from '@/types/product';


export async function getProducts(): Promise<Product[]> {
  const productsRef = collection(db, 'products');
  const now = Timestamp.now();
  
  const q = query(
    productsRef,
    where('status', '==', 'published'),
    where('publishStartDate', '<=', now),
    where('publishEndDate', '>', now),
    orderBy('publishStartDate', 'desc'),
    limit(20)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as Product));
}

export async function getProductById(id: string): Promise<Product | null> {
  const productRef = doc(db, 'products', id);
  const productSnap = await getDoc(productRef);

  if (productSnap.exists()) {
    return {
      id: productSnap.id,
      ...productSnap.data()
    } as Product;
  } else {
    return null;
  }
}

