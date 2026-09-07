import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getSaved, toggleSavedAPI } from '@/lib/api';

type SavedContextValue = {
  savedIds: number[];
  isSaved: (id: number) => boolean;
  toggleSaved: (id: number) => void;
};

const SavedContext = createContext<SavedContextValue | null>(null);
const STORAGE_KEY = '@og-landmark/saved-properties';

export function SavedProvider({ children }: { children: React.ReactNode }) {
  const [savedIds, setSavedIds] = useState<number[]>([]);
  const { user, isLoggedIn } = useAuth();

  // Load from AsyncStorage on first mount (guest or logged-in)
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => { if (value) setSavedIds(JSON.parse(value) as number[]); })
      .catch(() => undefined);
  }, []);

  // When user logs in, sync saved IDs from the backend and merge with local
  useEffect(() => {
    if (!isLoggedIn || !user) return;
    const numId = Number(user.id);
    if (!numId) return;
    getSaved(numId)
      .then((apiIds) => {
        setSavedIds((local) => {
          const merged = Array.from(new Set([...local, ...apiIds]));
          AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged)).catch(() => undefined);
          return merged;
        });
      })
      .catch(() => undefined);
  }, [isLoggedIn, user?.id]);

  const toggleSaved = (id: number) => {
    setSavedIds((current) => {
      const next = current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id];
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => undefined);
      // Sync toggle with backend if logged in
      if (isLoggedIn && user) {
        const numId = Number(user.id);
        if (numId) toggleSavedAPI(numId, id).catch(() => undefined);
      }
      return next;
    });
  };

  const value = useMemo(
    () => ({ savedIds, isSaved: (id: number) => savedIds.includes(id), toggleSaved }),
    [savedIds],
  );

  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>;
}

export function useSaved() {
  const context = useContext(SavedContext);
  if (!context) throw new Error('useSaved must be used inside SavedProvider');
  return context;
}
