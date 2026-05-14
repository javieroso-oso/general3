import { useState } from 'react';
import { Share2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ParametricParams, ObjectType } from '@/types/parametric';
import { toast } from 'sonner';

interface ShareButtonProps {
  params: ParametricParams;
  type: ObjectType;
}

/** Builds a shareable URL that, when opened, restores the same shape. */
export function buildShareUrl(params: ParametricParams, type: ObjectType): string {
  const encoded = encodeURIComponent(JSON.stringify(params));
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}?type=${type}&params=${encoded}`;
}

const ShareButton = ({ params, type }: ShareButtonProps) => {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = buildShareUrl(params, type);
    try {
      // Prefer native share on mobile
      if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
        await navigator.share({ title: 'general3 shape', url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Share link copied to clipboard');
      setTimeout(() => setCopied(false), 1800);
    } catch (e) {
      // User cancelled share or clipboard blocked – fall back to prompt
      window.prompt('Copy this link:', url);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={share}
      className="gap-1.5 rounded-full bg-card/80 backdrop-blur border-border/50 h-8"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Share2 className="w-3.5 h-3.5" />}
      <span className="hidden sm:inline">{copied ? 'Copied' : 'Share'}</span>
    </Button>
  );
};

export default ShareButton;
