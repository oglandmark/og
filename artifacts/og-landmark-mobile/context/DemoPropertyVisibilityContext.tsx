import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getMobileSettings } from '@/lib/api';

type DemoPropertyVisibilityValue = {
  hiddenDemoPropertyIds: number[];
  deletedDemoProjectIds: string[];
  refreshDemoPropertyVisibility: () => Promise<number[]>;
};

const DemoPropertyVisibilityContext = createContext<DemoPropertyVisibilityValue | null>(null);

export function DemoPropertyVisibilityProvider({ children }: { children: ReactNode }) {
  const [hiddenDemoPropertyIds, setHiddenDemoPropertyIds] = useState<number[]>([]);
  const [deletedDemoProjectIds, setDeletedDemoProjectIds] = useState<string[]>([]);

  const refreshDemoPropertyVisibility = useCallback(async () => {
    const settings = await getMobileSettings();
    const ids = Array.isArray(settings.hiddenDemoPropertyIds)
      ? [...new Set(settings.hiddenDemoPropertyIds.filter((id) => Number.isInteger(id) && id > 0))]
      : [];
    const deletedDemoIds = Array.isArray(settings.deletedDemoPropertyIds)
      ? settings.deletedDemoPropertyIds.filter((id) => Number.isInteger(id) && id > 0)
      : [];
    setHiddenDemoPropertyIds([...new Set([...ids, ...deletedDemoIds])]);
    setDeletedDemoProjectIds(
      Array.isArray(settings.deletedDemoProjectIds)
        ? [...new Set(settings.deletedDemoProjectIds.filter((id) => typeof id === 'string' && id.length > 0))]
        : [],
    );
    return ids;
  }, []);

  useEffect(() => {
    void refreshDemoPropertyVisibility().catch(() => undefined);
  }, [refreshDemoPropertyVisibility]);

  const value = useMemo(
    () => ({ hiddenDemoPropertyIds, deletedDemoProjectIds, refreshDemoPropertyVisibility }),
    [hiddenDemoPropertyIds, deletedDemoProjectIds, refreshDemoPropertyVisibility],
  );

  return (
    <DemoPropertyVisibilityContext.Provider value={value}>
      {children}
    </DemoPropertyVisibilityContext.Provider>
  );
}

export function useDemoPropertyVisibility() {
  const context = useContext(DemoPropertyVisibilityContext);
  if (!context) {
    throw new Error('useDemoPropertyVisibility must be used inside DemoPropertyVisibilityProvider');
  }
  return context;
}
