import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  TotemModuleConfig, 
  ShadeModuleConfig, 
  ExtensionModuleConfig,
  SpacerModuleConfig, 
  BaseModuleConfig,
} from '@/types/totem';

interface ModuleEditorProps {
  module: TotemModuleConfig | null;
  onUpdateModule: (id: string, updates: Partial<TotemModuleConfig>) => void;
}

const ModuleEditor = ({ module, onUpdateModule }: ModuleEditorProps) => {
  if (!module) {
    return (
      <div className="text-sm text-muted-foreground py-8 text-center">
        Select a module to edit its parameters
      </div>
    );
  }

  const handleUpdate = (updates: Partial<TotemModuleConfig>) => {
    onUpdateModule(module.id, updates);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        Edit {module.name}
      </h3>

      {/* Shade-specific parameters */}
      {(module.type === 'shade' || module.type === 'extension') && (
        <ShadeEditor 
          module={module as ShadeModuleConfig | ExtensionModuleConfig} 
          onUpdate={handleUpdate} 
        />
      )}

      {/* Spacer-specific parameters */}
      {module.type === 'spacer' && (
        <SpacerEditor 
          module={module as SpacerModuleConfig} 
          onUpdate={handleUpdate} 
        />
      )}

      {/* Base-specific parameters */}
      {module.type === 'base' && (
        <BaseEditor 
          module={module as BaseModuleConfig} 
          onUpdate={handleUpdate} 
        />
      )}

      {/* Cap and Pendant have minimal editable options for now */}
      {(module.type === 'cap' || module.type === 'pendant') && (
        <div className="text-sm text-muted-foreground py-4 text-center">
          Limited editing options for {module.type} modules
        </div>
      )}
    </div>
  );
};

// Shade-specific controls
interface ShadeEditorProps {
  module: ShadeModuleConfig | ExtensionModuleConfig;
  onUpdate: (updates: Partial<ShadeModuleConfig | ExtensionModuleConfig>) => void;
}

const ShadeEditor = ({ module, onUpdate }: ShadeEditorProps) => {
  const shapeParams = module.shapeParams || {};
  
  const updateShapeParam = (key: string, value: number) => {
    onUpdate({
      shapeParams: {
        ...shapeParams,
        [key]: value,
      },
    } as Partial<ShadeModuleConfig>);
  };

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold text-muted-foreground">Shape Parameters</h4>
      
      <div>
        <Label className="text-xs">Height: {shapeParams.height || 100}mm</Label>
        <Slider
          value={[shapeParams.height || 100]}
          onValueChange={([v]) => updateShapeParam('height', v)}
          min={30}
          max={200}
          step={5}
          className="mt-1"
        />
      </div>

      <div>
        <Label className="text-xs">Base Radius: {shapeParams.baseRadius || 30}mm</Label>
        <Slider
          value={[shapeParams.baseRadius || 30]}
          onValueChange={([v]) => updateShapeParam('baseRadius', v)}
          min={15}
          max={80}
          step={5}
          className="mt-1"
        />
      </div>

      <div>
        <Label className="text-xs">Top Radius: {shapeParams.topRadius || 60}mm</Label>
        <Slider
          value={[shapeParams.topRadius || 60]}
          onValueChange={([v]) => updateShapeParam('topRadius', v)}
          min={20}
          max={100}
          step={5}
          className="mt-1"
        />
      </div>

      <div>
        <Label className="text-xs">Wall Thickness: {shapeParams.wallThickness || 1.6}mm</Label>
        <Slider
          value={[(shapeParams.wallThickness || 1.6) * 10]}
          onValueChange={([v]) => updateShapeParam('wallThickness', v / 10)}
          min={8}
          max={40}
          step={2}
          className="mt-1"
        />
      </div>

    <div>
      <Label className="text-xs">Bulge: {(((shapeParams as any).bulge || 0) * 100).toFixed(0)}%</Label>
      <Slider
        value={[((shapeParams as any).bulge || 0) * 100]}
        onValueChange={([v]) => updateShapeParam('bulge', v / 100)}
        min={0}
        max={80}
        step={5}
        className="mt-1"
      />
    </div>

    <div>
      <Label className="text-xs">Organic: {(((shapeParams as any).organic || 0) * 100).toFixed(0)}%</Label>
      <Slider
        value={[((shapeParams as any).organic || 0) * 100]}
        onValueChange={([v]) => updateShapeParam('organic', v / 100)}
        min={0}
        max={50}
        step={5}
        className="mt-1"
      />
    </div>
    </div>
  );
};

