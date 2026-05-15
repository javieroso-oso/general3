/**
 * Pages mode STL export. Generates the book geometry (mm), normalizes it to
 * slicer-friendly orientation (spine on Z=0, pages rising in +Z), and writes
 * STL bytes.
 */

import * as THREE from 'three';
import { STLExporter } from 'three-stdlib';
import { BookParams } from '@/types/pages';
import { generateBookGeometry } from './book-generator';

export function exportBookToSTL(book: BookParams): Blob | null {
  const geo = generateBookGeometry(book, { scale: 1 });
  if (!geo) return null;

  // Normalize: rotate -PI/2 around X so +Y → +Z (spine ends up flat on Z=0,
  // pages rising along +Z). Then translate so min Z = 0.
  geo.rotateX(-Math.PI / 2);
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  geo.translate(0, 0, -bb.min.z);

  const mesh = new THREE.Mesh(geo);
  const exporter = new STLExporter();
  const result = exporter.parse(mesh);
  geo.dispose();
  return new Blob([result], { type: 'application/octet-stream' });
}

export function downloadBookSTL(book: BookParams, filename = 'book.stl') {
  const blob = exportBookToSTL(book);
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
