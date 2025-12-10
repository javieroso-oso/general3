import { motion } from 'framer-motion';
import { RotateCcw, Download, Share2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import ParameterSlider from './ParameterSlider';
import { ParametricParams, ObjectType, defaultParams } from '@/types/parametric';
import { toast } from 'sonner';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface ParameterControlsProps {
  params: ParametricParams;
  type: ObjectType;
  onParamsChange: (params: ParametricParams) => void;
}

interface SectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

const Section = ({ title, defaultOpen = true, children }: SectionProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-semibold text-text-secondary uppercase tracking-wider hover:text-foreground transition-colors">
        {title}
        <ChevronDown className={cn("w-4 h-4 transition-transform", isOpen && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 pt-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
};

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
      className="space-y-4"
    >
      {/* Action buttons */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleReset} className="flex-1 gap-2">
          <RotateCcw className="w-4 h-4" />
          Reset
        </Button>
        <Button variant="outline" size="sm" onClick={handleExport} className="flex-1 gap-2">
          <Download className="w-4 h-4" />
          Export
        </Button>
        <Button variant="outline" size="sm" onClick={handleShare} className="flex-1 gap-2">
          <Share2 className="w-4 h-4" />
          Share
        </Button>
      </div>

      {/* Dimensions */}
      <Section title="Dimensions" defaultOpen={true}>
        <ParameterSlider
          label="Height"
          value={params.height}
          min={1}
          max={6}
          step={0.1}
          unit=""
          onChange={handleChange('height')}
        />
        <ParameterSlider
          label="Base Radius"
          value={params.baseRadius}
          min={0.3}
          max={2}
          step={0.05}
          unit=""
          onChange={handleChange('baseRadius')}
        />
        <ParameterSlider
          label="Top Radius"
          value={params.topRadius}
          min={0.2}
          max={2}
          step={0.05}
          unit=""
          onChange={handleChange('topRadius')}
        />
        <ParameterSlider
          label="Wall Thickness"
          value={params.wallThickness}
          min={0.06}
          max={0.3}
          step={0.01}
          unit=""
          onChange={handleChange('wallThickness')}
        />
      </Section>

      {/* Organic Shape */}
      <Section title="Organic Shape" defaultOpen={true}>
        <ParameterSlider
          label="Bulge Position"
          value={params.bulgePosition}
          min={0.1}
          max={0.9}
          step={0.05}
          onChange={handleChange('bulgePosition')}
        />
        <ParameterSlider
          label="Bulge Amount"
          value={params.bulgeAmount}
          min={0}
          max={0.8}
          step={0.02}
          onChange={handleChange('bulgeAmount')}
        />
        <ParameterSlider
          label="Pinch"
          value={params.pinchAmount}
          min={0}
          max={0.5}
          step={0.02}
          onChange={handleChange('pinchAmount')}
        />
        <ParameterSlider
          label="Asymmetry"
          value={params.asymmetry}
          min={0}
          max={0.3}
          step={0.01}
          onChange={handleChange('asymmetry')}
        />
      </Section>

      {/* Deformations */}
      <Section title="Deformations" defaultOpen={false}>
        <ParameterSlider
          label="Twist Angle"
          value={params.twistAngle}
          min={0}
          max={360}
          step={5}
          unit="°"
          onChange={handleChange('twistAngle')}
        />
        <ParameterSlider
          label="Wobble Waves"
          value={params.wobbleFrequency}
          min={0}
          max={12}
          step={1}
          onChange={handleChange('wobbleFrequency')}
        />
        <ParameterSlider
          label="Wobble Depth"
          value={params.wobbleAmplitude}
          min={0}
          max={0.2}
          step={0.01}
          onChange={handleChange('wobbleAmplitude')}
        />
      </Section>

      {/* Surface Details */}
      <Section title="Surface Details" defaultOpen={false}>
        <ParameterSlider
          label="Ripple Count"
          value={params.rippleCount}
          min={0}
          max={24}
          step={1}
          onChange={handleChange('rippleCount')}
        />
        <ParameterSlider
          label="Ripple Depth"
          value={params.rippleDepth}
          min={0}
          max={0.15}
          step={0.005}
          onChange={handleChange('rippleDepth')}
        />
        <ParameterSlider
          label="Organic Noise"
          value={params.organicNoise}
          min={0}
          max={0.15}
          step={0.005}
          onChange={handleChange('organicNoise')}
        />
        <ParameterSlider
          label="Noise Scale"
          value={params.noiseScale}
          min={0.5}
          max={5}
          step={0.25}
          onChange={handleChange('noiseScale')}
        />
      </Section>

      {/* Lip & Rim */}
      <Section title="Lip & Rim" defaultOpen={false}>
        <ParameterSlider
          label="Lip Flare"
          value={params.lipFlare}
          min={0}
          max={0.4}
          step={0.02}
          onChange={handleChange('lipFlare')}
        />
        <ParameterSlider
          label="Lip Height"
          value={params.lipHeight}
          min={0.02}
          max={0.2}
          step={0.01}
          onChange={handleChange('lipHeight')}
        />
      </Section>
    </motion.div>
  );
};

export default ParameterControls;
