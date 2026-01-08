import { useState } from 'react';
import { DrawerItem, isParametricItem, isCustomItem } from '@/types/drawer';
import { ParametricParams, ObjectType } from '@/types/parametric';
import { ProfilePoint, ProfileSettings } from '@/types/custom-profile';
import { X, Archive, Check, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { exportDrawerItemsToZip, downloadBlob } from '@/lib/batch-export';
import { toast } from 'sonner';
import { useLicenseKey } from '@/hooks/useLicenseKey';
import ExportPaymentDialog from '@/components/ExportPaymentDialog';
import { calculateBatchPrice } from '@/config/export-pricing';

interface DrawerPanelProps {
  items: DrawerItem[];
  onLoadParametric?: (params: ParametricParams, objectType: ObjectType) => void;
  onLoadCustom?: (profile: ProfilePoint[], settings: ProfileSettings) => void;
  onRemove: (id: string) => void;
  // Legacy prop for backwards compatibility
  onLoad?: (params: ParametricParams, objectType: ObjectType) => void;
}

const DrawerPanel = ({ items, onLoadParametric, onLoadCustom, onRemove, onLoad }: DrawerPanelProps) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const { isUnlocked } = useLicenseKey();

  const getItemLabel = (item: DrawerItem): string => {
    if (isParametricItem(item)) {
      return item.objectType;
    } else if (isCustomItem(item)) {
      return `custom_${item.generationMode}`;
    }
    return 'item';
  };

  const handleItemClick = (item: DrawerItem) => {
    if (isParametricItem(item)) {
      if (onLoadParametric) {
        onLoadParametric(item.params, item.objectType);
      } else if (onLoad) {
        onLoad(item.params, item.objectType);
      }
    } else if (isCustomItem(item) && onLoadCustom) {
      onLoadCustom(item.profile, item.settings);
    }
  };

  const toggleSelect = (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(items.map((item) => item.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const doExport = async () => {
    const selectedItems = items.filter((item) => selectedIds.has(item.id));
    if (selectedItems.length === 0) {
      toast.error('Select items to export');
      return;
    }
    
    setIsExporting(true);
    try {
      const zip = await exportDrawerItemsToZip(selectedItems);
      const filename = selectedItems.length === 1 
        ? `${getItemLabel(selectedItems[0])}_export.zip`
        : `drawer_export_${selectedItems.length}_items.zip`;
      downloadBlob(zip, filename);
      toast.success(`Downloaded ${selectedItems.length} design${selectedItems.length > 1 ? 's' : ''}`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export files');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportClick = () => {
    const selectedItems = items.filter((item) => selectedIds.has(item.id));
    if (selectedItems.length === 0) {
      toast.error('Select items to export');
      return;
    }

    // If unlocked, export directly
    if (isUnlocked) {
      doExport();
    } else {
      // Show payment dialog
      setShowPaymentDialog(true);
    }
  };

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

  const hasSelection = selectedIds.size > 0;
  const allSelected = selectedIds.size === items.length;

  return (
    <div className="space-y-3">
      {/* Selection toolbar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={allSelected ? clearSelection : selectAll}
            className="text-xs h-7 px-2"
          >
            {allSelected ? 'Deselect all' : 'Select all'}
          </Button>
          {hasSelection && (
            <span className="text-xs text-muted-foreground">
              {selectedIds.size} selected
            </span>
          )}
        </div>
        
        {hasSelection && (
          <Button
            size="sm"
            onClick={handleExportClick}
            disabled={isExporting}
            className="gap-1 h-7"
          >
            {isExporting ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Download className="w-3 h-3" />
            )}
            {isExporting ? 'Exporting...' : `Export ZIP${!isUnlocked ? ` ${calculateBatchPrice(selectedIds.size).display}` : ''}`}
          </Button>
        )}
      </div>

      <ScrollArea className="h-[360px]">
        <div className="grid grid-cols-2 gap-3 pr-4">
          {items.map((item) => {
            const isSelected = selectedIds.has(item.id);
            const label = getItemLabel(item);
            
            return (
              <div
                key={item.id}
                className={`relative group cursor-pointer rounded-lg overflow-hidden border bg-muted/30 transition-colors ${
                  isSelected 
                    ? 'border-primary ring-2 ring-primary/20' 
                    : 'border-border hover:border-primary/50'
                }`}
                onClick={() => handleItemClick(item)}
              >
                {/* Selection checkbox */}
                <div
                  className="absolute top-1 left-1 z-10"
                  onClick={(e) => toggleSelect(item.id, e)}
                >
                  <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                    isSelected 
                      ? 'bg-primary border-primary' 
                      : 'bg-background/80 border-border hover:border-primary'
                  }`}>
                    {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                  </div>
                </div>

                {/* Thumbnail */}
                <div className="aspect-square">
                  <img
                    src={item.thumbnail}
                    alt="Design thumbnail"
                    className="w-full h-full object-cover"
                  />
                </div>
                
                {/* Type badge */}
                <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-background/80 backdrop-blur rounded text-[10px] font-medium capitalize">
                  {isCustomItem(item) ? (
                    <span className="text-primary">{item.generationMode}</span>
                  ) : (
                    label
                  )}
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
            );
          })}
        </div>
      </ScrollArea>

      {/* Payment Dialog */}
      <ExportPaymentDialog
        open={showPaymentDialog}
        onClose={() => setShowPaymentDialog(false)}
        onExport={doExport}
        exportType="batch"
        itemCount={selectedIds.size}
      />
    </div>
  );
};

export default DrawerPanel;
