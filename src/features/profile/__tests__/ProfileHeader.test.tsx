import { describe, it, expect } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import ProfileHeader from '../components/ProfileHeader';

function renderHeader(overrides: Record<string, unknown> = {}) {
  const defaults = {
    displayName: 'Alice Johnson',
    email: 'alice@example.com',
    photoURL: null as string | null,
    createdAt: new Date('2024-03-15T12:00:00Z').getTime(),
    hasStats: false,
  };
  return render(() => <ProfileHeader {...{ ...defaults, ...overrides }} />);
}

describe('ProfileHeader', () => {
  it('displays display name in heading', () => {
    renderHeader();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Alice Johnson');
  });

  it('displays email', () => {
    renderHeader();
    expect(screen.getByText('alice@example.com')).toBeTruthy();
  });

  it('formats "Member since" correctly', () => {
    renderHeader({ createdAt: new Date('2024-03-15T12:00:00Z').getTime() });
    expect(screen.getByText(/Member since Mar 2024/)).toBeTruthy();
  });

  it('shows initials avatar when photoURL is null', () => {
    renderHeader({ photoURL: null });
    expect(screen.getByText('A')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('shows initials avatar for non-HTTPS photo URL', () => {
    renderHeader({ photoURL: 'http://lh3.googleusercontent.com/photo.jpg' });
    expect(screen.getByText('A')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('shows initials avatar for non-Google domain', () => {
    renderHeader({ photoURL: 'https://evil.com/photo.jpg' });
    expect(screen.getByText('A')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('shows initials avatar for malformed URL', () => {
    renderHeader({ photoURL: 'not-a-url' });
    expect(screen.getByText('A')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('shows initials avatar for empty string URL', () => {
    renderHeader({ photoURL: '' });
    expect(screen.getByText('A')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('shows <img> for valid Google photo URL', () => {
    renderHeader({ photoURL: 'https://lh3.googleusercontent.com/a/photo123' });
    const img = screen.getByRole('img');
    expect(img).toBeTruthy();
    expect(img.getAttribute('alt')).toBe('Profile photo of Alice Johnson');
  });

  it('shows empty initial when displayName is empty string', () => {
    // Component uses `props.displayName?.charAt(0) ?? '?'`
    // For empty string, charAt(0) returns '' which is not nullish,
    // so ?? does not trigger and the avatar renders with no text.
    const { container } = renderHeader({ displayName: '' });
    const avatarDiv = container.querySelector('.bg-primary');
    expect(avatarDiv).toBeTruthy();
    expect(avatarDiv!.textContent).toBe('');
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('shows tier badge when hasStats is true', () => {
    renderHeader({ hasStats: true, tier: 'intermediate', tierConfidence: 'medium' });
    expect(screen.getByLabelText(/Skill tier: intermediate/)).toBeTruthy();
  });

  it('hides tier badge when hasStats is false', () => {
    renderHeader({ hasStats: false, tier: 'intermediate', tierConfidence: 'medium' });
    expect(screen.queryByLabelText(/Skill tier/)).toBeNull();
  });
});
