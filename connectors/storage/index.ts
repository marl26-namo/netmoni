export type StorageAdapter = { put(key: string, value: string): Promise<void>; get(key: string): Promise<string | undefined>; delete(key: string): Promise<void> };

export class MemoryStorage implements StorageAdapter {
  private readonly values = new Map<string, string>();
  async put(key: string, value: string) { this.values.set(key, value); }
  async get(key: string) { return this.values.get(key); }
  async delete(key: string) { this.values.delete(key); }
}
