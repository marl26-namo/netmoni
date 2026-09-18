import type { Event } from "@/core/types";

type EventHandler = (event: Event) => Promise<void> | void;

export class EventBus {
  private readonly handlers = new Map<string, Set<EventHandler>>();

  subscribe(eventType: string, handler: EventHandler) {
    const handlers = this.handlers.get(eventType) ?? new Set<EventHandler>();
    handlers.add(handler);
    this.handlers.set(eventType, handlers);
    return () => handlers.delete(handler);
  }

  async publish(event: Event) {
    const handlers = [...(this.handlers.get(event.type) ?? [])];
    await Promise.all(handlers.map((handler) => handler(event)));
    return event;
  }
}
