/**
 * Captures a thumbnail from the Three.js canvas
 * @param size - Target size for the square thumbnail (default: 150)
 * @returns Promise resolving to base64 JPEG data URL
 */
export const captureCanvasThumbnail = async (size: number = 150): Promise<string> => {
  // Find the Three.js canvas
  const canvas = document.querySelector('canvas') as HTMLCanvasElement | null;
  
  if (!canvas) {
    throw new Error('No canvas found for thumbnail capture');
  }

  // Create an offscreen canvas for resizing
  const offscreen = document.createElement('canvas');
  offscreen.width = size;
  offscreen.height = size;
  const ctx = offscreen.getContext('2d');
  
  if (!ctx) {
    throw new Error('Could not get 2D context for thumbnail');
  }

  // Get the source dimensions (square crop from center)
  const sourceSize = Math.min(canvas.width, canvas.height);
  const sourceX = (canvas.width - sourceSize) / 2;
  const sourceY = (canvas.height - sourceSize) / 2;

  // Draw the canvas content, cropping to square and resizing
  ctx.drawImage(
    canvas,
    sourceX, sourceY, sourceSize, sourceSize,
    0, 0, size, size
  );

  // Export as JPEG with moderate quality for storage efficiency
  return offscreen.toDataURL('image/jpeg', 0.7);
};
