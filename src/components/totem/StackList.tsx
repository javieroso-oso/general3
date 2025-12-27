import { Button } from '@/components/ui/button';
import { Trash2, GripVertical, ChevronUp, ChevronDown } from 'lucide-react';
import { 
  TotemModuleConfig, 
  ShadeModuleConfig, 
  ExtensionModuleConfig,
  SpacerModuleConfig,
  BaseModuleConfig,
  CapModuleConfig,
  PendantModuleConfig,
} from '@/types/totem';
import { cn } from '@/lib/utils';

interface StackListProps {
  modules: TotemModuleConfig[];
  selectedModuleId?: string;
  onSelectModule: (id: string) => void;
  onRemoveModule: (id: string) => void;
  onMoveModule: (id: string, direction: 'up' | 'down') => void;
}

const getModuleIcon = (type: TotemModuleConfig['type']) => {
  switch (type) {
    case 'shade':
    case 'extension':
      return '💡';
    case 'spacer':
      return '⭕';
    case 'base':
      return '🔳';
    case 'cap':
      return '🔺';
    case 'pendant':
      return '🔌';
    default:
      return '📦';
  }
};

// Get module height based on type
function getModuleHeight(module: TotemModuleConfig): number {
  switch (module.type) {
    case 'shade':
    case 'extension':
      const shapeModule = module as ShadeModuleConfig | ExtensionModuleConfig;
      return shapeModule.shapeParams.height || 100;
    case 'spacer':
      return (module as SpacerModuleConfig).height;
    case 'base':
      return (module as BaseModuleConfig).height;
    case 'cap':
      const capModule = module as CapModuleConfig;
      return capModule.domeHeight + capModule.bottomInterface.ring.height;
    case 'pendant':
      return (module as PendantModuleConfig).canopyHeight;
    default:
      return 50;
  }
}

const StackList = ({ 
  modules, 
  selectedModuleId, 
  onSelectModule, 
  onRemoveModule,
  onMoveModule 
}: StackListProps) => {
  // Display from top to bottom (reverse order since stack builds from bottom)
  const displayModules = [...modules].reverse();
  
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
        Stack Order
      </h3>
      
      {modules.length === 0 ? (
        <div className="text-sm text-muted-foreground py-4 text-center border-2 border-dashed border-border rounded-lg">
          No modules yet. Add one from the palette above.
        </div>
      ) : (
        <div className="space-y-1">
          {displayModules.map((module, displayIndex) => {
            const actualIndex = modules.length - 1 - displayIndex;
            const isSelected = selectedModuleId === module.id;
            const canMoveUp = actualIndex < modules.length - 1;
            const canMoveDown = actualIndex > 0;
            const height = getModuleHeight(module);
            
            return (
              <div
                key={module.id}
                className={cn(
                  'flex items-center gap-2 p-2 rounded-lg border-2 cursor-pointer transition-all',
                  isSelected 
                    ? 'border-primary bg-primary/10' 
                    : 'border-border hover:border-muted-foreground bg-card'
                )}
                onClick={() => onSelectModule(module.id)}
              >
                <GripVertical className="w-4 h-4 text-muted-foreground" />
                
                <span className="text-lg">{getModuleIcon(module.type)}</span>
                
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium capitalize truncate">
                    {module.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {height}mm
                  </div>
                </div>
                
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveModule(module.id, 'up');
                    }}
                    disabled={!canMoveUp}
                  >
                    <ChevronUp className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveModule(module.id, 'down');
                    }}
                    disabled={!canMoveDown}
                  >
                    <ChevronDown className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveModule(module.id);
                    }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StackList;
