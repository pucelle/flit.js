import {startUpdating, endUpdating, clearDependency} from './observer'
import {enqueueWatcherUpdate} from './queue'


export type WatchFn = () => unknown
export type Callback = (...values: unknown[]) => void
export type WatcherDisconnectFn = () => void


/** Watch return values of functions and trigger callback with these values as arguments. */
export function watch(fn: WatchFn, callback: Callback): WatcherDisconnectFn
export function watch(fn_1: WatchFn, fn_2: WatchFn, callback: Callback): WatcherDisconnectFn
export function watch(fn_1: WatchFn, fn_2: WatchFn, fn_3: WatchFn, callback: Callback): WatcherDisconnectFn
export function watch(fn_1: WatchFn, fn_2: WatchFn, fn_3: WatchFn, fn_4: WatchFn, callback: Callback): WatcherDisconnectFn
export function watch(fn_1: WatchFn, fn_2: WatchFn, fn_3: WatchFn, fn_4: WatchFn, fn_5: WatchFn, callback: Callback): WatcherDisconnectFn

export function watch(...fnsAndCallback: Function[]): () => void {
	let callback = fnsAndCallback.pop()
	let watcher = new Watcher(fnsAndCallback, callback as Callback)
	return watcher.disconnect.bind(watcher)
}


/** You need to know that the watch doesn't ensure the datas are really changed when calling callback. */
export class Watcher {

	private fns: Function[]
	private callback: Callback

	values: unknown[]

	constructor(fns: Function[], callback: Callback) {
		this.fns = fns
		this.callback = callback

		startUpdating(this)
		this.values = this.run()
		endUpdating()
	}

	private run(): unknown[] {
		let values: unknown[] = []

		for (let fn of this.fns) {
			this.values.push(fn())
		}

		return values
	}

	/** When detected relied object changed. trigger this immediately. */
	update() {
		enqueueWatcherUpdate(this)
	}

	/** Only returns false when all values and value type and equal */
	private mayChanged(newValue: unknown[]): boolean {
		for (let i = 0; i < newValue.length; i++) {
			if (newValue[i] !== this.values[i]) {
				return true
			}

			if (typeof newValue[i] === 'object' && typeof this.values[i] === 'object') {
				return true
			}
		}

		return false
	}

	/** Keep consitant with Component */
	__updateImmediately() {
		startUpdating(this)
		let newValues = this.run()
		endUpdating()

		if (this.mayChanged(newValues)) {
			this.values = newValues
			this.callback.apply(this, this.values)
		}
	}

	/**
	 * We currently just check the update times, if exceed 3 then warn.
	 * The better way should be analysising dependency tree:
	 * Get current watcher referenced objects, then get their referenced watchers.
	 * Then check if current watcher in it.
	 */
	warnMayInfiniteUpdating() {
		console.warn(`Watcher "${this.fns.map(fn => fn.toString().replace(/\s+/g, ''))}" may have infinite updating`)
	}

	/**
	 * Watcher and the Component can't be GC automatically,
	 * because we added `object -> Component | Watcher` map into dependencies.
	 * But if it's referred object is no longer in use any more, no need to disconnect it.
	 */
	disconnect() {
		clearDependency(this)
	}
}
