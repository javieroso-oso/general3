import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { LampParams } from '@/types/lamp';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface ShadeControlsProps {
  params: LampParams;
  onParamsChange: (params: LampParams) => void;
}

interface SectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

const Section = ({ title, defaultOpen = true, children }: SectionProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border-b border-border pb-4">
      <CollapsibleTrigger className="flex items-center justify-between w-full py-2 hover:bg-muted/50 rounded px-2 transition-colors">
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">{title}</span>
        <ChevronDown className={cn('w-4 h-4 transition-transform', isOpen && 'rotate-180')} />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3 space-y-4 px-1">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
};

const ShadeControls = ({ params, onParamsChange }: ShadeControlsProps) => {
  const updateParam = <K extends keyof LampParams>(key: K, value: LampParams[K]) => {
    onParamsChange({ ...params, [key]: value });
  };
  
  const SliderRow = ({ 
    label, 
    value, 
    onChange, 
    min, 
    max, 
    step = 1, 
    unit = 'mm' 
  }: { 
    label: string; 
    value: number; 
    onChange: (v: number) => void; 
    min: number; 
    max: number; 
    step?: number;
    unit?: string;
  }) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded">
          {value.toFixed(step < 1 ? 1 : 0)}{unit}
        </span>
      </div>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={min}
        max={max}
        step={step}
        className="py-1"
      />
    </div>
  );
  
  return (
    <div className="space-y-4">
      {/* Dimensions */}
      <Section title="Dimensions" defaultOpen={true}>
        <SliderRow
          label="Height"
          value={params.height}
          onChange={(v) => updateParam('height', v)}
          min={80}
          max={300}
        />
        <SliderRow
          label="Base Radius"
          value={params.baseRadius}
          onChange={(v) => updateParam('baseRadius', v)}
          min={20}
          max={120}
        />
        <SliderRow
          label="Top Radius"
          value={params.topRadius}
          onChange={(v) => updateParam('topRadius', v)}
          min={20}
          max={150}
        />
        <SliderRow
          label="Wall Thickness"
          value={params.wallThickness}
          onChange={(v) => updateParam('wallThickness', v)}
          min={1.2}
          max={5}
          step={0.2}
        />
      </Section>
      
      {/* Note: Socket mounting hole is now auto-calculated from hardware selection */}
      
      {/* Organic Shape */}
      <Section title="Organic Shape" defaultOpen={false}>
        <SliderRow
          label="Bulge Position"
          value={params.bulgePosition}
          onChange={(v) => updateParam('bulgePosition', v)}
          min={0.2}
          max={0.8}
          step={0.05}
          unit=""
        />
        <SliderRow
          label="Bulge Amount"
          value={params.bulgeAmount}
          onChange={(v) => updateParam('bulgeAmount', v)}
          min={0}
          max={0.5}
          step={0.02}
          unit=""
        />
        <SliderRow
          label="Pinch"
          value={params.pinchAmount}
          onChange={(v) => updateParam('pinchAmount', v)}
          min={0}
          max={0.3}
          step={0.02}
          unit=""
        />
        <SliderRow
          label="Asymmetry"
          value={params.asymmetry}
          onChange={(v) => updateParam('asymmetry', v)}
          min={0}
          max={0.2}
          step={0.01}
          unit=""
        />
      </Section>
      
      {/* Deformations */}
      <Section title="Deformations" defaultOpen={false}>
        <SliderRow
          label="Twist Angle"
          value={params.twistAngle}
          onChange={(v) => updateParam('twistAngle', v)}
          min={0}
          max={180}
          unit="°"
        />
        <SliderRow
          label="Wobble Frequency"
          value={params.wobbleFrequency}
          onChange={(v) => updateParam('wobbleFrequency', v)}
          min={0}
          max={8}
          unit=""
        />
        <SliderRow
          label="Wobble Amplitude"
          value={params.wobbleAmplitude}
          onChange={(v) => updateParam('wobbleAmplitude', v)}
          min={0}
          max={0.15}
          step={0.01}
          unit=""
        />
        <SliderRow
          label="Ripple Count"
          value={params.rippleCount}
          onChange={(v) => updateParam('rippleCount', v)}
          min={0}
          max={16}
          unit=""
        />
        <SliderRow
          label="Ripple Depth"
          value={params.rippleDepth}
          onChange={(v) => updateParam('rippleDepth', v)}
          min={0}
          max={0.1}
          step={0.005}
          unit=""
        />
      </Section>
      
      {/* Lip/Rim */}
      <Section title="Lip/Rim" defaultOpen={false}>
        <SliderRow
          label="Lip Flare"
          value={params.lipFlare}
          onChange={(v) => updateParam('lipFlare', v)}
          min={0}
          max={0.2}
          step={0.01}
          unit=""
        />
        <SliderRow
          label="Lip Height"
          value={params.lipHeight}
          onChange={(v) => updateParam('lipHeight', v)}
          min={0}
          max={0.1}
          step={0.01}
          unit=""
        />
      </Section>
      
      {/* Organic Noise */}
      <Section title="Surface Texture" defaultOpen={false}>
        <SliderRow
          label="Organic Noise"
          value={params.organicNoise}
          onChange={(v) => updateParam('organicNoise', v)}
          min={0}
          max={0.1}
          step={0.005}
          unit=""
        />
        <SliderRow
          label="Noise Scale"
          value={params.noiseScale}
          onChange={(v) => updateParam('noiseScale', v)}
          min={0.5}
          max={4}
          step={0.5}
          unit=""
        />
      </Section>
      
      {/* Base */}
      <Section title="Base" defaultOpen={false}>
        <SliderRow
          label="Base Thickness"
          value={params.baseThickness}
          onChange={(v) => updateParam('baseThickness', v)}
          min={0}
          max={5}
          step={0.5}
        />
      </Section>
    </div>
  );
};

export default ShadeControls;
