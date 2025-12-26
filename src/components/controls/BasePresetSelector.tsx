import { motion } from 'framer-motion';
import { Lamp, Circle, Lightbulb, Frame, AlertTriangle, AlertCircle, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PRESET_INFO, BasePresetKey } from '@/lib/base/preset-adapter';
import { ValidationResult } from '@/lib/base/validation';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface BasePresetSelectorProps {
  selectedPreset: BasePresetKey | null;
  onSelectPreset: (preset: BasePresetKey) => void;
  validation: ValidationResult | null;
}

const getIcon = (iconType: string) => {
  switch (iconType) {
    case 'lamp-tripod':
      return Lamp;
    case 'lamp-disc':
      return Circle;
    case 'led-puck':
      return Lightbulb;
    case 'wall-sconce':
      return Frame;
    default:
      return Lamp;
  }
};

const ValidationBadge = ({ validation }: { validation: ValidationResult | null }) => {
  if (!validation) return null;
  
  const errorCount = validation.errors.length;
  const warningCount = validation.warnings.length;
  
  if (errorCount === 0 && warningCount === 0) {
    return (
      <Badge variant="outline" className="text-emerald-500 border-emerald-500/50 text-xs">
        <Check className="w-3 h-3 mr-1" />
        Valid
      </Badge>
    );
  }
  
  if (errorCount > 0) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Badge variant="destructive" className="text-xs">
              <AlertCircle className="w-3 h-3 mr-1" />
              {errorCount} Error{errorCount > 1 ? 's' : ''}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <ul className="text-xs space-y-1">
              {validation.errors.map((err, i) => (
                <li key={i} className="text-destructive">{err}</li>
              ))}
            </ul>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Badge variant="outline" className="text-amber-500 border-amber-500/50 text-xs">
            <AlertTriangle className="w-3 h-3 mr-1" />
            {warningCount} Warning{warningCount > 1 ? 's' : ''}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <ul className="text-xs space-y-1">
            {validation.warnings.map((warn, i) => (
              <li key={i} className="text-amber-500">{warn}</li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export const BasePresetSelector = ({ 
  selectedPreset, 
  onSelectPreset,
  validation 
}: BasePresetSelectorProps) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Quick Presets</span>
        <ValidationBadge validation={validation} />
      </div>
      
      <div className="grid grid-cols-2 gap-2">
        {PRESET_INFO.map((preset) => {
          const Icon = getIcon(preset.icon);
          const isSelected = selectedPreset === preset.key;
          
          return (
            <motion.button
              key={preset.key}
              onClick={() => onSelectPreset(preset.key)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all",
                "text-left hover:bg-accent/50",
                isSelected 
                  ? "border-primary bg-primary/10 text-primary" 
                  : "border-border/50 bg-background/50"
              )}
            >
              <Icon className={cn(
                "w-5 h-5",
                isSelected ? "text-primary" : "text-muted-foreground"
              )} />
              <span className={cn(
                "text-xs font-medium text-center leading-tight",
                isSelected ? "text-primary" : "text-foreground"
              )}>
                {preset.name}
              </span>
            </motion.button>
          );
        })}
      </div>
      
      {selectedPreset && (
        <p className="text-xs text-muted-foreground">
          {PRESET_INFO.find(p => p.key === selectedPreset)?.description}
        </p>
      )}
    </div>
  );
};

export default BasePresetSelector;
