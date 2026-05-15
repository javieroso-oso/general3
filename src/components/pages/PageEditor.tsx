import { useRef } from 'react';
import { PageContent } from '@/types/pages';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Upload, X } from 'lucide-react';
import PageDrawCanvas from './PageDrawCanvas';

interface PageEditorProps {
  page: PageContent;
  pageWidthMm: number;
  pageHeightMm: number;
  onChange: (p: PageContent) => void;
}

const PageEditor = ({ page, pageWidthMm, pageHeightMm, onChange }: PageEditorProps) => {
  const update = (patch: Partial<PageContent>) => onChange({ ...page, ...patch });

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Select value={page.type} onValueChange={(v) => update({ type: v as any })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="text" className="text-xs">Text</SelectItem>
            <SelectItem value="drawing" className="text-xs">Drawing</SelectItem>
          </SelectContent>
        </Select>
        <Select value={page.faces} onValueChange={(v) => update({ faces: v as any })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="front" className="text-xs">Front only</SelectItem>
            <SelectItem value="back" className="text-xs">Back only</SelectItem>
            <SelectItem value="both" className="text-xs">Both faces</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {page.type === 'text' ? (
        <>
          <div>
            <Label className="text-xs">Text</Label>
            <Textarea
              value={page.text ?? ''}
              onChange={(e) => update({ text: e.target.value })}
              rows={3}
              className="text-sm mt-1"
              placeholder="Type text…"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Font size (mm)</Label>
              <Input
                type="number"
                min={4}
                max={80}
                value={page.fontSize ?? 18}
                onChange={(e) => update({ fontSize: Number(e.target.value) })}
                className="h-8 text-xs mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Align</Label>
              <Select value={page.align ?? 'center'} onValueChange={(v) => update({ align: v as any })}>
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="left" className="text-xs">Left</SelectItem>
                  <SelectItem value="center" className="text-xs">Center</SelectItem>
                  <SelectItem value="right" className="text-xs">Right</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </>
      ) : (
        <div>
          <Label className="text-xs mb-1 block">Drawing</Label>
          <PageDrawCanvas
            strokes={page.drawing?.strokes ?? []}
            onChange={(s) => update({ drawing: { strokes: s } })}
            pageWidthMm={pageWidthMm}
            pageHeightMm={pageHeightMm}
          />
        </div>
      )}

      <div>
        <div className="flex justify-between mb-1">
          <Label className="text-xs">Relief height</Label>
          <span className="text-xs text-muted-foreground">{page.reliefHeight.toFixed(2)} mm</span>
        </div>
        <Slider
          value={[page.reliefHeight]}
          min={0.2}
          max={1.5}
          step={0.05}
          onValueChange={([v]) => update({ reliefHeight: v })}
        />
      </div>
    </div>
  );
};

export default PageEditor;
