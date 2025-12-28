import * as THREE from 'three';

/**
 * Generate a hardware attachment bracket for wall mounting
 * This is a separate printable piece with:
 * - Rectangular plate with rounded corners
 * - Screw holes for wall mounting
 * - Keyhole slots for hanging
 */
export function generateWallMountBracket(
  width: number,
  height: number,
  thickness: number,
  holeSpacing: number,
  includeKeyholes: boolean = true
): THREE.BufferGeometry {
  const vertices: number[] = [];
  const indices: number[] = [];
  
  const halfW = width / 2;
  const halfH = height / 2;
  const cornerRadius = Math.min(5, Math.min(width, height) * 0.1);
  const segments = 8;
  
  // Generate rounded rectangle outline
  const outline: { x: number; y: number }[] = [];
  
  // Bottom-left corner
  for (let i = 0; i <= segments; i++) {
    const angle = Math.PI + (i / segments) * (Math.PI / 2);
    outline.push({
      x: -halfW + cornerRadius + Math.cos(angle) * cornerRadius,
      y: -halfH + cornerRadius + Math.sin(angle) * cornerRadius
    });
  }
  
  // Bottom-right corner
  for (let i = 0; i <= segments; i++) {
    const angle = 1.5 * Math.PI + (i / segments) * (Math.PI / 2);
    outline.push({
      x: halfW - cornerRadius + Math.cos(angle) * cornerRadius,
      y: -halfH + cornerRadius + Math.sin(angle) * cornerRadius
    });
  }
  
  // Top-right corner
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * (Math.PI / 2);
    outline.push({
      x: halfW - cornerRadius + Math.cos(angle) * cornerRadius,
      y: halfH - cornerRadius + Math.sin(angle) * cornerRadius
    });
  }
  
  // Top-left corner
  for (let i = 0; i <= segments; i++) {
    const angle = Math.PI / 2 + (i / segments) * (Math.PI / 2);
    outline.push({
      x: -halfW + cornerRadius + Math.cos(angle) * cornerRadius,
      y: halfH - cornerRadius + Math.sin(angle) * cornerRadius
    });
  }
  
  // Create front face vertices (z = thickness/2)
  const frontStart = 0;
  for (const pt of outline) {
    vertices.push(pt.x, pt.y, thickness / 2);
  }
  
  // Create back face vertices (z = -thickness/2)
  const backStart = vertices.length / 3;
  for (const pt of outline) {
    vertices.push(pt.x, pt.y, -thickness / 2);
  }
  
  // Create side faces
  const n = outline.length;
  for (let i = 0; i < n; i++) {
    const nextI = (i + 1) % n;
    const frontA = frontStart + i;
    const frontB = frontStart + nextI;
    const backA = backStart + i;
    const backB = backStart + nextI;
    
    indices.push(frontA, frontB, backA);
    indices.push(backA, frontB, backB);
  }
  
  // Create front face (fan triangulation)
  const frontCenterIdx = vertices.length / 3;
  vertices.push(0, 0, thickness / 2);
  for (let i = 0; i < n; i++) {
    const nextI = (i + 1) % n;
    indices.push(frontCenterIdx, frontStart + i, frontStart + nextI);
  }
  
  // Create back face (fan triangulation, reversed winding)
  const backCenterIdx = vertices.length / 3;
  vertices.push(0, 0, -thickness / 2);
  for (let i = 0; i < n; i++) {
    const nextI = (i + 1) % n;
    indices.push(backCenterIdx, backStart + nextI, backStart + i);
  }
  
  // Add screw holes (4 corners)
  const screwHoleRadius = 2.5; // 5mm hole for standard screws
  const screwMargin = 10;
  const screwPositions = [
    { x: -holeSpacing / 2, y: -holeSpacing / 2 },
    { x: holeSpacing / 2, y: -holeSpacing / 2 },
    { x: holeSpacing / 2, y: holeSpacing / 2 },
    { x: -holeSpacing / 2, y: holeSpacing / 2 },
  ].filter(pos => 
    Math.abs(pos.x) < halfW - screwMargin && 
    Math.abs(pos.y) < halfH - screwMargin
  );
  
  for (const pos of screwPositions) {
    addScrewHole(vertices, indices, pos.x, pos.y, thickness, screwHoleRadius);
  }
  
  // Add keyhole slots (2 vertical, centered)
  if (includeKeyholes) {
    const keyholeSpacing = Math.min(holeSpacing, height - 40);
    const keyholePositions = [
      { x: 0, y: keyholeSpacing / 2 },
      { x: 0, y: -keyholeSpacing / 2 },
    ];
    
    for (const pos of keyholePositions) {
      addKeyholeSlot(vertices, indices, pos.x, pos.y, thickness);
    }
  }
  
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  
  return geometry;
}

