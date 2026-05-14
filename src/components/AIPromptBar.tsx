import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ParametricParams } from '@/types/parametric';

interface AIPromptBarProps {
  currentParams: ParametricParams;
  onApply: (next: ParametricParams) => void;
}

const EXAMPLES = [
  'tall narrow vase with a flared lip',
  'fat round belly, pinched neck, organic',
  'three stacked spheres like a snowman',
  'twisted hourglass with subtle ridges',
];

const AIPromptBar = ({ currentParams, onApply }: AIPromptBarProps) => {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  const run = async (text: string) => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-shape-prompt', {
        body: { prompt: text },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const aiParams = data?.params ?? {};
      const { rationale, ...paramOnly } = aiParams;
      // Merge with current to keep stand/print/material settings intact
      onApply({ ...currentParams, ...paramOnly });
      toast.success('Shape generated', { description: rationale ?? 'Applied AI suggestion' });
      setOpen(false);
      setPrompt('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'AI request failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 rounded-full bg-card/80 backdrop-blur border-border/50 h-8"
        >
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span className="hidden sm:inline">Describe</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[340px] p-3" align="end" sideOffset={8}>
        <div className="space-y-2">
          <div className="text-xs font-medium text-foreground">Describe the shape you want</div>
          <form
            onSubmit={(e) => { e.preventDefault(); run(prompt); }}
            className="flex gap-2"
          >
            <Input
              autoFocus
              placeholder="e.g. tall vase with flared lip"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={loading}
              className="text-xs h-8"
            />
            <Button type="submit" size="sm" disabled={loading || !prompt.trim()} className="h-8">
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Go'}
            </Button>
          </form>
          <div className="space-y-1 pt-1">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Try</div>
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => { setPrompt(ex); run(ex); }}
                disabled={loading}
                className="block w-full text-left text-xs px-2 py-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default AIPromptBar;
