import type { Capability } from "@/core/types";

export class CapabilityRegistry {
  private readonly capabilities = new Map<string, Capability>();

  register(capability: Capability) {
    this.capabilities.set(capability.name, capability);
    return capability;
  }

  get(name: string) {
    return this.capabilities.get(name);
  }

  list() {
    return [...this.capabilities.values()];
  }
}
