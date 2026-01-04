import { motion } from 'framer-motion';
import { RotateCcw, Shield, Eye, Footprints, Cable, Box, Grip, Layers, Shuffle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ParameterSlider from './ParameterSlider';
import { ParametricParams, ObjectType, defaultParams, printConstraints, StandType, LegStyle } from '@/types/parametric';
import { getSupportFreeConstraints, applySupportFreeConstraints, checkSupportFreeCompliance } from '@/lib/support-free-constraints';
import { generateRandomParams } from '@/lib/random-generator';
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
    
    if (params.supportFreeMode) {
      newParams = applySupportFreeConstraints(newParams);
    }
    
    onParamsChange(newParams);
  };

  const handleReset = () => {
    onParamsChange(defaultParams[type]);
    toast.success('Parameters reset');
  };

  const handleRandomize = () => {
    let newParams = generateRandomParams(params);
    if (params.supportFreeMode) {
      newParams = applySupportFreeConstraints(newParams);
    }
    onParamsChange(newParams);
    toast.success('Random shape generated!');
  };
  
  const constraints = useMemo(() => getSupportFreeConstraints(params), [params]);
  const compliance = useMemo(() => checkSupportFreeCompliance(params), [params]);
  
  const handleSupportFreeModeToggle = (enabled: boolean) => {
    let newParams = { ...params, supportFreeMode: enabled };
    if (enabled) {
      newParams = applySupportFreeConstraints(newParams);
      toast.success('Support-free mode enabled');
    }
    onParamsChange(newParams);
  };
  
  const handleOverhangMapToggle = (enabled: boolean) => {
    onParamsChange({ ...params, showOverhangMap: enabled });
  };
  
  const handleLegsToggle = (enabled: boolean) => {
    onParamsChange({ ...params, addLegs: enabled });
  };
  
  const handleLegCountChange = (count: 3 | 4) => {
    onParamsChange({ ...params, legCount: count });
  };

  const handleCordHoleToggle = (enabled: boolean) => {
    onParamsChange({ ...params, cordHoleEnabled: enabled });
  };

  const handleStandTypeChange = (value: StandType) => {
    onParamsChange({ ...params, standType: value });
  };

  const handleLegStyleChange = (value: LegStyle) => {
    let newParams = { ...params, legStyle: value };
    
    switch (value) {
      case 'riser':
        newParams.legHeight = Math.min(params.legHeight, 15);
        newParams.legSpread = Math.min(params.legSpread, 10);
        break;
      case 'column':
        newParams.legSpread = 0;
        break;
      case 'bun':
        break;
      case 'tripod':
      default:
        if (params.legHeight < 30) newParams.legHeight = 80;
        if (params.legSpread < 15) newParams.legSpread = 25;
        break;
    }
    
    onParamsChange(newParams);
  };

  const getStandLabel = (type: StandType): string => {
    switch (type) {
      case 'tripod': return 'Tripod Legs';
      case 'wall_mount': return 'Wall Mount';
      default: return type;
    }
  };

  const getLegStyleLabel = (style: LegStyle): string => {
    switch (style) {
      case 'tripod': return 'Tripod';
      case 'riser': return 'Riser';
      case 'column': return 'Column';
      case 'bun': return 'Bun Feet';
      default: return style;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-3"
    >
      {/* 1. Randomize / Reset - TOP */}
      <div className="flex gap-2 items-center">
        <Button variant="outline" size="sm" onClick={handleRandomize} className="flex-1 gap-2">
          <Shuffle className="w-4 h-4" />
          Randomize
        </Button>
        <Button variant="outline" size="sm" onClick={handleReset} className="flex-1 gap-2">
          <RotateCcw className="w-4 h-4" />
          Reset
        </Button>
      </div>

      {/* 2. Dimensions */}
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

      {/* 3. Organic Shape */}
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
          max={params.supportFreeMode ? constraints.asymmetry.max : 0.35}
          step={0.01}
          onChange={handleChange('asymmetry')}
          constrained={params.supportFreeMode}
        />
      </Section>

      {/* 4. Deformations */}
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
          label="Wobble Frequency"
          value={params.wobbleFrequency}
          min={0}
          max={8}
          step={1}
          onChange={handleChange('wobbleFrequency')}
        />
        <ParameterSlider
          label="Wobble Amount"
          value={params.wobbleAmplitude}
          min={0}
          max={params.supportFreeMode ? constraints.wobbleAmplitude.max : 0.15}
          step={0.01}
          onChange={handleChange('wobbleAmplitude')}
          constrained={params.supportFreeMode}
        />
      </Section>

      {/* 4b. Spine Curve */}
      <Section title="Spine Curve" defaultOpen={false}>
        <div className="flex items-center justify-between mb-3">
          <Label htmlFor="spine-toggle" className="text-sm">Enable Spine</Label>
          <Switch
            id="spine-toggle"
            checked={params.spineEnabled}
            onCheckedChange={(enabled) => onParamsChange({ ...params, spineEnabled: enabled })}
          />
        </div>
        
        {params.spineEnabled && (
          <>
            <div className="text-xs text-muted-foreground mb-2">X-Axis Displacement</div>
            <ParameterSlider
              label="Amplitude X"
              value={params.spineAmplitudeX}
              min={0}
              max={50}
              step={1}
              unit="mm"
              onChange={handleChange('spineAmplitudeX')}
            />
            <ParameterSlider
              label="Frequency X"
              value={params.spineFrequencyX}
              min={0}
              max={4}
              step={0.5}
              onChange={handleChange('spineFrequencyX')}
            />
            <ParameterSlider
              label="Phase X"
              value={params.spinePhaseX}
              min={0}
              max={1}
              step={0.05}
              onChange={handleChange('spinePhaseX')}
            />
            
            <div className="text-xs text-muted-foreground mt-3 mb-2">Z-Axis Displacement</div>
            <ParameterSlider
              label="Amplitude Z"
              value={params.spineAmplitudeZ}
              min={0}
              max={50}
              step={1}
              unit="mm"
              onChange={handleChange('spineAmplitudeZ')}
            />
            <ParameterSlider
              label="Frequency Z"
              value={params.spineFrequencyZ}
              min={0}
              max={4}
              step={0.5}
              onChange={handleChange('spineFrequencyZ')}
            />
            <ParameterSlider
              label="Phase Z"
              value={params.spinePhaseZ}
              min={0}
              max={1}
              step={0.05}
              onChange={handleChange('spinePhaseZ')}
            />
          </>
        )}
        
        {!params.spineEnabled && (
          <ParameterSlider
            label="Drift (Legacy)"
            value={params.drift}
            min={0}
            max={1}
            step={0.02}
            onChange={handleChange('drift')}
          />
        )}
      </Section>

      {/* 4c. Melt Effect */}
      <Section title="Melt Effect" defaultOpen={false}>
        <ParameterSlider
          label="Melt Amount"
          value={params.meltAmount}
          min={0}
          max={30}
          step={1}
          unit="mm"
          onChange={handleChange('meltAmount')}
        />
        
        {params.meltAmount > 0 && (
          <>
            <ParameterSlider
              label="Melt Lobes"
              value={params.meltLobes}
              min={0}
              max={8}
              step={1}
              onChange={handleChange('meltLobes')}
            />
            <ParameterSlider
              label="Lobe Variation"
              value={params.meltVariation}
              min={0}
              max={1}
              step={0.05}
              onChange={handleChange('meltVariation')}
            />
            <ParameterSlider
              label="Lobe Phase"
              value={params.meltPhase}
              min={0}
              max={1}
              step={0.05}
              onChange={handleChange('meltPhase')}
            />
            <ParameterSlider
              label="Melt Delay"
              value={params.meltDelay}
              min={0}
              max={0.8}
              step={0.05}
              onChange={handleChange('meltDelay')}
            />
            <p className="text-xs text-muted-foreground">
              Delay controls where melt begins. Higher values keep lower layers rigid.
            </p>
          </>
        )}
        
        <div className="pt-3 border-t border-border/50 mt-3">
          <ParameterSlider
            label="Lateral Drag"
            value={params.meltDragAmount}
            min={0}
            max={30}
            step={1}
            unit="mm"
            onChange={handleChange('meltDragAmount')}
          />
          
          {params.meltDragAmount > 0 && (
            <ParameterSlider
              label="Drag Direction"
              value={params.meltDragAngle}
              min={0}
              max={1}
              step={0.05}
              onChange={handleChange('meltDragAngle')}
            />
          )}
        </div>
        
        <p className="text-xs text-muted-foreground mt-2">
          Simulates gravity pulling softened material downward and sideways. Zero at base, increases toward top.
        </p>
      </Section>

      {/* 5. Surface Details */}
      <Section title="Surface Details" defaultOpen={false}>
        <ParameterSlider
          label="Ripple Count"
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
      
      {/* 6. Surface Patterns */}
      <Section title="Surface Patterns" defaultOpen={false}>
        {/* Profile Curve */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Profile Curve</Label>
          <Select 
            value={params.profileCurve} 
            onValueChange={(value: 'linear' | 'convex' | 'concave' | 'hourglass' | 'wave') => {
              onParamsChange({ ...params, profileCurve: value });
            }}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="linear">Linear (Default)</SelectItem>
              <SelectItem value="convex">Convex (Bulges Out)</SelectItem>
              <SelectItem value="concave">Concave (Curves In)</SelectItem>
              <SelectItem value="hourglass">Hourglass</SelectItem>
              <SelectItem value="wave">Wave</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Faceting */}
        <div className="pt-3 border-t border-border/50 space-y-3">
          <Label className="text-xs text-muted-foreground font-semibold">Faceting</Label>
          <ParameterSlider
            label="Facet Count"
            value={params.facetCount}
            min={0}
            max={24}
            step={1}
            onChange={handleChange('facetCount')}
          />
          {params.facetCount >= 3 && (
            <ParameterSlider
              label="Facet Sharpness"
              value={params.facetSharpness}
              min={0}
              max={1}
              step={0.1}
              onChange={handleChange('facetSharpness')}
            />
          )}
          <p className="text-xs text-muted-foreground">
            {params.facetCount === 0 && 'Smooth circular profile'}
            {params.facetCount === 6 && 'Hexagonal shape'}
            {params.facetCount === 8 && 'Octagonal shape'}
            {params.facetCount > 0 && params.facetCount !== 6 && params.facetCount !== 8 && `${params.facetCount}-sided polygon`}
          </p>
        </div>
        
        {/* Horizontal Ribs */}
        <div className="pt-3 border-t border-border/50 space-y-3">
          <Label className="text-xs text-muted-foreground font-semibold">Horizontal Ribs</Label>
          <ParameterSlider
            label="Rib Count"
            value={params.horizontalRibCount}
            min={0}
            max={20}
            step={1}
            onChange={handleChange('horizontalRibCount')}
          />
          {params.horizontalRibCount > 0 && (
            <>
              <ParameterSlider
                label="Rib Depth"
                value={params.horizontalRibDepth}
                min={0}
                max={0.1}
                step={0.005}
                onChange={handleChange('horizontalRibDepth')}
              />
              <ParameterSlider
                label="Rib Width"
                value={params.horizontalRibWidth}
                min={0.1}
                max={0.5}
                step={0.05}
                onChange={handleChange('horizontalRibWidth')}
              />
            </>
          )}
        </div>
        
        {/* Fluting (Vertical Grooves) */}
        <div className="pt-3 border-t border-border/50 space-y-3">
          <Label className="text-xs text-muted-foreground font-semibold">Fluting (Vertical Grooves)</Label>
          <ParameterSlider
            label="Flute Count"
            value={params.flutingCount}
            min={0}
            max={24}
            step={1}
            onChange={handleChange('flutingCount')}
          />
          {params.flutingCount > 0 && (
            <ParameterSlider
              label="Flute Depth"
              value={params.flutingDepth}
              min={0}
              max={0.15}
              step={0.01}
              onChange={handleChange('flutingDepth')}
            />
          )}
        </div>
        
        {/* Spiral Grooves */}
        <div className="pt-3 border-t border-border/50 space-y-3">
          <Label className="text-xs text-muted-foreground font-semibold">Spiral Grooves</Label>
          <ParameterSlider
            label="Spiral Count"
            value={params.spiralGrooveCount}
            min={0}
            max={8}
            step={1}
            onChange={handleChange('spiralGrooveCount')}
          />
          {params.spiralGrooveCount > 0 && (
            <>
              <ParameterSlider
                label="Groove Depth"
                value={params.spiralGrooveDepth}
                min={0}
                max={0.15}
                step={0.01}
                onChange={handleChange('spiralGrooveDepth')}
              />
              <ParameterSlider
                label="Twist Amount"
                value={params.spiralGrooveTwist}
                min={0.5}
                max={10}
                step={0.5}
                onChange={handleChange('spiralGrooveTwist')}
              />
            </>
          )}
        </div>
        
        {/* Rim Waves */}
        <div className="pt-3 border-t border-border/50 space-y-3">
          <Label className="text-xs text-muted-foreground font-semibold">Rim Waves</Label>
          <ParameterSlider
            label="Wave Count"
            value={params.rimWaveCount}
            min={0}
            max={12}
            step={1}
            onChange={handleChange('rimWaveCount')}
          />
          {params.rimWaveCount > 0 && (
            <ParameterSlider
              label="Wave Depth"
              value={params.rimWaveDepth}
              min={0}
              max={0.3}
              step={0.02}
              onChange={handleChange('rimWaveDepth')}
            />
          )}
        </div>
      </Section>

      {/* 7. Lip & Rim */}
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

      {/* 8. Cord Hole - Standalone Section */}
      <Section title="Cord Hole" defaultOpen={false}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cable className={cn("w-4 h-4", params.cordHoleEnabled ? "text-primary" : "text-muted-foreground")} />
            <Label htmlFor="cord-hole-standalone" className="text-sm font-medium">Enable Cord Hole</Label>
          </div>
          <Switch 
            id="cord-hole-standalone" 
            checked={params.cordHoleEnabled} 
            onCheckedChange={handleCordHoleToggle}
          />
        </div>
        
        {params.cordHoleEnabled && (
          <>
            <ParameterSlider
              label="Cord Hole Ø"
              value={params.cordHoleDiameter}
              min={4}
              max={12}
              step={0.5}
              unit="mm"
              onChange={handleChange('cordHoleDiameter')}
            />
            
            {/* Centering Lip Controls */}
            <div className="pt-3 mt-3 border-t border-border/50 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Box className={cn("w-4 h-4", params.centeringLipEnabled ? "text-primary" : "text-muted-foreground")} />
                  <Label htmlFor="centering-lip" className="text-sm font-medium">Centering Lip</Label>
                </div>
                <Switch 
                  id="centering-lip" 
                  checked={params.centeringLipEnabled} 
                  onCheckedChange={(v) => onParamsChange({ ...params, centeringLipEnabled: v })}
                />
              </div>
              
              {params.centeringLipEnabled && (
                <>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Socket Type</Label>
                    <Select 
                      value={params.socketType} 
                      onValueChange={(value: 'E26' | 'E12' | 'E14' | 'GU10') => {
                        onParamsChange({ ...params, socketType: value });
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="E26">E26 (26mm - Standard US)</SelectItem>
                        <SelectItem value="E12">E12 (12mm - Candelabra)</SelectItem>
                        <SelectItem value="E14">E14 (14mm - Small EU)</SelectItem>
                        <SelectItem value="GU10">GU10 (35mm - Spotlight)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Inner diameter of the centering lip ring
                    </p>
                  </div>
                  
                  <ParameterSlider
                    label="Lip Height"
                    value={params.centeringLipHeight}
                    min={2}
                    max={8}
                    step={0.5}
                    unit="mm"
                    onChange={handleChange('centeringLipHeight')}
                  />
                </>
              )}
            </div>
          </>
        )}
      </Section>

      {/* 9. Add Legs/Stand - BOTTOM */}
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
            {/* Stand Type Selector */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Stand Type</Label>
              <Select value={params.standType} onValueChange={handleStandTypeChange}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tripod">Tripod Legs</SelectItem>
                  <SelectItem value="wall_mount">Wall Mount</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Tripod-specific controls */}
            {params.standType === 'tripod' && (
              <>
                {/* Leg Style Selector */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Leg Style</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['tripod', 'riser', 'column', 'bun'] as LegStyle[]).map((style) => (
                      <Button
                        key={style}
                        variant={params.legStyle === style ? 'default' : 'outline'}
                        size="sm"
                        className="text-xs"
                        onClick={() => handleLegStyleChange(style)}
                      >
                        {getLegStyleLabel(style)}
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {params.legStyle === 'tripod' && 'Classic angled legs that spread outward'}
                    {params.legStyle === 'riser' && 'Small stubby feet for table lamps (3-20mm)'}
                    {params.legStyle === 'column' && 'Straight vertical legs, no spread'}
                    {params.legStyle === 'bun' && 'Dome-shaped feet, flat on bed, print-friendly'}
                  </p>
                </div>

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
                
                {/* Conditional controls based on leg style */}
                {params.legStyle !== 'bun' && (
                  <ParameterSlider
                    label="Leg Height"
                    value={params.legHeight}
                    min={params.legStyle === 'riser' ? 2 : (params.legStyle === 'column' ? 3 : 10)}
                    max={params.legStyle === 'riser' ? 40 : 400}
                    step={params.legStyle === 'riser' ? 1 : (params.legStyle === 'column' ? 1 : 5)}
                    unit="mm"
                    onChange={handleChange('legHeight')}
                  />
                )}
                
                {/* Spread only for tripod and riser */}
                {(params.legStyle === 'tripod' || params.legStyle === 'riser') && (
                  <ParameterSlider
                    label="Leg Spread"
                    value={params.legSpread}
                    min={params.legStyle === 'riser' ? 0 : 15}
                    max={params.legStyle === 'riser' ? 10 : 45}
                    step={1}
                    unit="°"
                    onChange={handleChange('legSpread')}
                  />
                )}
                
                <ParameterSlider
                  label={params.legStyle === 'bun' ? 'Bun Size' : 'Leg Thickness'}
                  value={params.legThickness}
                  min={params.legStyle === 'bun' ? 5 : 3}
                  max={params.legStyle === 'bun' ? 15 : 10}
                  step={0.5}
                  unit="mm"
                  onChange={handleChange('legThickness')}
                />
                
                {/* Taper only for tripod */}
                {params.legStyle === 'tripod' && (
                  <ParameterSlider
                    label="Leg Taper"
                    value={params.legTaper}
                    min={0}
                    max={0.8}
                    step={0.1}
                    onChange={handleChange('legTaper')}
                  />
                )}
                
                {/* Base Size Mode Controls */}
                <div className="pt-3 mt-3 border-t border-border/50 space-y-3">
                  <div className="flex items-center gap-2">
                    <Box className={cn("w-4 h-4", params.baseSizeMode !== 'auto' ? "text-primary" : "text-muted-foreground")} />
                    <Label className="text-sm font-medium">Base Size</Label>
                  </div>
                  
                  <Select 
                    value={params.baseSizeMode} 
                    onValueChange={(value: 'auto' | 'tray' | 'custom') => {
                      onParamsChange({ ...params, baseSizeMode: value });
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Fit to Lamp Bottom</SelectItem>
                      <SelectItem value="tray">Match Widest Point</SelectItem>
                      <SelectItem value="custom">Custom Size</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <p className="text-xs text-muted-foreground">
                    {params.baseSizeMode === 'auto' && 'Base matches the lamp bottom radius'}
                    {params.baseSizeMode === 'tray' && 'Base matches widest point (tray effect)'}
                    {params.baseSizeMode === 'custom' && 'Set your own base size'}
                  </p>
                  
                  {params.baseSizeMode === 'custom' && (
                    <ParameterSlider
                      label="Base Radius"
                      value={params.standBaseRadius}
                      min={20}
                      max={150}
                      step={5}
                      unit="mm"
                      onChange={handleChange('standBaseRadius')}
                    />
                  )}
                </div>
                
                {/* Base Style Section */}
                <div className="pt-3 mt-3 border-t border-border/50 space-y-3">
                  <div className="flex items-center gap-2">
                    <Grip className={cn("w-4 h-4", params.standBaseThickness > 3 ? "text-primary" : "text-muted-foreground")} />
                    <Label className="text-sm font-medium">Base Style</Label>
                  </div>
                  
                  <ParameterSlider
                    label="Thickness"
                    value={params.standBaseThickness}
                    min={2}
                    max={30}
                    step={1}
                    unit="mm"
                    onChange={handleChange('standBaseThickness')}
                  />
                  
                  <ParameterSlider
                    label="Taper"
                    value={params.standBaseTaper}
                    min={0}
                    max={0.5}
                    step={0.05}
                    onChange={handleChange('standBaseTaper')}
                  />
                  
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Edge Style</Label>
                    <Select 
                      value={params.standBaseEdgeStyle} 
                      onValueChange={(value: 'flat' | 'rounded' | 'chamfer') => {
                        onParamsChange({ ...params, standBaseEdgeStyle: value });
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="flat">Flat</SelectItem>
                        <SelectItem value="rounded">Rounded</SelectItem>
                        <SelectItem value="chamfer">Chamfer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <ParameterSlider
                    label="Lip Height"
                    value={params.standBaseLip}
                    min={0}
                    max={10}
                    step={0.5}
                    unit="mm"
                    onChange={handleChange('standBaseLip')}
                  />
                  
                  {/* Base Only Preview */}
                  <div className="flex items-center justify-between pt-2 border-t border-border/30">
                    <div className="flex items-center gap-2">
                      <Layers className={cn("w-4 h-4", params.showBaseOnly ? "text-primary" : "text-muted-foreground")} />
                      <Label htmlFor="base-only" className="text-xs">Base Only Preview</Label>
                    </div>
                    <Switch 
                      id="base-only" 
                      checked={params.showBaseOnly} 
                      onCheckedChange={(v) => onParamsChange({ ...params, showBaseOnly: v })}
                    />
                  </div>
                </div>
              </>
            )}
            
            {/* Wall mount controls */}
            {params.standType === 'wall_mount' && (
              <>
                <ParameterSlider
                  label="Cut Offset"
                  value={params.wallMountCutOffset}
                  min={-30}
                  max={30}
                  step={1}
                  unit="mm"
                  onChange={handleChange('wallMountCutOffset')}
                />
                <p className="text-xs text-muted-foreground">
                  0 = exact half, negative = less material, positive = more
                </p>
                
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Mounting Holes</Label>
                  <div className="flex gap-2">
                    {([2, 3, 4] as const).map((count) => (
                      <Button
                        key={count}
                        variant={params.wallMountHoleCount === count ? 'default' : 'outline'}
                        size="sm"
                        className="flex-1"
                        onClick={() => onParamsChange({ ...params, wallMountHoleCount: count })}
                      >
                        {count}
                      </Button>
                    ))}
                  </div>
                </div>
                
                <ParameterSlider
                  label="Hole Margin"
                  value={params.wallMountHoleMargin}
                  min={0.05}
                  max={0.35}
                  step={0.01}
                  onChange={handleChange('wallMountHoleMargin')}
                />
                
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2">
                    <Cable className={cn("w-4 h-4", params.wallMountCordHoleEnabled ? "text-primary" : "text-muted-foreground")} />
                    <Label htmlFor="wall-cord-hole" className="text-xs">Cord Exit Hole</Label>
                  </div>
                  <Switch 
                    id="wall-cord-hole" 
                    checked={params.wallMountCordHoleEnabled} 
                    onCheckedChange={(v) => onParamsChange({ ...params, wallMountCordHoleEnabled: v })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Mount Style</Label>
                  <div className="flex gap-2">
                    <Button
                      variant={params.wallMountStyle === 'back' ? 'default' : 'outline'}
                      size="sm"
                      className="flex-1"
                      onClick={() => onParamsChange({ ...params, wallMountStyle: 'back' })}
                    >
                      Back
                    </Button>
                    <Button
                      variant={params.wallMountStyle === 'base' ? 'default' : 'outline'}
                      size="sm"
                      className="flex-1"
                      onClick={() => onParamsChange({ ...params, wallMountStyle: 'base' })}
                    >
                      Base
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {params.wallMountStyle === 'back' ? 'Flat back with keyholes' : 'Base plate with keyholes'}
                  </p>
                </div>
                
                {/* Hardware Bracket Option */}
                <div className="pt-3 mt-3 border-t border-border/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Box className={cn("w-4 h-4", params.wallMountBracketEnabled ? "text-primary" : "text-muted-foreground")} />
                      <Label htmlFor="bracket-enabled" className="text-sm font-medium">Hardware Bracket</Label>
                    </div>
                    <Switch 
                      id="bracket-enabled" 
                      checked={params.wallMountBracketEnabled} 
                      onCheckedChange={(v) => onParamsChange({ ...params, wallMountBracketEnabled: v })}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Generates a separate printable bracket with screw holes for standard wall hardware
                  </p>
                  
                  {params.wallMountBracketEnabled && (
                    <>
                      <ParameterSlider
                        label="Bracket Width"
                        value={params.wallMountBracketWidth}
                        min={40}
                        max={120}
                        step={5}
                        unit="mm"
                        onChange={handleChange('wallMountBracketWidth')}
                      />
                      <ParameterSlider
                        label="Bracket Height"
                        value={params.wallMountBracketHeight}
                        min={50}
                        max={150}
                        step={5}
                        unit="mm"
                        onChange={handleChange('wallMountBracketHeight')}
                      />
                      <ParameterSlider
                        label="Bracket Thickness"
                        value={params.wallMountBracketThickness}
                        min={3}
                        max={10}
                        step={0.5}
                        unit="mm"
                        onChange={handleChange('wallMountBracketThickness')}
                      />
                      <ParameterSlider
                        label="Hole Spacing"
                        value={params.wallMountBracketHoleSpacing}
                        min={30}
                        max={100}
                        step={5}
                        unit="mm"
                        onChange={handleChange('wallMountBracketHoleSpacing')}
                      />
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
      
      {/* 10. Support-Free Mode - VERY BOTTOM */}
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
    </motion.div>
  );
};

export default ParameterControls;
