# n8n MCP Server Setup

This document explains how to set up and use the n8n MCP server to connect Claude Code to your local n8n instance.

## What's Been Fixed

1. **Fixed global settings.json** - Corrected invalid JSON syntax in `C:\Users\Administrateur\.claude\settings.json`
2. **Created MCP configuration** - Added `.claude/mcp.n8n.json` to configure the n8n MCP server
3. **Created MCP server** - Implemented `mcp-server-n8n.mjs` with tools to interact with n8n workflows
4. **Installed dependencies** - Added `@modelcontextprotocol/sdk` to package.json

## Configuration Files

### 1. Global Settings (.claude/settings.json)
The global settings now correctly enable the n8n MCP server:
```json
"enabledMcpjsonServers": [
  "n8n"
]
```

### 2. MCP Configuration (.claude/mcp.n8n.json)
```json
{
  "mcpServers": {
    "n8n": {
      "command": "node",
      "args": [
        "C:\\Users\\Administrateur\\Downloads\\morodeutsh\\mcp-server-n8n.mjs"
      ],
      "env": {
        "N8N_API_URL": "http://localhost:5678/api/v1",
        "N8N_API_KEY": ""
      }
    }
  }
}
```

## Setting Up n8n API Key

### Option 1: Running n8n without API Key (Development)
For local development, you can run n8n without authentication:
```bash
n8n start
```

### Option 2: Using API Key (Recommended for Production)
1. Start n8n and log in to the UI at http://localhost:5678
2. Go to Settings → API
3. Create a new API key
4. Copy the API key
5. Update `.claude/mcp.n8n.json` with your API key:
   ```json
   "N8N_API_KEY": "your-api-key-here"
   ```

## Available MCP Tools

Once configured, Claude Code can use these tools to interact with n8n:

- `list_workflows` - List all workflows in n8n
- `get_workflow` - Get details of a specific workflow
- `execute_workflow` - Execute a workflow with optional input data
- `get_executions` - Get workflow execution history
- `activate_workflow` - Activate or deactivate a workflow

## Usage Examples

### List all workflows
```
Can you list all my n8n workflows?
```

### Execute a workflow
```
Execute the workflow with ID "abc123" with this data: {"name": "John"}
```

### Get workflow executions
```
Show me the recent executions for workflow "abc123"
```

## Troubleshooting

### MCP server not connecting
1. Make sure n8n is running on http://localhost:5678
2. Check that the API key is correct (if using authentication)
3. Verify the path in `mcp.n8n.json` is correct
4. Restart Claude Code after making configuration changes

### n8n not on default port
If your n8n instance runs on a different port, update the `N8N_API_URL` in `.claude/mcp.n8n.json`:
```json
"N8N_API_URL": "http://localhost:YOUR_PORT/api/v1"
```

### Testing the connection
Start n8n:
```bash
n8n start
```

Then ask Claude Code:
```
Can you list my n8n workflows?
```

## Next Steps

1. Start n8n: `n8n start` (or use the launch configuration)
2. Restart Claude Code to load the MCP server
3. Test the connection by asking Claude to list your workflows
4. Set up an API key for secure access (optional but recommended)
