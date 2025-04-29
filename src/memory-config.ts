import { Command } from "commander";  
import os from "os";  
import path from "path";  
import fs from "fs";  
  
// メモリ設定の型定義  
export interface MemoryConfig {  
  globalStorageLocation: string;  
  localStorageLocation: string;  
  enablePersistence: boolean;  
}  
  
// メモリ設定を取得  
export const getMemoryConfig = (): MemoryConfig => {  
  // コマンドライン引数から設定を取得  
  const program = new Command();  
  program  
    .name("mcp-memory")  
    .description("MCP Memory Server - A server for memory operations")  
    .version("0.1.0")  
    .option(  
      "-g, --global-storage <path>",  
      "Specify the path to store global memories",  
    )  
    .option(  
      "-l, --local-storage <path>",  
      "Specify the path to store local memories",  
    )  
    .option(  
      "--no-persistence",  
      "Disable persistence (in-memory only)",  
    );  
  
  program.parse(process.argv);  
  const options = program.opts();  
  
  // ローカルストレージのデフォルト設定  
  const localStorageLocation = options.localStorage ||   
    path.join(process.cwd(), ".goose", "memory");  
  
  // グローバルストレージのデフォルト設定  
  const globalStorageLocation = options.globalStorage ||   
    path.join(os.homedir(), ".config", "goose", "memory");  
  
  // 設定を返す  
  return {  
    globalStorageLocation,  
    localStorageLocation,  
    enablePersistence: options.persistence !== false,  
  };  
};  
  
// パスがホームディレクトリ以下かどうかを確認  
export const isUnderHome = (dirPath: string): boolean => {  
  const homePath = os.homedir();  
  const absoluteDirPath = path.resolve(dirPath);  
  const absoluteHomePath = path.resolve(homePath);  
  const relativePath = path.relative(absoluteHomePath, absoluteDirPath);  
  return !relativePath.startsWith("..") && !path.isAbsolute(relativePath);  
};  
  
// ストレージディレクトリを初期化  
export const initializeStorage = (config: MemoryConfig): void => {  
  if (config.enablePersistence) {  
    if (!fs.existsSync(config.globalStorageLocation)) {  
      fs.mkdirSync(config.globalStorageLocation, { recursive: true });  
    }  
    if (!fs.existsSync(config.localStorageLocation)) {  
      fs.mkdirSync(config.localStorageLocation, { recursive: true });  
    }  
  }  
};
