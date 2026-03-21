import { describe, it, expect } from 'vitest';
import { render } from '@solidjs/testing-library';

describe('PrivacyPolicy', () => {
  it('renders the privacy policy heading', async () => {
    const { default: PrivacyPolicy } = await import('../PrivacyPolicy');
    const { getByText } = render(() => <PrivacyPolicy />);
    expect(getByText('Privacy Policy')).toBeTruthy();
  });

  it('contains data deletion section', async () => {
    const { default: PrivacyPolicy } = await import('../PrivacyPolicy');
    const { getByText } = render(() => <PrivacyPolicy />);
    expect(getByText('Data Retention & Deletion')).toBeTruthy();
  });

  it('contains changes to policy section', async () => {
    const { default: PrivacyPolicy } = await import('../PrivacyPolicy');
    const { getByText } = render(() => <PrivacyPolicy />);
    expect(getByText('Changes to This Policy')).toBeTruthy();
  });

  it('contains contact email', async () => {
    const { default: PrivacyPolicy } = await import('../PrivacyPolicy');
    const { container } = render(() => <PrivacyPolicy />);
    expect(container.innerHTML).toContain('privacy@picklescore.co');
  });
});
