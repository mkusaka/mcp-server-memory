import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import os from 'os';
import path from 'path';

const originalEnv = { ...process.env };
const originalArgv = [...process.argv];

const mockHomedir = vi.fn();

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
    vi.resetAllMocks();

    vi.resetModules();

    process.env = { ...originalEnv };

    process.argv = [...originalArgv];

    mockHomedir.mockReturnValue('/home/user');
  });

  afterEach(() => {
    process.env = { ...originalEnv };

    process.argv = [...originalArgv];
  });

  it('uses default storage locations', async () => {
    const { getMemoryConfig } = await import('../memory-config.js');

    const config = getMemoryConfig();

    expect(config.globalStorageLocation).toContain('/home/user/.config/goose/memory');
    expect(config.localStorageLocation).toContain('.goose/memory');
    expect(config.enablePersistence).toBe(true);
  });

  it('uses custom storage locations from command line', async () => {
    // コマンダーのモックを上書き
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

    const { getMemoryConfig } = await import('../memory-config.js');

    const config = getMemoryConfig();

    expect(config.globalStorageLocation).toBe('/custom/global');
    expect(config.localStorageLocation).toBe('/custom/local');
  });

  it('disables persistence when --no-persistence is used', async () => {
    // コマンダーのモックを上書き
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

    const { getMemoryConfig } = await import('../memory-config.js');

    const config = getMemoryConfig();

    expect(config.enablePersistence).toBe(false);
  });

  it('validates paths under home directory', async () => {
    const { isUnderHome } = await import('../memory-config.js');

    expect(isUnderHome('/home/user/projects')).toBe(true);
    expect(isUnderHome('/home/user')).toBe(true);
    expect(isUnderHome('/home/user/documents/files')).toBe(true);

    expect(isUnderHome('/var/www')).toBe(false);
    expect(isUnderHome('/tmp')).toBe(false);
    expect(isUnderHome('/home/otheruser')).toBe(false);
  });

  it('handles relative paths correctly', async () => {
    const { isUnderHome } = await import('../memory-config.js');

    const originalCwd = process.cwd;
    process.cwd = vi.fn().mockReturnValue('/home/user/projects');

    expect(isUnderHome('.')).toBe(true);
    expect(isUnderHome('./subdir')).toBe(true);
    expect(isUnderHome('../documents')).toBe(true);

    expect(isUnderHome('../../..')).toBe(false);

    // 元に戻す
    process.cwd = originalCwd;
  });

  it('creates storage directories when initializing', async () => {
    // fsモジュールのモック
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

    const { initializeStorage } = await import('../memory-config.js');
    const fs = await import('fs');

    const config = {
      globalStorageLocation: '/home/user/.config/goose/memory',
      localStorageLocation: '/home/user/project/.goose/memory',
      enablePersistence: true,
    };

    initializeStorage(config);

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
    // fsモジュールのモック
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

    const { initializeStorage } = await import('../memory-config.js');
    const fs = await import('fs');

    const config = {
      globalStorageLocation: '/home/user/.config/goose/memory',
      localStorageLocation: '/home/user/project/.goose/memory',
      enablePersistence: false,
    };

    initializeStorage(config);

    expect(fs.existsSync).not.toHaveBeenCalled();
    expect(fs.mkdirSync).not.toHaveBeenCalled();
  });
});
