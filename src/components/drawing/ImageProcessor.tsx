import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Upload, RefreshCw } from 'lucide-react';
import { ProfilePoint } from '@/types/custom-profile';

interface ImageProcessorProps {
  onProfileChange: (points: ProfilePoint[]) => void;
  width?: number;
  height?: number;
}

const ImageProcessor = ({ onProfileChange, width = 400, height = 500 }: ImageProcessorProps) => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [threshold, setThreshold] = useState(128);
  const [edgeStrength, setEdgeStrength] = useState(50);
  const [profileSide, setProfileSide] = useState<'left' | 'right'>('right');
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const processedCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const axisX = width / 3;
  const scale = 2;

  // Sobel edge detection
  const detectEdges = useCallback((imageData: ImageData): ImageData => {
    const { data, width, height } = imageData;
    const output = new Uint8ClampedArray(data.length);
    
    const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0, gy = 0;
        
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4;
            const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
            const kernelIdx = (ky + 1) * 3 + (kx + 1);
            gx += gray * sobelX[kernelIdx];
            gy += gray * sobelY[kernelIdx];
          }
        }
        
        const magnitude = Math.sqrt(gx * gx + gy * gy) * (edgeStrength / 50);
        const idx = (y * width + x) * 4;
        const edge = magnitude > threshold ? 255 : 0;
        output[idx] = edge;
        output[idx + 1] = edge;
        output[idx + 2] = edge;
        output[idx + 3] = 255;
      }
    }
    
    return new ImageData(output, width, height);
  }, [threshold, edgeStrength]);

  // Extract profile from edges
  const extractProfileFromEdges = useCallback((edgeData: ImageData): ProfilePoint[] => {
    const { data, width: imgWidth, height: imgHeight } = edgeData;
    const points: ProfilePoint[] = [];
    
    // Scan each row and find edge points
    for (let y = 0; y < imgHeight; y += 2) {
      let edgeX = -1;
      
      if (profileSide === 'right') {
        // Find rightmost edge
        for (let x = imgWidth - 1; x >= imgWidth / 2; x--) {
          const idx = (y * imgWidth + x) * 4;
          if (data[idx] > 128) {
            edgeX = x;
            break;
          }
        }
      } else {
        // Find leftmost edge
        for (let x = 0; x < imgWidth / 2; x++) {
          const idx = (y * imgWidth + x) * 4;
          if (data[idx] > 128) {
            edgeX = imgWidth / 2 - x;
            break;
          }
        }
      }
      
      if (edgeX > 0) {
        const profileX = (edgeX - imgWidth / 2) / scale;
        const profileY = (imgHeight - y) / scale;
        
        if (profileX > 0) {
          points.push({ x: Math.max(1, profileX), y: profileY });
        }
      }
    }
    
    // Smooth and simplify points
    const simplified: ProfilePoint[] = [];
    for (let i = 0; i < points.length; i += 3) {
      if (i < points.length) {
        simplified.push(points[i]);
      }
    }
    
    return simplified.sort((a, b) => a.y - b.y);
  }, [profileSide, scale]);

  // Process image
  const processImage = useCallback(() => {
    if (!image || !canvasRef.current || !processedCanvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const processedCanvas = processedCanvasRef.current;
    const processedCtx = processedCanvas.getContext('2d');
    
    if (!ctx || !processedCtx) return;
    
    // Draw original image
    const aspectRatio = image.width / image.height;
    let drawWidth = width;
    let drawHeight = height;
    
    if (aspectRatio > width / height) {
      drawHeight = width / aspectRatio;
    } else {
      drawWidth = height * aspectRatio;
    }
    
    canvas.width = width;
    canvas.height = height;
    processedCanvas.width = width;
    processedCanvas.height = height;
    
    // Center the image
    const offsetX = (width - drawWidth) / 2;
    const offsetY = (height - drawHeight) / 2;
    
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
    
    // Get image data and detect edges
    const imageData = ctx.getImageData(0, 0, width, height);
    const edgeData = detectEdges(imageData);
    
    // Draw processed image
    processedCtx.putImageData(edgeData, 0, 0);
    
    // Draw axis line
    processedCtx.strokeStyle = 'hsl(var(--primary))';
    processedCtx.lineWidth = 2;
    processedCtx.setLineDash([5, 5]);
    processedCtx.beginPath();
    processedCtx.moveTo(width / 2, 0);
    processedCtx.lineTo(width / 2, height);
    processedCtx.stroke();
    
    // Extract and update profile
    const profile = extractProfileFromEdges(edgeData);
    onProfileChange(profile);
  }, [image, width, height, detectEdges, extractProfileFromEdges, onProfileChange]);

  // Process when settings change
  useEffect(() => {
    if (image) {
      processImage();
    }
  }, [image, threshold, edgeStrength, profileSide, processImage]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const img = new Image();
    img.onload = () => {
      setImage(img);
    };
    img.src = URL.createObjectURL(file);
  };

  return (
    <div className="space-y-4">
      {/* Upload button */}
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
        <Button onClick={() => fileInputRef.current?.click()}>
          <Upload className="w-4 h-4 mr-2" />
          Upload Image
        </Button>
        {image && (
          <Button variant="outline" onClick={processImage}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Reprocess
          </Button>
        )}
      </div>

      {/* Controls */}
      {image && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm">Edge Threshold</Label>
            <Slider
              value={[threshold]}
              onValueChange={([v]) => setThreshold(v)}
              min={20}
              max={200}
              step={1}
            />
          </div>
          
          <div className="space-y-2">
            <Label className="text-sm">Edge Strength</Label>
            <Slider
              value={[edgeStrength]}
              onValueChange={([v]) => setEdgeStrength(v)}
              min={10}
              max={100}
              step={1}
            />
          </div>
          
          <div className="flex gap-2">
            <Button
              variant={profileSide === 'right' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setProfileSide('right')}
            >
              Use Right Edge
            </Button>
            <Button
              variant={profileSide === 'left' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setProfileSide('left')}
            >
              Use Left Edge
            </Button>
          </div>
        </div>
      )}

      {/* Canvas display */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Original</Label>
          <canvas
            ref={canvasRef}
            width={width / 2}
            height={height / 2}
            className="border border-border rounded-lg bg-muted w-full"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Edge Detection</Label>
          <canvas
            ref={processedCanvasRef}
            width={width / 2}
            height={height / 2}
            className="border border-border rounded-lg bg-muted w-full"
          />
        </div>
      </div>

      {!image && (
        <div className="border-2 border-dashed border-border rounded-lg p-12 text-center">
          <p className="text-muted-foreground">
            Upload an image to extract a profile for 3D generation
          </p>
        </div>
      )}
    </div>
  );
};

export default ImageProcessor;
