import { render, screen } from '@solidjs/testing-library';
import { describe, it, expect } from 'vitest';
import StatusAvatar from '../StatusAvatar';

describe('StatusAvatar', () => {
  it('renders initial letter from displayName', () => {
    render(() => (
      <StatusAvatar
        displayName="Alice"
        photoURL={null}
        response="in"
        dayOfStatus="none"
      />
    ));
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('applies correct ring color for "here" status (emerald)', () => {
    const { container } = render(() => (
      <StatusAvatar
        displayName="Bob"
        photoURL={null}
        response="in"
        dayOfStatus="here"
      />
    ));
    const avatarDiv = container.querySelector('.ring-emerald-500');
    expect(avatarDiv).toBeInTheDocument();
  });

  it('applies correct ring color for "on-my-way" status (blue)', () => {
    const { container } = render(() => (
      <StatusAvatar
        displayName="Carol"
        photoURL={null}
        response="in"
        dayOfStatus="on-my-way"
      />
    ));
    const avatarDiv = container.querySelector('.ring-blue-500');
    expect(avatarDiv).toBeInTheDocument();
  });

  it('applies opacity-50 for "out" response', () => {
    const { container } = render(() => (
      <StatusAvatar
        displayName="Dave"
        photoURL={null}
        response="out"
        dayOfStatus="none"
      />
    ));
    const wrapper = container.querySelector('.opacity-50');
    expect(wrapper).toBeInTheDocument();
  });

  it('renders img when photoURL is provided', () => {
    render(() => (
      <StatusAvatar
        displayName="Eve"
        photoURL="https://example.com/photo.jpg"
        response="in"
        dayOfStatus="none"
      />
    ));
    const img = screen.getByAltText('Eve');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/photo.jpg');
  });

  it('default size is "md" (w-10 h-10)', () => {
    const { container } = render(() => (
      <StatusAvatar
        displayName="Frank"
        photoURL={null}
        response="in"
        dayOfStatus="none"
      />
    ));
    const avatarDiv = container.querySelector('.w-10');
    expect(avatarDiv).toBeInTheDocument();
  });
});
