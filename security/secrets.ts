export interface SecretStore { get(name: string): Promise<string | undefined>; set(name: string, value: string): Promise<void>; }

export class EnvironmentSecretStore implements SecretStore {
  async get(name: string) { return process.env[name]; }
  async set() { throw new Error("Environment secrets are read-only at runtime"); }
}
