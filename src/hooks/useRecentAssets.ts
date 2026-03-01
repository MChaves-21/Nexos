import { useState, useCallback } from "react";
import { B3Asset } from "@/data/b3-tickers";

const STORAGE_KEY = "nexos-recent-assets";
const MAX_RECENT = 8;

function loadRecent(): B3Asset[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveRecent(assets: B3Asset[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(assets));
  } catch {
    // silently fail
  }
}

export function useRecentAssets() {
  const [recentAssets, setRecentAssets] = useState<B3Asset[]>(loadRecent);

  const addRecent = useCallback((asset: B3Asset) => {
    setRecentAssets((prev) => {
      const filtered = prev.filter((a) => a.ticker !== asset.ticker);
      const updated = [asset, ...filtered].slice(0, MAX_RECENT);
      saveRecent(updated);
      return updated;
    });
  }, []);

  const removeRecent = useCallback((ticker: string) => {
    setRecentAssets((prev) => {
      const updated = prev.filter((a) => a.ticker !== ticker);
      saveRecent(updated);
      return updated;
    });
  }, []);

  const clearRecent = useCallback(() => {
    setRecentAssets([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { recentAssets, addRecent, removeRecent, clearRecent };
}
