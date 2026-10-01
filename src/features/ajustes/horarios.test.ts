import { describe, expect, it } from 'vitest';
import type { BloqueHorario, HorarioPublicado } from '@/api/tipos';
import {
  aPayload, bloquesPorCancha, conClave, copiarSemana, describirBloque, duracionBloque, enumerarBloques, esMonto, etiquetaPrecio,
  etiquetaRango, firmaBloques, generarBloques, guardarBloque, ordenarBloques, planCopiarDia, planGenerador,
  quitarBloque, resumenDia, seSuperponen, sugerirBloque, superposiciones, terminaAlDiaSiguiente, textoReemplazo, validarBloque,
  validarSemana,
  type Bloque,
} from './horarios';

const LUN = 1;
const MAR = 2;
const MIE = 3;
const VIE = 5;
const SAB = 6;
const DOM = 0;

function b(dia: number, inicio: string, fin: string, precio = 30000, sena = 10000): BloqueHorario {
  return { dia_semana: dia, hora_inicio: inicio, hora_fin: fin, precio_total: precio, precio_sena: sena };
}

function k(dia: number, inicio: string, fin: string, clave: string, precio = 30000, sena = 10000): Bloque {
  return { ...b(dia, inicio, fin, precio, sena), clave };
}

/** Bloques sin la clave local, para comparar resultados. */
const sinClave = (bloques: BloqueHorario[]) => aPayload(bloques);
const rangos = (bloques: BloqueHorario[]) => ordenarBloques(bloques).map(describirBloque);

describe('duración y etiquetas', () => {
  it('calcula la duración aunque el bloque cruce la medianoche', () => {
    expect(duracionBloque('18:00', '20:00')).toBe(120);
    expect(duracionBloque('22:00', '00:00')).toBe(120);
    expect(duracionBloque('23:00', '01:30')).toBe(150);
    expect(duracionBloque('10:00', '10:00')).toBe(0);
  });

  it('distingue el bloque que termina a medianoche del que sigue al día siguiente', () => {
    expect(terminaAlDiaSiguiente(b(LUN, '22:00', '00:00'))).toBe(false);
    expect(terminaAlDiaSiguiente(b(LUN, '23:00', '01:00'))).toBe(true);
    expect(terminaAlDiaSiguiente(b(LUN, '18:00', '20:00'))).toBe(false);
  });

  it('muestra 24:00 para los bloques que terminan a medianoche', () => {
    expect(etiquetaRango(b(LUN, '18:00', '20:00'))).toBe('18:00–20:00');
    expect(etiquetaRango(b(LUN, '22:00', '00:00'))).toBe('22:00–24:00');
    expect(etiquetaRango(b(LUN, '23:00', '01:00'))).toBe('23:00–01:00');
  });

  it('arma la etiqueta de precio con y sin seña', () => {
    expect(etiquetaPrecio(b(LUN, '18:00', '20:00', 30000, 10000))).toBe('$ 30.000 (seña $ 10.000)');
    expect(etiquetaPrecio(b(LUN, '18:00', '20:00', 30000, 0))).toBe('$ 30.000');
  });

  it('describe bloques para los mensajes', () => {
    expect(describirBloque(b(SAB, '22:00', '00:00'))).toBe('Sáb 22:00–24:00');
  });

  it('enumera bloques para los avisos', () => {
    expect(enumerarBloques([])).toBe('');
    expect(enumerarBloques([b(MAR, '18:00', '20:00')])).toBe('Mar 18:00–20:00');
    expect(enumerarBloques([b(MAR, '18:00', '20:00'), b(LUN, '18:00', '20:00')])).toBe('Lun 18:00–20:00 y Mar 18:00–20:00');
    const muchos = [1, 2, 3, 4, 5, 6].map((dia) => b(dia, '18:00', '20:00'));
    expect(enumerarBloques(muchos, 2)).toBe('Lun 18:00–20:00, Mar 18:00–20:00 y 4 más');
    expect(textoReemplazo([b(LUN, '18:00', '20:00')])).toBe('Se reemplaza 1 bloque: Lun 18:00–20:00.');
    expect(textoReemplazo(muchos.slice(0, 2))).toBe('Se reemplazan 2 bloques: Lun 18:00–20:00 y Mar 18:00–20:00.');
  });

  it('resume cada día', () => {
    const semana = [b(LUN, '20:00', '22:00'), b(LUN, '18:00', '20:00'), b(LUN, '22:00', '00:00'), b(MAR, '23:00', '01:00')];
    expect(resumenDia(semana, LUN)).toBe('3 bloques · 18:00 a 24:00');
    expect(resumenDia(semana, MAR)).toBe('1 bloque · 23:00 a 01:00 (día siguiente)');
    expect(resumenDia(semana, DOM)).toBe('Sin bloques');
  });
});

