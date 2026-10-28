---
name: Isolated browser video capture
description: Environment-specific constraint when recording promotional footage of private app screens
---

Record private app features with a separate synthetic-data browser harness, never a temporary authentication bypass in the real app. Label fictional data on-screen.

**Why:** A screenshot browser cannot sign in to the app; a demo harness can use the actual screen components without exposing accounts or changing campaign records.

**How to apply:** For browser recordings in this environment, install Playwright's separate FFmpeg binary if missing (`npx playwright install ffmpeg`), and save the recorded video before closing the browser context. The system FFmpeg can transcode the result but does not replace Playwright's recording binary.
