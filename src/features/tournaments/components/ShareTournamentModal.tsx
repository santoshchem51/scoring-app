import { createSignal, createEffect, Show } from 'solid-js';
import type { Component } from 'solid-js';
import QRCode from 'qrcode';

interface Props {
  open: boolean;
  tournamentName: string;
  tournamentDate: string;
  tournamentLocation: string;
  visibility: 'private' | 'public';
  shareCode: string | null;
  onToggleVisibility: (newVisibility: 'private' | 'public') => Promise<void>;
  onClose: () => void;
}

const ShareTournamentModal: Component<Props> = (props) => {
  const [qrDataUrl, setQrDataUrl] = createSignal('');
  const [copied, setCopied] = createSignal(false);
  const [toggling, setToggling] = createSignal(false);
  const [email, setEmail] = createSignal('');

  const shareUrl = () => {
    if (!props.shareCode) return '';
    return `${window.location.origin}/t/${props.shareCode}`;
  };

  // Generate QR code when share URL is available
  createEffect(async () => {
    const url = shareUrl();
    if (url) {
      try {
        const dataUrl = await QRCode.toDataURL(url, { width: 200, margin: 2 });
        setQrDataUrl(dataUrl);
      } catch {
        setQrDataUrl('');
      }
    } else {
      setQrDataUrl('');
    }
  });

  const handleToggleVisibility = async () => {
    if (toggling()) return;
    setToggling(true);
    try {
      const newVisibility = props.visibility === 'private' ? 'public' : 'private';
      await props.onToggleVisibility(newVisibility);
    } finally {
      setToggling(false);
    }
  };

  const handleCopyLink = async () => {
    const url = shareUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: user can manually select text
    }
  };

  const handleDownloadQr = () => {
    const dataUrl = qrDataUrl();
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.download = `${props.tournamentName.replace(/\s+/g, '-')}-qr.png`;
    link.href = dataUrl;
    link.click();
  };

  const mailtoHref = () => {
    const addr = email().trim();
    if (!addr) return '';
    const subject = encodeURIComponent(`You're invited to ${props.tournamentName}`);
    const body = encodeURIComponent(
      `Join ${props.tournamentName} on ${props.tournamentDate} at ${props.tournamentLocation}.\n\nView tournament: ${shareUrl()}`,
    );
    return `mailto:${addr}?subject=${subject}&body=${body}`;
  };

  return (
    <Show when={props.open}>
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div class="bg-surface rounded-2xl w-full max-w-sm overflow-hidden max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div class="px-4 py-3 bg-surface-light border-b border-surface-lighter flex items-center justify-between">
            <h2 class="font-bold text-on-surface text-sm">Share Tournament</h2>
            <button type="button" onClick={() => props.onClose()} class="text-on-surface-muted text-lg leading-none">&times;</button>
          </div>

          <div class="p-4 space-y-5">
            {/* Section 1: Visibility Toggle */}
            <div>
              <div class="text-xs font-semibold text-on-surface-muted uppercase tracking-wider mb-2">Visibility</div>
              <button
                type="button"
                onClick={handleToggleVisibility}
                disabled={toggling()}
                class="w-full flex items-center justify-between bg-surface-light rounded-xl px-4 py-3"
              >
                <span class="text-on-surface font-semibold text-sm">
                  {props.visibility === 'public' ? 'Public' : 'Private'}
                </span>
                <span class={`text-xs px-2 py-1 rounded-full font-semibold ${
                  props.visibility === 'public'
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-gray-500/20 text-gray-400'
                }`}>
                  {props.visibility === 'public' ? 'Anyone with link can view' : 'Only you can see'}
                </span>
              </button>
            </div>

            {/* Section 2: Shareable Link (only when public) */}
            <Show when={props.visibility === 'public' && shareUrl()}>
              <div>
                <div class="text-xs font-semibold text-on-surface-muted uppercase tracking-wider mb-2">Share Link</div>
                <div class="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl()}
                    class="flex-1 bg-surface-light border border-surface-lighter rounded-lg px-3 py-2 text-on-surface text-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    class={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                      copied()
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-primary text-surface active:scale-95'
                    }`}
                  >
                    {copied() ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            </Show>

            {/* Section 3: QR Code (only when public) */}
            <Show when={props.visibility === 'public' && qrDataUrl()}>
              <div>
                <div class="text-xs font-semibold text-on-surface-muted uppercase tracking-wider mb-2">QR Code</div>
                <div class="flex flex-col items-center gap-3">
                  <img src={qrDataUrl()} alt="Tournament QR Code" class="w-48 h-48 rounded-lg bg-white p-2" />
                  <button
                    type="button"
                    onClick={handleDownloadQr}
                    class="text-xs font-semibold text-primary underline"
                  >
                    Download PNG
                  </button>
                </div>
              </div>
            </Show>

            {/* Section 4: Email Invite (only when public) */}
            <Show when={props.visibility === 'public' && shareUrl()}>
              <div>
                <div class="text-xs font-semibold text-on-surface-muted uppercase tracking-wider mb-2">Invite by Email</div>
                <div class="flex gap-2">
                  <input
                    type="email"
                    value={email()}
                    onInput={(e) => setEmail(e.currentTarget.value)}
                    placeholder="player@example.com"
                    class="flex-1 bg-surface-light border border-surface-lighter rounded-lg px-3 py-2 text-on-surface text-sm"
                  />
                  <a
                    href={mailtoHref() || undefined}
                    class={`px-3 py-2 text-xs font-semibold rounded-lg inline-flex items-center ${
                      mailtoHref()
                        ? 'bg-primary text-surface active:scale-95'
                        : 'bg-surface-light text-on-surface-muted cursor-not-allowed'
                    }`}
                    onClick={(e) => { if (!mailtoHref()) e.preventDefault(); }}
                  >
                    Send
                  </a>
                </div>
              </div>
            </Show>
          </div>

          {/* Footer */}
          <div class="px-4 py-3 border-t border-surface-lighter">
            <button
              type="button"
              onClick={() => props.onClose()}
              class="w-full py-2 text-sm font-semibold text-on-surface-muted bg-surface-light rounded-lg active:scale-95 transition-transform"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
};

export default ShareTournamentModal;
