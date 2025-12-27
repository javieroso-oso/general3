/**
 * Spindle Totem System Types
 * 
 * A modular lamp system where pieces stack on a central wooden dowel (spindle).
 * Each module has universal interface rings at top and bottom that share
 * a constant inner diameter for the spindle, allowing:
 * - Free rotation of modules
 * - Self-alignment via gravity
 * - Cord routing through center
 * - Mix-and-match compositions
 */

import { ParametricParams } from './parametric';

// ============================================================================
// SPINDLE SPECIFICATIONS
// ============================================================================

export type SpindleSize = 'small' | 'standard' | 'large';

/**
 * Spindle (central dowel) specifications
 * The spindle hole is the constant that unifies all modules
 */
export const SPINDLE_SPECS: Record<SpindleSize, {
  diameter: number;      // mm - dowel diameter
  clearance: number;     // mm - extra clearance for easy fit
  holeDiameter: number;  // mm - actual hole size (diameter + clearance)
}> = {
  small: { diameter: 8, clearance: 0.5, holeDiameter: 8.5 },
  standard: { diameter: 10, clearance: 0.5, holeDiameter: 10.5 },
  large: { diameter: 12, clearance: 0.5, holeDiameter: 12.5 },
};

export const DEFAULT_SPINDLE_SIZE: SpindleSize = 'standard';

// ============================================================================
// INTERFACE RING SPECIFICATIONS
// ============================================================================

/**
 * Universal Interface Ring - the standardized connection point
 * 
 * Every module has this ring at top and bottom:
 *   ┌─────────────────┐  ← Outer diameter (varies with module size)
 *   │  ┌───────────┐  │  ← Ring wall
 *   │  │  ○ hole   │  │  ← Spindle hole (constant 10.5mm for standard)
 *   │  └───────────┘  │
 *   └─────────────────┘
 * 
 * The outer diameter can vary per module, but the inner spindle hole
 * is ALWAYS the same size for compatibility.
 */
export interface InterfaceRingConfig {
  innerDiameter: number;    // mm - spindle hole (from SPINDLE_SPECS)
  outerDiameter: number;    // mm - ring outer (varies per module)
  height: number;           // mm - ring thickness (3-8mm typical)
  chamfer: number;          // mm - edge chamfer for easy stacking
}

export const DEFAULT_INTERFACE_RING: InterfaceRingConfig = {
  innerDiameter: SPINDLE_SPECS.standard.holeDiameter,
  outerDiameter: 25,  // Minimum practical size
  height: 5,          // 5mm ring height
  chamfer: 0.5,       // Small chamfer for stacking
};

/**
 * Calculate interface ring outer diameter based on module body
 * Ring should be slightly larger than body bottom for stability
 */
export function calculateInterfaceRingDiameter(bodyBottomRadius: number): number {
  // Ring outer = body bottom diameter + 10mm margin
  return Math.max(bodyBottomRadius * 2 + 10, DEFAULT_INTERFACE_RING.outerDiameter);
}

// ============================================================================
// MODULE TYPES
// ============================================================================

/**
 * Types of modules in the totem system
 */
export type ModuleType = 
  | 'shade'      // Light shade - organic body with through-hole
  | 'spacer'     // Simple ring spacer for height/visual breaks
  | 'base'       // Weighted base with blind hole (spindle socket)
  | 'cap'        // Top cap with socket mount for bulb
  | 'pendant'    // Ceiling mount with cord grip
  | 'extension'; // Decorative extension piece

/**
 * Module interface configuration
 * Defines what connections a module has at top and bottom
 */
export interface ModuleInterface {
  type: 'through' | 'blind' | 'socket' | 'none';
  ring: InterfaceRingConfig;
}

/**
 * Base configuration for all module types
 */
export interface ModuleConfigBase {
  id: string;
  name: string;
  type: ModuleType;
  spindleSize: SpindleSize;
  topInterface: ModuleInterface;
  bottomInterface: ModuleInterface;
}

// ============================================================================
// SHADE MODULE
// ============================================================================

/**
 * Shade module - the main organic body
 * Has through-hole for spindle, interfaces at top and bottom
 */
export interface ShadeModuleConfig extends ModuleConfigBase {
  type: 'shade';
  // Uses full ParametricParams for shape definition
  shapeParams: Partial<ParametricParams>;
}

// ============================================================================
// SPACER MODULE
// ============================================================================

/**
 * Spacer module - simple ring for height adjustment
 * Can be decorative (ribbed, fluted) or plain
 */
export type SpacerStyle = 'plain' | 'ribbed' | 'fluted' | 'twisted';

export interface SpacerModuleConfig extends ModuleConfigBase {
  type: 'spacer';
  height: number;          // mm - spacer height
  outerDiameter: number;   // mm - outer diameter
  style: SpacerStyle;
  ribCount?: number;       // Number of ribs/flutes (for styled spacers)
}

