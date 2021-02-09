import {startUpdating, endUpdating, clearDependenciesOf} from '../observer'
import {enqueueWatcher, enqueueLazyWatcher} from './queue'


/** 
 * A watcher watchs a function returned value and trigger callback if the value is changed.
 * You need to know that when callback was called, it doesn't ensure the watched datas are truly changed,
 * especially the returned value is an object, so you may validate it again if needed.
 * You can create watcher from `context.watch...` or `globalWatcherGroup.watch...`.
 */
export class Watcher<T = any> {

	/** Watch function. */
	private fn: () => T

	/** Callback to call after data may change. */
	private callback: (value: T) => void

	/** Whether the watcher connected. */
	private connected: boolean = true

	/** Last value returned from `fn`. */
	value: T

	constructor(fn: () => T, callback: (value: T) => void) {
		this.fn = fn
		this.callback = callback
		this.value = this.getNewValue()
	}

	/** Get a new value from `fn`. */
	private getNewValue(): T {
		startUpdating(this)
		let newValue = this.fn.call(null)
		endUpdating(this)

		return newValue
	}

	/** When detected dependencies changed, enqueue to update later. */
	update() {
		if (!this.connected) {
			return
		}
		
		enqueueWatcher(this)
	}

	/** Update current value immediately, also keeps consitant with the same method in `Component`. */
	__updateImmediately() {
		// Don't update after disconnected, or the watcher will be observed and do meaningless updating.

		if (!this.connected) {
			return
		}

		let newValue = this.getNewValue()

		// Data may change, doesn't validate object.
		if (newValue !== this.value || typeof newValue === 'object') {
			this.callback.call(null, this.value = newValue)
		}
	}

	/** Gives a readable info about the watcher. */
	toString() {
		return this.fn.toString()
	}

	/** Connect and update to collect new dependencies. */
	connect() {
		this.connected = true
		this.update()
	}

	/** Disconnect current watcher with it's denpendencies. */
	disconnect() {
		this.connected = false
		clearDependenciesOf(this)
	}
}


/** 
 * Lazy watchers update later than normal watchers and components.
 * So data and nodes are prepared when watcher callback called. 
 */
export class LazyWatcher<T = any> extends Watcher<T> {

	update() {
		enqueueLazyWatcher(this)
	}
}


/** 
 * Used to manage several watchers that binded to a context or as global watchers.
 * From this class, you can easily connect, disconnect, update all the watchers in group.
 */
export class WatcherGroup {

	private watchers: Set<Watcher> = new Set()

	/** Add a watcher to current group. */
	add(watcher: Watcher) {
		this.watchers.add(watcher)
	}

	/** Disconnect a watcher, and deleted it from current group. */
	delete(watcher: Watcher) {
		watcher.disconnect()
		this.watchers!.delete(watcher)
	}

	/** Connect all the watchers in current group. */
	connect() {
		for (let watcher of this.watchers) {
			watcher.connect()
		}
	}

	/** Disonnect all the watchers in current group. */
	disconnect() {
		for (let watcher of this.watchers) {
			watcher.disconnect()
		}
	}

	/** Update all the watchers in current group. */
	update() {
		if (this.watchers) {
			for (let watcher of this.watchers) {
				watcher.update()
			}
		}
	}

	/** Create a new watcher and add to current group. */
	watch<T>(fn: () => T, callback: (value: T) => void): () => void {
		let watcher = new Watcher(fn, callback)
		this.add(watcher)

		return () => {
			this.delete(watcher)
		}
	}

	/** Create a new watcher and add to current group, calls `callback` immediately. */
	watchImmediately<T>(fn: () => T, callback: (value: T) => void): () => void {
		let watcher = new Watcher(fn, callback)
		callback.call(this, watcher.value)
		this.add(watcher)

		return () => {
			this.delete(watcher)
		}
	}

	/** Create a new watcher and add to current group, only calls `callback` for once. */
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

	/** Create a new watcher and add to current group, calls `callback` only when returned value of `fn` be true like. */
	watchUntil<T>(fn: () => T, callback: (value: T) => void): () => void {
		let wrappedCallback = (value: T) => {
			if (value) {
				callback(value)
				unwatch()
			}
		}

		let unwatch: () => void
		let watcher = new Watcher(fn, wrappedCallback)

		if (watcher.value) {
			watcher.disconnect()
			callback.call(this, watcher.value)
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


/** Global watcher group to watch scattered things that not belongs to a component. */
export const GlobalWatcherGroup = new WatcherGroup()


/** Watchs returned value of `fn` and calls `callback` with this value as parameter if the value changed. */
export function watch<T>(fn: () => T, callback: (value: T) => void): () => void {
	return GlobalWatcherGroup.watch(fn, callback)
}

/** 
 * Watchs returned value of `fn` and calls `callback` with this value as parameter if the value changed.
 * Will call `callback` immediately.
 */
export function watchImmediately<T>(fn: () => T, callback: (value: T) => void): () => void {
	return GlobalWatcherGroup.watchImmediately(fn, callback)
}

/** 
 * Watchs returned value of `fn` and calls `callback` with this value as parameter if the value changed.
 * Only calls `callback` for once.
 */
export function watchOnce<T>(fn: () => T, callback: (value: T) => void): () => void {
	return GlobalWatcherGroup.watchOnce(fn, callback)
}

/** Watchs returneded values of `fn` and calls `callback` if this value becomes true like. */
export function watchUntil<T>(fn: () => any, callback: (value: T) => void): () => void {
	return GlobalWatcherGroup.watchUntil(fn, callback)
}


/** 
 * Updates all the global watchers registered from `watch...()`.
 * e.g., you may call this after language changes and not automatically detected.
 */
export function updateAllGlobalWatchers() {
	GlobalWatcherGroup.update()
}
