// This file cloned for https://github.com/pucelle/ff/blob/master/src/base/emitter.ts
// You may visit it to find more descriptions about the implemention.


interface EventItem {
	listener: (...args: any[]) => void
	scope?: object,
	once: boolean
}


export class Emitter<E = any> {

	private __events: Map<keyof E, EventItem[]> = new Map()

	private __ensureEvents<K extends keyof E>(name: K): EventItem[] {
		let events = this.__events.get(name)
		if (!events) {
			this.__events.set(name, events = [])
		}

		return events
	}

	on<K extends keyof E>(name: K, listener: (...args: any[]) => void, scope?: object) {
		let events = this.__ensureEvents(name)
		
		events.push({
			listener,
			scope,
			once: false,
		})
	}

	once<K extends keyof E>(name: K, listener: (...args: any[]) => void, scope?: object) {
		let events = this.__ensureEvents(name)

		events.push({
			listener,
			scope,
			once: true
		})
	}

	off<K extends keyof E>(name: K, listener: (...args: any[]) => void, scope?: object) {
		let events = this.__events.get(name)
		if (events) {
			for (let i = events.length - 1; i >= 0; i--) {
				let event = events[i]
				if (event.listener === listener && (!scope || event.scope === scope)) {
					events.splice(i, 1)
				}
			}
		}
	}

	hasListener(name: string, listener?: (...args: any[]) => void, scope?: object) {
		let events = this.__events.get(name as any)

		if (!listener) {
			return !!events && events.length > 0
		}
		else if (events && listener) {
			for (let i = 0, len = events.length; i < len; i++) {
				let event = events[i]

				if (event.listener === listener && (!scope || event.scope === scope)) {
					return true
				}
			}
		}

		return false
	}

	emit<K extends keyof E>(name: K, ...args: any[]) {
		let events = this.__events.get(name)
		if (events) {
			for (let i = 0; i < events.length; i++) {
				let event = events[i]

				// The listener may call off, so must remove it before handling
				if (event.once === true) {
					events.splice(i--, 1)
				}

				event.listener.apply(event.scope, args)
			}
		}
	}

	removeAllListeners() {
		this.__events = new Map()
	}
}