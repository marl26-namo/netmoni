export type Message = { topic: string; payload: Record<string, unknown> };
export type MessageAdapter = { publish(message: Message): Promise<void> };

export class MemoryQueue implements MessageAdapter {
  readonly messages: Message[] = [];
  async publish(message: Message) { this.messages.push(message); }
}
