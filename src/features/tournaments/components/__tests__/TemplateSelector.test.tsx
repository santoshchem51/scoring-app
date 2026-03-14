import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import type { TournamentTemplate } from '../../engine/templateTypes';
import TemplateSelector from '../TemplateSelector';

function makeTemplate(overrides: Partial<TournamentTemplate> = {}): TournamentTemplate {
  return {
    id: 'tpl-1',
    name: 'Weekend Doubles',
    description: 'A casual doubles tournament',
    format: 'round-robin',
    gameType: 'doubles',
    config: {
      gameType: 'doubles',
      scoringMode: 'rally',
      matchFormat: 'best-of-3',
      pointsToWin: 11,
      poolCount: 1,
      teamsPerPoolAdvancing: 2,
    },
    teamFormation: 'byop',
    maxPlayers: 16,
    accessMode: 'open',
    rules: {
      registrationDeadline: null,
      checkInRequired: false,
      checkInOpens: null,
      checkInCloses: null,
      scoringRules: '',
      timeoutRules: '',
      conductRules: '',
      penalties: [],
      additionalNotes: '',
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    usageCount: 3,
    ...overrides,
  };
}

describe('TemplateSelector', () => {
  it('renders dropdown with "From Template" button', () => {
    const templates = [makeTemplate()];
    render(() => <TemplateSelector templates={templates} onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: /from template/i })).toBeTruthy();
  });

  it('calls onSelect with template when selected', async () => {
    const tpl = makeTemplate({ id: 'tpl-2', name: 'League Night' });
    const onSelect = vi.fn();
    render(() => <TemplateSelector templates={[tpl]} onSelect={onSelect} />);

    // Open dropdown
    fireEvent.click(screen.getByRole('button', { name: /from template/i }));
    // Click the template
    fireEvent.click(screen.getByText('League Night'));

    expect(onSelect).toHaveBeenCalledWith(tpl);
  });

  it('renders empty state when no templates', () => {
    render(() => <TemplateSelector templates={[]} onSelect={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /from template/i }));
    expect(screen.getByText(/no templates/i)).toBeTruthy();
  });

  // TODO: No click-outside-to-close behavior implemented yet
  it('does not close dropdown on outside click (no click-outside handler)', async () => {
    const templates = [makeTemplate()];
    render(() => (
      <div>
        <span data-testid="outside">Outside</span>
        <TemplateSelector templates={templates} onSelect={vi.fn()} />
      </div>
    ));

    // Open dropdown
    fireEvent.click(screen.getByRole('button', { name: /from template/i }));
    expect(screen.getByRole('listbox')).toBeTruthy();

    // Click outside — dropdown remains open since no click-outside handler exists
    fireEvent.click(screen.getByTestId('outside'));
    expect(screen.getByRole('listbox')).toBeTruthy();
  });
});
