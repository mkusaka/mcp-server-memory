import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import os from 'os';
import path from 'path';

// Backup environment variables
const originalEnv = { ...process.env };
const originalArgv = [...process.argv];

// Mock functions
const mockHomedir = vi.fn();

// Mock OS module
vi.mock('os', () => {
  const mockOs = {
    homedir: mockHomedir,
    platform: vi.fn().mockReturnValue('darwin'),
  };
  return {
    ...mockOs,
    default: mockOs,
  };
});

// Mock Commander module
vi.mock('commander', () => {
  return {
    Command: vi.fn().mockImplementation(() => {
      return {
        name: vi.fn().mockReturnThis(),
        description: vi.fn().mockReturnThis(),
        version: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis(),
        parse: vi.fn(),
        opts: vi.fn().mockReturnValue({}),
      };
    }),
  };
});

describe('Memory Configuration', () => {
  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();

    // Reset modules
    vi.resetModules();

    // Reset environment variables
    process.env = { ...originalEnv };

    // Reset command line arguments
    process.argv = [...originalArgv];

    // Set default mock values
    mockHomedir.mockReturnValue('/home/user');
  });

  afterEach(() => {
    // Restore environment variables
    process.env = { ...originalEnv };

    // Restore command line arguments
    process.argv = [...originalArgv];
  });

  it('uses default storage locations', async () => {
    // Import module
    const { getMemoryConfig } = await import('../memory-config.js');

    // Test
    const config = getMemoryConfig();

    // Verify
    expect(config.globalStorageLocation).toContain('/home/user/.config/goose/memory');
    expect(config.localStorageLocation).toContain('.goose/memory');
    expect(config.enablePersistence).toBe(true);
  });

  it('uses custom storage locations from command line', async () => {
    const { Command } = await import('commander');
    vi.mocked(Command).mockImplementation(() => {
      return {
        name: vi.fn().mockReturnThis(),
        description: vi.fn().mockReturnThis(),
        version: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis(),
        parse: vi.fn(),
        opts: vi.fn().mockReturnValue({
          globalStorage: '/custom/global',
          localStorage: '/custom/local',
        }),
      } as any;
    });

    // Import module
    const { getMemoryConfig } = await import('../memory-config.js');

    // Test
    const config = getMemoryConfig();

    // Verify
    expect(config.globalStorageLocation).toBe('/custom/global');
    expect(config.localStorageLocation).toBe('/custom/local');
  });

  it('disables persistence when --no-persistence is used', async () => {
    const { Command } = await import('commander');
    vi.mocked(Command).mockImplementation(() => {
      return {
        name: vi.fn().mockReturnThis(),
        description: vi.fn().mockReturnThis(),
        version: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis(),
        parse: vi.fn(),
        opts: vi.fn().mockReturnValue({
          persistence: false,
        }),
      } as any;
    });

    // Import module
    const { getMemoryConfig } = await import('../memory-config.js');

    // Test
    const config = getMemoryConfig();

    // Verify
    expect(config.enablePersistence).toBe(false);
  });

  it('validates paths under home directory', async () => {
    // Import module
    const { isUnderHome } = await import('../memory-config.js');

    // Test
    expect(isUnderHome('/home/user/projects')).toBe(true);
    expect(isUnderHome('/home/user')).toBe(true);
    expect(isUnderHome('/home/user/documents/files')).toBe(true);

    expect(isUnderHome('/var/www')).toBe(false);
    expect(isUnderHome('/tmp')).toBe(false);
    expect(isUnderHome('/home/otheruser')).toBe(false);
  });

  it('handles relative paths correctly', async () => {
    // Import module
    const { isUnderHome } = await import('../memory-config.js');

    // Temporarily change current directory
    const originalCwd = process.cwd;
    process.cwd = vi.fn().mockReturnValue('/home/user/projects');

    // Test
    expect(isUnderHome('.')).toBe(true);
    expect(isUnderHome('./subdir')).toBe(true);
    expect(isUnderHome('../documents')).toBe(true);

    expect(isUnderHome('../../..')).toBe(false);

    // Restore
    process.cwd = originalCwd;
  });

  it('creates storage directories when initializing', async () => {
    vi.mock('fs', () => {
      const mockFs = {
        existsSync: vi.fn().mockReturnValue(false),
        mkdirSync: vi.fn(),
      };
      return {
        ...mockFs,
        default: mockFs,
      };
    });

    // Import module
    const { initializeStorage } = await import('../memory-config.js');
    const fs = await import('fs');

    // Test
    const config = {
      globalStorageLocation: '/home/user/.config/goose/memory',
      localStorageLocation: '/home/user/project/.goose/memory',
      enablePersistence: true,
    };

    initializeStorage(config);

    // Verify
    expect(fs.existsSync).toHaveBeenCalledWith('/home/user/.config/goose/memory');
    expect(fs.existsSync).toHaveBeenCalledWith('/home/user/project/.goose/memory');
    expect(fs.mkdirSync).toHaveBeenCalledWith('/home/user/.config/goose/memory', {
      recursive: true,
    });
    expect(fs.mkdirSync).toHaveBeenCalledWith('/home/user/project/.goose/memory', {
      recursive: true,
    });
  });

  it('does not create directories when persistence is disabled', async () => {
    vi.mock('fs', () => {
      const mockFs = {
        existsSync: vi.fn(),
        mkdirSync: vi.fn(),
      };
      return {
        ...mockFs,
        default: mockFs,
      };
    });

    // Import module
    const { initializeStorage } = await import('../memory-config.js');
    const fs = await import('fs');

    // Test
    const config = {
      globalStorageLocation: '/home/user/.config/goose/memory',
      localStorageLocation: '/home/user/project/.goose/memory',
      enablePersistence: false,
    };

    initializeStorage(config);

    // Verify
    expect(fs.existsSync).not.toHaveBeenCalled();
    expect(fs.mkdirSync).not.toHaveBeenCalled();
  });
});
