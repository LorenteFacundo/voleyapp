import { describe, expect, it } from 'vitest';
import {
  contactoLead, etiquetaAccion, etiquetaRolGlobal, fechaCorta, permisoCambioRol, textoBuscable,
} from './etiquetas';

describe('roles globales', () => {
  const admin = { id: 'a', es_superadmin: false };
  const superadmin = { id: 's', es_superadmin: true };

  it('nadie cambia su propio rol', () => {
    expect(permisoCambioRol(admin, { id: 'a', rol: 'admin_global' })).toMatchObject({ editable: false, motivo: 'No podés cambiar tu propio rol.' });
    expect(permisoCambioRol(superadmin, { id: 's', rol: 'superadmin' }).editable).toBe(false);
  });

  it('solo un superadmin toca roles de administración', () => {
    expect(permisoCambioRol(admin, { id: 'x', rol: 'admin_global' }).editable).toBe(false);
    expect(permisoCambioRol(admin, { id: 'x', rol: 'jugador' })).toEqual({ editable: true, motivo: null, bloqueados: ['admin_global', 'superadmin'] });
    expect(permisoCambioRol(superadmin, { id: 'x', rol: 'admin_global' })).toEqual({ editable: true, motivo: null, bloqueados: [] });
  });

  it('sin sesión no se puede editar', () => {
    expect(permisoCambioRol(null, { id: 'x', rol: 'jugador' }).editable).toBe(false);
  });

  it('tiene etiquetas', () => {
    expect(etiquetaRolGlobal('admin_global')).toBe('Administración');
  });
});

describe('contacto de clubes interesados', () => {
  it('reconoce emails', () => {
    expect(contactoLead(' ana@club.com ')).toEqual({ tipo: 'email', texto: 'ana@club.com', href: 'mailto:ana@club.com' });
  });

  it('reconoce teléfonos y arma el enlace de WhatsApp', () => {
    const contacto = contactoLead('11 2233-4455', 'Club Sur');
    expect(contacto).toMatchObject({ tipo: 'whatsapp', texto: '+54 9 11 2233-4455', numero: '5491122334455' });
    expect(contacto.tipo === 'whatsapp' && contacto.href).toContain('https://wa.me/5491122334455?text=');
    expect(contacto.tipo === 'whatsapp' && decodeURIComponent(contacto.href)).toContain('para sumar Club Sur');
  });

  it('deja el resto como texto', () => {
    expect(contactoLead('@clubsur en Instagram')).toEqual({ tipo: 'texto', texto: '@clubsur en Instagram' });
    expect(contactoLead('123-45')).toEqual({ tipo: 'texto', texto: '123-45' });
  });
});

describe('auditoría', () => {
  it('traduce las acciones conocidas', () => {
    expect(etiquetaAccion('reserva.confirmar')).toBe('Pedido confirmado');
    expect(etiquetaAccion('acceso.habilitar')).toBe('Cuenta habilitada para el piloto');
  });

  it('arma una etiqueta legible para las desconocidas', () => {
    expect(etiquetaAccion('cliente.archivar_todo')).toBe('Clientes: archivar todo');
    expect(etiquetaAccion('otra')).toBe('Otra');
  });
});

describe('utilidades', () => {
  it('muestra el año solo si no es el actual', () => {
    const hoy = new Date('2026-10-01T15:00:00Z');
    expect(fechaCorta('2026-10-06T15:00:00Z', hoy)).toBe('6 oct');
    expect(fechaCorta('2025-03-02T15:00:00Z', hoy)).toBe('2 mar 2025');
  });

  it('normaliza textos para buscar', () => {
    expect(textoBuscable('Club Atlético ÑANDÚ')).toBe('club atletico nandu');
    expect(textoBuscable(null)).toBe('');
  });
});
