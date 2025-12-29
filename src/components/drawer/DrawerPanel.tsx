import { useState, useEffect } from 'react';
import { DrawerItem } from '@/types/drawer';
import { ParametricParams, ObjectType } from '@/types/parametric';
import { X, Archive, Check, Download, CreditCard, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { exportDrawerItemsToZip, downloadBlob } from '@/lib/batch-export';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface DrawerPanelProps {
  items: DrawerItem[];
  onLoad: (params: ParametricParams, objectType: ObjectType) => void;
  onRemove: (id: string) => void;
}

const EXPORT_PRICE = 2.99;

const DrawerPanel = ({ items, onLoad, onRemove }: DrawerPanelProps) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [email, setEmail] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [pendingExportItems, setPendingExportItems] = useState<DrawerItem[]>([]);

  // Check for successful payment on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const exportSuccess = params.get('export_success');
    const sessionId = params.get('session_id');
    
    if (exportSuccess === 'true' && sessionId) {
      verifyAndDownload(sessionId);
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
    
    if (params.get('export_canceled') === 'true') {
      toast.error('Payment was canceled');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const verifyAndDownload = async (sessionId: string) => {
    if (!supabase) {
      toast.error('Payment system not configured');
      return;
    }
    
    setIsExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-payment', {
        body: { sessionId },
      });

      if (error) throw error;
      
      if (data?.verified) {
        toast.success('Payment verified! Starting download...');
        // Download all items in drawer after successful payment
        const allItems = items.length > 0 ? items : [];
        if (allItems.length > 0) {
          const zip = await exportDrawerItemsToZip(allItems);
          const filename = allItems.length === 1 
            ? `${allItems[0].objectType}_export.zip`
            : `drawer_export_${allItems.length}_items.zip`;
          downloadBlob(zip, filename);
          toast.success(`Downloaded ${allItems.length} design${allItems.length > 1 ? 's' : ''}`);
        }
      } else {
        toast.error('Payment verification failed');
      }
    } catch (error) {
      console.error('Verification error:', error);
      toast.error('Failed to verify payment');
    } finally {
      setIsExporting(false);
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

  const handleExportClick = () => {
    const selectedItems = items.filter((item) => selectedIds.has(item.id));
    if (selectedItems.length === 0) {
      toast.error('Select items to export');
      return;
    }
    
    setPendingExportItems(selectedItems);
    setShowPaymentDialog(true);
  };

  const handlePurchase = async () => {
    if (!supabase) {
      toast.error('Payment system not configured');
      return;
    }
    
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email');
      return;
    }

    setIsProcessingPayment(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-export-payment', {
        body: { 
          itemCount: pendingExportItems.length,
          email 
        },
      });

      if (error) throw error;
      
      if (data?.url) {
        // Open Stripe checkout in new tab
        window.open(data.url, '_blank');
        setShowPaymentDialog(false);
        toast.info('Complete payment in the new tab, then return here');
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast.error('Failed to start checkout');
    } finally {
      setIsProcessingPayment(false);
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
    <>
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
              {isExporting ? 'Processing...' : `Export $${EXPORT_PRICE}`}
            </Button>
          )}
        </div>

        <ScrollArea className="h-[360px]">
          <div className="grid grid-cols-2 gap-3 pr-4">
            {items.map((item) => {
              const isSelected = selectedIds.has(item.id);
              
              return (
                <div
                  key={item.id}
                  className={`relative group cursor-pointer rounded-lg overflow-hidden border bg-muted/30 transition-colors ${
                    isSelected 
                      ? 'border-primary ring-2 ring-primary/20' 
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => onLoad(item.params, item.objectType)}
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
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Export STL Files
            </DialogTitle>
            <DialogDescription>
              Download {pendingExportItems.length} design{pendingExportItems.length > 1 ? 's' : ''} as STL files
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="font-medium">STL Batch Export</p>
                <p className="text-sm text-muted-foreground">
                  {pendingExportItems.length} file{pendingExportItems.length > 1 ? 's' : ''} in ZIP
                </p>
              </div>
              <p className="text-2xl font-bold">${EXPORT_PRICE}</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email for receipt</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowPaymentDialog(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 gap-2"
              onClick={handlePurchase}
              disabled={isProcessingPayment || !email}
            >
              {isProcessingPayment ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CreditCard className="w-4 h-4" />
              )}
              {isProcessingPayment ? 'Processing...' : 'Pay with Stripe'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DrawerPanel;
