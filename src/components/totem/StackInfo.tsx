import { TotemStack, calculateStackHeight, SPINDLE_SPECS } from '@/types/totem';
import { Ruler, Layers, Circle } from 'lucide-react';

interface StackInfoProps {
  stack: TotemStack;
}

const StackInfo = ({ stack }: StackInfoProps) => {
  const totalHeight = calculateStackHeight(stack.modules);
  const spindleSpec = SPINDLE_SPECS[stack.spindleSize];
  const moduleCount = stack.modules.length;
  
  // Recommended spindle length (stack height + 20mm for mounting)
  const recommendedSpindleLength = totalHeight + 20;

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
        Stack Info
      </h3>
      
      <div className="grid grid-cols-2 gap-2">
        <div className="p-3 bg-secondary/50 rounded-lg border border-border">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Ruler className="w-3 h-3" />
            <span className="text-xs uppercase tracking-wider">Height</span>
          </div>
          <div className="text-lg font-bold">{totalHeight}mm</div>
        </div>
        
        <div className="p-3 bg-secondary/50 rounded-lg border border-border">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Layers className="w-3 h-3" />
            <span className="text-xs uppercase tracking-wider">Modules</span>
          </div>
          <div className="text-lg font-bold">{moduleCount}</div>
        </div>
      </div>
      
      <div className="p-3 bg-secondary/50 rounded-lg border border-border">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <Circle className="w-3 h-3" />
          <span className="text-xs uppercase tracking-wider">Spindle</span>
        </div>
        <div className="text-sm">
          <span className="font-bold">{spindleSpec.diameter}mm</span>
          <span className="text-muted-foreground"> dowel</span>
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          Recommended length: {recommendedSpindleLength}mm
        </div>
      </div>
    </div>
  );
};

export default StackInfo;
