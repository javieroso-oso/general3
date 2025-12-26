/**
 * Base Composition Layer
 * 
 * Orchestrates the generation of complete base assemblies by:
 * 1. Validating configuration
 * 2. Generating individual components (socket mount, stand, connector)
 * 3. Positioning and merging into a single geometry
 */

import * as THREE from 'three';
import { 
  SocketMountConfig, 
  StandConfig, 
  ConnectorConfig 
} from './types';
import { validateBaseConfig, ValidationResult } from './validation';
import { generateSocketMount, getSocketMountRadius } from './socket-mount';
import { generateStand, getStandFootprint } from './stand-generator';
import { generateConnector, ConnectorGeometry } from './connector';

export interface BaseAssembly {
  /** Complete merged geometry for the base */
  geometry: THREE.BufferGeometry | null;
  /** Socket mount geometry (for separate rendering if needed) */
  socketGeometry: THREE.BufferGeometry | null;
  /** Stand geometry (tripod, disc, etc.) */
  standGeometry: THREE.BufferGeometry | null;
  /** Connector geometry (body interface) */
  connectorGeometry: ConnectorGeometry | null;
  /** Cord hole geometry if enabled */
  cordHoleGeometry: THREE.BufferGeometry | null;
  /** Validation result */
  validation: ValidationResult;
  /** Whether assembly was successfully generated */
  success: boolean;
  /** Error message if generation failed */
  error?: string;
}

/**
 * Compose a complete base assembly from validated configurations.
 * 
 * @param bodyBottomRadius - Radius of lamp body at bottom (mm)
 * @param bodyHeight - Height of the lamp body (mm)
 * @param socketConfig - Socket/light source mount configuration
 * @param standConfig - Stand type and parameters
 * @param connectorConfig - Body-to-base connection configuration
 * @returns Complete base assembly with all geometries
 */
export function composeBase(
  bodyBottomRadius: number,
  bodyHeight: number,
  socketConfig: SocketMountConfig,
  standConfig: StandConfig,
  connectorConfig: ConnectorConfig
): BaseAssembly {
  // Step 1: Validate configuration
  const validation = validateBaseConfig(
    bodyBottomRadius,
    bodyHeight,
    socketConfig,
    standConfig,
    connectorConfig
  );

  // If validation fails with critical errors, return early
  if (!validation.isValid) {
    console.warn('[Base Composer] Invalid configuration:', validation.errors);
    return {
      geometry: null,
      socketGeometry: null,
      standGeometry: null,
      connectorGeometry: null,
      cordHoleGeometry: null,
      validation,
      success: false,
      error: validation.errors.join('; ')
    };
  }

  // Log warnings but continue
  if (validation.warnings.length > 0) {
    console.log('[Base Composer] Warnings:', validation.warnings);
  }

  try {
    // Step 2: Generate individual components
    const geometries: THREE.BufferGeometry[] = [];
    
    // 2a: Generate socket mount at base level (y = 0)
    const socketMount = generateSocketMount(socketConfig, bodyBottomRadius, 0);
    let socketGeometry: THREE.BufferGeometry | null = null;
    let cordHoleGeometry: THREE.BufferGeometry | null = null;
    
    if (socketMount.geometry && socketMount.geometry.attributes.position?.count > 0) {
      socketGeometry = socketMount.geometry;
      geometries.push(socketGeometry);
    }
    
    if (socketMount.cordHoleGeometry) {
      cordHoleGeometry = socketMount.cordHoleGeometry;
    }

    // 2b: Generate stand (tripod legs, weighted disc, etc.)
    // Pass bodyBottomRadius as both the base radius and body bottom for transition geometry
    const standGeometry = generateStand(standConfig, bodyBottomRadius, bodyBottomRadius);
    if (standGeometry && standGeometry.attributes.position?.count > 0) {
      geometries.push(standGeometry);
    }

    // 2c: Generate connector interface (if not integrated)
    let connectorGeometry: ConnectorGeometry | null = null;
    if (connectorConfig.type !== 'integrated') {
      connectorGeometry = generateConnector(connectorConfig, bodyBottomRadius * 2);
      
      // Add connector geometries to merge list
      if (connectorGeometry.baseInterface && connectorGeometry.baseInterface.attributes.position?.count > 0) {
        geometries.push(connectorGeometry.baseInterface);
      }
      if (connectorGeometry.screwHoles && connectorGeometry.screwHoles.attributes.position?.count > 0) {
        geometries.push(connectorGeometry.screwHoles);
      }
    }

    // Step 3: Merge all geometries
    let mergedGeometry: THREE.BufferGeometry | null = null;
    
    if (geometries.length > 0) {
      mergedGeometry = mergeGeometries(geometries);
    }

    return {
      geometry: mergedGeometry,
      socketGeometry,
      standGeometry,
      connectorGeometry,
      cordHoleGeometry,
      validation,
      success: true
    };

  } catch (error) {
    console.error('[Base Composer] Generation error:', error);
    return {
      geometry: null,
      socketGeometry: null,
      standGeometry: null,
      connectorGeometry: null,
      cordHoleGeometry: null,
      validation,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown generation error'
    };
  }
}

