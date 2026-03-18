# Version Diff Report - Morodeutsch AI Tutor
**Generated:** 2026-03-13
**Repository:** https://github.com/Northtoto/moroo.git

---

## Executive Summary

| Version | Location | Commit | Date | Status |
|---------|----------|--------|------|--------|
| **v1 (Latest GitHub)** | origin/master | `2f84129` | 2026-03-12 | ✅ Synchronized |
| **v2 (Local Master)** | local master | `2f84129` | 2026-03-12 | ✅ Same as GitHub |
| **v3 (Local Working Dir)** | Working Directory | - | 2026-03-13 | 🔄 7 Uncommitted Changes |

**Key Finding:** GitHub and local master branches are synchronized. Only local working directory has modifications.

---

## Git Commit Timeline

### Commit 1: Latest (2026-03-12)
```
Hash:    2f84129aa0dc8cf8a16413fc6c36e7a87be728bc
Author:  Tarik
Date:    2026-03-12
Message: fix(phase-1b+2a): apply all critical bug fixes and add TTS feature
```

### Commit 2 (2026-03-11)
```
Hash:    d39f28543762604c8044d92476d88ae1937e5d22
Author:  Tarik
Date:    2026-03-11
Message: Phase 0: Complete AI tutor platform architecture and approval system
```

### Commit 3 (2026-03-09)
```
Hash:    aab0f1b3ed6dc35e1f34822f852e2a721c31ec13
Author:  Tarik
Date:    2026-03-09
Message: fix: Add error handling and type validation to protected routes and components
```

### Commit 4 (2026-03-09)
```
Hash:    cc93ca77fe81f330ba22068e2feab4182e790448
Author:  Tarik
Date:    2026-03-09
Message: fix: Address critical and high-priority issues across codebase
```

### Commit 5 (2026-03-09)
```
Hash:    7f2838263e48c6923de01445c95a31340f09702f
Author:  Tarik
Date:    2026-03-09
Message: feat: Add production n8n workflow architecture and documentation
```

### Commit 6: Initial (2026-03-08)
```
Hash:    22f5c00fccffa9968856fa1b403d0c805ab5c72c
Author:  Tarik
Date:    2026-03-08
Message: Initial commit from Create Next App
```

---

## Current Working Directory Changes (2026-03-13)

**Status:** 7 files modified, 0 staged for commit

### File Changes Summary
```
 .claude/launch.json                 |  6 ++++--  (2 insertions, 2 deletions)
 .claude/settings.local.json         |  3 ++-  (2 insertions, 1 deletion)
 n8n-workflows/audio-correction.json |  3 ++-  (2 insertions, 1 deletion)
 n8n-workflows/ocr-correction.json   |  1 +   (1 insertion)
 n8n-workflows/text-correction.json  |  1 +   (1 insertion)
 src/lib/supabase/client.ts          | 19 ++++++++-----------  (10 insertions, 9 deletions)
 src/lib/supabase/middleware.ts      | 18 +++++++++---------  (9 insertions, 9 deletions)
```

---

## Detailed Diffs by File

### 1. `.claude/launch.json`
**Type:** Configuration
**Changed:** 2026-03-13

```diff
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "Next.js Dev",
      "runtimeExecutable": "cmd",
      "runtimeArgs": ["/c", "npm", "run", "dev"],
-     "port": 3000
+     "port": 3000,
+     "autoPort": false
    },
    {
      "name": "n8n",
      "runtimeExecutable": "cmd",
      "runtimeArgs": ["/c", "n8n", "start"],
-     "port": 5678
+     "port": 5678,
+     "autoPort": false
    }
  ]
}
```

**Changes:**
- Added `"autoPort": false` to both dev server and n8n configurations
- Ensures fixed port assignments without automatic fallback

---

### 2. `.claude/settings.local.json`
**Type:** Configuration
**Changed:** 2026-03-13

```diff
{
  "disabledTools": [
    "Bash(if not exist \"C:\\\\Users\\\\Administrateur\\\\Downloads\\\\morodeutsh\\\\.claude\" mkdir \"C:\\\\Users\\\\Administrateur\\\\Downloads\\\\morodeutsh\\\\.claude\")",
    "mcp__Claude_Preview__preview_start",
    "Bash(xargs grep -l \"n8n\\\\|azure\\\\|openai\\\\|openrouter\" -i)",
-   "mcp__windows-agent__run_powershell"
+   "mcp__windows-agent__run_powershell",
+   "Bash(powershell -Command \":*)",
+   "Read(//tmp/**)"
  ]
}
```

**Changes:**
- Added PowerShell command execution to disabled tools
- Added read access restrictions to `/tmp` directories
- Security-focused configuration changes

---

### 3. `n8n-workflows/audio-correction.json`
**Type:** Workflow Configuration
**Changed:** 2026-03-13

