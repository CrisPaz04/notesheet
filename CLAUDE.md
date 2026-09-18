# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NoteSheet is a multiplataform music application for church musicians built as a monorepo. It features song management, playlists, metronome, chromatic tuner, and music transposition tools.

**Tech Stack:** React 19, Vite 6.2, Bootstrap 5.3, React Router 7, Firebase (Auth, Firestore, Storage), pnpm workspaces

## Commands

```bash
# Development
pnpm install          # Install all dependencies
pnpm web              # Start web dev server (localhost:5173)

# From apps/web/
npm run dev           # Start Vite dev server with HMR
npm run build         # Production build to dist/
npm run lint          # ESLint check
npm run preview       # Preview production build

# Mobile (planned)
pnpm mobile           # Start React Native
pnpm android          # Android build
pnpm ios              # iOS build
```

## Architecture

### Monorepo Structure

```
apps/web/             # Vite + React web application
packages/api/         # Firebase services layer (auth, songs, playlists, user, preferences)
packages/core/        # Music theory, audio utilities (metronome, tuner, pitch detection)
packages/ui/          # Shared UI components (planned)
```

### Web App Structure (apps/web/src/)

- **pages/** - Route-level components (Dashboard, SongEditor, SongView, PlaylistEditor, Metronome, Tuner, etc.)
- **components/** - Reusable components organized by feature (metronome/, tuner/, Navbar, Modal, ProtectedRoute)
- **hooks/** - Custom hooks (useMetronome, useTuner, useTheme, useModal, usePitchHistory, useTempoTrainer)
- **context/** - React Context (AuthContext for user state)
- **styles/** - Modular CSS (base/, components/, pages/, utilities/)

### Key Patterns

**Authentication:** Firebase Auth via AuthContext. Protected routes use `ProtectedRoute` wrapper. Access user state via `useAuth()` hook.

**State Management:** React Context API only, no Redux/Zustand. Feature-specific logic lives in custom hooks.

**Services:** Firebase SDK used directly via service functions in `packages/api/src/services/`. Components import and call these functions directly.

**Styling:** Bootstrap 5.3 base + custom CSS organized in modules. CSS variables for light/dark theming.

**Audio:** Web Audio API via `packages/core/src/audio/` for metronome synthesis and pitch detection.

## Security Rules

Firestore rules live in `firestore.rules` (deploy with `npx firebase-tools deploy --only firestore`).
The `role` field on `users/{uid}` is **not** writable by the user — assign roles from the Firebase
console or the Admin SDK. Client-side `EditorRoute` / `canEditSongs` are UX only; the rules are the
actual permission boundary.

## Environment Variables

Vite requires `VITE_` prefix. Firebase credentials go in the **repo-root** `.env` (see `.env.example`);
`apps/web/vite.config.js` sets `envDir` to the monorepo root so Vite picks it up:

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_MEASUREMENT_ID
```

## Deployment

Netlify auto-deploys from `master` branch. Configuration in `netlify.toml`:
- Base directory: `apps/web`
- Build command: `npm run build`
- Publish directory: `dist`
- SPA redirect rule configured

## Notes

- No TypeScript - pure JavaScript
- Vitest configured; 206 tests in `apps/web/src/test/` (run with `pnpm test:run`)
- The song rendering pipeline (transposición → instrumento → notación → formato)
  lives in `packages/core/src/music/songRendering.js`. Úsalo en vez de encadenar
  `transposeContent` / `transposeForInstrument` / `convertNotationSystem` a mano.
- `packages/ui` sigue vacío a propósito (ver el comentario en su `index.js`)
- Spanish comments appear in some files
- Mobile app (React Native) is planned but not yet implemented
