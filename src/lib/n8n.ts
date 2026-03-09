const N8N_BASE = process.env.N8N_WEBHOOK_BASE_URL || 'http://localhost:5678';
const N8N_SECRET = process.env.N8N_WEBHOOK_SECRET || '';

export async function callN8nWorkflow(
  workflow: string,
  data: Record<string, unknown>,
  jwt: string
): Promise<Record<string, unknown>> {
  const res = await fetch(`${N8N_BASE}/webhook/${workflow}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
      'X-Webhook-Secret': N8N_SECRET,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    throw new Error(`n8n workflow "${workflow}" failed: ${res.status}`);
  }

  return res.json();
}

export async function callN8nWorkflowWithFile(
  workflow: string,
  formData: FormData,
  jwt: string
): Promise<Record<string, unknown>> {
  formData.append('jwt', jwt);

  const res = await fetch(`${N8N_BASE}/webhook/${workflow}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'X-Webhook-Secret': N8N_SECRET,
    },
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`n8n workflow "${workflow}" failed: ${res.status}`);
  }

  return res.json();
}
