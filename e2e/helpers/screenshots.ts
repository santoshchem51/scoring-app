import type { Page, Locator, TestInfo } from '@playwright/test';
import { expect } from '@playwright/test';

type ScreenshotMode = 'attach' | 'compare';

export async function captureScreen(
  page: Page,
  testInfo: TestInfo,
  name: string,
  options?: {
    fullPage?: boolean;
    locator?: Locator;
    mode?: ScreenshotMode;
    threshold?: number;
  },
) {
  const target = options?.locator ?? page;
  const mode = options?.mode ?? 'attach';

  if (mode === 'compare') {
    await expect(target).toHaveScreenshot(`${name}.png`, {
      fullPage: options?.fullPage ?? false,
      animations: 'disabled',
      maxDiffPixelRatio: options?.threshold ?? 0.01,
    });
  } else {
    await testInfo.attach(name, {
      body: await (options?.locator
        ? options.locator.screenshot({ animations: 'disabled' })
        : page.screenshot({
            fullPage: options?.fullPage ?? false,
            animations: 'disabled',
          })),
      contentType: 'image/png',
    });
  }
}