describe('orden y conversión', () => {
  it('ordena de lunes a domingo y por hora', () => {
    const ordenados = ordenarBloques([b(DOM, '10:00', '11:00'), b(MAR, '09:00', '10:00'), b(LUN, '20:00', '21:00'), b(LUN, '08:00', '09:00')]);
    expect(ordenados.map(describirBloque)).toEqual(['Lun 08:00–09:00', 'Lun 20:00–21:00', 'Mar 09:00–10:00', 'Dom 10:00–11:00']);
  });

  it('agrupa los horarios guardados activos por cancha con claves estables', () => {
    const horarios: HorarioPublicado[] = [
      { id: 7, cancha_id: 1, dia_semana: MAR, hora_inicio: '18:00', hora_fin: '20:00', precio_total: 1000, precio_sena: 0, activo: true },
      { id: 3, cancha_id: 1, dia_semana: LUN, hora_inicio: '18:00', hora_fin: '20:00', precio_total: 1000, precio_sena: 0, activo: true },
      { id: 4, cancha_id: 1, dia_semana: LUN, hora_inicio: '10:00', hora_fin: '12:00', precio_total: 1000, precio_sena: 0, activo: false },
      { id: 9, cancha_id: 2, dia_semana: DOM, hora_inicio: '10:00', hora_fin: '12:00', precio_total: 1000, precio_sena: 0, activo: true },
    ];
    const agrupados = bloquesPorCancha(horarios);
    expect(agrupados[1].map((bloque) => bloque.clave)).toEqual(['h3', 'h7']);
    expect(agrupados[2]).toHaveLength(1);
    expect(bloquesPorCancha(horarios)[1][0].clave).toBe('h3');
  });

  it('genera el payload sin claves y con montos numéricos', () => {
    const bloque = { ...k(LUN, '18:00', '20:00', 'x'), precio_total: '1500' as unknown as number };
    expect(aPayload([bloque])).toEqual([{ dia_semana: LUN, hora_inicio: '18:00', hora_fin: '20:00', precio_total: 1500, precio_sena: 10000 }]);
  });

  it('la firma no depende del orden ni de las claves', () => {
    const a = [k(LUN, '18:00', '20:00', 'a'), k(MAR, '18:00', '20:00', 'b')];
    const otra = [k(MAR, '18:00', '20:00', 'z'), k(LUN, '18:00', '20:00', 'y')];
    expect(firmaBloques(a)).toBe(firmaBloques(otra));
    expect(firmaBloques(a)).not.toBe(firmaBloques([k(LUN, '18:00', '20:00', 'a', 35000)]));
  });
});

describe('superposiciones', () => {
  it('detecta bloques que se pisan el mismo día', () => {
    expect(seSuperponen(b(LUN, '18:00', '20:00'), b(LUN, '19:00', '21:00'))).toBe(true);
    expect(seSuperponen(b(LUN, '18:00', '20:00'), b(LUN, '18:30', '19:30'))).toBe(true);
  });

  it('no marca bloques que solo se tocan', () => {
    expect(seSuperponen(b(LUN, '18:00', '20:00'), b(LUN, '20:00', '22:00'))).toBe(false);
    expect(seSuperponen(b(LUN, '22:00', '00:00'), b(MAR, '00:00', '02:00'))).toBe(false);
  });

  it('detecta bloques que cruzan la medianoche y pisan el día siguiente', () => {
    expect(seSuperponen(b(LUN, '23:00', '01:00'), b(MAR, '00:30', '02:00'))).toBe(true);
    expect(seSuperponen(b(LUN, '23:00', '01:00'), b(MAR, '01:00', '02:00'))).toBe(false);
  });

  it('detecta el paso de sábado a domingo', () => {
    expect(seSuperponen(b(SAB, '23:00', '01:00'), b(DOM, '00:00', '00:30'))).toBe(true);
    expect(seSuperponen(b(DOM, '00:00', '00:30'), b(SAB, '23:00', '01:00'))).toBe(true);
    expect(seSuperponen(b(SAB, '22:00', '00:00'), b(DOM, '00:00', '02:00'))).toBe(false);
  });

  it('no compara un bloque consigo mismo al editarlo', () => {
    const bloque = k(LUN, '18:00', '20:00', 'a');
    const otros = [bloque, k(LUN, '19:00', '21:00', 'b'), k(MAR, '19:00', '21:00', 'c')];
    expect(superposiciones({ ...bloque, hora_fin: '19:30' }, otros).map((otro) => otro.clave)).toEqual(['b']);
    expect(superposiciones(b(LUN, '21:00', '22:00'), otros)).toEqual([]);
  });
});

