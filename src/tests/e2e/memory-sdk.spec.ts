import { describe, test, beforeEach, expect, afterEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  ListToolsResultSchema,
  CallToolResultSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from 'fs';
import path from 'path';
import os from 'os';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { MemoryStorage } from '../../lib/memory-storage.js';
import { z } from 'zod';

describe("Memory MCP Server E2E (in‐memory)", () => {
  let mcpServer: McpServer;
  let client: Client;
  let clientTransport: ReturnType<typeof InMemoryTransport.createLinkedPair>[0];
  let serverTransport: ReturnType<typeof InMemoryTransport.createLinkedPair>[1];
  let testDir: string;
  let memoryStorage: MemoryStorage;

  beforeEach(async () => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-test-'));
    const globalStorageLocation = path.join(testDir, 'global');
    const localStorageLocation = path.join(testDir, 'local');
    
    fs.mkdirSync(globalStorageLocation, { recursive: true });
    fs.mkdirSync(localStorageLocation, { recursive: true });
    
    memoryStorage = new MemoryStorage(globalStorageLocation, localStorageLocation);
    
    mcpServer = new McpServer(
      {
        name: '@mkusaka/mcp-server-memory',
        version: '0.0.4',
      },
      {
        instructions: 'Test instructions',
      }
    );

    mcpServer.tool(
      'remember_memory',
      'Stores a memory with optional tags in a specified category',
      {
        category: z.string().min(1).describe('The category to store the memory in'),
        data: z.string().min(1).describe('The data to store in memory'),
        tags: z
          .array(z.string())
          .optional()
          .default([])
          .describe('Optional tags for categorizing the memory'),
        is_global: z.boolean().describe('Whether to store in global or local memory'),
      },
      async ({ category, data, tags, is_global }) => {
        await memoryStorage.remember(category, data, tags || [], is_global);
        return {
          content: [
            {
              type: 'text',
              text: `Stored memory in category: ${category}`,
            },
          ],
        };
      }
    );

    mcpServer.tool(
      'retrieve_memories',
      'Retrieves all memories from a specified category',
      {
        category: z
          .string()
          .min(1)
          .describe("The category to retrieve memories from, use '*' for all categories"),
        is_global: z.boolean().describe('Whether to retrieve from global or local memory'),
      },
      async ({ category, is_global }) => {
        let memories;
        if (category === '*') {
          memories = await memoryStorage.retrieveAll(is_global);
        } else {
          memories = await memoryStorage.retrieve(category, is_global);
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(memories, null, 2),
            },
          ],
        };
      }
    );

    mcpServer.tool(
      'remove_memory_category',
      'Removes all memories within a specified category',
      {
        category: z.string().min(1).describe("The category to remove, use '*' for all categories"),
        is_global: z.boolean().describe('Whether to remove from global or local memory'),
      },
      async ({ category, is_global }) => {
        if (category === '*') {
          await memoryStorage.clearAllGlobalOrLocalMemories(is_global);
          return {
            content: [
              {
                type: 'text',
                text: `Cleared all ${is_global ? 'global' : 'local'} memory categories`,
              },
            ],
          };
        } else {
          await memoryStorage.clearMemory(category, is_global);
          return {
            content: [
              {
                type: 'text',
                text: `Cleared memories in category: ${category}`,
              },
            ],
          };
        }
      }
    );

    mcpServer.tool(
      'remove_specific_memory',
      'Removes a specific memory within a specified category',
      {
        category: z.string().min(1).describe('The category containing the memory to remove'),
        memory_content: z.string().min(1).describe('Content of the memory to remove (partial match)'),
        is_global: z.boolean().describe('Whether to remove from global or local memory'),
      },
      async ({ category, memory_content, is_global }) => {
        await memoryStorage.removeSpecificMemory(category, memory_content, is_global);
        return {
          content: [
            {
              type: 'text',
              text: `Removed specific memory from category: ${category}`,
            },
          ],
        };
      }
    );

    client = new Client({ name: "test client", version: "1.0" });
    [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([
      mcpServer.connect(serverTransport),
      client.connect(clientTransport),
    ]);
  });

  test("tools/list returns all memory tools", async () => {
    const res = await client.request(
      { method: "tools/list", params: {} },
      ListToolsResultSchema,
    );
    expect(Array.isArray(res.tools)).toBe(true);
    expect(res.tools.length).toBe(4);
    
    const toolNames = res.tools.map(tool => tool.name);
    expect(toolNames).toContain('remember_memory');
    expect(toolNames).toContain('retrieve_memories');
    expect(toolNames).toContain('remove_memory_category');
    expect(toolNames).toContain('remove_specific_memory');
  });

  test("remember_memory tool stores memory correctly", async () => {
    const storeRes = await client.request(
      {
        method: "tools/call",
        params: { 
          name: "remember_memory", 
          arguments: { 
            category: "test_category", 
            data: "Test memory data", 
            tags: ["test", "memory"], 
            is_global: true 
          } 
        },
      },
      CallToolResultSchema,
    );
    expect(storeRes.content[0].text).toBe("Stored memory in category: test_category");
    
    const retrieveRes = await client.request(
      {
        method: "tools/call",
        params: { 
          name: "retrieve_memories", 
          arguments: { 
            category: "test_category", 
            is_global: true 
          } 
        },
      },
      CallToolResultSchema,
    );
    
    const memories = JSON.parse(retrieveRes.content[0].text as string);
    expect(memories).toHaveProperty("test memory");
    expect(memories["test memory"]).toContain("Test memory data");
  });

  test("retrieve_memories tool returns all memories", async () => {
    await client.request(
      {
        method: "tools/call",
        params: { 
          name: "remember_memory", 
          arguments: { 
            category: "category1", 
            data: "Memory 1", 
            tags: ["tag1"], 
            is_global: false 
          } 
        },
      },
      CallToolResultSchema,
    );
    
    await client.request(
      {
        method: "tools/call",
        params: { 
          name: "remember_memory", 
          arguments: { 
            category: "category2", 
            data: "Memory 2", 
            tags: ["tag2"], 
            is_global: false 
          } 
        },
      },
      CallToolResultSchema,
    );
    
    const retrieveAllRes = await client.request(
      {
        method: "tools/call",
        params: { 
          name: "retrieve_memories", 
          arguments: { 
            category: "*", 
            is_global: false 
          } 
        },
      },
      CallToolResultSchema,
    );
    
    const allMemories = JSON.parse(retrieveAllRes.content[0].text as string);
    expect(Object.keys(allMemories).length).toBe(2);
    expect(allMemories).toHaveProperty("category1");
    expect(allMemories).toHaveProperty("category2");
  });

  test("remove_memory_category tool removes category", async () => {
    await client.request(
      {
        method: "tools/call",
        params: { 
          name: "remember_memory", 
          arguments: { 
            category: "to_remove", 
            data: "Memory to remove", 
            tags: [], 
            is_global: true 
          } 
        },
      },
      CallToolResultSchema,
    );
    
    const removeRes = await client.request(
      {
        method: "tools/call",
        params: { 
          name: "remove_memory_category", 
          arguments: { 
            category: "to_remove", 
            is_global: true 
          } 
        },
      },
      CallToolResultSchema,
    );
    expect(removeRes.content[0].text).toBe("Cleared memories in category: to_remove");
    
    const retrieveRes = await client.request(
      {
        method: "tools/call",
        params: { 
          name: "retrieve_memories", 
          arguments: { 
            category: "*", 
            is_global: true 
          } 
        },
      },
      CallToolResultSchema,
    );
    
    const memories = JSON.parse(retrieveRes.content[0].text as string);
    expect(Object.keys(memories).length).toBe(0);
  });

  test("remove_specific_memory tool removes specific memory", async () => {
    await client.request(
      {
        method: "tools/call",
        params: { 
          name: "remember_memory", 
          arguments: { 
            category: "mixed", 
            data: "Keep this memory", 
            tags: ["keep"], 
            is_global: false 
          } 
        },
      },
      CallToolResultSchema,
    );
    
    await client.request(
      {
        method: "tools/call",
        params: { 
          name: "remember_memory", 
          arguments: { 
            category: "mixed", 
            data: "Remove this memory", 
            tags: ["remove"], 
            is_global: false 
          } 
        },
      },
      CallToolResultSchema,
    );
    
    const removeSpecificRes = await client.request(
      {
        method: "tools/call",
        params: { 
          name: "remove_specific_memory", 
          arguments: { 
            category: "mixed", 
            memory_content: "Remove this", 
            is_global: false 
          } 
        },
      },
      CallToolResultSchema,
    );
    expect(removeSpecificRes.content[0].text).toBe("Removed specific memory from category: mixed");
    
    const retrieveRes = await client.request(
      {
        method: "tools/call",
        params: { 
          name: "retrieve_memories", 
          arguments: { 
            category: "mixed", 
            is_global: false 
          } 
        },
      },
      CallToolResultSchema,
    );
    
    const memories = JSON.parse(retrieveRes.content[0].text as string);
    expect(Object.keys(memories).length).toBe(1);
    expect(memories).toHaveProperty("keep");
    expect(memories["keep"]).toContain("Keep this memory");
  });
});
