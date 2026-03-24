import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Download, Loader2, FileArchive } from 'lucide-react';
import {
  ExportOptions,
  DEFAULT_EXPORT_OPTIONS,
  getSavedExportOptions,
  saveExportOptions,
} from '@/types/export-options';

interface ExportOptionsDialogProps {
  open: boolean;
  onClose: () => void;
  onExport: (options: ExportOptions) => void;
  isExporting?: boolean;
  hasLegs: boolean;
  hasMolds: boolean;
  hasLampShade?: boolean;
  hasBasePlate?: boolean;
  itemCount?: number;
}

export function ExportOptionsDialog({
  open,
  onClose,
  onExport,
  isExporting = false,
  hasLegs,
  hasMolds,
  hasLampShade = false,
  hasBasePlate = false,
  itemCount = 1,
}: ExportOptionsDialogProps) {
  const [options, setOptions] = useState<ExportOptions>(() => getSavedExportOptions());

  // Reset to saved options when dialog opens
  useEffect(() => {
    if (open) {
      setOptions(getSavedExportOptions());
    }
  }, [open]);

  // Validate options when availability changes
  useEffect(() => {
    setOptions((prev) => ({
      ...prev,
      includeLegs: prev.includeLegs && hasLegs,
      includeMolds: prev.includeMolds && hasMolds,
      includeSocketCradle: prev.includeSocketCradle && hasLampShade,
      includeBasePlate: prev.includeBasePlate && hasBasePlate,
    }));
  }, [hasLegs, hasMolds, hasLampShade, hasBasePlate]);

  const handleExport = () => {
    saveExportOptions(options);
    onExport(options);
  };

  // Preview what files will be generated
  const filePreview = useMemo(() => {
    const files: string[] = [];
    const { includeBody, includeLegs, includeMolds, includeSocketCradle, includeBasePlate, mergeMode } = options;

    if (!includeBody && !includeLegs && !includeMolds && !includeSocketCradle && !includeBasePlate) {
      return ['No components selected'];
    }

    if (mergeMode === 'allMerged' && (includeBody || includeLegs)) {
      files.push('combined.stl');
    } else if (mergeMode === 'bodyWithLegs' && includeBody && includeLegs && hasLegs) {
      files.push('combined.stl');
    } else {
      if (includeBody) {
        files.push('body.stl');
      }
      if (includeLegs && hasLegs) {
        files.push('legs_base.stl');
      }
    }

    if (includeMolds && hasMolds) {
      files.push('mold_A.stl', 'mold_B.stl', '...');
    }

    if (includeSocketCradle && hasLampShade) {
      files.push('socket_cradle.stl');
    }

    if (includeBasePlate && hasBasePlate) {
      files.push('base_plate.stl');
    }

    return files;
  }, [options, hasLegs, hasMolds, hasLampShade, hasBasePlate]);

  const canExport = options.includeBody || (options.includeLegs && hasLegs) || (options.includeMolds && hasMolds) || (options.includeSocketCradle && hasLampShade);
  const showMergeOptions = options.includeBody && options.includeLegs && hasLegs;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileArchive className="w-5 h-5" />
            Export Options
          </DialogTitle>
          <DialogDescription>
            {itemCount > 1 
              ? `Choose what to include for ${itemCount} designs`
              : 'Choose what to include in your export'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Component Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Components to export</Label>
            
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-body"
                  checked={options.includeBody}
                  onCheckedChange={(checked) =>
                    setOptions((prev) => ({ ...prev, includeBody: !!checked }))
                  }
                />
                <Label htmlFor="include-body" className="text-sm font-normal cursor-pointer">
                  Body (shape/vase/lamp)
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-legs"
                  checked={options.includeLegs && hasLegs}
                  disabled={!hasLegs}
                  onCheckedChange={(checked) =>
                    setOptions((prev) => ({ ...prev, includeLegs: !!checked }))
                  }
                />
                <Label 
                  htmlFor="include-legs" 
                  className={`text-sm font-normal cursor-pointer ${!hasLegs ? 'text-muted-foreground' : ''}`}
                >
                  Legs / Base
                  {!hasLegs && <span className="ml-1 text-xs">(not available)</span>}
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-molds"
                  checked={options.includeMolds && hasMolds}
                  disabled={!hasMolds}
                  onCheckedChange={(checked) =>
                    setOptions((prev) => ({ ...prev, includeMolds: !!checked }))
                  }
                />
                <Label 
                  htmlFor="include-molds" 
                  className={`text-sm font-normal cursor-pointer ${!hasMolds ? 'text-muted-foreground' : ''}`}
                >
                  Mold parts
                  {!hasMolds && <span className="ml-1 text-xs">(not available)</span>}
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-socket-cradle"
                  checked={options.includeSocketCradle && hasLampShade}
                  disabled={!hasLampShade}
                  onCheckedChange={(checked) =>
                    setOptions((prev) => ({ ...prev, includeSocketCradle: !!checked }))
                  }
                />
                <Label 
                  htmlFor="include-socket-cradle" 
                  className={`text-sm font-normal cursor-pointer ${!hasLampShade ? 'text-muted-foreground' : ''}`}
                >
                  Socket Cradle
                  {!hasLampShade && <span className="ml-1 text-xs">(lamp style only)</span>}
                  {hasLampShade && <span className="ml-1 text-xs text-muted-foreground">(drops into shade)</span>}
                </Label>
              </div>
            </div>
          </div>

          {/* Merge Options - Only show when both body and legs are selected */}
          {showMergeOptions && (
            <>
              <Separator />
              
              <div className="space-y-3">
                <Label className="text-sm font-medium">How to export</Label>
                
                <RadioGroup
                  value={options.mergeMode}
                  onValueChange={(value) =>
                    setOptions((prev) => ({ 
                      ...prev, 
                      mergeMode: value as ExportOptions['mergeMode'] 
                    }))
                  }
                  className="space-y-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="separate" id="merge-separate" />
                    <Label htmlFor="merge-separate" className="text-sm font-normal cursor-pointer">
                      Separate files
                    </Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="bodyWithLegs" id="merge-body-legs" />
                    <Label htmlFor="merge-body-legs" className="text-sm font-normal cursor-pointer">
                      Body + Legs combined
                    </Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="allMerged" id="merge-all" />
                    <Label htmlFor="merge-all" className="text-sm font-normal cursor-pointer">
                      Everything merged
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </>
          )}

          {/* File Preview */}
          <Separator />
          
          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">Files to generate</Label>
            <div className="flex flex-wrap gap-1.5">
              {filePreview.map((file, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 bg-muted rounded text-xs font-mono"
                >
                  {file}
                </span>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={onClose} disabled={isExporting}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={!canExport || isExporting}>
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Export ZIP
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ExportOptionsDialog;
