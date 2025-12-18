import { motion } from 'framer-motion';
import { RotateCcw, Shield, Eye, Footprints, Cable } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import ParameterSlider from './ParameterSlider';
import { ParametricParams, ObjectType, defaultParams, printConstraints } from '@/types/parametric';
import { getSupportFreeConstraints, applySupportFreeConstraints, checkSupportFreeCompliance } from '@/lib/support-free-constraints';
import { toast } from 'sonner';
import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

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
      <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-xs font-semibold text-text-secondary uppercase tracking-wider hover:text-foreground transition-colors">
        {title}
        <ChevronDown className={cn("w-4 h-4 transition-transform", isOpen && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 pt-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
};

const ParameterControls = ({ params, type, onParamsChange }: ParameterControlsProps) => {
  const handleChange = (key: keyof ParametricParams) => (value: number) => {
    let newParams = { ...params, [key]: value };
    
    // If support-free mode is on, apply constraints
    if (params.supportFreeMode) {
      newParams = applySupportFreeConstraints(newParams);
    }
    
    onParamsChange(newParams);
  };

  const handleReset = () => {
    onParamsChange(defaultParams[type]);
    toast.success('Parameters reset');
  };
  
  // Get support-free constraints
  const constraints = useMemo(() => getSupportFreeConstraints(params), [params]);
  const compliance = useMemo(() => checkSupportFreeCompliance(params), [params]);
  
  const handleSupportFreeModeToggle = (enabled: boolean) => {
    let newParams = { ...params, supportFreeMode: enabled };
    if (enabled) {
      newParams = applySupportFreeConstraints(newParams);
      toast.success('Support-free mode enabled - parameters constrained');
    }
    onParamsChange(newParams);
  };
  
  const handleOverhangMapToggle = (enabled: boolean) => {
    onParamsChange({ ...params, showOverhangMap: enabled });
  };
  
  const handleLegsToggle = (enabled: boolean) => {
    onParamsChange({ ...params, addLegs: enabled });
    if (enabled) {
      toast.success('Legs enabled');
    }
  };
  
  const handleLegCountChange = (count: 3 | 4) => {
    onParamsChange({ ...params, legCount: count });
  };

  const handleCordHoleToggle = (enabled: boolean) => {
    onParamsChange({ ...params, cordHoleEnabled: enabled });
    if (enabled) {
      toast.success('Cord hole enabled');
    }
  };

  const handleCordHoleDiameterChange = (value: number) => {
    onParamsChange({ ...params, cordHoleDiameter: value });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-3"
    >
      {/* Legs Toggle */}
      <div className="bg-secondary/50 rounded-lg p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Footprints className={cn("w-4 h-4", params.addLegs ? "text-primary" : "text-muted-foreground")} />
            <Label htmlFor="add-legs" className="text-sm font-medium">Add Legs</Label>
          </div>
          <Switch 
            id="add-legs" 
            checked={params.addLegs} 
            onCheckedChange={handleLegsToggle}
          />
        </div>
        
        {params.addLegs && (
          <div className="space-y-3 pt-2 border-t border-border/50">
            <div className="flex gap-2">
              <Button
                variant={params.legCount === 3 ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => handleLegCountChange(3)}
              >
                3 Legs
              </Button>
              <Button
                variant={params.legCount === 4 ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => handleLegCountChange(4)}
              >
                4 Legs
              </Button>
            </div>
            
            <ParameterSlider
              label="Leg Height"
              value={params.legHeight}
              min={30}
              max={200}
              step={5}
              unit="mm"
              onChange={handleChange('legHeight')}
            />
            <ParameterSlider
              label="Leg Spread"
              value={params.legSpread}
              min={15}
              max={45}
              step={1}
              unit="°"
              onChange={handleChange('legSpread')}
            />
            <ParameterSlider
              label="Leg Thickness"
              value={params.legThickness}
              min={3}
              max={10}
              step={0.5}
              unit="mm"
              onChange={handleChange('legThickness')}
            />
            <ParameterSlider
              label="Leg Taper"
              value={params.legTaper}
              min={0}
              max={0.8}
              step={0.1}
              onChange={handleChange('legTaper')}
            />
            <ParameterSlider
              label="Leg Inset"
              value={params.legInset}
              min={0}
              max={0.8}
              step={0.05}
              onChange={handleChange('legInset')}
            />
            
            {/* Cord Hole Controls */}
            <div className="pt-3 mt-3 border-t border-border/50 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cable className={cn("w-4 h-4", params.cordHoleEnabled ? "text-primary" : "text-muted-foreground")} />
                  <Label htmlFor="cord-hole" className="text-sm font-medium">Cord Hole</Label>
                </div>
                <Switch 
                  id="cord-hole" 
                  checked={params.cordHoleEnabled} 
                  onCheckedChange={handleCordHoleToggle}
                />
              </div>
              
              {params.cordHoleEnabled && (
                <ParameterSlider
                  label="Cord Hole Ø"
                  value={params.cordHoleDiameter}
                  min={4}
                  max={12}
                  step={0.5}
                  unit="mm"
                  onChange={handleCordHoleDiameterChange}
                />
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Support-Free Mode Toggle */}
      <div className="bg-secondary/50 rounded-lg p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className={cn("w-4 h-4", params.supportFreeMode ? "text-emerald-500" : "text-muted-foreground")} />
            <Label htmlFor="support-free" className="text-sm font-medium">Support-Free Mode</Label>
          </div>
          <Switch 
            id="support-free" 
            checked={params.supportFreeMode} 
            onCheckedChange={handleSupportFreeModeToggle}
          />
        </div>
        
        {params.supportFreeMode && (
          <div className={cn(
            "text-xs p-2 rounded",
            compliance.isCompliant 
              ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/30"
              : "bg-amber-500/10 text-amber-600 border border-amber-500/30"
          )}>
            {compliance.isCompliant 
              ? "✓ All parameters within support-free limits"
              : `Max overhang: ${compliance.maxOverhang.toFixed(0)}° (limit: 45°)`
            }
          </div>
        )}
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className={cn("w-4 h-4", params.showOverhangMap ? "text-primary" : "text-muted-foreground")} />
            <Label htmlFor="overhang-map" className="text-xs">Show Overhang Map</Label>
          </div>
          <Switch 
            id="overhang-map" 
            checked={params.showOverhangMap} 
            onCheckedChange={handleOverhangMapToggle}
          />
        </div>
      </div>
      
      <Button variant="outline" size="sm" onClick={handleReset} className="w-full gap-2">
        <RotateCcw className="w-4 h-4" />
        Reset to Default
      </Button>

      {/* Dimensions - in mm */}
      <Section title="Dimensions (mm)" defaultOpen={true}>
        <ParameterSlider
          label="Height"
          value={params.height}
          min={printConstraints.minHeight}
          max={printConstraints.maxHeight}
          step={5}
          unit="mm"
          onChange={handleChange('height')}
        />
        <ParameterSlider
          label="Base Radius"
          value={params.baseRadius}
          min={printConstraints.minBaseRadius}
          max={100}
          step={2}
          unit="mm"
          onChange={handleChange('baseRadius')}
        />
        <ParameterSlider
          label="Top Radius"
          value={params.topRadius}
          min={5}
          max={100}
          step={2}
          unit="mm"
          onChange={handleChange('topRadius')}
        />
        <ParameterSlider
          label="Wall Thickness"
          value={params.wallThickness}
          min={printConstraints.minWallThickness}
          max={printConstraints.maxWallThickness}
          step={0.2}
          unit="mm"
          onChange={handleChange('wallThickness')}
        />
        <ParameterSlider
          label="Base Thickness"
          value={params.baseThickness}
          min={printConstraints.minBaseThickness}
          max={5}
          step={0.2}
          unit="mm"
          onChange={handleChange('baseThickness')}
        />
      </Section>

      {/* Organic Shape */}
      <Section title="Organic Shape" defaultOpen={true}>
        <ParameterSlider
          label="Bulge Position"
          value={params.bulgePosition}
          min={0.15}
          max={0.85}
          step={0.05}
          onChange={handleChange('bulgePosition')}
        />
        <ParameterSlider
          label="Bulge Amount"
          value={params.bulgeAmount}
          min={0}
          max={params.supportFreeMode ? constraints.bulgeAmount.max : 0.5}
          step={0.02}
          onChange={handleChange('bulgeAmount')}
          constrained={params.supportFreeMode}
        />
        <ParameterSlider
          label="Pinch"
          value={params.pinchAmount}
          min={0}
          max={0.3}
          step={0.02}
          onChange={handleChange('pinchAmount')}
        />
        <ParameterSlider
          label="Asymmetry"
          value={params.asymmetry}
          min={0}
          max={params.supportFreeMode ? constraints.asymmetry.max : 0.1}
          step={0.01}
          onChange={handleChange('asymmetry')}
          constrained={params.supportFreeMode}
        />
      </Section>

      {/* Deformations */}
      <Section title="Deformations" defaultOpen={false}>
        <ParameterSlider
          label="Twist"
          value={params.twistAngle}
          min={0}
          max={180}
          step={5}
          unit="°"
          onChange={handleChange('twistAngle')}
        />
        <ParameterSlider
          label="Wobble Waves"
          value={params.wobbleFrequency}
          min={0}
          max={8}
          step={1}
          onChange={handleChange('wobbleFrequency')}
        />
        <ParameterSlider
          label="Wobble Depth"
          value={params.wobbleAmplitude}
          min={0}
          max={params.supportFreeMode ? constraints.wobbleAmplitude.max : 0.15}
          step={0.01}
          onChange={handleChange('wobbleAmplitude')}
          constrained={params.supportFreeMode}
        />
      </Section>

      {/* Surface */}
      <Section title="Surface Details" defaultOpen={false}>
        <ParameterSlider
          label="Ripples"
          value={params.rippleCount}
          min={0}
          max={16}
          step={1}
          onChange={handleChange('rippleCount')}
        />
        <ParameterSlider
          label="Ripple Depth"
          value={params.rippleDepth}
          min={0}
          max={0.1}
          step={0.005}
          onChange={handleChange('rippleDepth')}
        />
        <ParameterSlider
          label="Organic Noise"
          value={params.organicNoise}
          min={0}
          max={0.1}
          step={0.005}
          onChange={handleChange('organicNoise')}
        />
        <ParameterSlider
          label="Noise Scale"
          value={params.noiseScale}
          min={0.5}
          max={4}
          step={0.25}
          onChange={handleChange('noiseScale')}
        />
      </Section>

      {/* Lip */}
      <Section title="Lip & Rim" defaultOpen={false}>
        <ParameterSlider
          label="Lip Flare"
          value={params.lipFlare}
          min={0}
          max={params.supportFreeMode ? constraints.lipFlare.max : 0.25}
          step={0.02}
          onChange={handleChange('lipFlare')}
          constrained={params.supportFreeMode}
        />
        <ParameterSlider
          label="Lip Height"
          value={params.lipHeight}
          min={0.02}
          max={0.15}
          step={0.01}
          onChange={handleChange('lipHeight')}
        />
      </Section>
    </motion.div>
  );
};

export default ParameterControls;
