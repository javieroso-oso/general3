import { PrintSettings, defaultPrintSettings, PrintMode, defaultNonPlanarSettings } from '@/types/parametric';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, Layers, Workflow, Zap, Info } from 'lucide-react';

interface PrintSettingsPanelProps {
  settings: PrintSettings;
  onSettingsChange: (settings: PrintSettings) => void;
}

const PrintSettingsPanel = ({ settings, onSettingsChange }: PrintSettingsPanelProps) => {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  
  const handleChange = <K extends keyof PrintSettings>(key: K, value: PrintSettings[K]) => {
    onSettingsChange({ ...settings, [key]: value });
  };
  
  const handleNonPlanarChange = <K extends keyof typeof settings.nonPlanar>(
    key: K,
    value: typeof settings.nonPlanar[K]
  ) => {
    onSettingsChange({
      ...settings,
      nonPlanar: { ...settings.nonPlanar, [key]: value },
    });
  };

  const handlePrintModeChange = (mode: PrintMode) => {
    const newSettings = { ...settings, printMode: mode };
    
    // Auto-configure based on mode
    if (mode === 'vase_spiral') {
      newSettings.spiralVase = true;
      newSettings.infillPercent = 0;
      newSettings.supportEnabled = false;
    } else if (mode === 'non_planar') {
      newSettings.nonPlanar = {
        ...settings.nonPlanar,
        curvedLayers: true,
        topSurfaceOptimized: true,
        fullSurfaceLayers: false,
      };
    } else {
      newSettings.spiralVase = false;
    }
    
    onSettingsChange(newSettings);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-4"
    >
      {/* Print Mode Selection */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-text-secondary flex items-center gap-2">
          <Workflow className="w-4 h-4" />
          Print Mode
        </label>
        <Select
          value={settings.printMode}
          onValueChange={(v) => handlePrintModeChange(v as PrintMode)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="standard">Standard (Planar)</SelectItem>
            <SelectItem value="vase_spiral">Spiral Vase Mode</SelectItem>
            <SelectItem value="non_planar">Non-Planar Optimization</SelectItem>
          </SelectContent>
        </Select>
        
        {/* Mode description */}
        <div className={cn(
          "text-xs p-2 rounded border",
          settings.printMode === 'vase_spiral' && "bg-primary/10 border-primary/30 text-primary",
          settings.printMode === 'non_planar' && "bg-amber-500/10 border-amber-500/30 text-amber-600",
          settings.printMode === 'standard' && "bg-secondary/50 border-border text-text-muted"
        )}>
          {settings.printMode === 'standard' && "Traditional layer-by-layer planar printing"}
          {settings.printMode === 'vase_spiral' && "Single-wall continuous spiral - no seams, fast prints"}
          {settings.printMode === 'non_planar' && "Curved layers for smoother surfaces - requires compatible slicer"}
        </div>
      </div>

      {/* Material */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-text-secondary">Material</label>
        <Select
          value={settings.material}
          onValueChange={(v) => handleChange('material', v as PrintSettings['material'])}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PLA">PLA (Standard)</SelectItem>
            <SelectItem value="PETG">PETG (Durable)</SelectItem>
            <SelectItem value="ABS">ABS (Heat Resistant)</SelectItem>
            <SelectItem value="TPU">TPU (Flexible)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Layer Height */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <label className="text-sm font-medium text-text-secondary">Layer Height</label>
          <span className="text-sm font-semibold">{settings.layerHeight}mm</span>
        </div>
        <Select
          value={settings.layerHeight.toString()}
          onValueChange={(v) => handleChange('layerHeight', parseFloat(v))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0.1">0.10mm (Fine)</SelectItem>
            <SelectItem value="0.16">0.16mm (Normal)</SelectItem>
            <SelectItem value="0.2">0.20mm (Standard)</SelectItem>
            <SelectItem value="0.28">0.28mm (Draft)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Nozzle Diameter */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-text-secondary">Nozzle Diameter</label>
        <Select
          value={settings.nozzleDiameter.toString()}
          onValueChange={(v) => handleChange('nozzleDiameter', parseFloat(v))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0.4">0.4mm (Standard)</SelectItem>
            <SelectItem value="0.6">0.6mm (Fast)</SelectItem>
            <SelectItem value="0.8">0.8mm (Ultra Fast)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Infill - hidden in vase mode */}
      {settings.printMode !== 'vase_spiral' && (
        <div className="space-y-2">
          <div className="flex justify-between">
            <label className="text-sm font-medium text-text-secondary">Infill</label>
            <span className="text-sm font-semibold">{settings.infillPercent}%</span>
          </div>
          <Slider
            value={[settings.infillPercent]}
            min={0}
            max={100}
            step={5}
            onValueChange={([v]) => handleChange('infillPercent', v)}
          />
        </div>
      )}

      {/* Print Speed */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <label className="text-sm font-medium text-text-secondary">Print Speed</label>
          <span className="text-sm font-semibold">{settings.printSpeed}mm/s</span>
        </div>
        <Slider
          value={[settings.printSpeed]}
          min={20}
          max={100}
          step={5}
          onValueChange={([v]) => handleChange('printSpeed', v)}
        />
      </div>

      {/* Brim Width */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <label className="text-sm font-medium text-text-secondary">Brim Width</label>
          <span className="text-sm font-semibold">{settings.brimWidth}mm</span>
        </div>
        <Slider
          value={[settings.brimWidth]}
          min={0}
          max={15}
          step={1}
          onValueChange={([v]) => handleChange('brimWidth', v)}
        />
      </div>

      {/* Supports - hidden in vase mode */}
      {settings.printMode !== 'vase_spiral' && (
        <div className="flex items-center justify-between py-2">
          <label className="text-sm font-medium text-text-secondary">Enable Supports</label>
          <Switch
            checked={settings.supportEnabled}
            onCheckedChange={(v) => handleChange('supportEnabled', v)}
          />
        </div>
      )}

      {/* Spiral Vase Settings */}
      {settings.printMode === 'vase_spiral' && (
        <div className="bg-primary/5 rounded-lg p-3 space-y-3 border border-primary/20">
          <div className="flex items-center gap-2 text-primary">
            <Zap className="w-4 h-4" />
            <span className="text-sm font-semibold">Spiral Vase Settings</span>
          </div>
          <p className="text-xs text-text-muted">
            Single continuous wall with no seams. Perfect for vases and decorative objects.
            Automatically sets infill to 0% and disables supports.
          </p>
          <div className="flex items-center justify-between">
            <Label className="text-sm">Continuous Z movement</Label>
            <Switch checked={settings.spiralVase} disabled />
          </div>
        </div>
      )}

      {/* Non-Planar Settings */}
      {settings.printMode === 'non_planar' && (
        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium text-amber-600 hover:text-amber-700">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4" />
              Non-Planar Settings
            </div>
            <ChevronDown className={cn("w-4 h-4 transition-transform", advancedOpen && "rotate-180")} />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-2">
            <div className="bg-amber-500/5 rounded-lg p-3 space-y-4 border border-amber-500/20">
              {/* Max Z Angle */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-sm font-medium text-text-secondary">Max Nozzle Tilt</label>
                  <span className="text-sm font-semibold">{settings.nonPlanar.maxZAngle}°</span>
                </div>
                <Slider
                  value={[settings.nonPlanar.maxZAngle]}
                  min={15}
                  max={45}
                  step={5}
                  onValueChange={([v]) => handleNonPlanarChange('maxZAngle', v)}
                />
                <p className="text-xs text-text-muted">Higher angles allow smoother surfaces but risk nozzle collisions</p>
              </div>

              {/* Curved Layers */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">Curved Layers</Label>
                  <p className="text-xs text-text-muted">Generate curved toolpaths</p>
                </div>
                <Switch
                  checked={settings.nonPlanar.curvedLayers}
                  onCheckedChange={(v) => handleNonPlanarChange('curvedLayers', v)}
                />
              </div>

              {/* Top Surface Optimization */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">Top Surface Optimization</Label>
                  <p className="text-xs text-text-muted">Smooth curved top layers</p>
                </div>
                <Switch
                  checked={settings.nonPlanar.topSurfaceOptimized}
                  onCheckedChange={(v) => handleNonPlanarChange('topSurfaceOptimized', v)}
                />
              </div>

              {/* Full Surface Layers (Stage 2) */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">Full Surface Layers</Label>
                  <p className="text-xs text-text-muted">Follow entire object contour</p>
                </div>
                <Switch
                  checked={settings.nonPlanar.fullSurfaceLayers}
                  onCheckedChange={(v) => handleNonPlanarChange('fullSurfaceLayers', v)}
                />
              </div>

              {/* Adaptive Layer Height */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">Adaptive Layer Height</Label>
                  <p className="text-xs text-text-muted">Vary height based on surface angle</p>
                </div>
                <Switch
                  checked={settings.nonPlanar.adaptiveLayerHeight}
                  onCheckedChange={(v) => handleNonPlanarChange('adaptiveLayerHeight', v)}
                />
              </div>

              {settings.nonPlanar.adaptiveLayerHeight && (
                <div className="space-y-2 pl-4 border-l-2 border-amber-500/30">
                  <div className="flex justify-between">
                    <label className="text-xs text-text-muted">Layer Range</label>
                    <span className="text-xs font-medium">
                      {settings.nonPlanar.minLayerHeight}-{settings.nonPlanar.maxLayerHeight}mm
                    </span>
                  </div>
                </div>
              )}

              {/* Info box */}
              <div className="flex gap-2 p-2 bg-secondary/50 rounded text-xs text-text-muted">
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  Non-planar printing requires a compatible slicer (e.g., Slic3r++, FullControl) 
                  and printer with sufficient Z clearance.
                </span>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </motion.div>
  );
};

export default PrintSettingsPanel;
