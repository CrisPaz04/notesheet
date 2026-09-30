import { describe, it, expect } from 'vitest';
import { diaParaInput, hoyParaInput, formatearDiaLista, formatearFechaCorta } from '../utils/fechas';

// Lo que guarda el editor: `new Date("2026-09-20")`, la medianoche UTC del día
const guardada = new Date('2026-09-20');
const comoFirestore = { toDate: () => guardada };

describe('las fechas de las listas', () => {
  it('el día que se enseña es el elegido, no el anterior (en Honduras, UTC−6)', () => {
    // Leída en hora local, esta medianoche UTC es el sábado 19 en Honduras
    const enHonduras = guardada.toLocaleDateString('es-ES', { timeZone: 'America/Tegucigalpa', day: 'numeric' });
    expect(enHonduras).toBe('19');

    expect(formatearDiaLista(comoFirestore)).toBe('20 de septiembre de 2026');
    expect(formatearDiaLista(comoFirestore, { conDia: true })).toBe('Domingo, 20 de septiembre de 2026');
  });

  it('el editor recibe el mismo día que se guardó', () => {
    expect(diaParaInput(comoFirestore)).toBe('2026-09-20');
    expect(new Date(diaParaInput(comoFirestore)).getTime()).toBe(guardada.getTime());
  });

  // Antes era toISOString(): a partir de las 18:00 en Honduras ya era mañana
  it('una lista nueva arranca en el día del reloj del músico', () => {
    expect(hoyParaInput(new Date(2026, 8, 30, 21, 30))).toBe('2026-09-30');
    expect(hoyParaInput(new Date(2026, 0, 5, 0, 10))).toBe('2026-01-05');
  });

  it('sin fecha', () => {
    expect(formatearDiaLista(null)).toBe('Sin fecha');
    expect(formatearFechaCorta(null)).toBe('');
  });

  it('la fecha corta va en español (día/mes/año)', () => {
    expect(formatearFechaCorta({ toDate: () => new Date(2026, 8, 29, 12) })).toBe('29/9/2026');
  });
});
