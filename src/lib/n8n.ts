function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (!value) {
    if (defaultValue) {
      return defaultValue;
    }
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
}

const N8N_BASE = getEnvVar('N8N_WEBHOOK_BASE_URL', 'http://localhost:5678');
const N8N_SECRET = getEnvVar('N8N_WEBHOOK_SECRET');

/** Returns true if the n8n service is reachable. */
export async function checkN8nHealth(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${N8N_BASE}/healthz`, { signal: controller.signal });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

const WORKFLOW_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 2;

const RETRYABLE_CODES = new Set(['ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET', 'EAI_AGAIN']);

async function callN8nWithRetry(
  workflow: string,
  init: RequestInit,
  retries = 0
): Promise<Response> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), WORKFLOW_TIMEOUT);

    try {
      const res = await fetch(`${N8N_BASE}/webhook/${workflow}`, {
        ...init,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return res;
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('The AI service is taking too long to respond. Please try again in a moment.');
    }
    const code = (error as NodeJS.ErrnoException).code;
    if (retries < MAX_RETRIES && code && RETRYABLE_CODES.has(code)) {
      console.warn(`Workflow "${workflow}" network error (${code}), retrying... (${retries + 1}/${MAX_RETRIES})`);
      return callN8nWithRetry(workflow, init, retries + 1);
    }
    if (error instanceof TypeError || (code && RETRYABLE_CODES.has(code))) {
      throw new Error('The AI service is currently unavailable. Please try again later.');
    }
    throw error;
  }
}

export async function callN8nWorkflow(
  workflow: string,
  data: Record<string, unknown>,
  jwt: string
): Promise<Record<string, unknown>> {
  if (!workflow || typeof workflow !== 'string') {
    throw new Error('Invalid workflow name provided');
  }

  const res = await callN8nWithRetry(workflow, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
      'X-Webhook-Secret': N8N_SECRET,
    },
    body: JSON.stringify(data),
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error('Unauthorized: Invalid JWT or webhook secret');
  }

  if (res.status === 404) {
    throw new Error(`Workflow "${workflow}" not found`);
  }

  if (!res.ok) {
    const errorText = await res.text().catch(() => 'Unknown error');
    throw new Error(`n8n workflow "${workflow}" failed: ${res.status} - ${errorText}`);
  }

  try {
    return await res.json();
  } catch {
    throw new Error('Failed to parse n8n workflow response');
  }
}

export async function callN8nWorkflowWithFile(
  workflow: string,
  formData: FormData,
  jwt: string
): Promise<Record<string, unknown>> {
  if (!workflow || typeof workflow !== 'string') {
    throw new Error('Invalid workflow name provided');
  }

  if (!formData) {
    throw new Error('FormData is required');
  }

  const res = await callN8nWithRetry(workflow, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'X-Webhook-Secret': N8N_SECRET,
    },
    body: formData,
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error('Unauthorized: Invalid JWT or webhook secret');
  }

  if (res.status === 404) {
    throw new Error(`Workflow "${workflow}" not found`);
  }

  if (!res.ok) {
    const errorText = await res.text().catch(() => 'Unknown error');
    throw new Error(`n8n workflow "${workflow}" failed: ${res.status} - ${errorText}`);
  }

  try {
    return await res.json();
  } catch {
    throw new Error('Failed to parse n8n workflow response');
  }
}