// ============================================================================
// BASE MODULE
// ============================================================================

/**
 * Base module - weighted bottom with blind hole
 * The spindle inserts into this but doesn't go through
 */
export type BaseStyle = 'disc' | 'tripod' | 'ring';

export interface BaseModuleConfig extends ModuleConfigBase {
  type: 'base';
  style: BaseStyle;
  diameter: number;        // mm - base outer diameter
  height: number;          // mm - base height
  weight: {
    cavityEnabled: boolean;
    cavityDiameter: number; // mm - for adding weights
    cavityDepth: number;    // mm
  };
  rubberFeet: {
    enabled: boolean;
    count: number;
    diameter: number;      // mm
  };
  cordHole: {
    enabled: boolean;
    diameter: number;      // mm
  };
}

// ============================================================================
// CAP MODULE
// ============================================================================

/**
 * Cap module - top piece with socket mount
 * Closes the top of the stack and holds the bulb socket
 */
export type SocketType = 'E26' | 'E12' | 'E14' | 'GU10';

export interface CapModuleConfig extends ModuleConfigBase {
  type: 'cap';
  socketType: SocketType;
  socketMountStyle: 'press-fit' | 'threaded' | 'clip';
  domeHeight: number;      // mm - cap dome height (0 for flat)
  ventHoles: boolean;      // Add ventilation holes
}

// ============================================================================
// PENDANT MODULE
// ============================================================================

/**
 * Pendant module - ceiling mount
 * Has cord grip and mounting hardware
 */
export interface PendantModuleConfig extends ModuleConfigBase {
  type: 'pendant';
  canopyDiameter: number;  // mm - ceiling canopy diameter
  canopyHeight: number;    // mm - canopy dome height
  cordGripType: 'compression' | 'knot' | 'strain-relief';
}

// ============================================================================
// EXTENSION MODULE
// ============================================================================

/**
 * Extension module - decorative piece between other modules
 * Like a shade but typically shorter and more sculptural
 */
export interface ExtensionModuleConfig extends ModuleConfigBase {
  type: 'extension';
  shapeParams: Partial<ParametricParams>;
}

// ============================================================================
// UNION TYPE FOR ALL MODULES
// ============================================================================

export type TotemModuleConfig = 
  | ShadeModuleConfig 
  | SpacerModuleConfig 
  | BaseModuleConfig 
  | CapModuleConfig 
  | PendantModuleConfig
  | ExtensionModuleConfig;

// ============================================================================
// TOTEM STACK
// ============================================================================

/**
 * A complete totem stack - an array of modules that form a lamp
 */
export interface TotemStack {
  id: string;
  name: string;
  spindleSize: SpindleSize;
  modules: TotemModuleConfig[];
  totalHeight: number;      // mm - calculated total height
  spindleLength: number;    // mm - required spindle length
}

/**
 * Calculate the total height of a totem stack
 */
export function calculateStackHeight(modules: TotemModuleConfig[]): number {
  return modules.reduce((total, module) => {
    switch (module.type) {
      case 'shade':
      case 'extension':
        const shapeModule = module as ShadeModuleConfig | ExtensionModuleConfig;
        return total + (shapeModule.shapeParams.height || 100);
      case 'spacer':
        return total + (module as SpacerModuleConfig).height;
      case 'base':
        return total + (module as BaseModuleConfig).height;
      case 'cap':
        return total + (module as CapModuleConfig).domeHeight + 
               module.bottomInterface.ring.height;
      case 'pendant':
        return total + (module as PendantModuleConfig).canopyHeight;
      default:
        return total;
    }
  }, 0);
}

/**
 * Calculate required spindle length
 * Spindle should extend through all modules plus extra for base socket
 */
export function calculateSpindleLength(modules: TotemModuleConfig[]): number {
  const stackHeight = calculateStackHeight(modules);
  // Add 20mm extra for base socket depth + 10mm top clearance
  return stackHeight + 30;
}

// ============================================================================
// DEFAULT MODULE CONFIGURATIONS
// ============================================================================

export const DEFAULT_SHADE_MODULE: Omit<ShadeModuleConfig, 'id' | 'name'> = {
  type: 'shade',
  spindleSize: 'standard',
  topInterface: {
    type: 'through',
    ring: { ...DEFAULT_INTERFACE_RING, outerDiameter: 30 },
  },
  bottomInterface: {
    type: 'through',
    ring: { ...DEFAULT_INTERFACE_RING, outerDiameter: 30 },
  },
  shapeParams: {
    height: 100,
    baseRadius: 30,
    topRadius: 60,
    wallThickness: 1.6,
  },
};

