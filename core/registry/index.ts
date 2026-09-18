import { AutomationEngine } from "@/core/engine/automation-engine";
import { CapabilityRegistry } from "@/core/capabilities/registry";
import { EventBus } from "@/core/events/event-bus";

export const eventBus = new EventBus();
export const capabilityRegistry = new CapabilityRegistry();
export const automationEngine = new AutomationEngine();
