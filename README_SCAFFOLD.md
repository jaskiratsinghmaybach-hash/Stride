# STRIDE — Onboarding + Authentication

This update adds the merged first-run experience and authentication foundation.

Flow:
Welcome → Meet STRIDE → name → priorities → daily rhythm → Google OAuth → STRIDE.

Auth:
- Supabase Auth
- Google OAuth
- Persistent session with AsyncStorage
- Local onboarding/profile cache
- Expo deep-link callback

Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `.env`.

Then:
```bash
npm install
npm run dev
```

The existing `.git` directory, LICENSE and repository history are intentionally not included in this update ZIP, so extracting over `D:\project\Stride` preserves your Git repository.
