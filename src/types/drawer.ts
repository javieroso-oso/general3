import { ParametricParams, ObjectType } from './parametric';
import { ProfilePoint, ProfileSettings, GenerationMode } from './custom-profile';
import { PlotterParams, PlotterDrawing } from './plotter';

export type DrawerItemType = 'parametric' | 'custom' | 'plotter';

export interface BaseDrawerItem {
  id: string;
  thumbnail: string; // base64 JPEG data URL
  createdAt: number; // timestamp
}

export interface ParametricDrawerItem extends BaseDrawerItem {
  type: 'parametric';
  params: ParametricParams;
  objectType: ObjectType;
}

export interface CustomDrawerItem extends BaseDrawerItem {
  type: 'custom';
  profile: ProfilePoint[];
  settings: ProfileSettings;
  generationMode: GenerationMode;
}

export interface PlotterDrawerItem extends BaseDrawerItem {
  type: 'plotter';
  plotterParams: PlotterParams;
  drawing: PlotterDrawing;
}

export type DrawerItem = ParametricDrawerItem | CustomDrawerItem | PlotterDrawerItem;

// Type guards
export function isParametricItem(item: DrawerItem): item is ParametricDrawerItem {
  return item.type === 'parametric' || (!('profile' in item) && !('plotterParams' in item));
}

export function isCustomItem(item: DrawerItem): item is CustomDrawerItem {
  return item.type === 'custom';
}

export function isPlotterItem(item: DrawerItem): item is PlotterDrawerItem {
  return item.type === 'plotter';
}
