import { Share2, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';

type Props = {
  token: string;
  clubNombre: string;
  fecha: string;
  horaInicio: string;
};

export function ShareButton({ token, clubNombre, fecha, horaInicio }: Props) {
  const [copied, setCopied] = useState(false);

  const shareUrl = `${window.location.origin}/partido/invitar/${token}`;
  const shareText = `¡Te invito a jugar vóley! ${clubNombre} - ${fecha} ${horaInicio}`;

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'VoleyApp', text: shareText, url: shareUrl });
      } catch {
        // User cancelled
      }
    } else {
      await handleCopy();
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('Link copiado al portapapeles');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('No se pudo copiar el link');
    }
  }

  return (
    <Button variant="secondary" size="sm" onClick={handleShare}>
      {copied ? <Check size={16} /> : <Share2 size={16} />}
      {copied ? 'Copiado' : 'Compartir'}
    </Button>
  );
}
