import { Copy, ExternalLink, AlertTriangle, Check, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { 
  LampHardware, 
  HardwareShoppingList as ShoppingListType,
  generateShoppingList,
  HardwareItem,
} from '@/types/lamp';
import { PrintSettings } from '@/types/parametric';

interface HardwareShoppingListProps {
  hardware: LampHardware;
  material: PrintSettings['material'];
}

const ItemCard = ({ item, showWarning }: { item: HardwareItem; showWarning?: boolean }) => {
  const copySearchTerm = () => {
    navigator.clipboard.writeText(item.searchTerm);
    toast.success('Search term copied!');
  };
  
  return (
    <div className="p-3 rounded-lg bg-muted/30 border border-border space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="font-semibold text-sm">{item.name}</h4>
          <p className="text-xs text-muted-foreground">{item.specification}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={copySearchTerm}
        >
          <Copy className="w-3 h-3" />
        </Button>
      </div>
      <p className={`text-xs ${showWarning || item.notes.includes('⚠️') ? 'text-secondary font-medium' : 'text-muted-foreground'}`}>
        {item.notes}
      </p>
      <div className="flex items-center gap-1 text-xs text-primary">
        <span className="truncate">Search: "{item.searchTerm}"</span>
      </div>
    </div>
  );
};

const HardwareShoppingList = ({ hardware, material }: HardwareShoppingListProps) => {
  const list = generateShoppingList(hardware, material);
  
  const copyAllSearchTerms = () => {
    const terms = [
      list.socket.searchTerm,
      list.cord.searchTerm,
      list.bulb.searchTerm,
      list.threadedRing?.searchTerm,
      list.snapRing?.searchTerm,
      ...list.additionalItems.map(i => i.searchTerm),
    ].filter(Boolean).join('\n');
    
    navigator.clipboard.writeText(terms);
    toast.success('All search terms copied!');
  };
  
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-primary" />
          <h3 className="font-bold text-sm uppercase tracking-wider">Hardware List</h3>
        </div>
        <Button variant="outline" size="sm" onClick={copyAllSearchTerms} className="text-xs h-7">
          <Copy className="w-3 h-3 mr-1" />
          Copy All
        </Button>
      </div>
      
      {/* Mount Type Info */}
      <div className="p-2 rounded bg-primary/10 border border-primary/20">
        <p className="text-xs font-medium text-primary">
          Mount Type: <span className="capitalize">{hardware.mountType.replace('_', ' ')}</span>
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {hardware.mountType === 'threaded_ring' && 'Standard socket with included threaded ring'}
          {hardware.mountType === 'press_fit' && 'Socket press-fits into shade collar'}
          {hardware.mountType === 'snap_ring' && 'Snap ring holds socket in place'}
        </p>
      </div>
      
      {/* Required Items */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Required</h4>
        <ItemCard item={list.socket} />
        <ItemCard item={list.cord} />
        <ItemCard item={list.bulb} showWarning={list.bulb.notes.includes('⚠️')} />
        
        {list.threadedRing && <ItemCard item={list.threadedRing} />}
        {list.snapRing && <ItemCard item={list.snapRing} />}
      </div>
      
      {/* Additional Items */}
      {list.additionalItems.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Additional</h4>
          {list.additionalItems.map((item, i) => (
            <ItemCard key={i} item={item} />
          ))}
        </div>
      )}
      
      <Separator />
      
      {/* Assembly Steps */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Assembly</h4>
        <div className="space-y-1.5">
          {list.assemblySteps.map((step, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <Check className="w-3 h-3 text-primary mt-0.5 shrink-0" />
              <span>{step.replace(/^\d+\.\s*/, '')}</span>
            </div>
          ))}
        </div>
      </div>
      
      {/* Safety Note */}
      <div className="p-2 rounded bg-secondary/10 border border-secondary/20 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
        <div className="text-xs">
          <p className="font-medium text-secondary">Safety Reminder</p>
          <p className="text-muted-foreground mt-0.5">
            Always use LED bulbs with 3D printed shades. Ensure proper ventilation and never exceed material heat limits.
          </p>
        </div>
      </div>
    </div>
  );
};

export default HardwareShoppingList;
