import { useState } from 'react';
import { CreditCard, Key, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useLicenseKey } from '@/hooks/useLicenseKey';
import { ExportType, EXPORT_PRICES, calculateBatchPrice } from '@/config/export-pricing';

interface ExportPaymentDialogProps {
  open: boolean;
  onClose: () => void;
  onExport: () => void;
  exportType: ExportType;
  itemCount?: number;
}

const ExportPaymentDialog = ({
  open,
  onClose,
  onExport,
  exportType,
  itemCount = 1,
}: ExportPaymentDialogProps) => {
  const [licenseInput, setLicenseInput] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const { isUnlocked, setLicenseKey } = useLicenseKey();

  // Get pricing info based on export type
  const pricing = EXPORT_PRICES[exportType];
  const displayPrice = exportType === 'batch' 
    ? calculateBatchPrice(itemCount).display 
    : pricing.displayPrice;

  const handlePayment = async () => {
    setIsProcessingPayment(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-export-payment', {
        body: { exportType, itemCount },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
        onClose();
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast.error('Failed to initiate payment');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleUnlock = () => {
    const isValid = setLicenseKey(licenseInput.trim());
    if (isValid) {
      toast.success('License key activated!');
      onExport();
      onClose();
    } else {
      toast.error('Invalid license key');
    }
  };

  // If already unlocked, just export
  if (isUnlocked && open) {
    onExport();
    onClose();
    return null;
  }

  const getTitle = () => {
    switch (exportType) {
      case 'body': return 'Export Body STL';
      case 'bodyWithLegs': return 'Export Body + Legs';
      case 'bodyWithMold': return 'Export Body + Mold';
      case 'gcode': return 'Export G-code';
      case 'batch': return `Export ${itemCount} Designs`;
      default: return 'Export';
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            {getTitle()}
          </DialogTitle>
          <DialogDescription>
            {pricing.description}
            {exportType === 'batch' && itemCount > 1 && ` (${itemCount} items)`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Payment button */}
          <Button
            onClick={handlePayment}
            disabled={isProcessingPayment}
            className="w-full gap-2"
          >
            {isProcessingPayment ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CreditCard className="w-4 h-4" />
            )}
            {isProcessingPayment ? 'Processing...' : 'Continue to Checkout'}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">or</span>
            </div>
          </div>

          {/* License key input */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-1">
              <Key className="w-3 h-3" />
              Have a license key?
            </label>
            <div className="flex gap-2">
              <Input
                value={licenseInput}
                onChange={(e) => setLicenseInput(e.target.value)}
                placeholder="Enter license key"
                className="flex-1"
              />
              <Button
                onClick={handleUnlock}
                variant="secondary"
                disabled={!licenseInput.trim()}
              >
                Unlock
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExportPaymentDialog;
