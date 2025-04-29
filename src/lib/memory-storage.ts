import fs from 'fs';
import path from 'path';

export interface Memory {
  category: string;
  data: string;
  tags: string[];
  isGlobal: boolean;
}

export class MemoryStorage {
  constructor(
    private globalStorageLocation: string,
    private localStorageLocation: string
  ) {}

  // Get memory file path
  private getMemoryFilePath(category: string, isGlobal: boolean): string {
    const baseDir = isGlobal ? this.globalStorageLocation : this.localStorageLocation;
    return path.join(baseDir, `${category}.txt`);
  }

  // Save memory
  async remember(category: string, data: string, tags: string[], isGlobal: boolean): Promise<void> {
    const filePath = this.getMemoryFilePath(category, isGlobal);

    let content = '';
    if (tags.length > 0) {
      content += `# ${tags.join(' ')}\\n`;
    }
    content += `${data}\\n\\n`;

    await fs.promises.appendFile(filePath, content);
  }

  // Retrieve memory
  async retrieve(category: string, isGlobal: boolean): Promise<Record<string, string[]>> {
    const filePath = this.getMemoryFilePath(category, isGlobal);

    if (!fs.existsSync(filePath)) {
      return {};
    }

    const content = await fs.promises.readFile(filePath, 'utf-8');
    const memories: Record<string, string[]> = {};

    for (const entry of content.split('\\n\\n')) {
      if (!entry.trim()) continue;

      const lines = entry.split('\\n');
      const firstLine = lines[0];

      if (firstLine.startsWith('#')) {
        const tags = firstLine.substring(1).trim().split(/\\s+/);
        const tagKey = tags.join(' ');
        memories[tagKey] = lines.slice(1).filter(line => line.trim());
      } else {
        const untaggedKey = 'untagged';
        if (!memories[untaggedKey]) {
          memories[untaggedKey] = [];
        }
        memories[untaggedKey].push(...lines.filter(line => line.trim()));
      }
    }

    return memories;
  }

  // Retrieve all memories
  async retrieveAll(isGlobal: boolean): Promise<Record<string, string[]>> {
    const baseDir = isGlobal ? this.globalStorageLocation : this.localStorageLocation;
    const memories: Record<string, string[]> = {};

    if (!fs.existsSync(baseDir)) {
      return memories;
    }

    const files = await fs.promises.readdir(baseDir);

    for (const file of files) {
      if (file.endsWith('.txt')) {
        const category = file.replace('.txt', '');
        const categoryMemories = await this.retrieve(category, isGlobal);

        // Flatten by category
        const flatMemories: string[] = [];
        for (const taggedMemories of Object.values(categoryMemories)) {
          flatMemories.push(...taggedMemories);
        }

        memories[category] = flatMemories;
      }
    }

    return memories;
  }

  // Remove specific memory
  async removeSpecificMemory(
    category: string,
    memoryContent: string,
    isGlobal: boolean
  ): Promise<void> {
    const filePath = this.getMemoryFilePath(category, isGlobal);

    if (!fs.existsSync(filePath)) {
      return;
    }

    const content = await fs.promises.readFile(filePath, 'utf-8');
    const memories = content.split('\\n\\n');
    const newMemories = memories.filter(memory => !memory.includes(memoryContent));

    await fs.promises.writeFile(filePath, newMemories.join('\\n\\n'));
  }

  // Clear all memories in a category
  async clearMemory(category: string, isGlobal: boolean): Promise<void> {
    const filePath = this.getMemoryFilePath(category, isGlobal);

    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
  }

  // Clear all global or local memories
  async clearAllGlobalOrLocalMemories(isGlobal: boolean): Promise<void> {
    const baseDir = isGlobal ? this.globalStorageLocation : this.localStorageLocation;

    if (fs.existsSync(baseDir)) {
      await fs.promises.rm(baseDir, { recursive: true, force: true });
      await fs.promises.mkdir(baseDir, { recursive: true });
    }
  }
}
