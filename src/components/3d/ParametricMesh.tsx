import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ParametricParams, ObjectType, printConstraints, rimSpecs } from '@/types/parametric';

interface ParametricMeshProps {
  params: ParametricParams;
  type: ObjectType;
  showWireframe?: boolean;
}

// Deterministic noise for consistent results
const seededRandom = (x: number, y: number, z: number) => {
  const dot = x * 12.9898 + y * 78.233 + z * 37.719;
  return (Math.sin(dot) * 43758.5453) % 1;
};

const noise3D = (x: number, y: number, z: number, scale: number) => {
  const sx = x * scale;
  const sy = y * scale;
  const sz = z * scale;
  
  const ix = Math.floor(sx);
  const iy = Math.floor(sy);
  const iz = Math.floor(sz);
  
  const fx = sx - ix;
  const fy = sy - iy;
  const fz = sz - iz;
  
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const uz = fz * fz * (3 - 2 * fz);
  
  const n000 = seededRandom(ix, iy, iz);
  const n100 = seededRandom(ix + 1, iy, iz);
  const n010 = seededRandom(ix, iy + 1, iz);
  const n110 = seededRandom(ix + 1, iy + 1, iz);
  const n001 = seededRandom(ix, iy, iz + 1);
  const n101 = seededRandom(ix + 1, iy, iz + 1);
  const n011 = seededRandom(ix, iy + 1, iz + 1);
  const n111 = seededRandom(ix + 1, iy + 1, iz + 1);
  
  const nx00 = n000 * (1 - ux) + n100 * ux;
  const nx10 = n010 * (1 - ux) + n110 * ux;
  const nx01 = n001 * (1 - ux) + n101 * ux;
  const nx11 = n011 * (1 - ux) + n111 * ux;
  
  const nxy0 = nx00 * (1 - uy) + nx10 * uy;
  const nxy1 = nx01 * (1 - uy) + nx11 * uy;
  
  return (nxy0 * (1 - uz) + nxy1 * uz) * 2 - 1;
};

// Scale factor: convert mm to scene units (1 unit = 100mm for nice viewport)
const SCALE = 0.01;

