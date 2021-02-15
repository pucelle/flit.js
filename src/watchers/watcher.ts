import type {Context} from '../component'
import {startUpdating, endUpdating, clearDependenciesOf} from '../observer'
import {enqueueUpdatable, enqueueUpdatableInOrder} from '../queue'
import {UpdatableOrder} from '../queue/helpers/updatable-queue'


/** 
 * A watcher watchs a function returned value and trigger callback if the value is changed.
 * You need to know that when callback was called, it doesn't ensure the watched datas are truly changed,
 * especially the returned value is an object, so you may validate it again if needed.
 * You can create watcher from `context.watch...` or `globalWatcherGroup.watch...`.
 */
export class Watcher<T = any> {

	/** Watch function. */
	protected readonly fn: () => T

	/** Callback to call after data may be changed. */
	protected readonly callback: (value: T) => void

	/** Context to determine update order. */
	protected readonly context: Context

	/** Whether the watcher connected. */
	protected connected: boolean = true

	/** Last value returned from `fn`. */
	value: T

	constructor(fn: () => T, callback: (value: T) => void, context: Context) {
		this.fn = fn
		this.callback = callback
		this.context = context
		this.value = this.getNewValue()
	}

	/** Get a new value from `fn`. */
	protected getNewValue(): T {
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
		
		enqueueUpdatableInOrder(this, this.context, UpdatableOrder.Watcher)
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
 * So data and nodes are stabled now.
 */
export class LazyWatcher<T = any> extends Watcher<T> {

	update() {
		if (!this.connected) {
			return
		}
		
		enqueueUpdatable(this, this.context)
	}
}
