'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { Product } from '@/types/product';
import { Group } from '@/types/group';
import ProductListWrapper from '@/components/store/ProductListWrapper';

export default function StorePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch products
        const productsQuery = query(
          collection(db, 'products'),
          where('status', '==', 'published'),
          orderBy('createdAt', 'desc')
        );
        const productsSnapshot = await getDocs(productsQuery);
        const productsData = productsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Product[];
        setProducts(productsData);

        // Fetch groups
        const groupsQuery = query(collection(db, 'groups'));
        const groupsSnapshot = await getDocs(groupsQuery);
        const groupsData = groupsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Group[];
        setGroups(groupsData);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="min-h-screen">
      <h1 className="sr-only">PLAY TUNE オフィシャルストア</h1>
      <ProductListWrapper 
        initialProducts={products} 
        initialGroups={groups} 
        title="オフィシャルストア商品一覧"
      />
    </div>
  );
}