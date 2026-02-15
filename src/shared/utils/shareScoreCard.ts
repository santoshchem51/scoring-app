import type { Match } from '../../data/types';
import { renderScoreCard } from './renderScoreCard';

export async function shareScoreCard(match: Match): Promise<'shared' | 'copied' | 'downloaded' | 'failed'> {
  const canvas = renderScoreCard(match);

  try {
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas toBlob failed'))), 'image/png');
    });

    const file = new File([blob], `picklescore-${match.id.slice(0, 8)}.png`, { type: 'image/png' });

    // Try Web Share API
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        title: 'PickleScore Result',
        files: [file],
      });
      return 'shared';
    }

    // Fallback: clipboard
    if (navigator.clipboard?.write) {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ]);
        return 'copied';
      } catch {
        // Clipboard failed, try download
      }
    }

    // Fallback: download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
    return 'downloaded';
  } catch {
    return 'failed';
  }
}