```diff
{
  "name": "Audio Correction",
+ "active": true,
  "nodes": [
    {
      "parameters": {
        ...
-       "url": "={{ $env.AZURE_OPENAI_ENDPOINT }}/openai/deployments/{{ $env.AZURE_OPENAI_WHISPER_DEPLOYMENT }}/audio/transcriptions?api-version={{ $env.AZURE_OPENAI_API_VERSION }}",
+       "url": "={{ $env.AZURE_OPENAI_ENDPOINT }}/openai/deployments/{{ $env.AZURE_OPENAI_WHISPER_DEPLOYMENT }}/audio/transcriptions?api-version=2024-06-01",
        ...
      }
    }
  ]
}
```

**Changes:**
- Set workflow `active` flag to `true`
- Hardcoded Azure OpenAI API version to `2024-06-01` instead of using environment variable

---

### 4. `n8n-workflows/ocr-correction.json`
**Type:** Workflow Configuration
**Changed:** 2026-03-13

```diff
{
  "name": "OCR Correction",
+ "active": true,
  "nodes": [...]
}
```

**Changes:**
- Set workflow `active` flag to `true`

---

### 5. `n8n-workflows/text-correction.json`
**Type:** Workflow Configuration
**Changed:** 2026-03-13

```diff
{
  "name": "Text Correction",
+ "active": true,
  "nodes": [...]
}
```

**Changes:**
- Set workflow `active` flag to `true`

---

### 6. `src/lib/supabase/client.ts`
**Type:** TypeScript Source Code
**Changed:** 2026-03-13

```diff
 import { createBrowserClient } from '@supabase/ssr';

-function getEnvVar(key: string): string {
-  const value = process.env[key];
-  if (!value) {
-    throw new Error(`Missing environment variable: ${key}`);
-  }
-  return value;
-}
+// NEXT_PUBLIC_* vars must be accessed as static string literals
+// so Next.js can inline-replace them at build time (client bundle).
+const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
+const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
+
+if (!supabaseUrl) throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_URL');
+if (!supabaseAnonKey) throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY');
```

**Changes:**
- Removed `getEnvVar()` helper function
- Changed to direct static literal access for Supabase credentials
- Replaced generic error handling with specific variable checks
- Added comment explaining Next.js build-time inlining requirement

---

### 7. `src/lib/supabase/middleware.ts`
**Type:** TypeScript Source Code
**Changed:** 2026-03-13

```diff
 import { createServerClient } from '@supabase/ssr';
 import { NextResponse } from 'next/server';
 import type { NextRequest } from 'next/server';

-function getEnvVar(key: string): string {
-  const value = process.env[key];
-  if (!value) {
-    throw new Error(`Missing environment variable: ${key}`);
-  }
-  return value;
-}
+const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
+const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
+
+if (!supabaseUrl) throw new Error('Missing: NEXT_PUBLIC_SUPABASE_URL');
+if (!supabaseServiceRoleKey) throw new Error('Missing: SUPABASE_SERVICE_ROLE_KEY');
```

**Changes:**
- Removed `getEnvVar()` helper function
- Changed to direct environment variable assignment
- Replaced generic error handling with specific variable checks
- Shortened error messages for clarity

---

## Change Categories

### 🔧 Configuration Changes (4 files)
- `.claude/launch.json` - Fixed port configuration
- `.claude/settings.local.json` - Security restrictions
- `n8n-workflows/audio-correction.json` - API version hardcoding
- `n8n-workflows/ocr-correction.json` - Workflow activation
- `n8n-workflows/text-correction.json` - Workflow activation

### 📝 Code Refactoring (2 files)
- `src/lib/supabase/client.ts` - Removed helper function, direct env access
- `src/lib/supabase/middleware.ts` - Removed helper function, direct env access

---

## Analysis Summary

### Total Changes
- **Total Lines Added:** 27
- **Total Lines Removed:** 24
- **Net Change:** +3 lines
- **Files Modified:** 7
- **Commits in History:** 6
- **Date Range:** 2026-03-08 to 2026-03-13

### Key Patterns

1. **Build Optimization:** Changes in Supabase client files reflect Next.js best practices for client-side environment variables (static string literals for build-time inlining)

2. **Workflow Activation:** All three n8n workflows are now set to active status, indicating they're ready for use

3. **Configuration Hardening:**
   - Fixed port assignments prevent port conflicts
   - API version hardcoding ensures consistency
   - Simplified error messages improve debugging

4. **Code Simplification:** Removed generic `getEnvVar()` helper in favor of direct, explicit environment variable access

---

## Sync Status

✅ **GitHub Remote:** Synchronized with local master branch
✅ **Local Master:** Matches origin/master (commit `2f84129`)
⚠️ **Working Directory:** 7 uncommitted changes pending

**Next Steps:**
- Review the 7 local changes
- Decide whether to commit or discard
- Push to GitHub if approved

---

## File Locations

```
Local Repository: C:\Users\Administrateur\Downloads\morodeutsh
Remote Repository: https://github.com/Northtoto/moroo.git
Current Branch: master
```

