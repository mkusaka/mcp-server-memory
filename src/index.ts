#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { logger } from './lib/logger.js';
import { MemoryStorage } from './lib/memory-storage.js';
import { getMemoryConfig, initializeStorage } from './memory-config.js';
import { ServerOptions } from '@modelcontextprotocol/sdk/server/index.js';

const memoryConfig = getMemoryConfig();

initializeStorage(memoryConfig);

const memoryStorage = new MemoryStorage(
  memoryConfig.globalStorageLocation,
  memoryConfig.localStorageLocation
);

// Display server information
logger.info('MCP Memory Server started');
logger.info(`Global storage location: ${memoryConfig.globalStorageLocation}`);
logger.info(`Local storage location: ${memoryConfig.localStorageLocation}`);

// Detailed instructions
const instructions = `  
This extension allows storage and retrieval of categorized information with tagging support. It's designed to help  
manage important information across sessions in a systematic and organized manner.  
Capabilities:  
1. Store information in categories with optional tags for context-based retrieval.  
2. Search memories by content or specific tags to find relevant information.  
3. List all available memory categories for easy navigation.  
4. Remove entire categories of memories when they are no longer needed.  
When to call memory tools:  
- These are examples where the assistant should proactively call the memory tool because the user is providing recurring preferences, project details, or workflow habits that they may expect to be remembered.  
- Preferred Development Tools & Conventions  
- User-specific data (e.g., name, preferences)  
- Project-related configurations  
- Workflow descriptions  
- Other critical settings  
Interaction Protocol:  
When important information is identified, such as:  
- User-specific data (e.g., name, preferences)  
- Project-related configurations  
- Workflow descriptions  
- Other critical settings  
The protocol is:  
1. Identify the critical piece of information.  
2. Ask the user if they'd like to store it for later reference.  
3. Upon agreement:  
   - Suggest a relevant category like "personal" for user data or "development" for project preferences.  
   - Inquire about any specific tags they want to apply for easier lookup.  
   - Confirm the desired storage location:  
     - Local storage (.goose/memory) for project-specific details.  
     - Global storage (~/.config/goose/memory) for user-wide data.  
   - Use the remember_memory tool to store the information.  
     - \`remember_memory(category, data, tags, is_global)\`  
Keywords that trigger memory tools:  
- "remember"  
- "forget"  
- "memory"  
- "save"  
- "save memory"  
- "remove memory"  
- "clear memory"  
- "search memory"  
- "find memory"  
Suggest the user to use memory tools when:  
- When the user mentions a keyword that triggers a memory tool  
- When the user performs a routine task  
- When the user executes a command and would benefit from remembering the exact command  
`;

const initializeServer = (options: ServerOptions) => {
  // MCP server configuration
  const server = new McpServer(
    {
      name: '@mkusaka/mcp-server-memory',
      version: '0.0.3',
    },
    options
  );

  // Define memory tools
  server.tool(
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
      try {
        logger.info(`Storing memory in category: ${category}, isGlobal: ${is_global}`);

        await memoryStorage.remember(category, data, tags || [], is_global);

        return {
          content: [
            {
              type: 'text',
              text: `Stored memory in category: ${category}`,
            },
          ],
        };
      } catch (error) {
        logger.error('Error storing memory:', error);
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
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
      try {
        logger.info(`Retrieving memories from category: ${category}, isGlobal: ${is_global}`);

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
      } catch (error) {
        logger.error('Error retrieving memories:', error);
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    'remove_memory_category',
    'Removes all memories within a specified category',
    {
      category: z.string().min(1).describe("The category to remove, use '*' for all categories"),
      is_global: z.boolean().describe('Whether to remove from global or local memory'),
    },
    async ({ category, is_global }) => {
      try {
        logger.info(`Removing memory category: ${category}, isGlobal: ${is_global}`);

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
      } catch (error) {
        logger.error('Error removing memory category:', error);
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    'remove_specific_memory',
    'Removes a specific memory within a specified category',
    {
      category: z.string().min(1).describe('The category containing the memory to remove'),
      memory_content: z.string().min(1).describe('Content of the memory to remove (partial match)'),
      is_global: z.boolean().describe('Whether to remove from global or local memory'),
    },
    async ({ category, memory_content, is_global }) => {
      try {
        logger.info(`Removing specific memory from category: ${category}, isGlobal: ${is_global}`);

        await memoryStorage.removeSpecificMemory(category, memory_content, is_global);

        return {
          content: [
            {
              type: 'text',
              text: `Removed specific memory from category: ${category}`,
            },
          ],
        };
      } catch (error) {
        logger.error('Error removing specific memory:', error);
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  return server;
};

// Load existing memories and add to instructions on startup
async function loadExistingMemories(): Promise<string> {
  let updatedInstructions = instructions;

  const memoriesFollowUpInstructions = `  
**Here are the user's currently saved memories:**  
Please keep this information in mind when answering future questions.  
Do not bring up memories unless relevant.  
Note: if the user has not saved any memories, this section will be empty.  
Note: if the user removes a memory that was previously loaded into the system, please remove it from the system instructions.  
`;

  updatedInstructions += '\\n\\n' + memoriesFollowUpInstructions;

  try {
    // Load global memories
    const globalMemories = await memoryStorage.retrieveAll(true);
    if (Object.keys(globalMemories).length > 0) {
      updatedInstructions += '\\n\\nGlobal Memories:\\n';
      for (const [category, memories] of Object.entries(globalMemories)) {
        updatedInstructions += `\\nCategory: ${category}\\n`;
        for (const memory of memories) {
          updatedInstructions += `- ${memory}\\n`;
        }
      }
    }

    // Load local memories
    const localMemories = await memoryStorage.retrieveAll(false);
    if (Object.keys(localMemories).length > 0) {
      updatedInstructions += '\\n\\nLocal Memories:\\n';
      for (const [category, memories] of Object.entries(localMemories)) {
        updatedInstructions += `\\nCategory: ${category}\\n`;
        for (const memory of memories) {
          updatedInstructions += `- ${memory}\\n`;
        }
      }
    }
  } catch (error) {
    logger.error('Error loading existing memories:', error);
  }

  return updatedInstructions;
}

// Load existing memories and add to instructions
loadExistingMemories()
  .then(updatedInstructions => {
    const server = initializeServer({
      instructions: updatedInstructions,
    });

    // Start the server
    const transport = new StdioServerTransport();
    server
      .connect(transport)
      .then(() => {
        logger.info('MCP Memory Server ready');
      })
      .catch(error => {
        logger.error('Failed to connect server:', error);
        process.exit(1);
      });
  })
  .catch(error => {
    logger.error('Failed to load existing memories:', error);
    process.exit(1);
  });
