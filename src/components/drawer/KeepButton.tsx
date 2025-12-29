import { useState } from 'react';
import { Plus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { captureCanvasThumbnail } from '@/lib/thumbnail-capture';
import { ParametricParams, ObjectType } from '@/types/parametric';
import { toast } from 'sonner';

interface KeepButtonProps {
  params: ParametricParams;
  objectType: ObjectType;
  onKeep: (params: ParametricParams, objectType: ObjectType, thumbnail: string) => void;
}

const KeepButton = ({ params, objectType, onKeep }: KeepButtonProps) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [justKept, setJustKept] = useState(false);

  const handleKeep = async () => {
    if (isCapturing) return;
    
    setIsCapturing(true);
    try {
      // Small delay to ensure canvas is rendered
      await new Promise((resolve) => setTimeout(resolve, 100));
      
      const thumbnail = await captureCanvasThumbnail(150);
      onKeep(params, objectType, thumbnail);
      
      setJustKept(true);
      toast.success('Added to drawer');
      
      // Reset the "just kept" state after animation
      setTimeout(() => setJustKept(false), 1500);
    } catch (error) {
      console.error('Failed to capture thumbnail:', error);
      toast.error('Could not capture design');
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="lg"
      onClick={handleKeep}
      disabled={isCapturing}
      className="gap-2"
    >
      {justKept ? (
        <Check className="w-5 h-5 text-green-500" />
      ) : (
        <Plus className="w-5 h-5" />
      )}
      {isCapturing ? 'Capturing...' : justKept ? 'Kept!' : 'Keep'}
    </Button>
  );
};

export default KeepButton;
