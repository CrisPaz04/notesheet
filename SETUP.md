# NoteSheet Setup Guide

## Prerequisites

- Node.js 18 or higher
- pnpm package manager (`npm install -g pnpm`)
- Firebase account with a project created

## Local Development Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd notesheet
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Configure Firebase Environment Variables

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Get your Firebase credentials:
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Select your project (or create a new one)
   - Go to **Project Settings** (gear icon) > **General**
   - Scroll down to **Your apps** section
   - Click on your web app or create a new web app
   - Copy the configuration values

3. Edit `.env` file and replace the placeholder values:
   ```env
   VITE_FIREBASE_API_KEY=your_actual_api_key_here
   VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project_id.firebasestorage.app
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
   ```

4. **IMPORTANT**: Never commit the `.env` file to git. It's already in `.gitignore`.

### 4. Firebase Services Setup

Make sure these Firebase services are enabled in your project:

1. **Authentication**:
   - Go to Authentication > Sign-in method
   - Enable **Email/Password**
   - Enable **Google** (optional but recommended)

2. **Firestore Database**:
   - Go to Firestore Database
   - Create database (start in test mode for development)
   - Update security rules as needed

3. **Cloud Storage**:
   - Go to Storage
   - Get started (default rules are fine for development)

### 5. Run Development Server

```bash
pnpm dev
```

The app should now be running at `http://localhost:5173` (or another port if 5173 is busy).

### 6. Build for Production

```bash
pnpm build
```

## Deploying to Netlify

### Option 1: Netlify UI (Recommended for first deploy)

1. Push your code to GitHub/GitLab/Bitbucket
2. Go to [Netlify](https://app.netlify.com/)
3. Click **Add new site** > **Import an existing project**
4. Connect your repository
5. Configure build settings:
   - **Base directory**: `apps/web`
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
6. **Before deploying**, click **Show advanced** > **New variable**
7. Add all environment variables from your `.env` file:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_FIREBASE_MEASUREMENT_ID`
8. Click **Deploy site**

### Option 2: Netlify CLI

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Deploy
netlify deploy --prod
```

When prompted:
- Choose **Create & configure a new site**
- Set environment variables in Netlify UI after first deploy

### Updating Environment Variables in Netlify

1. Go to your site in Netlify dashboard
2. Navigate to **Site settings** > **Environment variables**
3. Click **Add a variable** or **Edit variables**
4. Add or modify variables
5. Click **Save**
6. Trigger a new deploy for changes to take effect

## Firebase Security Rules

### Firestore Rules (Production)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper functions
    function isSignedIn() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isSignedIn() && request.auth.uid == userId;
    }

    // Songs collection
    match /songs/{songId} {
      allow read: if isSignedIn();
      allow create: if isSignedIn();
      allow update, delete: if isOwner(resource.data.userId);
    }

    // Playlists collection
    match /playlists/{playlistId} {
      allow read: if isSignedIn() || resource.data.public == true;
      allow create: if isSignedIn();
      allow update, delete: if isOwner(resource.data.creatorId);
    }

    // Users collection
    match /users/{userId} {
      allow read: if isSignedIn();
      allow write: if isOwner(userId);
    }
  }
}
```

### Storage Rules (Production)

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /songs/{userId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Troubleshooting

### "Firebase: Error (auth/invalid-api-key)"
- Check that your `.env` file exists and has the correct API key
- Restart the dev server after changing environment variables

### "Firebase: Error (auth/unauthorized-domain)"
- Add your domain to Firebase Console:
  - Go to Authentication > Settings > Authorized domains
  - Add `localhost` for local development
  - Add your Netlify domain for production (e.g., `your-app.netlify.app`)

### Environment variables not working
- Make sure variable names start with `VITE_` (required for Vite)
- Restart dev server after adding/changing variables
- Check that variables are set in Netlify dashboard for production

### Build fails on Netlify
- Verify all environment variables are set in Netlify
- Check build logs for specific errors
- Ensure Node version matches (18+)

## Security Best Practices

1. ✅ **Never commit `.env` files** - Already in `.gitignore`
2. ✅ **Use environment variables** - Implemented in this setup
3. ⚠️ **Update Firebase security rules** - Default rules are too permissive
4. ⚠️ **Restrict API key usage** - Configure in Firebase Console > Project Settings > API Keys
5. ⚠️ **Enable App Check** - Protect against abuse (optional but recommended)
6. ⚠️ **Use HTTPS only** - Automatically handled by Netlify

## Project Structure

```
notesheet/
├── .env                    # Local environment variables (DO NOT COMMIT)
├── .env.example            # Template for environment variables
├── apps/
│   └── web/                # React web application
├── packages/
│   ├── api/                # Firebase API services
│   ├── core/               # Music theory utilities
│   └── ui/                 # Shared UI components
└── netlify.toml            # Netlify deployment config
```

## Need Help?

- [Firebase Documentation](https://firebase.google.com/docs)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
- [Netlify Environment Variables](https://docs.netlify.com/environment-variables/overview/)
- [React Router Documentation](https://reactrouter.com/)
