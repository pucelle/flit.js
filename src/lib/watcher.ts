import {startUpdating, endUpdating, clearDependencies} from './observer'
import {enqueueWatcherUpdate} from './queue'


export type WatchFn = (value: any) => unknown
export type WatcherCallback = (...args: any[]) => void
export type WatcherDisconnectFn = () => void


/** Watch return value of function and trigger callback with this value as argument. */
export function watch<FN extends WatchFn>(fn: FN, callback: (value: ReturnType<FN>) => void): WatcherDisconnectFn

/** Watch return values of functions and trigger callback with these values as arguments. */
export function watch<FN1 extends WatchFn, FN2 extends WatchFn>(
	fn1: FN1,
	fn2: FN2,
	callback: (value1: ReturnType<FN1>, value2: ReturnType<FN2>) => void
): WatcherDisconnectFn

/** Watch return values of functions and trigger callback with these values as arguments. */
export function watch<FN1 extends WatchFn, FN2 extends WatchFn, FN3 extends WatchFn>(
	fn1: FN1,
	fn2: FN2,
	fn3: FN3,
	callback: (value1: ReturnType<FN1>, value2: ReturnType<FN2>, value3: ReturnType<FN3>) => void
): WatcherDisconnectFn

export function watch(...fnsAndCallback: Function[]): WatcherDisconnectFn {
	let callback = fnsAndCallback.pop()
	let watcher = new Watcher(fnsAndCallback, callback as WatcherCallback)
	return watcher.disconnect.bind(watcher)
}


/** Watch return value of function and trigger callback with this value as argument. */
export function watchImmediately<FN extends WatchFn>(fn: FN, callback: (value: ReturnType<FN>) => void): WatcherDisconnectFn

/** Watch return values of functions and trigger callback with these values as arguments. */
export function watchImmediately<FN1 extends WatchFn, FN2 extends WatchFn>(
	fn1: FN1,
	fn2: FN2,
	callback: (value1: ReturnType<FN1>, value2: ReturnType<FN2>) => void
): WatcherDisconnectFn

/** Watch return values of functions and trigger callback with these values as arguments. */
export function watchImmediately<FN1 extends WatchFn, FN2 extends WatchFn, FN3 extends WatchFn>(
	fn1: FN1,
	fn2: FN2,
	fn3: FN3,
	callback: (value1: ReturnType<FN1>, value2: ReturnType<FN2>, value3: ReturnType<FN3>) => void
): WatcherDisconnectFn

export function watchImmediately(...fnsAndCallback: Function[]): WatcherDisconnectFn {
	let callback = fnsAndCallback.pop()
	let watcher = new Watcher(fnsAndCallback, callback as WatcherCallback, true)
	return watcher.disconnect.bind(watcher)
}


/** Watch return value of function and trigger callback with this value as argument. Run callback for only once. */
export function watchOnce<FN extends WatchFn>(fn: FN, callback: (value: ReturnType<FN>) => void): WatcherDisconnectFn

/** Watch return values of functions and trigger callback with these values as arguments. Run callback for only once. */
export function watchOnce<FN1 extends WatchFn, FN2 extends WatchFn>(
	fn1: FN1,
	fn2: FN2,
	callback: (value1: ReturnType<FN1>, value2: ReturnType<FN2>) => void
): WatcherDisconnectFn

/** Watch return values of functions and trigger callback with these values as arguments. Run callback for only once. */
export function watchOnce<FN1 extends WatchFn, FN2 extends WatchFn, FN3 extends WatchFn>(
	fn1: FN1,
	fn2: FN2,
	fn3: FN3,
	callback: (value1: ReturnType<FN1>, value2: ReturnType<FN2>, value3: ReturnType<FN3>) => void
): WatcherDisconnectFn

export function watchOnce(...fnsAndCallback: Function[]): WatcherDisconnectFn {
	let callback = fnsAndCallback.pop()!

	let wrappedCallback = (values: any[]) => {
		callback(...values)
		watcher.disconnect()
	}

	let watcher = new Watcher(fnsAndCallback, wrappedCallback as WatcherCallback)
	return watcher.disconnect.bind(watcher)
}


/** Watch returned values of function and trigger callback if it becomes true. */
export function watchUntil(fn: () => any, callback: () => void): WatcherDisconnectFn {
	let wrappedCallback = ([value]: any[]) => {
		if (value) {
			callback()
			watcher.disconnect()
		}
	}

	let value = fn()
	if (value) {
		callback()
		return () => {}
	}

	let watcher = new Watcher([fn], wrappedCallback)
	return watcher.disconnect.bind(watcher)
}


/** You need to know that the watch doesn't ensure the datas are really changed when calling callback. */
export class Watcher {

	private fns: Function[]
	private callback: WatcherCallback
	private values: unknown[] | null = null
	private connected: boolean = true

	constructor(fns: Function[], callback: WatcherCallback, immediately: boolean = false) {
		this.fns = fns
		this.callback = callback
		
		if (immediately) {
			this.__updateImmediately()
			this.callback(...this.values as unknown[])
		}
		else {
			this.update()
		}
	}

	private run(): unknown[] {
		let values: unknown[] = []

		for (let fn of this.fns) {
			values.push(fn())
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
			if (newValue[i] !== this.values![i]) {
				return true
			}

			if (typeof newValue[i] === 'object' && typeof this.values![i] === 'object') {
				return true
			}
		}

		return false
	}

	/** Keep consitant with Component */
	__updateImmediately() {
		if (!this.connected) {
			return
		}

		startUpdating(this)
		let newValues = this.run()
		endUpdating(this)

		if (this.values === null) {
			this.values = newValues
		}
		else if (this.mayChanged(newValues)) {
			this.values = newValues
			this.callback(...this.values)
		}
	}

	/**
	 * We currently just check the update times, if exceed 3 then warn.
	 * The better way should be analysising dependency tree:
	 * Get current watcher referenced objects, then get their referenced watchers.
	 * Then check if current watcher in it.
	 */
	toString() {
		return this.fns.map(fn => fn.toString().replace(/\s+/g, ' '))
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