export const DEFAULT_SPACER_MODULE: Omit<SpacerModuleConfig, 'id' | 'name'> = {
  type: 'spacer',
  spindleSize: 'standard',
  topInterface: {
    type: 'through',
    ring: DEFAULT_INTERFACE_RING,
  },
  bottomInterface: {
    type: 'through',
    ring: DEFAULT_INTERFACE_RING,
  },
  height: 20,
  outerDiameter: 40,
  style: 'plain',
};

export const DEFAULT_BASE_MODULE: Omit<BaseModuleConfig, 'id' | 'name'> = {
  type: 'base',
  spindleSize: 'standard',
  topInterface: {
    type: 'blind', // Spindle inserts into socket
    ring: { ...DEFAULT_INTERFACE_RING, outerDiameter: 80 },
  },
  bottomInterface: {
    type: 'none', // Sits on table
    ring: { ...DEFAULT_INTERFACE_RING, outerDiameter: 100 },
  },
  style: 'disc',
  diameter: 100,
  height: 15,
  weight: {
    cavityEnabled: true,
    cavityDiameter: 60,
    cavityDepth: 10,
  },
  rubberFeet: {
    enabled: true,
    count: 3,
    diameter: 10,
  },
  cordHole: {
    enabled: true,
    diameter: 8,
  },
};

export const DEFAULT_CAP_MODULE: Omit<CapModuleConfig, 'id' | 'name'> = {
  type: 'cap',
  spindleSize: 'standard',
  topInterface: {
    type: 'socket', // Bulb socket mount
    ring: { ...DEFAULT_INTERFACE_RING, outerDiameter: 40 },
  },
  bottomInterface: {
    type: 'through',
    ring: { ...DEFAULT_INTERFACE_RING, outerDiameter: 40 },
  },
  socketType: 'E26',
  socketMountStyle: 'press-fit',
  domeHeight: 15,
  ventHoles: true,
};

export const DEFAULT_PENDANT_MODULE: Omit<PendantModuleConfig, 'id' | 'name'> = {
  type: 'pendant',
  spindleSize: 'standard',
  topInterface: {
    type: 'none', // Mounts to ceiling
    ring: { ...DEFAULT_INTERFACE_RING, outerDiameter: 80 },
  },
  bottomInterface: {
    type: 'through', // Cord goes through
    ring: { ...DEFAULT_INTERFACE_RING, outerDiameter: 30 },
  },
  canopyDiameter: 80,
  canopyHeight: 20,
  cordGripType: 'strain-relief',
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a new module with unique ID
 */
export function createModule<T extends TotemModuleConfig>(
  config: Omit<T, 'id' | 'name'>,
  name: string
): T {
  return {
    ...config,
    id: `module_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
  } as T;
}

/**
 * Validate that modules can stack together
 * Checks that interface rings are compatible
 */
export function validateStack(modules: TotemModuleConfig[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (modules.length === 0) {
    errors.push('Stack must have at least one module');
    return { valid: false, errors };
  }
  
  // Check spindle size consistency
  const spindleSizes = new Set(modules.map(m => m.spindleSize));
  if (spindleSizes.size > 1) {
    errors.push('All modules must use the same spindle size');
  }
  
  // Check interface compatibility between adjacent modules
  for (let i = 0; i < modules.length - 1; i++) {
    const current = modules[i];
    const next = modules[i + 1];
    
    // Bottom of current should connect to top of next
    if (current.bottomInterface.type === 'none' && i < modules.length - 1) {
      errors.push(`Module "${current.name}" has no bottom interface but is not at bottom of stack`);
    }
    
    if (next.topInterface.type === 'none' && i > 0) {
      errors.push(`Module "${next.name}" has no top interface but is not at top of stack`);
    }
  }
  
  // First module (top of lamp) should typically be a cap or pendant
  const topModule = modules[0];
  if (topModule.type !== 'cap' && topModule.type !== 'pendant') {
    // Warning, not error - could be intentional
  }
  
  // Last module (bottom) should typically be a base
  const bottomModule = modules[modules.length - 1];
  if (bottomModule.type !== 'base') {
    // Warning, not error - could be wall mount or pendant
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Create a default totem stack (cap + shade + base)
 */
export function createDefaultStack(): TotemStack {
  const cap = createModule(DEFAULT_CAP_MODULE, 'Top Cap');
  const shade = createModule(DEFAULT_SHADE_MODULE, 'Main Shade');
  const base = createModule(DEFAULT_BASE_MODULE, 'Weighted Base');
  
  const modules = [cap, shade, base];
  
  return {
    id: `stack_${Date.now()}`,
    name: 'New Lamp',
    spindleSize: 'standard',
    modules,
    totalHeight: calculateStackHeight(modules),
    spindleLength: calculateSpindleLength(modules),
  };
}
