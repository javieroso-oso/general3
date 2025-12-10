import { motion } from 'framer-motion';
import { RotateCcw, Download, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ParameterSlider from './ParameterSlider';
import { ParametricParams, ObjectType, defaultParams } from '@/types/parametric';
import { toast } from 'sonner';

interface ParameterControlsProps {
  params: ParametricParams;
  type: ObjectType;
  onParamsChange: (params: ParametricParams) => void;
}

const ParameterControls = ({ params, type, onParamsChange }: ParameterControlsProps) => {
  const handleChange = (key: keyof ParametricParams) => (value: number) => {
    onParamsChange({ ...params, [key]: value });
  };

  const handleReset = () => {
    onParamsChange(defaultParams[type]);
    toast.success('Parameters reset to default');
  };

  const handleExport = () => {
    toast.success('Export feature coming soon!', {
      description: 'STL and OBJ export will be available in the next update.',
    });
  };

  const handleShare = () => {
    const shareData = btoa(JSON.stringify({ type, params }));
    navigator.clipboard.writeText(`${window.location.origin}?config=${shareData}`);
    toast.success('Link copied to clipboard!');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleReset}
          className="flex-1 gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          Reset
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          className="flex-1 gap-2"
        >
          <Download className="w-4 h-4" />
          Export
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleShare}
          className="flex-1 gap-2"
        >
          <Share2 className="w-4 h-4" />
          Share
        </Button>
      </div>

      {/* Parameter sliders */}
      <div className="space-y-5">
        <ParameterSlider
          label="Height"
          value={params.height}
          min={1}
          max={6}
          step={0.1}
          unit=" units"
          onChange={handleChange('height')}
        />
        
        <ParameterSlider
          label="Base Radius"
          value={params.baseRadius}
          min={0.3}
          max={2}
          step={0.05}
          unit=" units"
          onChange={handleChange('baseRadius')}
        />
        
        <ParameterSlider
          label="Top Radius"
          value={params.topRadius}
          min={0.2}
          max={2}
          step={0.05}
          unit=" units"
          onChange={handleChange('topRadius')}
        />
        
        <ParameterSlider
          label="Wall Thickness"
          value={params.wallThickness}
          min={0.05}
          max={0.3}
          step={0.01}
          unit=" units"
          onChange={handleChange('wallThickness')}
        />
        
        <ParameterSlider
          label="Wobble Frequency"
          value={params.wobbleFrequency}
          min={0}
          max={10}
          step={1}
          onChange={handleChange('wobbleFrequency')}
        />
        
        <ParameterSlider
          label="Twist Angle"
          value={params.twistAngle}
          min={0}
          max={360}
          step={5}
          unit="°"
          onChange={handleChange('twistAngle')}
        />
      </div>
    </motion.div>
  );
};

export default ParameterControls;
