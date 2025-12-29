import { ParametricParams, ObjectType } from './parametric';

export interface DrawerItem {
  id: string;
  params: ParametricParams;
  objectType: ObjectType;
  thumbnail: string; // base64 JPEG data URL
  createdAt: number; // timestamp
}