const ParametricMesh = ({ params, type, showWireframe = false }: ParametricMeshProps) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const wireRef = useRef<THREE.LineSegments>(null);
  const collarRef = useRef<THREE.Mesh>(null);

  const { bodyGeometry, collarGeometry, wireframeGeo } = useMemo(() => {
    const {
      height,
      baseRadius,
      topRadius,
      wallThickness,
      rimSize,
      wobbleFrequency,
      wobbleAmplitude,
      twistAngle,
      bulgePosition,
      bulgeAmount,
      pinchAmount,
      asymmetry,
      rippleCount,
      rippleDepth,
      lipFlare,
      lipHeight,
      organicNoise,
      noiseScale,
    } = params;

    // Scale to scene units
    const h = height * SCALE;
    const bRad = baseRadius * SCALE;
    const tRad = topRadius * SCALE;
    const wall = wallThickness * SCALE;
    
    // COLLAR DIMENSIONS (scaled) - this is the universal mounting interface
    const collarOuterRadius = (rimSize / 2) * SCALE;
    const collarInnerRadius = (rimSize / 2 - rimSpecs.lipDepth) * SCALE;
    const collarHeight = rimSpecs.height * SCALE;

    const segments = 64;
    const heightSegments = 64;

    // ========================================
    // 1. GENERATE COLLAR (solid cylinder at base)
    // ========================================
    const collarGeo = new THREE.CylinderGeometry(
      collarOuterRadius,  // top radius
      collarOuterRadius,  // bottom radius
      collarHeight,       // height
      48,                 // radial segments
      1,                  // height segments
      false               // open ended = false (solid)
    );
    // Position collar so its BOTTOM is at y=0
    collarGeo.translate(0, collarHeight / 2, 0);

    // ========================================
    // 2. GENERATE ORGANIC BODY (starts above collar)
    // ========================================
    const bodyStartY = collarHeight;
    const bodyHeight = h - collarHeight;
    
    const outerVerts: number[] = [];
    const innerVerts: number[] = [];

    for (let i = 0; i <= heightSegments; i++) {
      const t = i / heightSegments;
      const y = bodyStartY + t * bodyHeight;

      // Base profile interpolation
      let radius: number;
      if (type === 'lamp') {
        radius = bRad + (tRad - bRad) * Math.pow(t, 0.6);
      } else if (type === 'sculpture') {
        const curve = Math.sin(t * Math.PI);
        radius = bRad * (1 - t * 0.3) + tRad * t * 0.7 + curve * bRad * 0.2;
      } else {
        const curve = Math.sin(t * Math.PI * 0.8 + 0.2);
        radius = bRad * (1 - t * 0.4) + tRad * t * 0.6 + curve * bRad * 0.12;
      }

      // Organic bulge
      const bulgeDist = Math.abs(t - bulgePosition);
      radius += Math.exp(-bulgeDist * bulgeDist * 12) * bulgeAmount * bRad;

      // Pinch effect
      const pinchTop = Math.pow(t, 4) * pinchAmount * 0.3;
      const pinchBottom = Math.pow(1 - t, 4) * pinchAmount * 0.2;
      radius *= (1 - pinchTop - pinchBottom);

      // Lip flare
      const lipT = Math.max(0, (t - (1 - lipHeight)) / lipHeight);
      radius += lipT * lipT * lipFlare * bRad;

      // Ensure minimum radius
      radius = Math.max(radius, printConstraints.minBaseRadius * SCALE * 0.5);

      const twistRad = (twistAngle * Math.PI / 180) * t;

      for (let j = 0; j <= segments; j++) {
        const theta = (j / segments) * Math.PI * 2 + twistRad;
        let r = radius;

        // Wobble
        if (wobbleFrequency > 0 && wobbleAmplitude > 0) {
          const maxWobble = Math.min(wobbleAmplitude, 0.15);
          r += Math.sin(t * Math.PI * 2 * wobbleFrequency + theta * 2) * maxWobble * bRad;
        }

        // Ripples
        if (rippleCount > 0 && rippleDepth > 0) {
          const maxRipple = Math.min(rippleDepth, 0.1);
          r += Math.sin(theta * rippleCount) * maxRipple * bRad;
        }

        // Asymmetry
        if (asymmetry > 0) {
          const maxAsym = Math.min(asymmetry, 0.1);
          r += Math.sin(theta) * Math.cos(t * Math.PI * 2) * maxAsym * bRad;
        }

        // Organic noise
        if (organicNoise > 0) {
          const maxNoise = Math.min(organicNoise, 0.1);
          const nx = Math.cos(theta) * r;
          const nz = Math.sin(theta) * r;
          r += noise3D(nx * 10, y * 10, nz * 10, noiseScale) * maxNoise * bRad;
        }

        // At the bottom of the body (t=0), blend to match collar inner radius
        if (t < 0.15) {
          const blendT = t / 0.15;
          r = collarInnerRadius + (r - collarInnerRadius) * blendT;
        }

        // Ensure minimum radius
        r = Math.max(r, wall * 2);

        const x = Math.cos(theta) * r;
        const z = Math.sin(theta) * r;
        outerVerts.push(x, y, z);

        // Inner surface (wall thickness)
        const innerR = Math.max(r - wall, wall);
        const ix = Math.cos(theta) * innerR;
        const iz = Math.sin(theta) * innerR;
        innerVerts.push(ix, y, iz);
      }
    }

    // Build body geometry
    const vertices: number[] = [...outerVerts];
    const indices: number[] = [];

    // Outer surface indices
    for (let i = 0; i < heightSegments; i++) {
      for (let j = 0; j < segments; j++) {
        const a = i * (segments + 1) + j;
        const b = a + 1;
        const c = a + (segments + 1);
        const d = c + 1;
        indices.push(a, c, b);
        indices.push(b, c, d);
      }
    }

    const bodyGeo = new THREE.BufferGeometry();
    bodyGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    bodyGeo.setIndex(indices);
    bodyGeo.computeVertexNormals();

    // Wireframe geometry
    const wireGeo = new THREE.WireframeGeometry(bodyGeo);

    return { bodyGeometry: bodyGeo, collarGeometry: collarGeo, wireframeGeo: wireGeo };
  }, [params, type]);

  useFrame((state) => {
    const rotation = state.clock.elapsedTime * 0.05;
    if (meshRef.current) meshRef.current.rotation.y = rotation;
    if (collarRef.current) collarRef.current.rotation.y = rotation;
    if (wireRef.current) wireRef.current.rotation.y = rotation;
  });

  return (
    <group position={[0, -params.height * SCALE * 0.5, 0]}>
      {/* Solid collar at base */}
      <mesh ref={collarRef} geometry={collarGeometry} castShadow receiveShadow>
        <meshStandardMaterial
          color="#c0c0c0"
          roughness={0.5}
          metalness={0.1}
        />
      </mesh>
      
      {/* Organic body above collar */}
      <mesh ref={meshRef} geometry={bodyGeometry} castShadow receiveShadow>
        <meshStandardMaterial
          color="#d4d4d4"
          roughness={0.6}
          metalness={0.05}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {showWireframe && (
        <lineSegments ref={wireRef} geometry={wireframeGeo}>
          <lineBasicMaterial color="#3b82f6" opacity={0.3} transparent />
        </lineSegments>
      )}
    </group>
  );
};

export default ParametricMesh;