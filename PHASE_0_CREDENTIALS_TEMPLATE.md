# Phase 0: Credentials Collection Template

> Use this template to gather all required credentials before fixing Blocker #1

---

## Instructions

1. For each section below, follow the "How to get" instructions
2. Copy the value and paste into the template
3. Keep this file PRIVATE (don't commit to Git)
4. Once all values collected, provide to Claude for .env.local update

---

## Supabase Credentials

### NEXT_PUBLIC_SUPABASE_URL
**Where to get**: Supabase Project Settings → API

```
Your value: ___________________________________
```

**How to get**:
1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Select your morodeutsch project
3. Click "Settings" (bottom of left sidebar)
4. Click "API" tab
5. Copy the "Project URL" under "Configuration"
6. Example: `https://[project-ref].supabase.co`

---

### NEXT_PUBLIC_SUPABASE_ANON_KEY
**Where to get**: Supabase Project Settings → API

```
Your value: ___________________________________
```

**How to get**:
1. Same location as above (Project Settings → API)
2. Copy "anon public" key under "Project API keys"
3. This is a long string starting with "eyJ..."

---

### SUPABASE_SERVICE_ROLE_KEY
**Where to get**: Supabase Project Settings → API

```
Your value: ___________________________________
```

**How to get**:
1. Same location as above (Project Settings → API)
2. Copy "service_role secret" key under "Project API keys"
3. ⚠️ This is sensitive - keep it SECRET, don't share
4. This is a long string starting with "eyJ..."

---

## n8n Credentials

### N8N_WEBHOOK_BASE_URL
**Where to get**: Your n8n installation

```
Your value: ___________________________________
```

**How to get**:
1. For local development: `http://localhost:5678`
2. For hosted n8n: Use your n8n instance URL
3. Example: `http://localhost:5678` or `https://n8n.yourdomain.com`

---

### N8N_WEBHOOK_SECRET
**Where to get**: Generate a secure random string

```
Your value: ___________________________________
```

**How to generate**:
1. Open terminal/PowerShell
2. Run this command to generate secure random string:
   ```powershell
   # PowerShell
   -join ((33..126) | Get-Random -Count 32 | % {[char]$_})
   ```
3. Or use online generator: [https://www.random.org/strings/](https://www.random.org/strings/)
4. Generate a 32-character string
5. Copy the generated string here

---

### N8N_PASSWORD
**Where to get**: Your n8n admin password

```
Your value: ___________________________________
```

**How to get**:
1. Start n8n if not already running
2. Visit `http://localhost:5678`
3. If first time: Set admin password
4. If already set: Use existing password
5. ⚠️ This is sensitive - keep it SECRET
6. You'll use this to log into n8n UI

---

## Azure OpenAI Credentials

### AZURE_OPENAI_ENDPOINT
**Where to get**: Azure Portal

```
Your value: ___________________________________
```

**How to get**:
1. Go to [https://portal.azure.com](https://portal.azure.com)
2. Find your OpenAI resource
3. Click "Keys and Endpoint" in left sidebar
4. Copy "Endpoint" URL
5. Format: `https://[resource-name].openai.azure.com/`
6. ⚠️ Include the trailing slash `/`

---

### AZURE_OPENAI_API_KEY
**Where to get**: Azure Portal

```
Your value: ___________________________________
```

**How to get**:
1. Same location as ENDPOINT (Keys and Endpoint)
2. Copy "Key 1" or "Key 2" (either works)
3. ⚠️ This is sensitive - keep it SECRET
4. Long string of letters and numbers

---

### AZURE_OPENAI_GPT_DEPLOYMENT
**Where to get**: Azure OpenAI Studio

```
Your value: ___________________________________
```

**How to get**:
1. Go to [https://oai.azure.com/](https://oai.azure.com/)
2. Sign in with your Azure account
3. Go to "Deployments" section
4. Find your GPT deployment (likely gpt-5.2 or gpt-4)
5. Copy deployment name
6. ⚠️ This must match EXACTLY what's deployed
7. Example: `gpt-5.2`

---

### AZURE_OPENAI_WHISPER_DEPLOYMENT
**Where to get**: Azure OpenAI Studio

```
Your value: ___________________________________
```

**How to get**:
1. Same location as GPT deployment (Deployments)
2. Find your Whisper deployment (speech-to-text)
3. Copy deployment name
4. ⚠️ This must match EXACTLY what's deployed
5. Example: `whisper`

---

### AZURE_OPENAI_API_VERSION
**Where to get**: This is standard

```
Your value: 2024-12-01-preview
```

**Note**: This is fixed value, don't change it

---

## App Configuration

### NEXT_PUBLIC_APP_URL
**Where to get**: This is your local development URL

```
Your value: http://localhost:3000
```

**Note**: For local development, always use `http://localhost:3000`

---

## Verification Checklist

Before providing credentials to Claude, verify:

- [ ] All 11 values filled in above (including the standard ones)
- [ ] No placeholder values (like "your-anon-key")
- [ ] No "undefined" or empty values
- [ ] Sensitive values (API keys) not shared anywhere unsafe
- [ ] Azure deployment names match EXACTLY what's in Azure
- [ ] Supabase project URL ends with `.supabase.co`

---

## Next Steps

Once all values collected:

1. Keep this file PRIVATE (don't commit)
2. Provide values to Claude (or copy into .env.local manually)
3. Claude will update `.env.local` with these values
4. Proceed to Blockers #2-5

---

## Common Issues

### "I can't find my Azure deployment name"
→ Go to [https://oai.azure.com/](https://oai.azure.com/) → Deployments → Check list

### "Which Supabase key should I use?"
→ Use "anon public" for NEXT_PUBLIC_SUPABASE_ANON_KEY  
→ Use "service_role secret" for SUPABASE_SERVICE_ROLE_KEY

### "Is it safe to give you these credentials?"
→ Only share with trusted instances  
→ Don't commit `.env.local` to Git  
→ Regenerate keys if accidentally exposed

---

## Do NOT share publicly

⚠️ Keep credentials private:
- Don't paste into public chat
- Don't commit `.env.local` to Git
- Don't share screenshots with keys visible
- Rotate keys if accidentally exposed

