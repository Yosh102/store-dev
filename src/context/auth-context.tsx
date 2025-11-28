// context/auth-context.tsx - 開発用認証スキップ対応版
"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  auth,
  db,
  onAuthStateChanged,
  FirebaseUser,
} from "@/lib/firebase"; 
import { doc, onSnapshot } from "firebase/firestore";
import { User as FirestoreUser } from "@/types/user"; 

interface AuthContextType {
  user: FirestoreUser | null;
  loading: boolean;
  firebaseUser: FirebaseUser | null;
  getIdToken: () => Promise<string>;
  isDevelopmentMode: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  firebaseUser: null,
  getIdToken: async () => "",
  isDevelopmentMode: false,
});

// 開発用ダミーユーザー
const createDevelopmentUser = (): FirestoreUser => ({
  id: "dev-user-123",
  uid: "dev-user-123",
  email: "dev@example.com",
  displayName: "開発用ユーザー",
  groupIds: [],
  role: "user",
  avatarUrl: "",
  createdAt: undefined,
  introduction: "",
  xUsername: "",
  youtubeChannel: "",
  tiktokUsername: "",
  emailVerified: true,
  subscriptions: {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirestoreUser | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  // 開発モードかどうかの判定
  const isDevelopmentMode = process.env.NODE_ENV === 'development' && 
                           process.env.NEXT_PUBLIC_SKIP_AUTH_IN_DEV === 'true';

  // IDトークンを取得する関数
  const getIdToken = async (): Promise<string> => {
    if (isDevelopmentMode) {
      // 開発モードでは固定トークンを返す
      return "dev-token-123";
    }

    if (!firebaseUser) {
      throw new Error("User is not authenticated");
    }
    
    try {
      return await firebaseUser.getIdToken(true);
    } catch (error) {
      console.error("Error getting ID token:", error);
      throw error;
    }
  };

  useEffect(() => {
    // if (isDevelopmentMode) {
    //   // 開発モードでは認証をスキップしてダミーユーザーを設定
    //   console.log("🔧 Development mode: Skipping authentication");
    //   setUser(createDevelopmentUser());
    //   setLoading(false);
    //   return;
    // }

    // 本番・ステージング環境では通常の認証フロー
    const unsubscribeAuth = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser) {
        setFirebaseUser(fbUser);
        handleUserLoggedIn(fbUser);
      } else {
        setUser(null);
        setFirebaseUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
    };
  }, [isDevelopmentMode]);

  const handleUserLoggedIn = (firebaseUser: FirebaseUser) => {
    const userDocRef = doc(db, "users", firebaseUser.uid);
    const unsubscribeUserDoc = onSnapshot(
      userDocRef,
      (docSnap) => {
        setLoading(true);

        if (docSnap.exists()) {
          const docData = docSnap.data() as Partial<FirestoreUser>;

          const mergedUser: FirestoreUser = {
            id: docData.id ?? firebaseUser.uid,
            uid: firebaseUser.uid,
            email: firebaseUser.email || "",
            displayName: docData.displayName ?? firebaseUser.displayName,
            groupIds: docData.groupIds ?? [],
            role: docData.role ?? "user",
            avatarUrl: docData.avatarUrl ?? "",
            createdAt: docData.createdAt,
            introduction: docData.introduction ?? "",
            xUsername: docData.xUsername ?? "",
            youtubeChannel: docData.youtubeChannel ?? "",
            tiktokUsername: docData.tiktokUsername ?? "",
            emailVerified: firebaseUser.emailVerified,
            subscriptions: docData.subscriptions ?? {},
          };

          setUser(mergedUser);
        } else {
          const fallbackUser: FirestoreUser = {
            id: firebaseUser.uid,
            uid: firebaseUser.uid,
            email: firebaseUser.email || "",
            displayName: firebaseUser.displayName,
            groupIds: [],
            role: "user",
            avatarUrl: "",
            createdAt: undefined,
            introduction: "",
            xUsername: "",
            youtubeChannel: "",
            tiktokUsername: "",
            emailVerified: firebaseUser.emailVerified,
            subscriptions: {},
          };
          setUser(fallbackUser);
        }

        setLoading(false);
      },
      (error) => {
        console.error("Error fetching user document:", error);
        setLoading(false);
      }
    );

    return () => {
      unsubscribeUserDoc();
    };
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      firebaseUser, 
      getIdToken, 
      isDevelopmentMode 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};