// Spacer-specific controls
interface SpacerEditorProps {
  module: SpacerModuleConfig;
  onUpdate: (updates: Partial<SpacerModuleConfig>) => void;
}

const SpacerEditor = ({ module, onUpdate }: SpacerEditorProps) => (
  <div className="space-y-3">
    <h4 className="text-xs font-semibold text-muted-foreground">Spacer Options</h4>
    
    <div>
      <Label className="text-xs">Height: {module.height}mm</Label>
      <Slider
        value={[module.height]}
        onValueChange={([v]) => onUpdate({ height: v })}
        min={5}
        max={50}
        step={5}
        className="mt-1"
      />
    </div>

    <div>
      <Label className="text-xs">Outer Diameter: {module.outerDiameter}mm</Label>
      <Slider
        value={[module.outerDiameter]}
        onValueChange={([v]) => onUpdate({ outerDiameter: v })}
        min={25}
        max={100}
        step={5}
        className="mt-1"
      />
    </div>

    <div>
      <Label className="text-xs">Pattern</Label>
      <Select 
        value={module.style} 
        onValueChange={(v) => onUpdate({ style: v as SpacerModuleConfig['style'] })}
      >
        <SelectTrigger className="mt-1">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="plain">Plain</SelectItem>
          <SelectItem value="ribbed">Ribbed</SelectItem>
          <SelectItem value="fluted">Fluted</SelectItem>
          <SelectItem value="twisted">Twisted</SelectItem>
        </SelectContent>
      </Select>
    </div>

    {(module.style === 'ribbed' || module.style === 'fluted') && (
      <div>
        <Label className="text-xs">Rib Count: {module.ribCount ?? 12}</Label>
        <Slider
          value={[module.ribCount ?? 12]}
          onValueChange={([v]) => onUpdate({ ribCount: v })}
          min={6}
          max={32}
          step={2}
          className="mt-1"
        />
      </div>
    )}
  </div>
);

// Base-specific controls
interface BaseEditorProps {
  module: BaseModuleConfig;
  onUpdate: (updates: Partial<BaseModuleConfig>) => void;
}

const BaseEditor = ({ module, onUpdate }: BaseEditorProps) => (
  <div className="space-y-3">
    <h4 className="text-xs font-semibold text-muted-foreground">Base Options</h4>
    
    <div>
      <Label className="text-xs">Diameter: {module.diameter}mm</Label>
      <Slider
        value={[module.diameter]}
        onValueChange={([v]) => onUpdate({ diameter: v })}
        min={60}
        max={150}
        step={5}
        className="mt-1"
      />
    </div>

    <div>
      <Label className="text-xs">Height: {module.height}mm</Label>
      <Slider
        value={[module.height]}
        onValueChange={([v]) => onUpdate({ height: v })}
        min={10}
        max={40}
        step={2}
        className="mt-1"
      />
    </div>

    <div>
      <Label className="text-xs">Style</Label>
      <Select 
        value={module.style} 
        onValueChange={(v) => onUpdate({ style: v as BaseModuleConfig['style'] })}
      >
        <SelectTrigger className="mt-1">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="disc">Disc</SelectItem>
          <SelectItem value="tripod">Tripod</SelectItem>
          <SelectItem value="ring">Ring</SelectItem>
        </SelectContent>
      </Select>
    </div>

    {module.weight.cavityEnabled && (
      <div>
        <Label className="text-xs">Weight Cavity: {module.weight.cavityDiameter}mm</Label>
        <Slider
          value={[module.weight.cavityDiameter]}
          onValueChange={([v]) => onUpdate({ 
            weight: { ...module.weight, cavityDiameter: v } 
          })}
          min={30}
          max={100}
          step={5}
          className="mt-1"
        />
      </div>
    )}
  </div>
);

export default ModuleEditor;
