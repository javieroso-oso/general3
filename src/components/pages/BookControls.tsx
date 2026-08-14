import { useState } from 'react';
import { BookParams, createEmptyPage, normalizeBookParams } from '@/types/pages';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, ChevronUp, ChevronDown, Book, BookOpen } from 'lucide-react';
import PageEditor from './PageEditor';
import { cn } from '@/lib/utils';

interface BookControlsProps {
  book: BookParams;
  onChange: (b: BookParams) => void;
}

const BookControls = ({ book: bookIn, onChange }: BookControlsProps) => {
  const book = normalizeBookParams(bookIn);
  const [activeIdx, setActiveIdx] = useState(0);
  const [coverTab, setCoverTab] = useState<'front' | 'back'>('front');
  const update = (patch: Partial<BookParams>) => onChange({ ...book, ...patch });


  const addPage = () => {
    const next = [...book.pages, createEmptyPage('text')];
    update({ pages: next });
    setActiveIdx(next.length - 1);
  };
  const removePage = (i: number) => {
    if (book.pages.length <= 1) return;
    const next = book.pages.filter((_, idx) => idx !== i);
    update({ pages: next });
    setActiveIdx(Math.min(activeIdx, next.length - 1));
  };
  const movePage = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= book.pages.length) return;
    const next = [...book.pages];
    [next[i], next[j]] = [next[j], next[i]];
    update({ pages: next });
    setActiveIdx(j);
  };

  const active = book.pages[activeIdx];

  return (
    <div className="space-y-4">
      {/* Book params */}
      <div className="space-y-3 p-3 rounded-lg bg-secondary/30">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Book className="w-4 h-4" /> Book
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Page width</Label>
            <Input type="number" min={20} max={200} value={book.pageWidth}
              onChange={(e) => update({ pageWidth: Number(e.target.value) })}
              className="h-8 text-xs mt-1" />
          </div>
          <div>
            <Label className="text-xs">Page height</Label>
            <Input type="number" min={20} max={250} value={book.pageHeight}
              onChange={(e) => update({ pageHeight: Number(e.target.value) })}
              className="h-8 text-xs mt-1" />
          </div>
        </div>
        <div>
          <div className="flex justify-between mb-1">
            <Label className="text-xs">Wall thickness</Label>
            <span className="text-xs text-muted-foreground">{book.pageThickness.toFixed(2)} mm</span>
          </div>
          <Slider value={[book.pageThickness]} min={0.4} max={1.6} step={0.02}
            onValueChange={([v]) => update({ pageThickness: v })} />
        </div>
        <div>
          <div className="flex justify-between mb-1">
            <Label className="text-xs">Page gap</Label>
            <span className="text-xs text-muted-foreground">{book.pageGap.toFixed(2)} mm</span>
          </div>
          <Slider value={[book.pageGap]} min={0} max={4} step={0.1}
            onValueChange={([v]) => update({ pageGap: v })} />
        </div>
        <div>
          <div className="flex justify-between mb-1">
            <Label className="text-xs">Spine height</Label>
            <span className="text-xs text-muted-foreground">{book.spineExtra.toFixed(1)} mm</span>
          </div>
          <Slider value={[book.spineExtra]} min={1.0} max={10} step={0.2}
            onValueChange={([v]) => update({ spineExtra: v })} />
        </div>
        <p className="text-[10px] leading-snug text-muted-foreground pt-1 border-t border-border/50">
          Pages print as single perimeters. In your slicer set <span className="font-medium">1 wall, 0% infill, 0 top/bottom layers</span>, spine flat on the bed.
        </p>
      </div>

      {/* Pages list */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-sm font-medium">Pages ({book.pages.length})</Label>
          <Button size="sm" variant="outline" onClick={addPage} className="h-7">
            <Plus className="w-3 h-3 mr-1" /> Add
          </Button>
        </div>
        <div className="flex flex-wrap gap-1 mb-3">
          {book.pages.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setActiveIdx(i)}
              className={cn(
                'px-2 py-1 text-xs rounded border transition-colors',
                i === activeIdx ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border hover:bg-secondary'
              )}
              title={p.type === 'text' ? p.text : 'Drawing'}
            >
              {i + 1}
            </button>
          ))}
        </div>

        {active && (
          <div className="space-y-3 p-3 rounded-lg border border-border/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">Page {activeIdx + 1}</span>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" className="h-6 w-6"
                  onClick={() => movePage(activeIdx, -1)} disabled={activeIdx === 0}>
                  <ChevronUp className="w-3 h-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6"
                  onClick={() => movePage(activeIdx, 1)} disabled={activeIdx === book.pages.length - 1}>
                  <ChevronDown className="w-3 h-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive"
                  onClick={() => removePage(activeIdx)} disabled={book.pages.length <= 1}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
            <PageEditor
              page={active}
              pageWidthMm={book.pageWidth}
              pageHeightMm={book.pageHeight}
              onChange={(p) => {
                const next = [...book.pages];
                next[activeIdx] = p;
                update({ pages: next });
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default BookControls;
