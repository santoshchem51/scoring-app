import { createSignal, createEffect, Show } from 'solid-js';
import type { Component } from 'solid-js';
import type { TournamentAccessMode } from '../../../data/types';
import QRCode from 'qrcode';
import PlayerSearch from './PlayerSearch';

interface Props {
  open: boolean;
  tournamentId: string;
  tournamentName: string;
  tournamentDate: string;
  tournamentLocation: string;
  accessMode: TournamentAccessMode;
  buddyGroupName: string | null;
  shareCode: string | null;
  organizerId: string;
  registeredUserIds: string[];
  onClose: () => void;
}

const ShareTournamentModal: Component<Props> = (props) => {
  const [qrDataUrl, setQrDataUrl] = createSignal('');
  const [copied, setCopied] = createSignal(false);

  const shareUrl = () => {
    if (!props.shareCode) return '';
    return `${window.location.origin}/t/${props.shareCode}`;
  };

  const helpText = () => {
    const mode = props.accessMode ?? 'open';
    if (mode === 'open') return 'Anyone with this link can join immediately.';
    if (mode === 'approval') return "Anyone with this link can request to join. You'll approve each one.";
    if (mode === 'invite-only') return 'Only players you invite can join. Others will see this is invite-only.';
    if (mode === 'group') return `Only members of ${props.buddyGroupName ?? 'the group'} can join.`;
    return '';
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
            {/* Section 1: Access Mode Info */}
            <div class="bg-surface-light rounded-lg p-3 text-sm text-on-surface-muted">
              {helpText()}
            </div>

            {/* Section 2: Shareable Link */}
            <Show when={shareUrl()}>
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

            {/* Section 3: QR Code */}
            <Show when={qrDataUrl()}>
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

            {/* Section 4: Invite Player */}
            <Show when={shareUrl()}>
              <PlayerSearch
                tournamentId={props.tournamentId}
                tournamentName={props.tournamentName}
                tournamentDate={props.tournamentDate}
                tournamentLocation={props.tournamentLocation}
                organizerId={props.organizerId}
                registeredUserIds={props.registeredUserIds}
                shareUrl={shareUrl()}
              />
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
