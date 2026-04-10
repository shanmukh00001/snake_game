# Snake

Small Snake game for this repo with Firebase Google sign-in and Firestore-backed lifetime high scores.

## Run

Open `index.html` in a browser.

If you plan to use sign-in, do not use `file://` directly. Use your HTTPS deployed URL or run on `localhost`.

If you want a local server and already have Python installed:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Firebase setup

1. Create a Firebase project in the Firebase console.
2. Add a Web app to that project.
3. Enable `Authentication` and turn on `Google`.
4. Create a `Cloud Firestore` database.
5. Add your deployed site domain in `Authentication > Settings > Authorized domains` if you are running on Vercel or another host.
6. If you deploy on Vercel, add these environment variables for the project:
   `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID`
7. If you deploy on GitHub Pages, switch Pages source to `GitHub Actions` and add repository secrets with the same names:
   `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID`
8. For local testing, copy [firebase-config.local.example.json](C:\Users\Shannu\OneDrive - Indian Institute of Technology Indian School of Mines Dhanbad\Documents\New project\firebase-config.local.example.json) to `firebase-config.local.json` and fill in your values. This local file is gitignored.

Use Firestore rules like this so each signed-in user can only read and write their own score:

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /scores/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Manual verification

- Move with arrow keys and `WASD`.
- Use the on-screen buttons on mobile or a narrow viewport.
- Confirm the snake grows and the score increments after eating food.
- Confirm `Space` pauses and resumes the game.
- Confirm `Restart` resets the board, score, and snake length.
- Confirm the game ends when the snake hits a wall or itself.
- Sign in with Google.
- Confirm the lifetime best score appears after sign-in.
- Confirm a new higher score is saved and still appears after refresh/sign-in again.
