import {Context} from '../../component'
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
	private items: {updatable: Updatable, context: Context, order: UpdatableOrder}[] = []

	isEmpty() {
		return this.items.length === 0
	}

	has(upt: Updatable): boolean {
		return this.set.has(upt)
	}

	add(updatable: Updatable, context: Context, order: UpdatableOrder) {
		this.items.push({
			updatable,
			context,
			order,
		})
	}

	getInOrder(): Updatable[] {
		this.items.sort((a, b) => {
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

		return this.items.map(i => i.updatable)
	}

	clear() {
		this.set = new Set()
		this.items = []
	}
}
