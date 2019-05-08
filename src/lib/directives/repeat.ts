import {defineDirective, Directive, DirectiveResult} from './define'
import {Watcher} from '../watcher'
import {Context} from '../component'
import {DirectiveTransition, DirectiveTransitionOptions, WatchedTemplate, TemplateFn} from './shared'
import {NodeAnchor} from '../node-helper'
import {observe} from '../observer'


export class RepeatDirective<T> implements Directive {

	protected anchor: NodeAnchor
	protected context: Context
	protected templateFn: TemplateFn<T>
	protected transition: DirectiveTransition
	protected items: T[] = []
	protected wtems: WatchedTemplate<T>[] = []
	protected itemsWatcher: Watcher<T[]> | null = null
	protected firstlyUpdated: boolean = false

	/** 
	 * For `liveRepeat`, specify the the start index of first item in the whole data.
	 * It was initialized from start options, and was reset when trigger `scroll` event on `scroller`.
	 */
	protected startIndex: number = 0

	constructor(anchor: NodeAnchor, context: Context, items: Iterable<T> | null, templateFn: TemplateFn<T>, transitionOptions?: DirectiveTransitionOptions) {
		this.anchor = anchor		
		this.context = context
		this.templateFn = templateFn
		this.transition = new DirectiveTransition(context, transitionOptions)
		this.initItems(items)
	}

	protected initItems(items: Iterable<T> | null) {
		this.watchAndUpdateItems(items)
	}

	private watchAndUpdateItems(items: Iterable<T> | null) {
		if (!items) {
			return
		}

		if (this.itemsWatcher) {
			this.itemsWatcher.disconnect()
		}

		// Here need to read each item of the `Iterable<T>` so we can observe changes like `a[i] = xxx`.
		let watchFn = () => {
			return [...items]
		}

		let onUpdate = (items: T[]) => {
			this.updateItems(items)
		}

		this.itemsWatcher = new Watcher(watchFn, onUpdate)
		this.updateItems(this.itemsWatcher.value)
	}

	canMergeWith(_items: Iterable<T>, templateFn: TemplateFn<T>): boolean {
		return templateFn.toString() === this.templateFn.toString()
	}

	merge(items: Iterable<T> | null, _templateFn: TemplateFn<T>, options?: DirectiveTransitionOptions) {
		this.transition.setOptions(options)
		this.watchAndUpdateItems(items)
	}

	// We want to reduce moving times, the best way is here:
	// http://citeseerx.ist.psu.edu/viewdoc/download?doi=10.1.1.4.6927&rep=rep1&type=pdf

	// Another way in `lit-html` is to check from start and end position,
	// it's good when only add or remove somes in one position:
	// https://github.com/Polymer/lit-html/blob/master/src/directives/repeat.ts

	// But here we need to keep the index of template nodes that will be removed,
	// So we check from start position to end position,
	// collected templates which will be removed but keep them in their old position.

	// Concepts:
	//   matched: same item, no need to update item. if duplicate items exist, only the first one match.
	//   reuse: reuse not in use item and update item on it.

