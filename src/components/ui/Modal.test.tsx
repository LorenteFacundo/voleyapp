import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from './Modal';

describe('Modal', () => {
  it('Escape cierra solo el diálogo de arriba y el scroll vuelve al cerrar el último', async () => {
    const usuario = userEvent.setup({ delay: null });
    const cerrarFicha = vi.fn();
    const cerrarConfirmacion = vi.fn();
    const { rerender } = render(
      <>
        <Modal open onClose={cerrarFicha} title="Ficha"><button type="button">Archivar</button></Modal>
        <Modal open onClose={cerrarConfirmacion} title="¿Archivar?"><button type="button">Sí</button></Modal>
      </>,
    );
    expect(document.body.style.overflow).toBe('hidden');

    await usuario.keyboard('{Escape}');
    expect(cerrarConfirmacion).toHaveBeenCalledTimes(1);
    expect(cerrarFicha).not.toHaveBeenCalled();

    rerender(
      <>
        <Modal open onClose={cerrarFicha} title="Ficha"><button type="button">Archivar</button></Modal>
        <Modal open={false} onClose={cerrarConfirmacion} title="¿Archivar?"><button type="button">Sí</button></Modal>
      </>,
    );
    expect(document.body.style.overflow).toBe('hidden');
    await usuario.keyboard('{Escape}');
    expect(cerrarFicha).toHaveBeenCalledTimes(1);

    rerender(<Modal open={false} onClose={cerrarFicha} title="Ficha">-</Modal>);
    expect(document.body.style.overflow).toBe('');
  });

  it('mientras está bloqueado, Escape no cierra', async () => {
    const usuario = userEvent.setup({ delay: null });
    const cerrar = vi.fn();
    render(<Modal open bloqueado onClose={cerrar} title="Guardando">-</Modal>);
    await usuario.keyboard('{Escape}');
    expect(cerrar).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Guardando' })).toBeInTheDocument();
  });
});
