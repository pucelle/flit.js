import type {Context} from "../component"
import {Watcher} from "./watcher"


/** 
 * Used to manage several watchers that binded to a context or as global watchers.
 * From this class, you can easily connect, disconnect, update all the watchers in group.
 */
export class WatcherGroup {

	/** Context to determine update order. */
	protected readonly context: Context

	/** All watchers. */
	protected watchers: Set<Watcher> = new Set()

	constructor(context: Context) {
		this.context = context
	}

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
		let watcher = new Watcher(fn, callback, this.context)
		this.add(watcher)

		return () => {
			this.delete(watcher)
		}
	}

	/** Create a new watcher and add to current group, calls `callback` immediately. */
	watchImmediately<T>(fn: () => T, callback: (value: T) => void): () => void {
		let watcher = new Watcher(fn, callback, this.context)
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

		let watcher = new Watcher(fn, wrappedCallback, this.context)
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
		let watcher = new Watcher(fn, wrappedCallback, this.context)

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

