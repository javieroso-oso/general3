import { motion } from 'framer-motion';
import { RotateCcw, Shield, Eye, Footprints, Cable, Box, Grip, Layers, Shuffle, ChevronDown, ChevronRight, FlaskConical, Wind, CircleDot, Ruler, AlertTriangle, Sparkles, CheckCircle2, Maximize2, PenTool } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ParameterSlider from './ParameterSlider';
import { ParametricParams, ObjectType, defaultParams, printConstraints, StandType, LegStyle, SurfaceStroke } from '@/types/parametric';
import SurfaceCanvas, { SurfaceHoverPosition } from '@/components/drawing/SurfaceCanvas';
import { getSupportFreeConstraints, applySupportFreeConstraints, checkSupportFreeCompliance } from '@/lib/support-free-constraints';
import { generateRandomParams } from '@/lib/random-generator';
import { analyzeUndercuts, calculateMoldMaterialEstimate, calculateOptimalSplits } from '@/lib/mold-undercut-detector';
import { toast } from 'sonner';
import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';

interface ParameterControlsProps {
  params: ParametricParams;
  type: ObjectType;
  onParamsChange: (params: ParametricParams) => void;
  onSurfaceHover?: (pos: SurfaceHoverPosition | null) => void;
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

// Subsection for advanced features - smaller header, indented
interface SubsectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

const Subsection = ({ title, defaultOpen = false, children }: SubsectionProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className="border-t border-border/50 pt-3 mt-3">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronRight className={cn("w-3 h-3 transition-transform", isOpen && "rotate-90")} />
        <span className="font-medium">{title}</span>
      </button>
      {isOpen && (
        <div className="space-y-3 pt-3 pl-1">
          {children}
        </div>
      )}
    </div>
  );
};

// Mold controls sub-component with undercut analysis and material estimation
interface MoldControlsProps {
  params: ParametricParams;
  type: ObjectType;
  onParamsChange: (params: ParametricParams) => void;
  handleChange: (key: keyof ParametricParams) => (value: number) => void;
}

