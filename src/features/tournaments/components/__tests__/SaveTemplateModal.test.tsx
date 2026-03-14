import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import SaveTemplateModal from '../SaveTemplateModal';

describe('SaveTemplateModal', () => {
  it('renders name input and save button', () => {
    render(() => <SaveTemplateModal onSave={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByPlaceholderText('Template name')).toBeTruthy();
    expect(screen.getByText('Save')).toBeTruthy();
  });

  it('calls onSave with name and description', async () => {
    const onSave = vi.fn();
    render(() => <SaveTemplateModal onSave={onSave} onClose={vi.fn()} />);
    const nameInput = screen.getByPlaceholderText('Template name');
    const descInput = screen.getByPlaceholderText('Description (optional)');
    await fireEvent.input(nameInput, { target: { value: 'My Template' } });
    await fireEvent.input(descInput, { target: { value: 'A nice template' } });
    await fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledWith('My Template', 'A nice template');
  });

  it('does not submit with empty name', async () => {
    const onSave = vi.fn();
    render(() => <SaveTemplateModal onSave={onSave} onClose={vi.fn()} />);
    await fireEvent.click(screen.getByText('Save'));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('shows error when name exceeds 50 chars', async () => {
    const onSave = vi.fn();
    render(() => <SaveTemplateModal onSave={onSave} onClose={vi.fn()} />);
    const nameInput = screen.getByPlaceholderText('Template name');
    const longName = 'A'.repeat(51);
    await fireEvent.input(nameInput, { target: { value: longName } });
    await fireEvent.click(screen.getByText('Save'));
    expect(screen.getByText('Name must be 50 characters or less')).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('calls onClose when cancel clicked', async () => {
    const onClose = vi.fn();
    render(() => <SaveTemplateModal onSave={vi.fn()} onClose={onClose} />);
    await fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });
});
