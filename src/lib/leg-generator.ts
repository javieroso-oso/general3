import * as THREE from 'three';

/**
 * Generate legs that extend from the object's base
 * Legs attach at the edge of the base and angle outward
 */
export function generateLegs(
  baseRadius: number,      // mm - radius of the object's base
  legCount: 3 | 4,
  legHeight: number,       // mm - how tall the legs are
  legSpread: number,       // degrees - angle outward from vertical
  legThickness: number,    // mm - leg diameter
  legTaper: number,        // 0-1 - taper factor (1 = full taper to point)
  legInset: number = 0.3   // 0-1 - how far inward from edge (0 = edge, 1 = center)
): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];
  
  const spreadRad = (legSpread * Math.PI) / 180;
  const segments = 8; // Segments around each leg
  const heightSegments = 12;
  
  // Calculate attach radius based on inset (max 70% inward from edge)
  const attachRadius = baseRadius * (1 - legInset * 0.7);
  
  for (let leg = 0; leg < legCount; leg++) {
    const angle = (leg / legCount) * Math.PI * 2;
    
    // Leg attachment point at inset radius
    const attachX = Math.cos(angle) * attachRadius;
    const attachZ = Math.sin(angle) * attachRadius;
    
    // Leg extends outward and down
    // Direction: outward from center at spreadRad angle from vertical
    const outwardX = Math.cos(angle);
    const outwardZ = Math.sin(angle);
    
    // Calculate foot position
    const horizontalDist = Math.sin(spreadRad) * legHeight;
    const verticalDist = Math.cos(spreadRad) * legHeight;
    
    const footX = attachX + outwardX * horizontalDist;
    const footZ = attachZ + outwardZ * horizontalDist;
    const footY = -verticalDist;
    
    // Create leg geometry as a tapered cylinder
    const legVerts: number[] = [];
    const legIndices: number[] = [];
    
    for (let h = 0; h <= heightSegments; h++) {
      const t = h / heightSegments;
      
      // Interpolate position along leg
      const px = attachX + (footX - attachX) * t;
      const py = 0 + (footY - 0) * t;
      const pz = attachZ + (footZ - attachZ) * t;
      
      // Taper radius
      const topRadius = legThickness / 2;
      const bottomRadius = topRadius * (1 - legTaper * 0.6); // Don't taper to zero
      const r = topRadius + (bottomRadius - topRadius) * t;
      
      // Create ring of vertices at this height
      for (let s = 0; s <= segments; s++) {
        const segAngle = (s / segments) * Math.PI * 2;
        
        // Local coordinate system for the leg
        // We need to orient the circle perpendicular to the leg direction
        const legDirX = footX - attachX;
        const legDirY = footY - 0;
        const legDirZ = footZ - attachZ;
        const legLen = Math.sqrt(legDirX * legDirX + legDirY * legDirY + legDirZ * legDirZ);
        
        // Normalized leg direction
        const dirX = legDirX / legLen;
        const dirY = legDirY / legLen;
        const dirZ = legDirZ / legLen;
        
        // Create perpendicular vectors
        // Use cross product with up vector
        let perpX = -dirZ;
        let perpZ = dirX;
        const perpLen = Math.sqrt(perpX * perpX + perpZ * perpZ);
        if (perpLen > 0.001) {
          perpX /= perpLen;
          perpZ /= perpLen;
        } else {
          perpX = 1;
          perpZ = 0;
        }
        
        // Second perpendicular (cross of dir and perp)
        const perp2X = dirY * perpZ;
        const perp2Y = dirZ * perpX - dirX * perpZ;
        const perp2Z = -dirY * perpX;
        
        // Point on circle
        const cx = Math.cos(segAngle) * perpX + Math.sin(segAngle) * perp2X;
        const cy = Math.sin(segAngle) * perp2Y;
        const cz = Math.cos(segAngle) * perpZ + Math.sin(segAngle) * perp2Z;
        
        legVerts.push(
          px + cx * r,
          py + cy * r,
          pz + cz * r
        );
      }
    }
    
    // Create faces
    for (let h = 0; h < heightSegments; h++) {
      for (let s = 0; s < segments; s++) {
        const a = h * (segments + 1) + s;
        const b = a + 1;
        const c = a + (segments + 1);
        const d = c + 1;
        
        legIndices.push(a, c, b);
        legIndices.push(b, c, d);
      }
    }
    
    // Add rounded foot (hemisphere at bottom)
    const footCenterIdx = legVerts.length / 3;
    legVerts.push(footX, footY, footZ);
    
    // Connect last ring to foot center
    const lastRingStart = heightSegments * (segments + 1);
    for (let s = 0; s < segments; s++) {
      const a = lastRingStart + s;
      const b = lastRingStart + s + 1;
      legIndices.push(a, footCenterIdx, b);
    }
    
    // Add cap at top
    const topCenterIdx = legVerts.length / 3;
    legVerts.push(attachX, 0, attachZ);
    
    // Connect first ring to top center
    for (let s = 0; s < segments; s++) {
      const a = s;
      const b = s + 1;
      legIndices.push(b, topCenterIdx, a);
    }
    
    const legGeo = new THREE.BufferGeometry();
    legGeo.setAttribute('position', new THREE.Float32BufferAttribute(legVerts, 3));
    legGeo.setIndex(legIndices);
    legGeo.computeVertexNormals();
    
    geometries.push(legGeo);
  }
  
  // Merge all leg geometries
  const mergedGeo = mergeGeometries(geometries);
  return mergedGeo;
}

// Simple geometry merge function
function mergeGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  let indexOffset = 0;
  
  for (const geo of geometries) {
    const posAttr = geo.getAttribute('position');
    const posArray = posAttr.array as Float32Array;
    
    for (let i = 0; i < posArray.length; i++) {
      positions.push(posArray[i]);
    }
    
    const geoIndices = geo.getIndex();
    if (geoIndices) {
      const idxArray = geoIndices.array;
      for (let i = 0; i < idxArray.length; i++) {
        indices.push(idxArray[i] + indexOffset);
      }
    }
    
    indexOffset += posAttr.count;
  }
  
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setIndex(indices);
  merged.computeVertexNormals();
  
  return merged;
}
