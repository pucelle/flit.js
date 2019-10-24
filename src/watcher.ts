import {startUpdating, endUpdating, clearDependencies} from './observer'
import {enqueueWatcherToUpdate} from './queue'


/** 
 * Used to watch a function returns and trigger callback if it is changed.
 * You need to know that when callback was called, it doesn't ensure the watched datas are truly changed.
 * Normally you should create watcher but using `context.watch` or `globalWatcherGroup.watch`.
 * If you use created watcher, makesure to add it to a `context` or the `globalWatcherGroup`.
 */
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
		enqueueWatcherToUpdate(this)
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
	//   1. Data changed, cause watcher update been enqueued, and will be updated in micro task queue.
	//   2. later some element was removed in same stack, related watcher was disconnected in micro task queue.
	//   3. Update and then disconnect.
	//
	// So this will not happen.
	// But we still need to avoid it by adding a `connected` property,
	// because once update after disconnect, the watcher will have new dependencies and be reconnected. 
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


/** 
 * Used to manage several watchers that binded to a context or as global watchers.
 * By this class, you can easily connect, disconnect, update all the watchers related.
 */
/** @hidden */
export class WatcherGroup {

	private watchers: Set<Watcher> = new Set()

	add(watcher: Watcher) {
		this.watchers.add(watcher)
	}

	delete(watcher: Watcher) {
		watcher.disconnect()
		this.watchers!.delete(watcher)
	}

	connect() {
		for (let watcher of this.watchers) {
			watcher.connect()
		}
	}

	disconnect() {
		for (let watcher of this.watchers) {
			watcher.disconnect()
		}
	}

	update() {
		if (this.watchers) {
			for (let watcher of this.watchers) {
				watcher.update()
			}
		}
	}

	watch<T>(fn: () => T, callback: (value: T) => void): () => void {
		let watcher = new Watcher(fn, callback)
		this.add(watcher)

		return () => {
			this.delete(watcher)
		}
	}

	watchImmediately<T>(fn: () => T, callback: (value: T) => void): () => void {
		let watcher = new Watcher(fn, callback)
		callback.call(this, watcher.value)
		this.add(watcher)

		return () => {
			this.delete(watcher)
		}
	}

	watchOnce<T>(fn: () => T, callback: (value: T) => void): () => void {
		let wrappedCallback = (value: T) => {
			callback(value)
			unwatch()
		}

		let watcher = new Watcher(fn, wrappedCallback)
		this.add(watcher)

		let unwatch = () => {
			this.delete(watcher)
		}

		return unwatch
	}

	watchUntil<T>(fn: () => T, callback: () => void): () => void {
		let wrappedCallback = (value: T) => {
			if (value) {
				callback()
				unwatch()
			}
		}

		let unwatch: () => void
		let watcher = new Watcher(fn, wrappedCallback)

		if (watcher.value) {
			watcher.disconnect()
			callback.call(this)
			unwatch = () => {}
		}
		else {
			this.add(watcher)

			unwatch = () => {
				this.delete(watcher)
			}
		}

		return unwatch
	}
}

/** @hidden */
export const globalWatcherGroup = new WatcherGroup()


/** Watch return value of function and trigger callback with this value as argument. */
export function watch<T>(fn: () => T, callback: (value: T) => void): () => void {
	return globalWatcherGroup.watch(fn, callback)
}

/** Watch return value of function and trigger callback with this value as argument. */
export function watchImmediately<T>(fn: () => T, callback: (value: T) => void): () => void {
	return globalWatcherGroup.watchImmediately(fn, callback)
}

/** Watch return value of function and trigger callback with this value as argument. Run callback for only once. */
export function watchOnce<T>(fn: () => T, callback: (value: T) => void): () => void {
	return globalWatcherGroup.watchOnce(fn, callback)
}

/** Watch returned values of function and trigger callback if it becomes true. */
export function watchUntil(fn: () => any, callback: () => void): () => void {
	return globalWatcherGroup.watchUntil(fn, callback)
}