const MoldControls = ({ params, type, onParamsChange, handleChange }: MoldControlsProps) => {
  const undercutAnalysis = useMemo(() => analyzeUndercuts(params), [params]);
  const materialEstimate = useMemo(() => calculateMoldMaterialEstimate(params, type), [params, type]);
  
  // Calculate optimal splits for preview info
  const optimalSplits = useMemo(() => {
    if (!params.moldAutoSplit) return null;
    return calculateOptimalSplits(params, undefined, params.moldPartCount);
  }, [params]);

  const handlePartCountChange = (count: 2 | 3 | 4) => {
    onParamsChange({ ...params, moldPartCount: count });
  };

  const handleColorChange = (index: number, color: string) => {
    const newColors = [...(params.moldColors || ['#C97B5D', '#7B9E87', '#8B7EC7', '#CBA670'])];
    newColors[index] = color;
    onParamsChange({ ...params, moldColors: newColors });
  };

  const partCount = params.moldPartCount || 2;
  const colors = params.moldColors || ['#C97B5D', '#7B9E87', '#8B7EC7', '#CBA670'];
  const partLabels = ['A', 'B', 'C', 'D'];

  return (
    <div className="space-y-3 pt-2 border-t border-border/50">
      <div className="text-xs text-muted-foreground bg-amber-500/10 p-2 rounded border border-amber-500/30">
        Generates {partCount}-part slip-casting mold. Export as separate STL files for 3D printing.
      </div>
      
      {/* Part Count Selector */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Mold Parts</Label>
        <div className="flex gap-2">
          {([2, 3, 4] as const).map((count) => (
            <Button
              key={count}
              variant={partCount === count ? 'default' : 'outline'}
              size="sm"
              className="flex-1"
              onClick={() => handlePartCountChange(count)}
            >
              {count}-Part
            </Button>
          ))}
        </div>
      </div>
      
      {/* Auto-Split Toggle */}
      <div className="space-y-2 bg-background/50 p-2 rounded border border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className={cn("w-3 h-3", params.moldAutoSplit ? "text-primary" : "text-muted-foreground")} />
            <Label htmlFor="auto-split" className="text-xs font-medium">Geometry-Based Splitting</Label>
          </div>
          <Switch 
            id="auto-split" 
            checked={params.moldAutoSplit ?? false} 
            onCheckedChange={(v) => onParamsChange({ ...params, moldAutoSplit: v })}
          />
        </div>
        <div className="text-xs text-muted-foreground">
          Places splits at natural parting lines based on body shape to minimize undercuts
        </div>
        
        {params.moldAutoSplit && optimalSplits && (
          <div className="text-xs mt-2 p-1.5 rounded bg-primary/5 border border-primary/20">
            <div className="flex items-center gap-1.5 text-primary">
              <CheckCircle2 className="w-3 h-3" />
              <span className="font-medium">
                {Math.round(optimalSplits.confidence * 100)}% confidence
              </span>
            </div>
            <div className="text-muted-foreground mt-1">
              Split angles: {optimalSplits.splitAngles.map(a => 
                `${Math.round(a * 180 / Math.PI)}°`
              ).join(', ')}
            </div>
          </div>
        )}
      </div>
      
      {/* Show Parting Lines Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Maximize2 className={cn("w-3 h-3", params.moldShowPartingLines ? "text-primary" : "text-muted-foreground")} />
          <Label htmlFor="show-parting-lines" className="text-xs">Show Parting Lines</Label>
        </div>
        <Switch 
          id="show-parting-lines" 
          checked={params.moldShowPartingLines ?? false} 
          onCheckedChange={(v) => onParamsChange({ ...params, moldShowPartingLines: v })}
        />
      </div>
      
      {/* Part Colors */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Part Colors</Label>
        <div className="flex gap-2">
          {Array.from({ length: partCount }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <input
                type="color"
                value={colors[i]}
                onChange={(e) => handleColorChange(i, e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border border-border"
                title={`Part ${partLabels[i]} color`}
              />
              <span className="text-xs text-muted-foreground">{partLabels[i]}</span>
            </div>
          ))}
        </div>
      </div>
      
      {/* Undercut Warning */}
      {undercutAnalysis.hasUndercuts && (
        <div className={cn(
          "text-xs p-2 rounded border",
          undercutAnalysis.severity > 50 
            ? "bg-red-500/10 text-red-600 border-red-500/30"
            : "bg-amber-500/10 text-amber-600 border-amber-500/30"
        )}>
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="w-3 h-3" />
            Undercuts Detected ({undercutAnalysis.severity}% severity)
          </div>
          <ul className="mt-1 space-y-0.5 pl-5 list-disc">
            {undercutAnalysis.recommendations.slice(0, 2).map((rec, i) => (
              <li key={i}>{rec}</li>
            ))}
          </ul>
          {partCount === 2 && undercutAnalysis.severity > 30 && (
            <p className="mt-2 text-xs font-medium">💡 Try a 3 or 4-part mold to avoid undercuts</p>
          )}
        </div>
      )}
      
      {/* Material Estimate */}
      <div className="text-xs bg-background/50 p-2 rounded border border-border/50 space-y-1">
        <div className="flex items-center gap-2 font-medium text-foreground">
          <Ruler className="w-3 h-3" />
          Material Estimate
        </div>
        <div className="grid grid-cols-2 gap-x-3 text-muted-foreground">
          <span>Mold size:</span>
          <span>{materialEstimate.totalMoldWidth}×{materialEstimate.totalMoldHeight}mm</span>
          <span>Volume:</span>
          <span>~{materialEstimate.volumeCm3} cm³</span>
          <span>Plaster:</span>
          <span>~{materialEstimate.plasterKg} kg</span>
          <span>Silicone:</span>
          <span>~{materialEstimate.siliconeKg} kg</span>
        </div>
      </div>
      
      <ParameterSlider
        label="Wall Thickness"
        value={params.moldWallThickness}
        min={15}
        max={50}
        step={1}
        unit="mm"
        onChange={handleChange('moldWallThickness')}
      />
      
      <ParameterSlider
        label="Base Thickness"
        value={params.moldBaseThickness}
        min={10}
        max={30}
        step={1}
        unit="mm"
        onChange={handleChange('moldBaseThickness')}
      />
      
      <ParameterSlider
        label="Pour Hole Ø"
        value={params.moldPourHoleDiameter}
        min={15}
        max={40}
        step={1}
        unit="mm"
        onChange={handleChange('moldPourHoleDiameter')}
      />
      
      {/* Vent Holes */}
      <Subsection title="Vent Holes">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wind className={cn("w-3 h-3", params.moldVentHolesEnabled ? "text-primary" : "text-muted-foreground")} />
            <Label htmlFor="vent-holes" className="text-xs">Enable Vents</Label>
          </div>
          <Switch 
            id="vent-holes" 
            checked={params.moldVentHolesEnabled} 
            onCheckedChange={(v) => onParamsChange({ ...params, moldVentHolesEnabled: v })}
          />
        </div>
        
        {params.moldVentHolesEnabled && (
          <>
            <ParameterSlider
              label="Count"
              value={params.moldVentHoleCount}
              min={2}
              max={8}
              step={1}
              onChange={handleChange('moldVentHoleCount')}
            />
            <ParameterSlider
              label="Diameter"
              value={params.moldVentHoleDiameter}
              min={2}
              max={5}
              step={0.5}
              unit="mm"
              onChange={handleChange('moldVentHoleDiameter')}
            />
            <ParameterSlider
              label="Position"
              value={params.moldVentHolePosition}
              min={0.5}
              max={0.95}
              step={0.05}
              onChange={handleChange('moldVentHolePosition')}
            />
          </>
        )}
      </Subsection>
      
      {/* Spare Collar */}
      <Subsection title="Spare Collar">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CircleDot className={cn("w-3 h-3", params.moldSpareEnabled ? "text-primary" : "text-muted-foreground")} />
            <Label htmlFor="spare-collar" className="text-xs">Enable Spare</Label>
          </div>
          <Switch 
            id="spare-collar" 
            checked={params.moldSpareEnabled} 
            onCheckedChange={(v) => onParamsChange({ ...params, moldSpareEnabled: v })}
          />
        </div>
        <div className="text-xs text-muted-foreground -mt-1">
          Raised collar for slip reservoir
        </div>
        
        {params.moldSpareEnabled && (
          <>
            <ParameterSlider
              label="Height"
              value={params.moldSpareHeight}
              min={10}
              max={30}
              step={2}
              unit="mm"
              onChange={handleChange('moldSpareHeight')}
            />
            <ParameterSlider
              label="Diameter"
              value={params.moldSpareDiameter}
              min={0}
              max={60}
              step={5}
              unit="mm"
              onChange={handleChange('moldSpareDiameter')}
            />
            <div className="text-xs text-muted-foreground -mt-2">
              0 = auto (1.5× pour hole)
            </div>
          </>
        )}
      </Subsection>
      
      {/* Strap Notches */}
      <Subsection title="Strap Notches">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Grip className={cn("w-3 h-3", params.moldStrapNotchesEnabled ? "text-primary" : "text-muted-foreground")} />
            <Label htmlFor="strap-notches" className="text-xs">Enable Notches</Label>
          </div>
          <Switch 
            id="strap-notches" 
            checked={params.moldStrapNotchesEnabled} 
            onCheckedChange={(v) => onParamsChange({ ...params, moldStrapNotchesEnabled: v })}
          />
        </div>
        <div className="text-xs text-muted-foreground -mt-1">
          Grooves for rubber bands to hold halves
        </div>
        
        {params.moldStrapNotchesEnabled && (
          <>
            <ParameterSlider
              label="Count"
              value={params.moldStrapNotchCount}
              min={2}
              max={4}
              step={1}
              onChange={handleChange('moldStrapNotchCount')}
            />
            <ParameterSlider
              label="Width"
              value={params.moldStrapNotchWidth}
              min={8}
              max={15}
              step={1}
              unit="mm"
              onChange={handleChange('moldStrapNotchWidth')}
            />
            <ParameterSlider
              label="Depth"
              value={params.moldStrapNotchDepth}
              min={3}
              max={6}
              step={0.5}
              unit="mm"
              onChange={handleChange('moldStrapNotchDepth')}
            />
          </>
        )}
      </Subsection>
      
      <Subsection title="Registration Keys">
        <ParameterSlider
          label="Key Size"
          value={params.moldRegistrationKeySize}
          min={5}
          max={15}
          step={1}
          unit="mm"
          onChange={handleChange('moldRegistrationKeySize')}
        />
        <ParameterSlider
          label="Key Count"
          value={params.moldRegistrationKeyCount}
          min={2}
          max={6}
          step={1}
          onChange={handleChange('moldRegistrationKeyCount')}
        />
      </Subsection>
      
      <Subsection title="Split & Draft">
        <ParameterSlider
          label="Split Rotation"
          value={params.moldSplitAngle}
          min={0}
          max={180}
          step={5}
          unit="°"
          onChange={handleChange('moldSplitAngle')}
        />
        <ParameterSlider
          label="Draft Angle"
          value={params.moldDraftAngle}
          min={0}
          max={5}
          step={0.5}
          unit="°"
          onChange={handleChange('moldDraftAngle')}
        />
      </Subsection>
      
      <ParameterSlider
        label="Mold Offset"
        value={params.moldOffset}
        min={0}
        max={2}
        step={0.1}
        unit="mm"
        onChange={handleChange('moldOffset')}
      />
      <div className="text-xs text-muted-foreground -mt-2">
        Gap for clay shrinkage compensation
      </div>
      
      <ParameterSlider
        label="Preview Gap"
        value={params.moldGap}
        min={0}
        max={20}
        step={1}
        unit="mm"
        onChange={handleChange('moldGap')}
      />
      
      {/* Ghost Body Toggle */}
      <div className="flex items-center justify-between pt-2 border-t border-border/50">
        <div className="flex items-center gap-2">
          <Eye className={cn("w-3 h-3", params.moldShowGhostBody ? "text-primary" : "text-muted-foreground")} />
          <Label htmlFor="ghost-body" className="text-xs">Show Body Inside</Label>
        </div>
        <Switch 
          id="ghost-body" 
          checked={params.moldShowGhostBody ?? true} 
          onCheckedChange={(v) => onParamsChange({ ...params, moldShowGhostBody: v })}
        />
      </div>
    </div>
  );
};

const ParameterControls = ({ params, type, onParamsChange, onSurfaceHover }: ParameterControlsProps) => {
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
      {/* Randomize / Reset */}
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

      {/* 1. Dimensions */}
      <Section title="Dimensions" defaultOpen={true}>
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
        
        {/* Profile Curve - moved here from Surface Patterns */}
        <div className="space-y-2 pt-3 border-t border-border/50">
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
              <SelectItem value="linear">Linear</SelectItem>
              <SelectItem value="convex">Convex (Bulges Out)</SelectItem>
              <SelectItem value="concave">Concave (Curves In)</SelectItem>
              <SelectItem value="hourglass">Hourglass</SelectItem>
              <SelectItem value="wave">Wave</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Section>

      {/* 2. Shape (merged Organic Shape + Deformations) */}
      <Section title="Shape" defaultOpen={true}>
        {/* Core organic controls */}
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
          label="Twist"
          value={params.twistAngle}
          min={0}
          max={180}
          step={5}
          unit="°"
          onChange={handleChange('twistAngle')}
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

        {/* Advanced Shape - Wobble, Spine, Melt */}
        <Subsection title="Advanced Shape">
          {/* Wobble */}
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground font-semibold">Wobble</Label>
            <ParameterSlider
              label="Frequency"
              value={params.wobbleFrequency}
              min={0}
              max={8}
              step={1}
              onChange={handleChange('wobbleFrequency')}
            />
            <ParameterSlider
              label="Amount"
              value={params.wobbleAmplitude}
              min={0}
              max={params.supportFreeMode ? constraints.wobbleAmplitude.max : 0.15}
              step={0.01}
              onChange={handleChange('wobbleAmplitude')}
              constrained={params.supportFreeMode}
            />
          </div>

          {/* Spine Curve */}
          <div className="space-y-3 pt-3 border-t border-border/30">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground font-semibold">Spine Curve</Label>
              <Switch
                checked={params.spineEnabled}
                onCheckedChange={(enabled) => onParamsChange({ ...params, spineEnabled: enabled })}
              />
            </div>
            
            {params.spineEnabled && (
              <>
                <div className="text-xs text-muted-foreground">X-Axis</div>
                <ParameterSlider
                  label="Amplitude"
                  value={params.spineAmplitudeX}
                  min={0}
                  max={25}
                  step={1}
                  unit="mm"
                  onChange={handleChange('spineAmplitudeX')}
                />
                <ParameterSlider
                  label="Frequency"
                  value={params.spineFrequencyX}
                  min={0}
                  max={4}
                  step={0.5}
                  onChange={handleChange('spineFrequencyX')}
                />
                <ParameterSlider
                  label="Phase"
                  value={params.spinePhaseX}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={handleChange('spinePhaseX')}
                />
                
                <div className="text-xs text-muted-foreground mt-2">Z-Axis</div>
                <ParameterSlider
                  label="Amplitude"
                  value={params.spineAmplitudeZ}
                  min={0}
                  max={25}
                  step={1}
                  unit="mm"
                  onChange={handleChange('spineAmplitudeZ')}
                />
                <ParameterSlider
                  label="Frequency"
                  value={params.spineFrequencyZ}
                  min={0}
                  max={4}
                  step={0.5}
                  onChange={handleChange('spineFrequencyZ')}
                />
                <ParameterSlider
                  label="Phase"
                  value={params.spinePhaseZ}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={handleChange('spinePhaseZ')}
                />
              </>
            )}
          </div>

          {/* Melt Effect */}
          <div className="space-y-3 pt-3 border-t border-border/30">
            <Label className="text-xs text-muted-foreground font-semibold">Melt Effect</Label>
            <ParameterSlider
              label="Amount"
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
                  label="Lobes"
                  value={params.meltLobes}
                  min={0}
                  max={8}
                  step={1}
                  onChange={handleChange('meltLobes')}
                />
                <ParameterSlider
                  label="Variation"
                  value={params.meltVariation}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={handleChange('meltVariation')}
                />
                <ParameterSlider
                  label="Delay"
                  value={params.meltDelay}
                  min={0}
                  max={0.8}
                  step={0.05}
                  onChange={handleChange('meltDelay')}
                />
              </>
            )}
            
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
        </Subsection>
      </Section>

      {/* 3. Textures (merged Surface Details + Surface Patterns) */}
      <Section title="Textures" defaultOpen={false}>
        {/* Faceting */}
        <div className="space-y-3">
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
              label="Sharpness"
              value={params.facetSharpness}
              min={0}
              max={1}
              step={0.1}
              onChange={handleChange('facetSharpness')}
            />
          )}
        </div>
        
        {/* Horizontal Ribs */}
        <div className="pt-3 border-t border-border/50 space-y-3">
          <Label className="text-xs text-muted-foreground font-semibold">Horizontal Ribs</Label>
          <ParameterSlider
            label="Count"
            value={params.horizontalRibCount}
            min={0}
            max={20}
            step={1}
            onChange={handleChange('horizontalRibCount')}
          />
          {params.horizontalRibCount > 0 && (
            <>
              <ParameterSlider
                label="Depth"
                value={params.horizontalRibDepth}
                min={0}
                max={0.1}
                step={0.005}
                onChange={handleChange('horizontalRibDepth')}
              />
              <ParameterSlider
                label="Width"
                value={params.horizontalRibWidth}
                min={0.1}
                max={0.5}
                step={0.05}
                onChange={handleChange('horizontalRibWidth')}
              />
            </>
          )}
        </div>
        
        {/* Fluting */}
        <div className="pt-3 border-t border-border/50 space-y-3">
          <Label className="text-xs text-muted-foreground font-semibold">Fluting (Vertical)</Label>
          <ParameterSlider
            label="Count"
            value={params.flutingCount}
            min={0}
            max={24}
            step={1}
            onChange={handleChange('flutingCount')}
          />
          {params.flutingCount > 0 && (
            <ParameterSlider
              label="Depth"
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
            label="Count"
            value={params.spiralGrooveCount}
            min={0}
            max={8}
            step={1}
            onChange={handleChange('spiralGrooveCount')}
          />
          {params.spiralGrooveCount > 0 && (
            <>
              <ParameterSlider
                label="Depth"
                value={params.spiralGrooveDepth}
                min={0}
                max={0.15}
                step={0.01}
                onChange={handleChange('spiralGrooveDepth')}
              />
              <ParameterSlider
                label="Twist"
                value={params.spiralGrooveTwist}
                min={0.5}
                max={10}
                step={0.5}
                onChange={handleChange('spiralGrooveTwist')}
              />
            </>
          )}
        </div>
        
        {/* Ripples */}
        <div className="pt-3 border-t border-border/50 space-y-3">
          <Label className="text-xs text-muted-foreground font-semibold">Ripples</Label>
          <ParameterSlider
            label="Count"
            value={params.rippleCount}
            min={0}
            max={16}
            step={1}
            onChange={handleChange('rippleCount')}
          />
          {params.rippleCount > 0 && (
            <ParameterSlider
              label="Depth"
              value={params.rippleDepth}
              min={0}
              max={0.1}
              step={0.005}
              onChange={handleChange('rippleDepth')}
            />
          )}
        </div>

        {/* Organic Noise */}
        <Subsection title="Organic Noise">
          <ParameterSlider
            label="Amount"
            value={params.organicNoise}
            min={0}
            max={0.1}
            step={0.005}
            onChange={handleChange('organicNoise')}
          />
          {params.organicNoise > 0 && (
            <ParameterSlider
              label="Scale"
              value={params.noiseScale}
              min={0.5}
              max={4}
              step={0.25}
              onChange={handleChange('noiseScale')}
            />
          )}
        </Subsection>
      </Section>

      {/* 4. Lip & Rim (now includes Rim Waves) */}
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
        
        {/* Rim Waves - moved here */}
        <div className="pt-3 border-t border-border/50 space-y-3">
          <Label className="text-xs text-muted-foreground font-semibold">Rim Waves</Label>
          <ParameterSlider
            label="Count"
            value={params.rimWaveCount}
            min={0}
            max={12}
            step={1}
            onChange={handleChange('rimWaveCount')}
          />
          {params.rimWaveCount > 0 && (
            <ParameterSlider
              label="Depth"
              value={params.rimWaveDepth}
              min={0}
              max={0.3}
              step={0.02}
              onChange={handleChange('rimWaveDepth')}
            />
          )}
        </div>
      </Section>

      {/* Wireframe Shade Frame */}
      {(
        <Section title="Shade Frame" defaultOpen={false}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className={cn("w-4 h-4", params.wireframeMode ? "text-primary" : "text-muted-foreground")} />
              <Label htmlFor="wireframe-mode" className="text-sm font-medium">Wireframe Mode</Label>
            </div>
            <Switch 
              id="wireframe-mode" 
              checked={params.wireframeMode ?? false} 
              onCheckedChange={(v) => onParamsChange({ ...params, wireframeMode: v })}
            />
          </div>
          <div className="text-xs text-muted-foreground">
            Generates structural ribs &amp; rings for fabric/paper shades
          </div>
          
          {params.wireframeMode && (
            <>
              <ParameterSlider
                label="Rib Count"
                value={params.wireframeRibCount ?? 8}
                min={4}
                max={24}
                step={1}
                onChange={handleChange('wireframeRibCount')}
              />
              <ParameterSlider
                label="Ring Count"
                value={params.wireframeRingCount ?? 4}
                min={2}
                max={10}
                step={1}
                onChange={handleChange('wireframeRingCount')}
              />
              <ParameterSlider
                label="Rib Thickness"
                value={params.wireframeThickness ?? 3}
                min={2}
                max={8}
                step={0.5}
                unit="mm"
                onChange={handleChange('wireframeThickness')}
              />
              <ParameterSlider
                label="Mount Ring Height"
                value={params.wireframeMountRingHeight ?? 5}
                min={3}
                max={15}
                step={1}
                unit="mm"
                onChange={handleChange('wireframeMountRingHeight')}
              />
              <ParameterSlider
                label="Ring Thickness"
                value={params.wireframeRingThickness ?? 1.0}
                min={0.5}
                max={1.5}
                step={0.1}
                unit="×"
                onChange={handleChange('wireframeRingThickness')}
              />
              
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Rib Style</Label>
                <Select 
                  value={params.wireframeRibStyle ?? 'curved'} 
                  onValueChange={(value: 'straight' | 'curved' | 'twisted') => {
                    onParamsChange({ ...params, wireframeRibStyle: value });
                  }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="straight">Straight</SelectItem>
                    <SelectItem value="curved">Curved</SelectItem>
                    <SelectItem value="twisted">Twisted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Cross Section</Label>
                <Select 
                  value={params.wireframeCrossSection ?? 'round'} 
                  onValueChange={(value: 'round' | 'square' | 'flat') => {
                    onParamsChange({ ...params, wireframeCrossSection: value });
                  }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="round">Round</SelectItem>
                    <SelectItem value="square">Square</SelectItem>
                    <SelectItem value="flat">Flat (Wide)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Subsection title="Printability">
                <ParameterSlider
                  label="Joint Bulge"
                  value={params.wireframeJointBulge ?? 0.5}
                  min={0}
                  max={2}
                  step={0.1}
                  onChange={handleChange('wireframeJointBulge')}
                />
                <div className="text-xs text-muted-foreground -mt-2">
                  Extra material at rib-ring joints for strength
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="flat-base" className="text-xs">Flat Base (Bed Adhesion)</Label>
                  <Switch 
                    id="flat-base" 
                    checked={params.wireframeFlatBase ?? true} 
                    onCheckedChange={(v) => onParamsChange({ ...params, wireframeFlatBase: v })}
                  />
                </div>
                
                <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded border border-border/50">
                  💡 <strong>Print tips:</strong> Use square or flat cross-section for better layer adhesion. Print upside-down (base on bed) for best results.
                </div>
              </Subsection>
              
              <Subsection title="Diagonal Bracing">
                <div className="flex items-center justify-between">
                  <Label htmlFor="diagonal-bracing" className="text-xs">Enable Bracing</Label>
                  <Switch 
                    id="diagonal-bracing" 
                    checked={params.wireframeDiagonalBracing ?? false} 
                    onCheckedChange={(v) => onParamsChange({ ...params, wireframeDiagonalBracing: v })}
                  />
                </div>
                <div className="text-xs text-muted-foreground -mt-1">
                  X-braces between ribs for rigidity
                </div>
                
                {params.wireframeDiagonalBracing && (
                  <ParameterSlider
                    label="Brace Frequency"
                    value={params.wireframeBraceFrequency ?? 1}
                    min={1}
                    max={4}
                    step={1}
                    onChange={handleChange('wireframeBraceFrequency')}
                  />
                )}
              </Subsection>
              
              <Subsection title="Organic">
                <ParameterSlider
                  label="Organic Intensity"
                  value={params.wireframeOrganic ?? 0}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={handleChange('wireframeOrganic')}
                />
                <div className="text-xs text-muted-foreground -mt-2">
                  Makes ribs &amp; rings look hand-bent and natural
                </div>
                
                <ParameterSlider
                  label="Thickness Variation"
                  value={params.wireframeThicknessVariation ?? 0}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={handleChange('wireframeThicknessVariation')}
                />
                <div className="text-xs text-muted-foreground -mt-2">
                  Varies tube thickness along each rib/ring
                </div>
                
                <ParameterSlider
                  label="Seed"
                  value={params.wireframeOrganicSeed ?? 42}
                  min={0}
                  max={999}
                  step={1}
                  onChange={handleChange('wireframeOrganicSeed')}
                />
              </Subsection>
            </>
          )}
        </Section>
      )}

      {/* Light Patterns */}
      {(
        <Section title="Light Patterns" defaultOpen={false}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className={cn("w-4 h-4", params.lightPatternEnabled ? "text-primary" : "text-muted-foreground")} />
              <Label htmlFor="light-pattern" className="text-sm font-medium">Enable Perforations</Label>
            </div>
            <Switch 
              id="light-pattern" 
              checked={params.lightPatternEnabled} 
              onCheckedChange={(v) => onParamsChange({ ...params, lightPatternEnabled: v })}
            />
          </div>
          
          {params.wallThickness < 1.6 && params.lightPatternEnabled && (
            <div className="text-xs text-amber-600 bg-amber-500/10 p-2 rounded border border-amber-500/30">
              Wall thickness must be ≥1.6mm for perforations
            </div>
          )}
          
          {params.lightPatternEnabled && (
            <>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Pattern Type</Label>
                <Select 
                  value={params.lightPatternType} 
                  onValueChange={(value: 'dots' | 'lines' | 'organic' | 'geometric' | 'spiral') => {
                    onParamsChange({ ...params, lightPatternType: value });
                  }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dots">Dots (Grid/Hex)</SelectItem>
                    <SelectItem value="lines">Lines (Horizontal Slots)</SelectItem>
                    <SelectItem value="organic">Organic (Random)</SelectItem>
                    <SelectItem value="geometric">Geometric (Honeycomb)</SelectItem>
                    <SelectItem value="spiral">Spiral</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <ParameterSlider
                label="Density"
                value={params.lightPatternDensity}
                min={0.1}
                max={1}
                step={0.05}
                onChange={handleChange('lightPatternDensity')}
              />
              
              <ParameterSlider
                label="Hole Size"
                value={params.lightPatternSize}
                min={2}
                max={15}
                step={0.5}
                unit="mm"
                onChange={handleChange('lightPatternSize')}
              />
              
              <div className="pt-3 border-t border-border/50 space-y-3">
                <Label className="text-xs text-muted-foreground font-semibold">Pattern Zone</Label>
                <ParameterSlider
                  label="Zone Start"
                  value={params.lightPatternZoneStart}
                  min={0}
                  max={0.9}
                  step={0.05}
                  onChange={handleChange('lightPatternZoneStart')}
                />
                <ParameterSlider
                  label="Zone End"
                  value={params.lightPatternZoneEnd}
                  min={0.1}
                  max={1}
                  step={0.05}
                  onChange={handleChange('lightPatternZoneEnd')}
                />
              </div>
              
              <Subsection title="Advanced Options">
                <ParameterSlider
                  label="Randomness"
                  value={params.lightPatternRandomness}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={handleChange('lightPatternRandomness')}
                />
                
                <ParameterSlider
                  label="Rim Margin"
                  value={params.lightPatternRimMargin}
                  min={0}
                  max={0.2}
                  step={0.02}
                  onChange={handleChange('lightPatternRimMargin')}
                />
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="scale-with-height" className="text-xs">Scale with Height</Label>
                  <Switch 
                    id="scale-with-height" 
                    checked={params.lightPatternScaleWithHeight} 
                    onCheckedChange={(v) => onParamsChange({ ...params, lightPatternScaleWithHeight: v })}
                  />
                </div>
                <div className="text-xs text-muted-foreground -mt-1">
                  Holes get larger toward the top
                </div>
              </Subsection>
            </>
          )}
        </Section>
      )}

      {/* 5. Cord Hole */}
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
              label="Diameter"
              value={params.cordHoleDiameter}
              min={4}
              max={60}
              step={0.5}
              unit="mm"
              onChange={handleChange('cordHoleDiameter')}
            />
            
            {/* Centering Lip - Only show when legs are enabled */}
            {params.addLegs && (
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
                          <SelectItem value="E26">E26 (Standard US)</SelectItem>
                          <SelectItem value="E12">E12 (Candelabra)</SelectItem>
                          <SelectItem value="E14">E14 (Small EU)</SelectItem>
                          <SelectItem value="GU10">GU10 (Spotlight)</SelectItem>
                        </SelectContent>
                      </Select>
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
            )}
          </>
        )}
      </Section>

      {/* 6. Legs/Stand */}
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
            {/* Stand Type */}
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
            
            {/* Tripod controls */}
            {params.standType === 'tripod' && (
              <>
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
                
                {params.legStyle !== 'bun' && (
                  <ParameterSlider
                    label="Height"
                    value={params.legHeight}
                    min={params.legStyle === 'riser' ? 2 : (params.legStyle === 'column' ? 3 : 10)}
                    max={params.legStyle === 'riser' ? 40 : 400}
                    step={params.legStyle === 'riser' ? 1 : (params.legStyle === 'column' ? 1 : 5)}
                    unit="mm"
                    onChange={handleChange('legHeight')}
                  />
                )}
                
                {(params.legStyle === 'tripod' || params.legStyle === 'riser') && (
                  <ParameterSlider
                    label="Spread"
                    value={params.legSpread}
                    min={params.legStyle === 'riser' ? 0 : 15}
                    max={params.legStyle === 'riser' ? 10 : 45}
                    step={1}
                    unit="°"
                    onChange={handleChange('legSpread')}
                  />
                )}
                
                <ParameterSlider
                  label={params.legStyle === 'bun' ? 'Size' : 'Thickness'}
                  value={params.legThickness}
                  min={params.legStyle === 'bun' ? 5 : 3}
                  max={params.legStyle === 'bun' ? 15 : 10}
                  step={0.5}
                  unit="mm"
                  onChange={handleChange('legThickness')}
                />
                
                {params.legStyle === 'tripod' && (
                  <ParameterSlider
                    label="Taper"
                    value={params.legTaper}
                    min={0}
                    max={0.8}
                    step={0.1}
                    onChange={handleChange('legTaper')}
                  />
                )}
                
                {/* Base Size */}
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
                      <SelectItem value="auto">Fit to Bottom</SelectItem>
                      <SelectItem value="tray">Match Widest</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {params.baseSizeMode === 'custom' && (
                    <ParameterSlider
                      label="Radius"
                      value={params.standBaseRadius}
                      min={20}
                      max={150}
                      step={5}
                      unit="mm"
                      onChange={handleChange('standBaseRadius')}
                    />
                  )}
                </div>
                
                {/* Base Style */}
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
                    max={15}
                    step={0.5}
                    unit="mm"
                    onChange={handleChange('standBaseLip')}
                  />
                  
                  {params.standBaseLip > 0 && (
                    <>
                      <ParameterSlider
                        label="Lip Thickness"
                        value={params.standBaseLipThickness}
                        min={1.5}
                        max={8}
                        step={0.5}
                        unit="mm"
                        onChange={handleChange('standBaseLipThickness')}
                      />
                      
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Lip Edge</Label>
                        <Select
                          value={params.standBaseLipEdgeStyle}
                          onValueChange={(value: 'flat' | 'rounded' | 'chamfer') => {
                            onParamsChange({ ...params, standBaseLipEdgeStyle: value });
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
                    </>
                  )}
                  
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
                    <Label htmlFor="wall-cord-hole" className="text-xs">Cord Exit</Label>
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
                </div>
                
                {/* Hardware Bracket */}
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
                  
                  {params.wallMountBracketEnabled && (
                    <>
                      <ParameterSlider
                        label="Width"
                        value={params.wallMountBracketWidth}
                        min={40}
                        max={120}
                        step={5}
                        unit="mm"
                        onChange={handleChange('wallMountBracketWidth')}
                      />
                      <ParameterSlider
                        label="Height"
                        value={params.wallMountBracketHeight}
                        min={50}
                        max={150}
                        step={5}
                        unit="mm"
                        onChange={handleChange('wallMountBracketHeight')}
                      />
                      <ParameterSlider
                        label="Thickness"
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
      
      {/* 7. Support-Free Mode */}
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
      
      {/* 8. Mold Generation */}
      <div className="bg-secondary/50 rounded-lg p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FlaskConical className={cn("w-4 h-4", params.moldEnabled ? "text-amber-500" : "text-muted-foreground")} />
            <Label htmlFor="mold-enabled" className="text-sm font-medium">Ceramic Mold</Label>
          </div>
          <Switch 
            id="mold-enabled" 
            checked={params.moldEnabled} 
            onCheckedChange={(enabled) => {
              onParamsChange({ ...params, moldEnabled: enabled });
              if (enabled) {
                toast.success('Mold generation enabled', { description: 'Preview shows 2-part mold halves' });
              }
            }}
          />
        </div>
        
        {params.moldEnabled && (
          <MoldControls params={params} type={type} onParamsChange={onParamsChange} handleChange={handleChange} />
        )}
      </div>
      
      {/* 9. Surface Art */}
      <div className="bg-secondary/50 rounded-lg p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PenTool className={cn("w-4 h-4", params.surfaceStrokes?.length > 0 ? "text-primary" : "text-muted-foreground")} />
            <Label className="text-sm font-medium">Surface Art</Label>
          </div>
          <Switch
            id="surface-strokes-visible"
            checked={params.surfaceStrokesVisible ?? true}
            onCheckedChange={(v) => onParamsChange({ ...params, surfaceStrokesVisible: v })}
          />
        </div>
        <div className="text-xs text-muted-foreground">
          Draw lines on the unwrapped surface. They become 3D tubes, grooves, or ribbons on your shape.
        </div>
        <SurfaceCanvas
          strokes={params.surfaceStrokes || []}
          onChange={(newStrokes: SurfaceStroke[]) => onParamsChange({ ...params, surfaceStrokes: newStrokes })}
          onHover={onSurfaceHover}
          params={params}
        />
      </div>
    </motion.div>
  );
};

export default ParameterControls;
