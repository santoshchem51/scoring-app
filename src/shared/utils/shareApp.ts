import { Share } from '@capacitor/share';
import { IS_NATIVE } from '../platform/platform';

const SHARE_DATA = {
  title: 'PickleScore',
  text: 'Score your pickleball games with PickleScore!',
  url: 'https://picklescore.co',
};

export async function shareApp(): Promise<void> {
  if (IS_NATIVE) {
    await Share.share(SHARE_DATA).catch(() => {});
    return;
  }

  if (navigator.share) {
    await navigator.share(SHARE_DATA).catch(() => {});
    return;
  }

  await navigator.clipboard.writeText(
    'Score your pickleball games with PickleScore! https://picklescore.co'
  ).catch(() => {});
}
