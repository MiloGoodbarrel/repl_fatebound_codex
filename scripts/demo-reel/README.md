# Feature reel

This isolated recording harness imports actual app screens with fictional,
in-memory API responses. It is not an application route, authentication bypass,
or production feature. No database connection or real user data is used.

Run `npx tsx scripts/demo-reel/record.ts`. Requires an existing app build in
`dist/public/assets`, FFmpeg, and `/repl/tools/bin/chromium`.
Outputs are ignored under `generated-artifacts/demo-reel/`.

The recording has a simplified presentation navigation bar, clearly marks demo
data, and exercises the real screen controls. Music is intentionally omitted
until the user supplies a track. Keep any later music mix separate from the
silent master. Use only music the user has permission to share.
