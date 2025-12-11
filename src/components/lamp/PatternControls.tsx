import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { LampParams, LightPatternType } from '@/types/lamp';
import { Sparkles, Wind, Sun } from 'lucide-react';

interface PatternControlsProps {
  params: LampParams;
  onParamsChange: (params: LampParams) => void;
}

const patternOptions: { value: LightPatternType; label: string; icon: string }[] = [
  { value: 'none', label: 'None', icon: '⬜' },
  { value: 'dots', label: 'Dots', icon: '⚪' },
  { value: 'lines', label: 'Lines', icon: '═' },
  { value: 'organic', label: 'Organic', icon: '🌊' },
  { value: 'geometric', label: 'Geometric', icon: '◆' },
];

const PatternControls = ({ params, onParamsChange }: PatternControlsProps) => {
  const updateParam = <K extends keyof LampParams>(key: K, value: LampParams[K]) => {
    onParamsChange({ ...params, [key]: value });
  };
  
  return (
    <div className="space-y-6">
      {/* Light Pattern Cutouts */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <Label className="text-xs font-bold uppercase tracking-wider">Light Pattern</Label>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {patternOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => updateParam('lightPatternType', opt.value)}
              className={`p-2 rounded-lg border-2 text-center transition-all ${
                params.lightPatternType === opt.value
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <span className="text-lg">{opt.icon}</span>
              <p className="text-[10px] mt-1">{opt.label}</p>
            </button>
          ))}
        </div>
      </div>
      
      {params.lightPatternType !== 'none' && (
        <>
          {/* Pattern Density */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold uppercase tracking-wider">Pattern Density</Label>
              <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded">
                {Math.round(params.patternDensity * 100)}%
              </span>
            </div>
            <Slider
              value={[params.patternDensity]}
              onValueChange={([v]) => updateParam('patternDensity', v)}
              min={0.1}
              max={0.8}
              step={0.05}
              className="py-2"
            />
          </div>
          
          {/* Pattern Size */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold uppercase tracking-wider">Pattern Size</Label>
              <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded">{params.patternSize}mm</span>
            </div>
            <Slider
              value={[params.patternSize]}
              onValueChange={([v]) => updateParam('patternSize', v)}
              min={3}
              max={25}
              step={1}
              className="py-2"
            />
          </div>
          
          {/* Pattern Depth */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold uppercase tracking-wider">Cutout Depth</Label>
              <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded">
                {params.patternDepth < 1 ? `${Math.round(params.patternDepth * 100)}%` : 'Through'}
              </span>
            </div>
            <Slider
              value={[params.patternDepth]}
              onValueChange={([v]) => updateParam('patternDepth', v)}
              min={0.3}
              max={1}
              step={0.1}
              className="py-2"
            />
          </div>
        </>
      )}
      
      {/* Ventilation Slots */}
      <div className="space-y-4 pt-4 border-t border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wind className="w-4 h-4 text-secondary" />
            <Label className="text-xs font-bold uppercase tracking-wider">Ventilation Slots</Label>
          </div>
          <Switch
            checked={params.ventilationSlots}
            onCheckedChange={(v) => updateParam('ventilationSlots', v)}
          />
        </div>
        
        {params.ventilationSlots && (
          <div className="space-y-4 pl-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Slot Count</Label>
                <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded">{params.ventSlotCount}</span>
              </div>
              <Slider
                value={[params.ventSlotCount]}
                onValueChange={([v]) => updateParam('ventSlotCount', v)}
                min={3}
                max={12}
                step={1}
                className="py-1"
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Slot Width</Label>
                <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded">{params.ventSlotWidth}mm</span>
              </div>
              <Slider
                value={[params.ventSlotWidth]}
                onValueChange={([v]) => updateParam('ventSlotWidth', v)}
                min={3}
                max={15}
                step={1}
                className="py-1"
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Slot Height</Label>
                <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded">{params.ventSlotHeight}mm</span>
              </div>
              <Slider
                value={[params.ventSlotHeight]}
                onValueChange={([v]) => updateParam('ventSlotHeight', v)}
                min={10}
                max={50}
                step={5}
                className="py-1"
              />
            </div>
          </div>
        )}
      </div>
      
      {/* Translucency Zone */}
      <div className="space-y-4 pt-4 border-t border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sun className="w-4 h-4 text-accent" />
            <Label className="text-xs font-bold uppercase tracking-wider">Translucency Zone</Label>
          </div>
          <Switch
            checked={params.translucencyEnabled}
            onCheckedChange={(v) => updateParam('translucencyEnabled', v)}
          />
        </div>
        
        {params.translucencyEnabled && (
          <div className="space-y-4 pl-6">
            <div className="space-y-2">
              <Label className="text-xs">Zone Range (Height %)</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs w-12">{Math.round(params.translucencyZoneStart * 100)}%</span>
                <Slider
                  value={[params.translucencyZoneStart, params.translucencyZoneEnd]}
                  onValueChange={([start, end]) => {
                    updateParam('translucencyZoneStart', start);
                    updateParam('translucencyZoneEnd', end);
                  }}
                  min={0}
                  max={1}
                  step={0.05}
                  className="flex-1"
                />
                <span className="text-xs w-12 text-right">{Math.round(params.translucencyZoneEnd * 100)}%</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Wall Thickness in Zone</Label>
                <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded">{params.translucencyThickness}mm</span>
              </div>
              <Slider
                value={[params.translucencyThickness]}
                onValueChange={([v]) => updateParam('translucencyThickness', v)}
                min={0.4}
                max={1.5}
                step={0.1}
                className="py-1"
              />
              <p className="text-xs text-muted-foreground">Thinner walls allow more light diffusion</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PatternControls;
