import {startUpdating, endUpdating, clearDependencies} from './observer'
import {enqueueWatcherUpdate} from './queue'


export type WatchFn = () => unknown
export type WatcherCallback<T> = (value: T) => void


/** Watch return value of function and trigger callback with this value as argument. */
export function watch<T>(fn: () => T, callback: (value: T) => void): () => void {
	let watcher = new Watcher(fn, callback)
	return watcher.disconnect.bind(watcher)
}


/** Watch return value of function and trigger callback with this value as argument. */
export function watchImmediately<T>(fn: () => T, callback: (value: T) => void): () => void {
	let watcher = new Watcher(fn, callback)
	callback(watcher.value)
	return watcher.disconnect.bind(watcher)
}


/** Watch return value of function and trigger callback with this value as argument. Run callback for only once. */
export function watchOnce<T>(fn: () => T, callback: (value: T) => void): () => void {
	let wrappedCallback = (value: T) => {
		callback(value)
		watcher.disconnect()
	}

	let watcher = new Watcher(fn, wrappedCallback)
	return watcher.disconnect.bind(watcher)
}


/** Watch returned values of function and trigger callback if it becomes true. */
export function watchUntil(fn: () => any, callback: () => void): () => void {
	let wrappedCallback = (value: unknown) => {
		if (value) {
			callback()
			watcher.disconnect()
		}
	}

	let watcher = new Watcher(fn, wrappedCallback)
	if (watcher.value) {
		watcher.disconnect()
		callback()
		return () => {}
	}
	else {
		return watcher.disconnect.bind(watcher)
	}
}


/** You need to know that when calling callback, the Watch doesn't ensure the watched datas are truly changed. */
export class Watcher<T = any> {

	private fn: () => T
	private callback: (value: T) => void
	private connected: boolean = true

	value: T

	constructor(fn: () => T, callback: (value: T) => void) {
		this.fn = fn
		this.callback = callback
		this.value = this.getValue()
	}

	getValue(): T {
		startUpdating(this)
		let newValue = this.fn.call(null)
		endUpdating(this)

		return newValue
	}

	/** When detected dependencies changed. trigger this immediately. */
	update() {
		enqueueWatcherUpdate(this)
	}

	/** Keep consitant with Component */
	__updateImmediately() {
		if (!this.connected) {
			return
		}

		let newValue = this.getValue()
		if (newValue !== this.value || typeof newValue === 'object') {
			this.callback.call(null, this.value = newValue)
		}
	}

	/**
	 * We currently just check the update times, if exceed 3 then warn.
	 * The better way should be analysising dependency tree:
	 * Get current watcher referenced objects, then get their referenced watchers.
	 * Then check if current watcher in it.
	 */
	toString() {
		return this.fn.toString()
	}

	/**
	 * Watcher and the Component can't be GC automatically,
	 * because we added `object -> Component | Watcher` map into dependencies.
	 * But if it's referred object is no longer in use any more, no need to disconnect it.
	 */

	// One question: Will the update be triggered after disconnected?
	//   1. Data changed, cause watcher update been enqueued, and will be updated in next micro task.
	//   2. later some element was removed in same stack, related watcher was disconnected in next micro task.
	//   3. Update and then disconnect.
	//
	// So this will not happen.
	// But we still need to avoid it by adding a `connected` property, because once update after disconnect, the watcher will have new dependencies and be reconnected. 
	disconnect() {
		clearDependencies(this)
		this.connected = false
	}

	/** If it's related commponent restore to be connected, connect and activate it's watchers. */
	connect() {
		this.connected = true
		this.update()
	}
}