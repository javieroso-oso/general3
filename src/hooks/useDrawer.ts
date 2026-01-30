import { useState, useEffect, useCallback } from 'react';
import { DrawerItem, ParametricDrawerItem, CustomDrawerItem, PlotterDrawerItem, isParametricItem } from '@/types/drawer';
import { ParametricParams, ObjectType } from '@/types/parametric';
import { ProfilePoint, ProfileSettings } from '@/types/custom-profile';
import { PlotterParams, PlotterDrawing } from '@/types/plotter';

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
          // Migrate old items without 'type' field
          const migrated = parsed.map((item: any) => {
            if (!item.type && item.params && item.objectType) {
              return { ...item, type: 'parametric' as const };
            }
            return item;
          });
          setItems(migrated);
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

  const addParametricItem = useCallback((
    params: ParametricParams,
    objectType: ObjectType,
    thumbnail: string
  ) => {
    const newItem: ParametricDrawerItem = {
      id: `drawer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'parametric',
      params,
      objectType,
      thumbnail,
      createdAt: Date.now(),
    };
    setItems((prev) => [newItem, ...prev]);
    return newItem.id;
  }, []);

  const addCustomItem = useCallback((
    profile: ProfilePoint[],
    settings: ProfileSettings,
    thumbnail: string
  ) => {
    const newItem: CustomDrawerItem = {
      id: `drawer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'custom',
      profile,
      settings,
      generationMode: settings.generationMode,
      thumbnail,
      createdAt: Date.now(),
    };
    setItems((prev) => [newItem, ...prev]);
    return newItem.id;
  }, []);

  const addPlotterItem = useCallback((
    plotterParams: PlotterParams,
    drawing: PlotterDrawing,
    thumbnail: string
  ) => {
    const newItem: PlotterDrawerItem = {
      id: `drawer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'plotter',
      plotterParams,
      drawing,
      thumbnail,
      createdAt: Date.now(),
    };
    setItems((prev) => [newItem, ...prev]);
    return newItem.id;
  }, []);

  // Legacy addItem for backwards compatibility
  const addItem = useCallback((
    params: ParametricParams,
    objectType: ObjectType,
    thumbnail: string
  ) => {
    return addParametricItem(params, objectType, thumbnail);
  }, [addParametricItem]);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setItems([]);
  }, []);

  return {
    items,
    addItem,
    addParametricItem,
    addCustomItem,
    addPlotterItem,
    removeItem,
    clearAll,
    count: items.length,
  };
};