describe('validación', () => {
  it('acepta un bloque correcto', () => {
    expect(validarBloque(b(LUN, '18:00', '20:00'))).toBeNull();
    expect(validarBloque(b(LUN, '22:00', '00:00'))).toBeNull();
  });

  it('exige duración entre 30 minutos y 12 horas', () => {
    expect(validarBloque(b(LUN, '18:00', '18:20'))).toMatch(/30 minutos y 12 horas/);
    expect(validarBloque(b(LUN, '08:00', '20:30'))).toMatch(/30 minutos y 12 horas/);
    expect(validarBloque(b(LUN, '18:00', '18:00'))).toMatch(/30 minutos y 12 horas/);
    expect(validarBloque(b(LUN, '18:00', '18:30'))).toBeNull();
    expect(validarBloque(b(LUN, '20:00', '08:00'))).toBeNull();
  });

  it('valida formato de hora y día', () => {
    expect(validarBloque(b(LUN, '', '20:00'))).toMatch(/hora/);
    expect(validarBloque(b(LUN, '24:00', '01:00'))).toMatch(/hora/);
    expect(validarBloque(b(7, '18:00', '20:00'))).toMatch(/día/);
  });

  it('exige que la seña no supere el precio', () => {
    expect(validarBloque(b(LUN, '18:00', '20:00', 10000, 12000))).toMatch(/seña no puede superar/);
    expect(validarBloque(b(LUN, '18:00', '20:00', 10000, 10000))).toBeNull();
    expect(validarBloque(b(LUN, '18:00', '20:00', -1, 0))).toMatch(/precios/);
    expect(validarBloque(b(LUN, '18:00', '20:00', Number.NaN, 0))).toMatch(/precios/);
  });

  it('acepta montos con hasta dos decimales', () => {
    expect(esMonto(1.15)).toBe(true);
    expect(esMonto(1.155)).toBe(false);
    expect(esMonto(30000)).toBe(true);
  });

  it('marca cada superposición en los dos bloques', () => {
    const semana = [k(LUN, '18:00', '20:00', 'a'), k(LUN, '19:00', '21:00', 'b'), k(MAR, '18:00', '20:00', 'c')];
    const resultado = validarSemana(semana);
    expect(resultado.porBloque.a).toEqual(['Se superpone con Lun 19:00–21:00.']);
    expect(resultado.porBloque.b).toEqual(['Se superpone con Lun 18:00–20:00.']);
    expect(resultado.porBloque.c).toBeUndefined();
    expect(resultado.total).toBe(2);
  });

  it('marca superposiciones de madrugada y del fin de semana', () => {
    const semana = [k(SAB, '23:00', '01:00', 'a'), k(DOM, '00:00', '02:00', 'b')];
    expect(validarSemana(semana).total).toBe(2);
  });

  it('informa errores propios sin buscar superposiciones con bloques inválidos', () => {
    const semana = [k(LUN, '18:00', '18:10', 'a'), k(LUN, '18:00', '20:00', 'b')];
    const resultado = validarSemana(semana);
    expect(resultado.porBloque.a).toHaveLength(1);
    expect(resultado.porBloque.b).toBeUndefined();
  });

  it('limita la cantidad de bloques por cancha', () => {
    const muchos = Array.from({ length: 151 }, (_, i) => k(i % 7, '08:00', '08:30', `x${i}`));
    expect(validarSemana(muchos).generales[0]).toMatch(/hasta 150 bloques/);
  });
});

