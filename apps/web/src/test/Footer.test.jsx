import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Footer from '../components/Footer';

describe('Footer', () => {
  // La API de GetSongBPM exige un enlace visible a su web; si falta,
  // suspenden la clave sin avisar y la app se queda sin tempo ni tonalidad.
  it('enlaza a getsongbpm.com, como exige su API', () => {
    render(<Footer />);
    const enlace = screen.getByRole('link', { name: 'GetSongBPM' });
    expect(enlace).toHaveAttribute('href', 'https://getsongbpm.com');
    expect(enlace.getAttribute('rel') || '').not.toMatch(/nofollow/);
  });
});
