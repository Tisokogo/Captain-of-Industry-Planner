import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from './Modal';

describe('Modal accessibility', () => {
  it('traps keyboard focus, closes with Escape, and restores the trigger focus', () => {
    const close = vi.fn();
    const trigger = document.createElement('button');
    document.body.append(trigger);
    trigger.focus();

    const { unmount } = render(
      <Modal title="Test dialog" close={close}>
        <button>First action</button>
        <button>Last action</button>
      </Modal>
    );

    const dialog = screen.getByRole('dialog', { name: 'Test dialog' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const closeButton = screen.getByRole('button', { name: 'Close: Test dialog' });
    const lastButton = screen.getByRole('button', { name: 'Last action' });
    expect(closeButton).toHaveFocus();

    lastButton.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(close).toHaveBeenCalledOnce();
    unmount();
    expect(trigger).toHaveFocus();
    trigger.remove();
  });
});
