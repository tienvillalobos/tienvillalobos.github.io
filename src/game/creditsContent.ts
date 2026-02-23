/**
 * Texto de los créditos del juego.
 * Edita este archivo para cambiar lo que se muestra en la pantalla de victoria (/credits).
 */

export type CreditLineType = 'title' | 'subtitle' | 'line';

export interface CreditLine {
  type: CreditLineType;
  text: string;
}

export const VICTORY_CREDITS: CreditLine[] = [
  { type: 'title', text: 'VICTORIA' },
  { type: 'subtitle', text: 'Has salvado a Maxxa' },
  { type: 'line', text: '' },
  { type: 'subtitle', text: 'LA MAXXA VELADA' },
  { type: 'line', text: '' },
  { type: 'line', text: 'Direccion' },
  { type: 'line', text: 'Jorge Vidal' },
  { type: 'line', text: '' },
  { type: 'line', text: 'Arte y diseno' },
  { type: 'line', text: 'Jorge Vidal' },
  { type: 'line', text: '' },
  { type: 'line', text: 'Programacion' },
  { type: 'line', text: 'Jorge Vidal' },
  { type: 'line', text: '' },
  { type: 'line', text: 'Musica y sonido' },
  { type: 'line', text: 'Jorge Vidal' },
  { type: 'line', text: '' },
  { type: 'line', text: 'Gracias por jugar' },
  { type: 'line', text: '' },
  { type: 'line', text: 'SPACE/ENTER - Volver al menu' },
];
