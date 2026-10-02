import { describe, expect, it } from 'vitest';
import { coincideEmailEnmascarado, enlaceInvitacion, mensajeInvitacion, vencimientoInvitacion } from './equipo';

describe('invitaciones al equipo', () => {
  it('arma el enlace de la invitación', () => {
    expect(enlaceInvitacion('abc123', 'https://voley.app')).toBe('https://voley.app/invitacion/abc123');
  });

  it('arma el mensaje para compartir', () => {
    const mensaje = mensajeInvitacion(
      { email: 'ana@mail.com', rol: 'encargado', expira_at: '2026-10-08T15:00:00.000Z' },
      'Club Sur',
      'https://voley.app/invitacion/abc',
    );
    expect(mensaje).toContain('equipo de Club Sur en VoleyApp como encargado');
    expect(mensaje).toContain('ana@mail.com');
    expect(mensaje).toContain('https://voley.app/invitacion/abc');
    expect(mensaje).toMatch(/vence el jueves,? 8 de octubre\)\.$/);
  });

  it('muestra el vencimiento en hora argentina', () => {
    expect(vencimientoInvitacion('2026-10-09T02:00:00.000Z')).toMatch(/^jueves,? 8 de octubre$/);
  });

  it('compara el email con la versión enmascarada', () => {
    expect(coincideEmailEnmascarado('a•••@mail.com', 'Ana@Mail.com')).toBe(true);
    expect(coincideEmailEnmascarado('a•••@mail.com', 'bruno@mail.com')).toBe(false);
    expect(coincideEmailEnmascarado('a•••@mail.com', 'ana@otro.com')).toBe(false);
    expect(coincideEmailEnmascarado(undefined, 'ana@mail.com')).toBeNull();
    expect(coincideEmailEnmascarado('formato raro', 'ana@mail.com')).toBeNull();
  });
});
