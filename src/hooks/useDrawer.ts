import { useState, useEffect, useCallback } from 'react';
import { DrawerItem } from '@/types/drawer';
import { ParametricParams, ObjectType } from '@/types/parametric';

const STORAGE_KEY = 'parametric-drawer';

export const useDrawer = () => {
  const [items, setItems] = useState<DrawerItem[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setItems(parsed);
        }
      }
    } catch (e) {
      console.warn('Failed to load drawer from localStorage:', e);
    }
  }, []);

  // Persist to localStorage on changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn('Failed to save drawer to localStorage:', e);
    }
  }, [items]);

  const addItem = useCallback((
    params: ParametricParams,
    objectType: ObjectType,
    thumbnail: string
  ) => {
    const newItem: DrawerItem = {
      id: `drawer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      params,
      objectType,
      thumbnail,
      createdAt: Date.now(),
    };
    setItems((prev) => [newItem, ...prev]);
    return newItem.id;
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setItems([]);
  }, []);

  return {
    items,
    addItem,
    removeItem,
    clearAll,
    count: items.length,
  };
};
