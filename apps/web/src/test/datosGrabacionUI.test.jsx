import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockBuscar = vi.fn();
vi.mock('@notesheet/api', () => ({
  buscarDatosDeCancion: (...a) => mockBuscar(...a)
}));

const { default: BuscarDatosModal } = await import('../components/datos/BuscarDatosModal');
const { default: DatosGrabacion } = await import('../components/datos/DatosGrabacion');

const RESULTADO = {
  grabaciones: [
    { fuente: 'itunes', id: '1', titulo: 'Agnus Dei', artista: 'Marco Barrientos', album: 'Muéstrame Tu Gloria', anio: 2003, duracion: 635, enlace: 'https://music.apple.com/x' },
    { fuente: 'musicbrainz', id: 'mb1', titulo: 'Agnus dei (en vivo)', artista: 'Marco Barrientos', album: '', anio: null, duracion: 300, enlace: 'https://musicbrainz.org/recording/mb1' }
  ],
  tempos: [
    { fuente: 'getsongbpm', id: 'g1', titulo: 'Agnus Dei', artista: 'Marco Barrientos', tempo: 67, tonoConcierto: 'LA', compas: '4/4', enlace: 'https://getsongbpm.com/song/g1' }
  ],
  errores: {}
};

const abrir = (props = {}) => {
  const onAplicar = vi.fn();
  const onClose = vi.fn();
  render(
    <BuscarDatosModal
      isOpen
      onClose={onClose}
      titulo="Agnus Dei"
      artista="Marco Barrientos"
      versiones={[]}
      onAplicar={onAplicar}
      {...props}
    />
  );
  return { onAplicar, onClose };
};

beforeEach(() => {
  vi.clearAllMocks();
  mockBuscar.mockResolvedValue(RESULTADO);
});

describe('BuscarDatosModal', () => {
  it('al abrir busca con el título y el artista de la canción', async () => {
    abrir();
    await screen.findByText('1. ¿Cuál es vuestra grabación?');
    expect(mockBuscar).toHaveBeenCalledWith({ titulo: 'Agnus Dei', artista: 'Marco Barrientos' });
  });

  it('no elige nada por su cuenta: sin elegir, no se puede aplicar', async () => {
    abrir();
    await screen.findByText('1. ¿Cuál es vuestra grabación?');
    expect(screen.queryByText('3. Qué datos usar')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aplicar' })).toBeDisabled();
  });

  it('con grabación y tempo elegidos propone cada dato, y aplica solo lo marcado', async () => {
    const user = userEvent.setup();
    const { onAplicar, onClose } = abrir();
    await screen.findByText('1. ¿Cuál es vuestra grabación?');

    await user.click(screen.getAllByRole('radio', { name: /Agnus Dei/ })[0]);
    const grupoTempo = screen.getByText('2. Tempo y tonalidad').closest('fieldset');
    await user.click(within(grupoTempo).getByRole('radio'));

    // Desmarca el compás
    await user.click(screen.getByRole('checkbox', { name: 'Compás 4/4' }));
    await user.click(screen.getByRole('button', { name: 'Aplicar' }));

    const propuesta = onAplicar.mock.calls[0][0];
    expect(propuesta.tempo).toBe(67);
    expect(propuesta.compas).toBeUndefined();
    expect(propuesta.versiones).toEqual(['Marco Barrientos']);
    expect(propuesta.grabacion).toMatchObject({
      titulo: 'Agnus Dei',
      artista: 'Marco Barrientos',
      album: 'Muéstrame Tu Gloria',
      anio: 2003,
      duracion: 635,
      tonoConcierto: 'LA',
      bpm: 67,
      fuentes: {
        grabacion: { fuente: 'itunes', id: '1', enlace: 'https://music.apple.com/x' },
        tempo: { fuente: 'getsongbpm', id: 'g1', enlace: 'https://getsongbpm.com/song/g1' }
      }
    });
    expect(propuesta.grabacion.actualizado).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(onClose).toHaveBeenCalled();
  });

  it('la tonalidad propuesta se anuncia en concierto, no pisa la de la canción', async () => {
    const user = userEvent.setup();
    abrir();
    await screen.findByText('2. Tempo y tonalidad');
    await user.click(within(screen.getByText('2. Tempo y tonalidad').closest('fieldset')).getByRole('radio'));
    expect(screen.getByRole('checkbox', { name: /Tonalidad original: LA \(en concierto\)/ })).toBeInTheDocument();
    expect(screen.getByText(/no cambia la tonalidad de la canción/)).toBeInTheDocument();
  });

  it('si se desmarca la tonalidad, la grabación se guarda sin ella', async () => {
    const user = userEvent.setup();
    const { onAplicar } = abrir();
    await screen.findByText('1. ¿Cuál es vuestra grabación?');
    await user.click(screen.getAllByRole('radio', { name: /Agnus Dei/ })[0]);
    await user.click(within(screen.getByText('2. Tempo y tonalidad').closest('fieldset')).getByRole('radio'));
    await user.click(screen.getByRole('checkbox', { name: /Tonalidad original/ }));
    await user.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(onAplicar.mock.calls[0][0].grabacion.tonoConcierto).toBeNull();
  });

  it('no ofrece añadir a "Versión de" a quien ya está', async () => {
    const user = userEvent.setup();
    abrir({ versiones: ['marco barrientos'] });
    await screen.findByText('1. ¿Cuál es vuestra grabación?');
    await user.click(screen.getAllByRole('radio', { name: /Agnus Dei/ })[0]);
    expect(screen.queryByRole('checkbox', { name: /Versión de/ })).not.toBeInTheDocument();
  });

  it('si no encuentra nada lo dice y ofrece los enlaces "Ver en…"', async () => {
    mockBuscar.mockResolvedValue({ grabaciones: [], tempos: [], errores: {} });
    abrir({ titulo: 'Al que hizo los cielos', artista: 'Elim' });
    expect(await screen.findByText(/No se encontró esta canción/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Cifra Club/ })).toHaveAttribute(
      'href', 'https://www.cifraclub.com/?q=Al%20que%20hizo%20los%20cielos%20Elim'
    );
  });

  it('avisa de la fuente que falló sin esconder las demás', async () => {
    mockBuscar.mockResolvedValue({ ...RESULTADO, errores: { musicbrainz: 'HTTP 503' } });
    abrir();
    expect(await screen.findByText(/No se pudo consultar MusicBrainz/)).toBeInTheDocument();
    expect(screen.getByText('1. ¿Cuál es vuestra grabación?')).toBeInTheDocument();
  });

  it('se puede corregir la búsqueda y volver a buscar', async () => {
    const user = userEvent.setup();
    abrir();
    await screen.findByText('1. ¿Cuál es vuestra grabación?');
    await user.clear(screen.getByLabelText('Artista a buscar'));
    await user.type(screen.getByLabelText('Artista a buscar'), 'Marcos Barrientos');
    await user.click(screen.getByRole('button', { name: /Buscar/ }));
    await waitFor(() => expect(mockBuscar).toHaveBeenLastCalledWith({ titulo: 'Agnus Dei', artista: 'Marcos Barrientos' }));
  });

  it('enlaza a GetSongBPM, como exige su API', async () => {
    abrir();
    await screen.findByText('1. ¿Cuál es vuestra grabación?');
    expect(screen.getByRole('link', { name: 'GetSongBPM' })).toHaveAttribute('href', 'https://getsongbpm.com');
  });
});

