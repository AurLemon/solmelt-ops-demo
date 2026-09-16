import type { DomainEventMap, DomainEventName } from '~~/shared/events'

type UnknownHandler = (payload: unknown) => Promise<void> | void
type EventHandler<Name extends DomainEventName> = (
	payload: DomainEventMap[Name],
) => Promise<void> | void

export class TypedEventBus {
	private readonly handlers = new Map<DomainEventName, Set<UnknownHandler>>()

	on<Name extends DomainEventName>(eventName: Name, handler: EventHandler<Name>): () => void {
		const wrappedHandler: UnknownHandler = (payload) => handler(payload as DomainEventMap[Name])
		const eventHandlers = this.handlers.get(eventName) ?? new Set<UnknownHandler>()
		eventHandlers.add(wrappedHandler)
		this.handlers.set(eventName, eventHandlers)

		return () => eventHandlers.delete(wrappedHandler)
	}

	async emit<Name extends DomainEventName>(
		eventName: Name,
		payload: DomainEventMap[Name],
	): Promise<void> {
		const eventHandlers = this.handlers.get(eventName)
		if (!eventHandlers) return

		for (const handler of eventHandlers) {
			await handler(payload)
		}
	}
}

export const eventBus = new TypedEventBus()
