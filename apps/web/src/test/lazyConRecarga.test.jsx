import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Suspense, createElement } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { lazyConRecarga, olvidarRecarga } from '../lib/lazyConRecarga';

// Tras un despliegue, los archivos de la version anterior desaparecen y quien
// tenia la app abierta se queda en blanco al entrar en una vista nueva. Lo que
// se prueba aqui es que eso acaba en una recarga, y en UNA sola: recargar en
// bucle seria peor que la pantalla en blanco, porque no se podria ni leer el
// error.

const Ok = () => <div>cargado</div>;

// `createElement` y no `<Componente />` porque esta configuración de ESLint no
// lleva el plugin de React, así que no cuenta el uso dentro de JSX y marca la
// variable como no usada.
const pintar = (Componente) => render(
  <Suspense fallback={<div>cargando</div>}>
    {createElement(Componente)}
  </Suspense>
);

beforeEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
});

describe('lazyConRecarga', () => {
  it('con una carga normal, ni recarga ni molesta', async () => {
    const recargar = vi.fn();
    const Componente = lazyConRecarga(
      () => Promise.resolve({ default: Ok }),
      { recargar }
    );

    pintar(Componente);

    expect(await screen.findByText('cargado')).toBeInTheDocument();
    expect(recargar).not.toHaveBeenCalled();
  });

  it('si el archivo ya no existe, recarga la página', async () => {
    const recargar = vi.fn();
    const Componente = lazyConRecarga(
      () => Promise.reject(new TypeError('Failed to fetch dynamically imported module')),
      { recargar }
    );

    pintar(Componente);

    await waitFor(() => expect(recargar).toHaveBeenCalledTimes(1));
  });

  it('no resuelve mientras la página se está yendo', async () => {
    // Si la promesa se resolviera, React intentaria pintar un componente que
    // no existe justo mientras el navegador descarga la pagina.
    const recargar = vi.fn();
    const Componente = lazyConRecarga(
      () => Promise.reject(new Error('boom')),
      { recargar }
    );

    pintar(Componente);

    await waitFor(() => expect(recargar).toHaveBeenCalled());
    expect(screen.getByText('cargando')).toBeInTheDocument();
  });

  it('recarga UNA vez: si tras recargar sigue fallando, deja ver el error', async () => {
    // El bucle de recargas es el peor final posible: la pantalla parpadea y
    // no hay forma de leer que ha pasado.
    const recargar = vi.fn();
    const fallar = () => Promise.reject(new Error('boom'));

    pintar(lazyConRecarga(fallar, { recargar }));
    await waitFor(() => expect(recargar).toHaveBeenCalledTimes(1));

    // Segundo intento en la misma pestaña, como tras la recarga.
    const errores = vi.spyOn(console, 'error').mockImplementation(() => {});
    pintar(lazyConRecarga(fallar, { recargar }));

    // Hay que ESPERAR y luego mirar. Un `waitFor` sobre "sigue valiendo 1" se
    // da por bueno nada más empezar, antes de que la segunda recarga tuviera
    // tiempo de llegar, y el test pasaría aunque el bucle existiera.
    await new Promise((r) => setTimeout(r, 50));
    expect(recargar).toHaveBeenCalledTimes(1);

    errores.mockRestore();
  });

  it('una carga buena devuelve el derecho a reintentar', async () => {
    // Si no se limpiara la marca, la primera recarga de la vida de la pestaña
    // gastaria el unico intento para todos los despliegues siguientes.
    const recargar = vi.fn();

    pintar(lazyConRecarga(() => Promise.reject(new Error('boom')), { recargar }));
    await waitFor(() => expect(recargar).toHaveBeenCalledTimes(1));

    // Ahora una que va bien
    pintar(lazyConRecarga(() => Promise.resolve({ default: Ok }), { recargar }));
    await screen.findAllByText('cargado');

    // Y otro despliegue mas tarde: vuelve a tener derecho a recargar
    pintar(lazyConRecarga(() => Promise.reject(new Error('boom')), { recargar }));
    await waitFor(() => expect(recargar).toHaveBeenCalledTimes(2));
  });

  it('sin sessionStorage no recarga, para no arriesgar un bucle', async () => {
    // En incognito o con el almacenamiento bloqueado no hay forma de saber si
    // ya se recargo antes.
    const recargar = vi.fn();
    const original = Object.getOwnPropertyDescriptor(window, 'sessionStorage');
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      get() { throw new Error('bloqueado'); }
    });

    try {
      pintar(lazyConRecarga(() => Promise.reject(new Error('boom')), { recargar }));
      await new Promise((r) => setTimeout(r, 50));
      expect(recargar).not.toHaveBeenCalled();
    } finally {
      if (original) Object.defineProperty(window, 'sessionStorage', original);
    }
  });

  it('olvidarRecarga no revienta si el almacenamiento falla', () => {
    const original = Object.getOwnPropertyDescriptor(window, 'sessionStorage');
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      get() { throw new Error('bloqueado'); }
    });

    try {
      expect(() => olvidarRecarga()).not.toThrow();
    } finally {
      if (original) Object.defineProperty(window, 'sessionStorage', original);
    }
  });
});
