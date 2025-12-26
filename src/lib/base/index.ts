/**
 * Clean Base System
 * 
 * Modular, validated base generation for 3D printed lamps.
 * 
 * Architecture:
 * - types.ts: Type definitions and defaults
 * - validation.ts: Pre-generation validation
 * - socket-mount.ts: Light source mounting
 * - stand-generator.ts: Structural support (tripod, disc, wall)
 * - connector.ts: Body-to-base connection
 * - composer.ts: Orchestration layer
 */

// Types
export * from './types';

// Validation
export { 
  validateBaseConfig, 
  getMinimumBodyRadius,
  getRecommendedLegHeight,
  type ValidationResult 
} from './validation';

// Generators
export { generateSocketMount, getSocketMountRadius } from './socket-mount';
export { generateStand, getStandFootprint } from './stand-generator';
export { generateConnector, type ConnectorGeometry } from './connector';

// Composer (main entry point)
export { 
  composeBase, 
  composeTripodBase,
  composeWeightedDiscBase,
  type BaseAssembly 
} from './composer';
