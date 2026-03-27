import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Printer } from 'lucide-react';
import { submitToExhibitQueue } from '@/lib/exhibit-submit';
import { ParametricParams, ObjectType } from '@/types/parametric';
import ExhibitQueueStatus from './ExhibitQueueStatus';

interface ExhibitSubmitDialogProps {
  open: boolean;
  onClose: () => void;
  params: ParametricParams;
  objectType: ObjectType;
  onSubmitted: () => void;
}

const ExhibitSubmitDialog = ({ open, onClose, params, objectType, onSubmitted }: ExhibitSubmitDialogProps) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ queuePosition: number; id: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await submitToExhibitQueue({
        visitorName: name.trim(),
        visitorEmail: email.trim() || undefined,
        params,
        objectType,
      });
      setResult(res);
    } catch (e: any) {
      setError(e.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setName('');
    setEmail('');
    setResult(null);
    setError(null);
    onClose();
    if (result) onSubmitted();
  };

  if (result) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <ExhibitQueueStatus
            queuePosition={result.queuePosition}
            visitorName={name}
            onDone={handleClose}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5" />
            Send to Print
          </DialogTitle>
          <DialogDescription>
            Your design will be added to the print queue. Enter your name so we can let you know when it's ready!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="visitor-name">Your Name *</Label>
            <Input
              id="visitor-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              autoFocus
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="visitor-email">Email (optional)</Label>
            <Input
              id="visitor-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              maxLength={255}
            />
            <p className="text-xs text-muted-foreground">We'll notify you when your print is ready</p>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button
            onClick={handleSubmit}
            disabled={!name.trim() || submitting}
            className="w-full h-12 text-lg gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Printer className="w-5 h-5" />
                Send to Print!
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExhibitSubmitDialog;