/**
 * Add a screw hole through the bracket
 */
function addScrewHole(
  vertices: number[],
  indices: number[],
  cx: number,
  cy: number,
  thickness: number,
  radius: number
): void {
  const segs = 16;
  const startIdx = vertices.length / 3;
  
  // Front ring
  for (let i = 0; i <= segs; i++) {
    const angle = (i / segs) * Math.PI * 2;
    vertices.push(
      cx + Math.cos(angle) * radius,
      cy + Math.sin(angle) * radius,
      thickness / 2
    );
  }
  
  // Back ring
  const backRingStart = vertices.length / 3;
  for (let i = 0; i <= segs; i++) {
    const angle = (i / segs) * Math.PI * 2;
    vertices.push(
      cx + Math.cos(angle) * radius,
      cy + Math.sin(angle) * radius,
      -thickness / 2
    );
  }
  
  // Hole wall (reversed winding for inside of hole)
  for (let i = 0; i < segs; i++) {
    const frontA = startIdx + i;
    const frontB = startIdx + i + 1;
    const backA = backRingStart + i;
    const backB = backRingStart + i + 1;
    
    indices.push(frontA, backA, frontB);
    indices.push(backA, backB, frontB);
  }
}

/**
 * Add a keyhole slot for hanging on screws
 * Large circle at top, narrow slot going down
 */
function addKeyholeSlot(
  vertices: number[],
  indices: number[],
  cx: number,
  cy: number,
  thickness: number
): void {
  const headRadius = 5;  // 10mm diameter for screw head
  const slotWidth = 2.5; // 5mm wide slot
  const slotLength = 10; // 10mm slot length
  const segs = 16;
  const startIdx = vertices.length / 3;
  
  // Generate keyhole outline - circle at TOP, slot going DOWN
  const outlinePoints: { x: number; y: number }[] = [];
  
  // Large circle at top
  for (let i = 0; i <= segs; i++) {
    const angle = -Math.PI / 2 + (i / segs) * Math.PI * 2;
    outlinePoints.push({
      x: cx + Math.cos(angle) * headRadius,
      y: cy + Math.sin(angle) * headRadius
    });
  }
  
  // Front vertices
  for (const pt of outlinePoints) {
    vertices.push(pt.x, pt.y, thickness / 2);
  }
  
  // Back vertices
  const backStart = vertices.length / 3;
  for (const pt of outlinePoints) {
    vertices.push(pt.x, pt.y, -thickness / 2);
  }
  
  // Keyhole wall
  for (let i = 0; i < outlinePoints.length - 1; i++) {
    const frontA = startIdx + i;
    const frontB = startIdx + i + 1;
    const backA = backStart + i;
    const backB = backStart + i + 1;
    
    indices.push(frontA, backA, frontB);
    indices.push(backA, backB, frontB);
  }
  
  // Slot going DOWN from circle
  const slotStartIdx = vertices.length / 3;
  const slotTopY = cy - headRadius * 0.3;
  const slotBottomY = cy - slotLength;
  
  // Slot front
  vertices.push(cx - slotWidth, slotTopY, thickness / 2);
  vertices.push(cx + slotWidth, slotTopY, thickness / 2);
  vertices.push(cx + slotWidth, slotBottomY, thickness / 2);
  vertices.push(cx - slotWidth, slotBottomY, thickness / 2);
  
  // Slot back
  vertices.push(cx - slotWidth, slotTopY, -thickness / 2);
  vertices.push(cx + slotWidth, slotTopY, -thickness / 2);
  vertices.push(cx + slotWidth, slotBottomY, -thickness / 2);
  vertices.push(cx - slotWidth, slotBottomY, -thickness / 2);
  
  // Slot walls
  // Left wall
  indices.push(slotStartIdx + 0, slotStartIdx + 4, slotStartIdx + 3);
  indices.push(slotStartIdx + 3, slotStartIdx + 4, slotStartIdx + 7);
  
  // Right wall
  indices.push(slotStartIdx + 1, slotStartIdx + 2, slotStartIdx + 5);
  indices.push(slotStartIdx + 5, slotStartIdx + 2, slotStartIdx + 6);
  
  // Bottom wall
  indices.push(slotStartIdx + 2, slotStartIdx + 3, slotStartIdx + 6);
  indices.push(slotStartIdx + 6, slotStartIdx + 3, slotStartIdx + 7);
}
