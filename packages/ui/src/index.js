// packages/ui/src/index.js
//
// Paquete de componentes compartidos. Todavía vacío a propósito.
//
// La idea original era compartir UI entre la app web y la app móvil, pero
// la móvil está planteada en React Native: los componentes de apps/web
// (Bootstrap + DOM) no son reutilizables ahí tal cual. Mover componentes
// aquí ahora solo añadiría una capa de indirección con un único consumidor.
//
// Tiene sentido empezar a llenarlo cuando se cumpla una de estas dos cosas:
//   1. Aparezca una segunda app web (p. ej. un panel de administración) que
//      necesite los mismos componentes presentacionales — los candidatos
//      serían LoadingSpinner, Modal, KeySelector, TypeSelector e
//      InstrumentSelector, que no dependen de Firebase.
//   2. Se arranque la app móvil y se extraiga aquí la lógica de presentación
//      agnóstica de plataforma (hooks y helpers, no JSX).
//
// Mientras tanto, la lógica que sí se comparte vive en @notesheet/core.

export const version = '0.1.0';