describe('edición del borrador', () => {
  it('agrega, reemplaza y quita bloques por clave', () => {
    const inicial = [k(LUN, '18:00', '20:00', 'a')];
    const conNuevo = guardarBloque(inicial, k(LUN, '16:00', '18:00', 'b'));
    expect(conNuevo.map((bloque) => bloque.clave)).toEqual(['b', 'a']);
    const editado = guardarBloque(conNuevo, k(LUN, '20:00', '22:00', 'a'));
    expect(rangos(editado)).toEqual(['Lun 16:00–18:00', 'Lun 20:00–22:00']);
    expect(quitarBloque(editado, 'b').map((bloque) => bloque.clave)).toEqual(['a']);
  });

  it('copia la semana de otra cancha con claves nuevas', () => {
    const origen = [k(LUN, '18:00', '20:00', 'a')];
    const copia = copiarSemana(origen);
    expect(sinClave(copia)).toEqual(sinClave(origen));
    expect(copia[0].clave).not.toBe('a');
  });

  it('sugiere un bloque nuevo a continuación del último del día', () => {
    const referencia = { precio_total: 25000, precio_sena: 5000 };
    const semana = [b(LUN, '18:00', '19:30', 30000, 10000), b(LUN, '19:30', '21:00', 32000, 10000)];
    expect(sugerirBloque(semana, LUN, referencia)).toEqual(b(LUN, '21:00', '22:30', 32000, 10000));
    expect(sugerirBloque(semana, MAR, referencia)).toEqual(b(MAR, '18:00', '19:30', 30000, 10000));
    expect(sugerirBloque([], MAR, referencia)).toEqual(b(MAR, '18:00', '20:00', 25000, 5000));
  });

  it('no sugiere bloques que empiecen después de la medianoche del mismo día', () => {
    const semana = [b(LUN, '20:00', '22:00'), b(LUN, '22:00', '00:00')];
    expect(sugerirBloque(semana, LUN, { precio_total: 0, precio_sena: 0 })).toMatchObject({ hora_inicio: '18:00', hora_fin: '20:00' });
  });

  it('asigna claves nuevas distintas', () => {
    expect(conClave(b(LUN, '18:00', '20:00')).clave).not.toBe(conClave(b(LUN, '18:00', '20:00')).clave);
  });
});

describe('generador de bloques', () => {
  const base = { dias: [LUN], desde: '18:00', hasta: '00:00', duracion: 120, precio: 30000, sena: 10000 };

  it('genera bloques consecutivos hasta la medianoche', () => {
    const resultado = generarBloques(base);
    expect(resultado.error).toBeNull();
    expect(resultado.porDia).toBe(3);
    expect(resultado.sobrante).toBe(0);
    expect(rangos(resultado.bloques)).toEqual(['Lun 18:00–20:00', 'Lun 20:00–22:00', 'Lun 22:00–24:00']);
    expect(resultado.bloques.every((bloque) => validarBloque(bloque) === null)).toBe(true);
  });

  it('pasa al día siguiente los bloques que empiezan después de medianoche', () => {
    const resultado = generarBloques({ ...base, dias: [VIE], desde: '22:00', hasta: '02:00', duracion: 60 });
    expect(rangos(resultado.bloques)).toEqual(['Vie 22:00–23:00', 'Vie 23:00–24:00', 'Sáb 00:00–01:00', 'Sáb 01:00–02:00']);
  });

  it('pasa del sábado al domingo', () => {
    const resultado = generarBloques({ ...base, dias: [SAB], desde: '23:00', hasta: '01:00', duracion: 60 });
    expect(rangos(resultado.bloques)).toEqual(['Sáb 23:00–24:00', 'Dom 00:00–01:00']);
  });

  it('informa los minutos que sobran', () => {
    const resultado = generarBloques({ ...base, desde: '18:00', hasta: '23:30', duracion: 120 });
    expect(rangos(resultado.bloques)).toEqual(['Lun 18:00–20:00', 'Lun 20:00–22:00']);
    expect(resultado.sobrante).toBe(90);
  });

  it('acepta duraciones personalizadas y varios días', () => {
    const resultado = generarBloques({ ...base, dias: [MAR, LUN, LUN], desde: '19:00', hasta: '22:00', duracion: 90 });
    expect(rangos(resultado.bloques)).toEqual(['Lun 19:00–20:30', 'Lun 20:30–22:00', 'Mar 19:00–20:30', 'Mar 20:30–22:00']);
  });

  it('usa un día completo cuando inicio y fin coinciden', () => {
    expect(generarBloques({ ...base, desde: '08:00', hasta: '08:00', duracion: 720 }).porDia).toBe(2);
  });

  it('valida las opciones', () => {
    expect(generarBloques({ ...base, dias: [] }).error).toMatch(/al menos un día/);
    expect(generarBloques({ ...base, duracion: 20 }).error).toMatch(/30 minutos y 12 horas/);
    expect(generarBloques({ ...base, duracion: 800 }).error).toMatch(/30 minutos y 12 horas/);
    expect(generarBloques({ ...base, desde: '' }).error).toMatch(/hora/);
    expect(generarBloques({ ...base, sena: 40000 }).error).toMatch(/seña/);
    expect(generarBloques({ ...base, desde: '18:00', hasta: '19:00', duracion: 120 }).error).toMatch(/más corto/);
  });
});

