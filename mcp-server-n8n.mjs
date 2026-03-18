#!/usr/bin/env node

/**
 * n8n MCP Server
 * Provides tools to interact with n8n workflows via the n8n API
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const N8N_API_URL = process.env.N8N_API_URL || 'http://localhost:5678/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY || '';

class N8nMcpServer {
  constructor() {
    this.server = new Server(
      {
        name: 'n8n-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  async fetchN8n(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(N8N_API_KEY && { 'X-N8N-API-KEY': N8N_API_KEY }),
    };

    const response = await fetch(`${N8N_API_URL}${endpoint}`, {
      ...options,
      headers: { ...headers, ...options.headers },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`n8n API error: ${response.status} - ${error}`);
    }

    return await response.json();
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'list_workflows',
          description: 'List all workflows in n8n',
          inputSchema: {
            type: 'object',
            properties: {
              active: {
                type: 'boolean',
                description: 'Filter by active status',
              },
            },
          },
        },
        {
          name: 'get_workflow',
          description: 'Get details of a specific workflow',
          inputSchema: {
            type: 'object',
            properties: {
              workflowId: {
                type: 'string',
                description: 'The workflow ID',
              },
            },
            required: ['workflowId'],
          },
        },
        {
          name: 'execute_workflow',
          description: 'Execute a workflow',
          inputSchema: {
            type: 'object',
            properties: {
              workflowId: {
                type: 'string',
                description: 'The workflow ID to execute',
              },
              data: {
                type: 'object',
                description: 'Input data for the workflow',
              },
            },
            required: ['workflowId'],
          },
        },
        {
          name: 'get_executions',
          description: 'Get workflow executions',
          inputSchema: {
            type: 'object',
            properties: {
              workflowId: {
                type: 'string',
                description: 'Filter by workflow ID',
              },
              limit: {
                type: 'number',
                description: 'Number of executions to return',
                default: 20,
              },
            },
          },
        },
        {
          name: 'activate_workflow',
          description: 'Activate or deactivate a workflow',
          inputSchema: {
            type: 'object',
            properties: {
              workflowId: {
                type: 'string',
                description: 'The workflow ID',
              },
              active: {
                type: 'boolean',
                description: 'Set workflow active status',
              },
            },
            required: ['workflowId', 'active'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        switch (request.params.name) {
          case 'list_workflows': {
            const { active } = request.params.arguments;
            let endpoint = '/workflows';
            if (active !== undefined) {
              endpoint += `?active=${active}`;
            }
            const data = await this.fetchN8n(endpoint);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(data, null, 2),
                },
              ],
            };
          }

          case 'get_workflow': {
            const { workflowId } = request.params.arguments;
            const data = await this.fetchN8n(`/workflows/${workflowId}`);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(data, null, 2),
                },
              ],
            };
          }

          case 'execute_workflow': {
            const { workflowId, data: inputData } = request.params.arguments;
            const result = await this.fetchN8n(`/workflows/${workflowId}/execute`, {
              method: 'POST',
              body: JSON.stringify(inputData || {}),
            });
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'get_executions': {
            const { workflowId, limit = 20 } = request.params.arguments;
            let endpoint = `/executions?limit=${limit}`;
            if (workflowId) {
              endpoint += `&workflowId=${workflowId}`;
            }
            const data = await this.fetchN8n(endpoint);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(data, null, 2),
                },
              ],
            };
          }

          case 'activate_workflow': {
            const { workflowId, active } = request.params.arguments;
            const data = await this.fetchN8n(`/workflows/${workflowId}`, {
              method: 'PATCH',
              body: JSON.stringify({ active }),
            });
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(data, null, 2),
                },
              ],
            };
          }

          default:
            throw new Error(`Unknown tool: ${request.params.name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('n8n MCP server running on stdio');
  }
}

const server = new N8nMcpServer();
server.run().catch(console.error);