describe('DatosGrabacion', () => {
  const GRABACION = {
    titulo: 'Agnus Dei', artista: 'Marco Barrientos', album: 'Muéstrame Tu Gloria', anio: 2003,
    duracion: 635, tonoConcierto: 'LA', bpm: 67, compas: '4/4',
    fuentes: {
      grabacion: { fuente: 'itunes', id: '1', enlace: 'https://music.apple.com/x' },
      tempo: { fuente: 'getsongbpm', id: 'g1', enlace: 'https://getsongbpm.com/song/g1' }
    }
  };

  it('enseña los datos, con la nota de que están en concierto', () => {
    render(<DatosGrabacion grabacion={GRABACION} titulo="Agnus Dei" instrumento="c_flute" />);
    expect(screen.getByText('Muéstrame Tu Gloria (2003)')).toBeInTheDocument();
    expect(screen.getByText('10:35')).toBeInTheDocument();
    expect(screen.getByText('67 BPM')).toBeInTheDocument();
    expect(screen.getByText(/en tonalidad de concierto/)).toBeInTheDocument();
  });

  it('a un trompetista le dice la tonalidad escrita para su instrumento', () => {
    render(<DatosGrabacion grabacion={GRABACION} titulo="Agnus Dei" instrumento="bb_trumpet" />);
    expect(screen.getByText(/en tu instrumento \(Trompeta en Sib\)/)).toBeInTheDocument();
    expect(screen.getByText('SI')).toBeInTheDocument();
  });

  it('a quien lee en concierto no le añade nada', () => {
    render(<DatosGrabacion grabacion={GRABACION} titulo="Agnus Dei" instrumento="c_flute" />);
    expect(screen.queryByText(/en tu instrumento/)).not.toBeInTheDocument();
  });

  it('en C-D-E nombra la tonalidad en C-D-E', () => {
    render(<DatosGrabacion grabacion={GRABACION} titulo="Agnus Dei" instrumento="bb_trumpet" notacion="english" />);
    const tonalidad = screen.getByText('Tonalidad').nextSibling;
    expect(tonalidad.textContent).toMatch(/^A · en tu instrumento/);
    expect(within(tonalidad).getByText('B')).toBeInTheDocument();
  });

  it('cita sus fuentes y enlaza a GetSongBPM si sus datos están', () => {
    render(<DatosGrabacion grabacion={GRABACION} titulo="Agnus Dei" instrumento="c_flute" />);
    expect(screen.getByRole('link', { name: 'Apple Music' })).toHaveAttribute('href', 'https://music.apple.com/x');
    expect(screen.getByRole('link', { name: 'GetSongBPM' })).toHaveAttribute('href', 'https://getsongbpm.com/song/g1');
  });

  it('sin datos lo dice, y aun así ofrece los enlaces "Ver en…"', () => {
    render(<DatosGrabacion grabacion={null} titulo="Fuego" artista="Billy Bunster" instrumento="c_flute" />);
    expect(screen.getByText(/Aún no hay datos/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /YouTube/ })).toHaveAttribute(
      'href', 'https://www.youtube.com/results?search_query=Fuego%20Billy%20Bunster'
    );
  });
});
