import { Button } from '@/components/ui/button';
import { 
  Lightbulb, 
  Circle, 
  Square, 
  ChevronUp,
  Lamp
} from 'lucide-react';
import { ModuleType } from '@/types/totem';

interface ModulePaletteProps {
  onAddModule: (type: ModuleType) => void;
}

const moduleTypes: { type: ModuleType; label: string; icon: React.ReactNode; description: string }[] = [
  { 
    type: 'shade', 
    label: 'Shade', 
    icon: <Lightbulb className="w-4 h-4" />,
    description: 'Main lamp shade with organic shape'
  },
  { 
    type: 'spacer', 
    label: 'Spacer', 
    icon: <Circle className="w-4 h-4" />,
    description: 'Decorative ring spacer'
  },
  { 
    type: 'base', 
    label: 'Base', 
    icon: <Square className="w-4 h-4" />,
    description: 'Weighted table base'
  },
  { 
    type: 'cap', 
    label: 'Cap', 
    icon: <ChevronUp className="w-4 h-4" />,
    description: 'Top cap with socket mount'
  },
  { 
    type: 'pendant', 
    label: 'Pendant', 
    icon: <Lamp className="w-4 h-4" />,
    description: 'Ceiling mount canopy'
  },
];

const ModulePalette = ({ onAddModule }: ModulePaletteProps) => {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
        Add Module
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {moduleTypes.map(({ type, label, icon }) => (
          <Button
            key={type}
            variant="outline"
            size="sm"
            onClick={() => onAddModule(type)}
            className="flex flex-col items-center gap-1 h-auto py-3 hover:bg-primary hover:text-primary-foreground transition-colors"
          >
            {icon}
            <span className="text-xs font-medium">{label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
};

export default ModulePalette;
