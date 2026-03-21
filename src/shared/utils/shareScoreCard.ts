import type { Match } from '../../data/types';
import { renderScoreCard } from './renderScoreCard';
import { IS_NATIVE } from '../platform/platform';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';

export async function shareScoreCard(match: Match): Promise<'shared' | 'copied' | 'downloaded' | 'failed'> {
  const canvas = renderScoreCard(match);

  try {
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas toBlob failed'))), 'image/png');
    });

    const fileName = `picklescore-${match.id.slice(0, 8)}.png`;
    const file = new File([blob], fileName, { type: 'image/png' });

    if (IS_NATIVE) {
      const dataUrl = canvas.toDataURL('image/png');
      const base64 = dataUrl.split(',')[1];

      const result = await Filesystem.writeFile({
        path: fileName,
        data: base64,
        directory: Directory.Cache,
      });

      await Share.share({
        title: 'PickleScore Result',
        text: 'Check out my pickleball score!',
        files: [result.uri],
      });
      return 'shared';
    }

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
