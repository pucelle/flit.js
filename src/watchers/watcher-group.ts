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

	/** Whether connected. */
	protected connected: boolean = true

	constructor(context: Context) {
		this.context = context
	}

	/** Add a watcher to current group, and keeps it's connected state same with current group. */
	add(watcher: Watcher) {
		if (this.connected) {
			watcher.connect()
		}
		else {
			watcher.disconnect()
		}

		this.watchers.add(watcher)
	}

	/** Deleted watcher from current group, will always disconnect the watcher. */
	delete(watcher: Watcher) {
		if (this.connected) {
			watcher.disconnect()
		}
		
		this.watchers!.delete(watcher)
	}

	/** Connect all the watchers in current group. */
	connect() {
		if (!this.connected) {
			for (let watcher of this.watchers) {
				watcher.connect()
			}

			this.connected = true
		}
	}

	/** Disonnect all the watchers in current group. */
	disconnect() {
		if (this.connected) {
			for (let watcher of this.watchers) {
				watcher.disconnect()
			}
			
			this.connected = false
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
	watch<T>(fn: () => T, callback: (newValue: T, oldValue: T | undefined) => void): () => void {
		let watcher = new Watcher(fn, callback, this.context)
		this.add(watcher)

		return () => {
			this.delete(watcher)
		}
	}

	/** Create a new watcher and add to current group, calls `callback` immediately. */
	watchImmediately<T>(fn: () => T, callback: (newValue: T, oldValue: T | undefined) => void): () => void {
		let watcher = new Watcher(fn, callback, this.context)
		callback.call(this, watcher.value, undefined)
		this.add(watcher)

		return () => {
			this.delete(watcher)
		}
	}

	/** Create a new watcher and add to current group, only calls `callback` for once. */
	watchOnce<T>(fn: () => T, callback: (newValue: T, oldValue: T | undefined) => void): () => void {
		let wrappedCallback = (newValue: T, oldValue: T | undefined) => {
			callback(newValue, oldValue)
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
	watchUntil<T>(fn: () => T, callback: (trueValue: T) => void): () => void {
		let wrappedCallback = (newValue: T) => {
			if (newValue) {
				callback(newValue)
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

