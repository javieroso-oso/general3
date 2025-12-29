import { ParametricParams, ObjectType } from './parametric';
import { ProfilePoint, ProfileSettings, GenerationMode } from './custom-profile';

export type DrawerItemType = 'parametric' | 'custom';

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

export type DrawerItem = ParametricDrawerItem | CustomDrawerItem;

// Legacy type guard for backwards compatibility
export function isParametricItem(item: DrawerItem): item is ParametricDrawerItem {
  return item.type === 'parametric' || !('profile' in item);
}

export function isCustomItem(item: DrawerItem): item is CustomDrawerItem {
  return item.type === 'custom';
}
