/**
 * Neutral domain-event shape for future inter-module communication.
 * Transactional outbox implementation is deferred; this is a type contract only.
 */
export type DomainEvent<
  TPayload extends Readonly<Record<string, unknown>> = Readonly<Record<string, unknown>>,
> = {
  readonly eventName: string;
  readonly occurredAt: string;
  readonly correlationId: string;
  readonly payload: TPayload;
};

/**
 * Placeholder publisher surface. Modules must not call other modules' repositories.
 */
export interface DomainEventPublisher {
  publish(event: DomainEvent): Promise<void>;
}

export const DOMAIN_EVENT_PUBLISHER = Symbol('DOMAIN_EVENT_PUBLISHER');

export class NoopDomainEventPublisher implements DomainEventPublisher {
  async publish(_event: DomainEvent): Promise<void> {
    // Intentional no-op until outbox infrastructure is approved and implemented.
  }
}
