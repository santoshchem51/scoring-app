import { Share } from '@capacitor/share';
import { IS_NATIVE } from '../platform/platform';

const SHARE_DATA = {
  title: 'PickleScore',
  text: 'Score your pickleball games with PickleScore!',
  url: 'https://picklescore.co',
};

export async function shareApp(): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (IS_NATIVE) {
      await Share.share(SHARE_DATA);
      return 'shared';
    }

    if (navigator.share) {
      await navigator.share(SHARE_DATA);
      return 'shared';
    }

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(
        'Score your pickleball games with PickleScore! https://picklescore.co'
      );
      return 'copied';
    }

    return 'failed';
  } catch {
    return 'failed';
  }
}
