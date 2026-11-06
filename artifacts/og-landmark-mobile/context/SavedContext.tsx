import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getSaved, toggleSavedAPI } from '@/lib/api';

type SavedContextValue = {
  savedIds: number[];
  isSaved: (id: number) => boolean;
  toggleSaved: (id: number) => void;
  refreshSaved: () => Promise<void>;
};

const SavedContext = createContext<SavedContextValue | null>(null);
const STORAGE_KEY = '@og-landmark/saved-properties';

export function SavedProvider({ children }: { children: React.ReactNode }) {
  const [savedIds, setSavedIds] = useState<number[]>([]);
  const { user, isLoggedIn } = useAuth();

  const refreshSaved = useCallback(async () => {
    const stored = await AsyncStorage.getItem(STORAGE_KEY).catch(() => null);
    let localIds: number[] = [];
    try {
      if (stored) localIds = JSON.parse(stored) as number[];
    } catch {
      localIds = [];
    }
    let nextIds = localIds;
    const numId = Number(user?.id);
    if (isLoggedIn && numId) {
      try {
        const apiIds = await getSaved(numId);
        nextIds = Array.from(new Set([...localIds, ...apiIds]));
      } catch {
        // Keep locally saved properties available when the API is offline.
      }
    }
    setSavedIds(nextIds);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextIds)).catch(() => undefined);
  }, [isLoggedIn, user?.id]);

  useEffect(() => { void refreshSaved(); }, [refreshSaved]);

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
    () => ({ savedIds, isSaved: (id: number) => savedIds.includes(id), toggleSaved, refreshSaved }),
    [savedIds, refreshSaved],
  );

  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>;
}

export function useSaved() {
  const context = useContext(SavedContext);
  if (!context) throw new Error('useSaved must be used inside SavedProvider');
  return context;
}
