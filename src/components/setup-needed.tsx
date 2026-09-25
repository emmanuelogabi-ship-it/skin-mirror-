import { Card, Screen, T } from './ui';

// Shown when the app is started without Supabase keys in .env.
export default function SetupNeeded() {
  return (
    <Screen>
      <T variant="title">Almost there</T>
      <T muted>
        Skin Mirror needs its backend keys. Copy .env.example to .env, fill in your Supabase URL and
        anon key, then restart the app.
      </T>
      <Card>
        <T variant="small">EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co</T>
        <T variant="small">EXPO_PUBLIC_SUPABASE_ANON_KEY=…</T>
      </Card>
    </Screen>
  );
}
