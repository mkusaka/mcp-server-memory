import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MemoryStorage } from "../lib/memory-storage.js";
import {
  createTempDir,
  removeTempDir,
  initTestMemoryStorage,
} from "./test-utils.js";
import fs from "fs";
import path from "path";

describe("Memory Storage Operations", () => {
  let tempDir: string;
  let memoryStorage: MemoryStorage;
  let testDirs: { globalDir: string; localDir: string };

  beforeEach(() => {
    tempDir = createTempDir();
    testDirs = initTestMemoryStorage(tempDir);
    memoryStorage = new MemoryStorage(testDirs.globalDir, testDirs.localDir);
  });

  afterEach(() => {
    removeTempDir(tempDir);
  });

  it("stores memory with tags", async () => {
    // Arrange
    const category = "test-category";
    const data = "Test memory data";
    const tags = ["tag1", "tag2"];
    const isGlobal = true;

    // Act
    await memoryStorage.remember(category, data, tags, isGlobal);

    // Assert
    const filePath = path.join(testDirs.globalDir, `${category}.txt`);
    expect(fs.existsSync(filePath)).toBe(true);

    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("# tag1 tag2");
    expect(content).toContain(data);
  });

  it("retrieves memories by category", async () => {
    // Arrange
    const category = "test-category";
    const data1 = "Memory 1";
    const data2 = "Memory 2";
    const tags1 = ["tag1"];
    const tags2 = ["tag2", "tag3"];
    const isGlobal = false;

    await memoryStorage.remember(category, data1, tags1, isGlobal);
    await memoryStorage.remember(category, data2, tags2, isGlobal);

    // Act
    const result = await memoryStorage.retrieve(category, isGlobal);

    // Assert
    expect(Object.keys(result)).toHaveLength(2);
    expect(result["tag1"]).toContain(data1);
    expect(result["tag2 tag3"]).toContain(data2);
  });

  it("removes specific memory", async () => {
    // Arrange
    const category = "test-category";
    const data1 = "Memory to keep";
    const data2 = "Memory to remove";
    const isGlobal = true;

    await memoryStorage.remember(category, data1, [], isGlobal);
    await memoryStorage.remember(category, data2, [], isGlobal);

    // Act
    await memoryStorage.removeSpecificMemory(category, "to remove", isGlobal);

    // Assert
    const result = await memoryStorage.retrieve(category, isGlobal);
    const allMemories = Object.values(result).flat();

    expect(allMemories).toContain(data1);
    expect(allMemories).not.toContain(data2);
  });

  it("clears entire memory category", async () => {
    // Arrange
    const category = "test-category";
    const data = "Test memory data";
    const isGlobal = false;

    await memoryStorage.remember(category, data, [], isGlobal);

    // Act
    await memoryStorage.clearMemory(category, isGlobal);

    // Assert
    const filePath = path.join(testDirs.localDir, `${category}.txt`);
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it("retrieves all memories", async () => {
    // Arrange
    await memoryStorage.remember("category1", "Data 1", [], true);
    await memoryStorage.remember("category2", "Data 2", [], true);

    // Act
    const result = await memoryStorage.retrieveAll(true);

    // Assert
    expect(Object.keys(result)).toContain("category1");
    expect(Object.keys(result)).toContain("category2");
    expect(result["category1"]).toContain("Data 1");
    expect(result["category2"]).toContain("Data 2");
  });
});
