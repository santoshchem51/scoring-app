import { describe, it, expect } from 'vitest';
import { render, screen } from '@solidjs/testing-library';

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

  it('contains Sentry disclosure', async () => {
    const { default: PrivacyPolicy } = await import('../PrivacyPolicy');
    const { container } = render(() => <PrivacyPolicy />);
    expect(container.innerHTML).toContain('Sentry');
    expect(container.innerHTML).toContain('sentry.io/privacy');
  });

  it('contains Firebase Analytics disclosure', async () => {
    const { default: PrivacyPolicy } = await import('../PrivacyPolicy');
    const { container } = render(() => <PrivacyPolicy />);
    expect(container.innerHTML).toContain('Firebase Analytics');
    expect(container.innerHTML).toContain('De-identified usage data');
  });

  it('contains Cookies & Local Storage section', async () => {
    const { default: PrivacyPolicy } = await import('../PrivacyPolicy');
    const { getByText } = render(() => <PrivacyPolicy />);
    expect(getByText('Cookies & Local Storage')).toBeTruthy();
  });

  it('contains Operational Logs section', async () => {
    const { default: PrivacyPolicy } = await import('../PrivacyPolicy');
    const { getByText } = render(() => <PrivacyPolicy />);
    expect(getByText('Operational Logs')).toBeTruthy();
  });

  it('renders Your Rights section', async () => {
    const { default: PrivacyPolicy } = await import('../PrivacyPolicy');
    render(() => <PrivacyPolicy />);
    expect(screen.getByText('Your Rights')).toBeTruthy();
  });
});
