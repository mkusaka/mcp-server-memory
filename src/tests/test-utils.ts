import { vi } from 'vitest';
import fs from 'fs';
import path from 'path';

// Mock McpServer
export const mockMcpServer = () => {
  return {
    name: '@mkusaka/mcp-memory-server',
    version: '0.1.0',
    tool: vi.fn(),
    resource: vi.fn(),
    connect: vi.fn().mockResolvedValue(undefined),
    setInstructions: vi.fn(),
  };
};

// Create temporary directory for tests
export const createTempDir = () => {
  const tempDir = path.join(process.cwd(), 'temp-test-' + Date.now());
  fs.mkdirSync(tempDir, { recursive: true });
  return tempDir;
};

// Remove temporary test directory
export const removeTempDir = (tempDir: string) => {
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
};

// Initialize memory storage for tests
export const initTestMemoryStorage = (tempDir: string) => {
  const globalDir = path.join(tempDir, 'global');
  const localDir = path.join(tempDir, 'local');

  fs.mkdirSync(globalDir, { recursive: true });
  fs.mkdirSync(localDir, { recursive: true });

  return {
    globalDir,
    localDir,
  };
};