		protected updateItems(items: T[]) {
		// Old
		let oldItems = this.items
		let oldItemIndexMap: Map<T, number> = new Map()
		let oldWtems = this.wtems
		

		// New
		// Here it's not in updating and we can't capture dependencies,
		// so we need to observe each item manually,
		// then later we can generate templates and automatically update them when properties of item changed.
		let newItems = this.items = items.map(observe)
		let newItemSet: Set<T> = new Set(this.items)
		this.wtems = []

		
		// Mark not in use and reused
		let notInUseIndexSet: Set<number> = new Set()
		let usedIndexSet: Set<number> = new Set()

		for (let i = 0; i < oldItems.length; i++) {
			let oldItem = oldItems[i]

			// Duplicate item or placeholder item, which should not in use.
			if (oldItem === null || oldItemIndexMap.has(oldItem)) {
				notInUseIndexSet.add(i)
			}
			else {
				oldItemIndexMap.set(oldItem, i)

				if (!newItemSet.has(oldItem)) {
					notInUseIndexSet.add(i)
				}
			}
		}


		// "Old matched index" is the core indicator we moving elements according to.
		// When we reuse other elements, we move it before "next matched index",
		// such than when we meet the "next matched index" later, we don't need to move the elements.
		function getNextMatchedOldIndex(startIndex: number): number {
			for (let i = startIndex; i < oldItems.length; i++) {
				let oldItem = oldItems[i]
				if (newItemSet.has(oldItem) && oldItemIndexMap.get(oldItem) === i) {
					return i
				}
			}

			return oldItems.length
		}

		let lastMatchedOldIndex = -1
		let nextMatchedOldIndex = getNextMatchedOldIndex(0)


		for (let index = 0; index < newItems.length; index++) {
			let item = newItems[index]

			// May reuse
			if (oldItemIndexMap.has(item)) {
				
				// Find the old index for item
				let reuseIndex = oldItemIndexMap.get(item)!

				// Although template with the index can be reused, but it may be reused already.
				// In this scenario we don't try to find a new index that match item,
				// Such that all the items with duplicate value except the first one will be removed.
				if (usedIndexSet.has(reuseIndex)) {
					reuseIndex = -1
				}

				// It's already in the right position, no need to move.
				if (nextMatchedOldIndex <= reuseIndex) {
					this.useMatched(oldWtems[reuseIndex], index)
					usedIndexSet.add(reuseIndex)
					lastMatchedOldIndex = nextMatchedOldIndex
					nextMatchedOldIndex = getNextMatchedOldIndex(reuseIndex + 1)
					continue
				}

				if (reuseIndex > -1) {
					this.move(oldWtems[reuseIndex], nextMatchedOldIndex < oldItems.length ? oldWtems[nextMatchedOldIndex]: null)
					this.useMatched(oldWtems[reuseIndex], index)
					usedIndexSet.add(reuseIndex)
					continue
				}
			}

			// Reuse template that will be removed and rerender it
			if (!this.transition.shouldPlay() && notInUseIndexSet.size > 0) {
				let reuseIndex = -1

				// Looking for a not in use index betweens `lastMatchedOldIndex` and `nextMatchedOldIndex`,
				// Such that we have no need to move it.
				for (let i = lastMatchedOldIndex + 1; i < nextMatchedOldIndex; i++) {
					if (notInUseIndexSet.has(i)) {
						reuseIndex = i
						break
					}
				}

				if (reuseIndex === -1) {
					reuseIndex = notInUseIndexSet.keys().next().value
					this.move(oldWtems[reuseIndex], nextMatchedOldIndex < oldItems.length ? oldWtems[nextMatchedOldIndex]: null)
				}
				
				this.reuse(oldWtems[reuseIndex], item, index)
				notInUseIndexSet.delete(reuseIndex)
				usedIndexSet.add(reuseIndex)
				continue
			}

			this.wtems.push(
				this.create(
					item,
					index,
					nextMatchedOldIndex < oldItems.length ? oldWtems[nextMatchedOldIndex]: null
				)
			)
		}

		// Should not follow `willRemoveIndexSet` here:
		// e.g., two same items exist, and only first one reused, 
		// the second one needs to be removed but not in `willRemoveIndexSet`.
		if (usedIndexSet.size < oldItems.length) {
			for (let i = 0; i < oldItems.length; i++) {
				if (!usedIndexSet.has(i)) {
					this.delete(oldWtems[i])
				}
			}
		}

		this.firstlyUpdated = true
	}

	private useMatched(wtem: WatchedTemplate<T>, index: number) {
		wtem.updateIndex(index + this.startIndex)
		this.wtems.push(wtem)
	}

	private reuse(wtem: WatchedTemplate<T>, item: T, index: number) {
		wtem.update(item, index + this.startIndex)
		this.wtems.push(wtem)
	}

	private move(wtem: WatchedTemplate<T>, nextOldWtem: WatchedTemplate<T> | null) {
		let fragment = wtem.template.range.getFragment()

		if (nextOldWtem) {
			nextOldWtem.template.range.startNode.before(fragment)
		}
		else {
			this.anchor.insert(fragment)
		}
	}

	private create(item: T, index: number, nextOldWtem: WatchedTemplate<T> | null): WatchedTemplate<T> {
		let wtem = new WatchedTemplate(this.context, this.templateFn, item, index + this.startIndex)
		let template = wtem.template
		let fragment = template.range.getFragment()
		let firstElement: HTMLElement | null = null

		if (this.transition.shouldPlayEnterMayAtStart(this.firstlyUpdated)) {
			firstElement = fragment.firstElementChild as HTMLElement
		}

		if (nextOldWtem) {
			nextOldWtem.template.range.startNode.before(fragment)
		}
		else {
			this.anchor.insert(fragment)
		}

		if (firstElement) {
			this.transition.playEnterAt(firstElement)
		}

		return wtem
	}

	private delete(wtem: WatchedTemplate<T>) {
		let template = wtem.template

		if (this.transition.shouldPlay()) {
			let firstElement = template.range.getFirstElement()
			if (firstElement) {
				this.transition.playLeaveAt(firstElement)
				wtem.remove()
			}
			else {
				wtem.remove()
			}
		}
		else {
			wtem.remove()
		}
	}

	remove() {
		for (let wtem of this.wtems) {
			wtem.remove()
		}
	}
}

/**
 * Gerenate repeat elements, it will reuse elements as much as possible when data changed.
 * @param items The iterable data, each item in it will pass to `templateFn.`
 * @param templateFn The fucntion which will return a template from one iterable data and index position.
 * @param options The transition options, it can be a transition name, property or properties, or {transition, enterAtStart}.
 */
export const repeat = defineDirective(RepeatDirective) as <T>(
	items: Iterable<T> | null,
	templateFn: TemplateFn<T>,
	options?: DirectiveTransitionOptions
) => DirectiveResult
