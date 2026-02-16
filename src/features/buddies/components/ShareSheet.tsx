import { Show, createSignal } from 'solid-js';
import type { Component } from 'solid-js';

interface ShareSheetProps {
  url: string;
  text: string;
  onClose: () => void;
}

const ShareSheet: Component<ShareSheetProps> = (props) => {
  const [copied, setCopied] = createSignal(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(props.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    const encoded = encodeURIComponent(`${props.text}\n${props.url}`);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  const handleNativeShare = async () => {
    try {
      await navigator.share({ title: props.text, url: props.url });
    } catch {
      // User cancelled or not supported
    }
  };

  const canNativeShare = () => typeof navigator.share === 'function';

  return (
    <div class="fixed inset-0 z-50 flex items-end justify-center" onClick={() => props.onClose()}>
      {/* Backdrop */}
      <div class="absolute inset-0 bg-black/50" />

      {/* Sheet */}
      <div class="relative w-full max-w-lg bg-surface rounded-t-2xl p-6 pb-safe" onClick={(e) => e.stopPropagation()}>
        <div class="w-12 h-1 bg-surface-lighter rounded-full mx-auto mb-4" />
        <h3 class="text-lg font-bold text-on-surface mb-4">Share</h3>

        <div class="space-y-3">
          {/* Copy link */}
          <button onClick={handleCopy} class="w-full flex items-center gap-3 p-3 bg-surface-light rounded-xl active:scale-[0.98] transition-transform">
            <div class="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
              <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
            </div>
            <span class="font-medium text-on-surface">{copied() ? 'Copied!' : 'Copy link'}</span>
          </button>

          {/* WhatsApp */}
          <button onClick={handleWhatsApp} class="w-full flex items-center gap-3 p-3 bg-surface-light rounded-xl active:scale-[0.98] transition-transform">
            <div class="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
              <svg class="w-5 h-5 text-green-500" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" /></svg>
            </div>
            <span class="font-medium text-on-surface">Share to WhatsApp</span>
          </button>

          {/* Native share */}
          <Show when={canNativeShare()}>
            <button onClick={handleNativeShare} class="w-full flex items-center gap-3 p-3 bg-surface-light rounded-xl active:scale-[0.98] transition-transform">
              <div class="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
                <svg class="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
              </div>
              <span class="font-medium text-on-surface">More options</span>
            </button>
          </Show>
        </div>

        <button onClick={() => props.onClose()} class="w-full mt-4 p-3 text-on-surface-muted font-medium rounded-xl active:bg-surface-light transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
};

export default ShareSheet;
