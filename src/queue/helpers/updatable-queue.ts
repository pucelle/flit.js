import {Context} from '../../component'
import {MiniHeap} from '../../helpers/mini-heap'
import {Updatable} from './types'


export enum UpdatableOrder {
	
	/** Update firstly. */
	Watcher,

	/** Update in second order. */
	Component,

	/** Update at last. */
	Otherwise,
}


/** Caches updatable items, get then in the order of `context, order`. */
export class UpdatableQueue {
	
	private set: Set<Updatable> = new Set()
	private heap: MiniHeap<{updatable: Updatable, context: Context, order: UpdatableOrder}>

	constructor() {
		this.heap = new MiniHeap((a, b) => {
			if (!a.context) {
				return -1
			}
			else if (!b.context) {
				return 1
			}
			else if (a.context !== b.context) {
				return a.context.el.compareDocumentPosition(b.context.el) & a.context.el.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
			}
			else {
				return a.order - b.order
			}
		})
	}

	isEmpty() {
		return this.heap.isEmpty()
	}

	has(upt: Updatable): boolean {
		return this.set.has(upt)
	}

	add(updatable: Updatable, context: Context, order: UpdatableOrder) {
		this.heap.add({
			updatable,
			context,
			order,
		})

		this.set.add(updatable)
	}

	shift() {
		let o = this.heap.removeHead()
		let upt = o!.updatable
		this.set.delete(upt)
		
		return o?.updatable
	}

	clear() {
		this.set = new Set()
		this.heap.clear()
	}
}