/**
 * Quick compose for tripod stands - simplified API for most common case
 */
export function composeTripodBase(
  bodyBottomRadius: number,
  bodyHeight: number,
  legCount: 3 | 4 = 3,
  legHeight: number = 40,
  socketType: 'E26' | 'E12' | 'E14' = 'E26'
): BaseAssembly {
  const socketConfig: SocketMountConfig = {
    type: 'press-fit-ring',
    socketType,
    clearance: 0.5,
    lipHeight: 3,
    cordHoleEnabled: true,
    cordHoleDiameter: 8,
  };

  const standConfig: StandConfig = {
    type: 'tripod',
    tripod: {
      legCount,
      legHeight,
      legSpread: 0.8,
      legThickness: 8,
      legTaper: 0.6,
      legInset: 0,
    },
    baseThickness: 3,
    baseTaper: 0,
    baseEdgeStyle: 'flat',
    baseLip: 0,
  };

  const connectorConfig: ConnectorConfig = {
    type: 'integrated',
    tolerance: 0.3,
    insertDepth: 5,
  };

  return composeBase(bodyBottomRadius, bodyHeight, socketConfig, standConfig, connectorConfig);
}

/**
 * Quick compose for weighted disc stands
 */
export function composeWeightedDiscBase(
  bodyBottomRadius: number,
  bodyHeight: number,
  discDiameter: number = 120,
  socketType: 'E26' | 'E12' | 'E14' = 'E26'
): BaseAssembly {
  const socketConfig: SocketMountConfig = {
    type: 'press-fit-ring',
    socketType,
    clearance: 0.5,
    lipHeight: 3,
    cordHoleEnabled: true,
    cordHoleDiameter: 8,
  };

  const standConfig: StandConfig = {
    type: 'weighted-disc',
    weightedDisc: {
      discDiameter,
      discThickness: 10,
      weightCavityEnabled: true,
      weightCavityDiameter: discDiameter * 0.6,
      weightCavityDepth: 8,
      rubberFeetEnabled: true,
      rubberFeetCount: 3,
      rubberFeetDiameter: 10,
    },
    baseThickness: 10,
    baseTaper: 0,
    baseEdgeStyle: 'chamfer',
    baseLip: 0,
  };

  const connectorConfig: ConnectorConfig = {
    type: 'integrated',
    tolerance: 0.3,
    insertDepth: 5,
  };

  return composeBase(bodyBottomRadius, bodyHeight, socketConfig, standConfig, connectorConfig);
}

/**
 * Merge multiple BufferGeometries into one
 */
function mergeGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const validGeometries = geometries.filter(g => 
    g && g.attributes.position && g.attributes.position.count > 0
  );

  if (validGeometries.length === 0) {
    return new THREE.BufferGeometry();
  }

  if (validGeometries.length === 1) {
    return validGeometries[0].clone();
  }

  // Calculate total vertex and index counts
  let totalVertices = 0;
  let totalIndices = 0;
  
  for (const geo of validGeometries) {
    totalVertices += geo.attributes.position.count;
    if (geo.index) {
      totalIndices += geo.index.count;
    } else {
      totalIndices += geo.attributes.position.count;
    }
  }

  // Merge positions
  const positions = new Float32Array(totalVertices * 3);
  const indices: number[] = [];
  
  let vertexOffset = 0;
  let indexOffset = 0;

  for (const geo of validGeometries) {
    const posAttr = geo.attributes.position;
    const posArray = posAttr.array as Float32Array;
    
    // Copy positions
    for (let i = 0; i < posArray.length; i++) {
      positions[vertexOffset * 3 + i] = posArray[i];
    }

    // Copy/create indices
    if (geo.index) {
      const idxArray = geo.index.array;
      for (let i = 0; i < idxArray.length; i++) {
        indices.push(idxArray[i] + vertexOffset);
      }
    } else {
      // Non-indexed geometry - create sequential indices
      for (let i = 0; i < posAttr.count; i++) {
        indices.push(vertexOffset + i);
      }
    }

    vertexOffset += posAttr.count;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setIndex(indices);
  merged.computeVertexNormals();

  return merged;
}

export type { ValidationResult };