describe('aplicar cambios masivos', () => {
  it('reemplaza los días elegidos y la madrugada que se superpone', () => {
    const actuales = [
      k(VIE, '18:00', '20:00', 'a'),
      k(SAB, '00:00', '02:00', 'b'),
      k(SAB, '18:00', '20:00', 'c'),
      k(LUN, '18:00', '20:00', 'd'),
    ];
    const { bloques } = generarBloques({ dias: [VIE], desde: '22:00', hasta: '02:00', duracion: 120, precio: 1, sena: 0 });
    const plan = planGenerador(actuales, bloques, [VIE], 'reemplazar');
    expect(plan.reemplazados.map((bloque) => bloque.clave)).toEqual(['a', 'b']);
    expect(plan.conflictos).toEqual([]);
    expect(rangos(plan.resultado)).toEqual(['Lun 18:00–20:00', 'Vie 22:00–24:00', 'Sáb 00:00–02:00', 'Sáb 18:00–20:00']);
    expect(validarSemana(plan.resultado).total).toBe(0);
  });

  it('al agregar informa los choques y no quita nada', () => {
    const actuales = [k(LUN, '19:00', '21:00', 'a')];
    const { bloques } = generarBloques({ dias: [LUN, MAR], desde: '18:00', hasta: '22:00', duracion: 120, precio: 1, sena: 0 });
    const plan = planGenerador(actuales, bloques, [LUN, MAR], 'agregar');
    expect(plan.reemplazados).toEqual([]);
    expect(plan.conflictos.map(({ nuevo }) => describirBloque(nuevo))).toEqual(['Lun 18:00–20:00', 'Lun 20:00–22:00']);
  });

  it('copia un día a otros reemplazando lo que tenían', () => {
    const actuales = [k(LUN, '18:00', '20:00', 'a', 100), k(LUN, '20:00', '22:00', 'b', 200), k(MAR, '10:00', '12:00', 'c'), k(MIE, '10:00', '12:00', 'd')];
    const plan = planCopiarDia(actuales, LUN, [MAR, LUN]);
    expect(plan.reemplazados.map((bloque) => bloque.clave)).toEqual(['c']);
    expect(plan.conflictos).toEqual([]);
    expect(rangos(plan.resultado)).toEqual(['Lun 18:00–20:00', 'Lun 20:00–22:00', 'Mar 18:00–20:00', 'Mar 20:00–22:00', 'Mié 10:00–12:00']);
    expect(plan.resultado.find((bloque) => bloque.dia_semana === MAR)?.precio_total).toBe(100);
  });

  it('avisa si la copia choca con la madrugada del día anterior', () => {
    const actuales = [k(LUN, '00:00', '02:00', 'a'), k(DOM, '23:00', '01:00', 'b'), k(MAR, '00:00', '01:00', 'c')];
    const plan = planCopiarDia(actuales, MAR, [LUN]);
    expect(plan.reemplazados.map((bloque) => bloque.clave)).toEqual(['a']);
    expect(plan.conflictos).toHaveLength(1);
    expect(describirBloque(plan.conflictos[0].existente)).toBe('Dom 23:00–01:00');
  });
});

