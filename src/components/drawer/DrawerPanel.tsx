import { DrawerItem } from '@/types/drawer';
import { ParametricParams, ObjectType } from '@/types/parametric';
import { X, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface DrawerPanelProps {
  items: DrawerItem[];
  onLoad: (params: ParametricParams, objectType: ObjectType) => void;
  onRemove: (id: string) => void;
}

const DrawerPanel = ({ items, onLoad, onRemove }: DrawerPanelProps) => {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Archive className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
        <p className="text-sm text-muted-foreground">
          Your drawer is empty
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Click "Keep" to add designs here
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px]">
      <div className="grid grid-cols-2 gap-3 pr-4">
        {items.map((item) => (
          <div
            key={item.id}
            className="relative group cursor-pointer rounded-lg overflow-hidden border border-border bg-muted/30 hover:border-primary/50 transition-colors"
            onClick={() => onLoad(item.params, item.objectType)}
          >
            {/* Thumbnail */}
            <div className="aspect-square">
              <img
                src={item.thumbnail}
                alt="Design thumbnail"
                className="w-full h-full object-cover"
              />
            </div>
            
            {/* Object type badge */}
            <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-background/80 backdrop-blur rounded text-[10px] font-medium capitalize">
              {item.objectType}
            </div>
            
            {/* Remove button */}
            <Button
              variant="destructive"
              size="icon"
              className="absolute top-1 right-1 w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(item.id);
              }}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
};

export default DrawerPanel;
