import {defineDirective, Directive, DirectiveResult} from './define'
import {Watcher, globalWatcherSet} from '../watcher'
import {Context} from '../component'
import {DirectiveTransition, DirectiveTransitionOptions} from './libs/directive-transition'
import {WatchedTemplate, TemplateFn} from './libs/watched-template'
import {NodeAnchor} from '../libs/node-helper'
import {observe} from '../observer'


export class RepeatDirective<Item> implements Directive {

	protected anchor: NodeAnchor
	protected context: Context
	protected templateFn!: TemplateFn<Item>
	protected transition!: DirectiveTransition
	protected data: Item[] = []
	protected lastData: Iterable<Item> | null = null
	protected wtems: WatchedTemplate<Item>[] = []
	protected dataWatcher: Watcher<Item[]> | null = null
	protected firstlyMerge: boolean = true

	/** 
	 * For `liveRepeat`, specify the the start index of first item in the whole data.
	 * It was initialized from start options, and was reset when trigger `scroll` event on `scroller`.
	 */
	protected startIndex: number = 0

	constructor(anchor: NodeAnchor, context: Context) {
		this.anchor = anchor		
		this.context = context
		this.transition = new DirectiveTransition(context)
	}

	private watchAndUpdateData(data: Iterable<Item> | null) {
		if (data === this.lastData) {
			return
		}

		this.lastData = data

		if (!data) {
			this.setDataWatcher(null)
			this.updateData([])
			return
		}

		// Here need to read each item of the `Iterable<T>` so we can observe changes like `a[i] = xxx`.
		let watchFn = () => {
			return [...data].map(observe)
		}

		let onUpdate = (data: Item[]) => {
			this.updateData(data)
		}

		let watcher = new Watcher(watchFn, onUpdate)
		this.updateData(watcher.value)
		this.setDataWatcher(watcher)
	}

	protected setDataWatcher(watcher: Watcher | null) {
		if (this.dataWatcher) {
			this.dataWatcher.disconnect()

			if (this.context) {
				this.context.__deleteWatcher(this.dataWatcher)
			}
			else {
				globalWatcherSet.delete(this.dataWatcher)
			}
		}

		if (watcher) {
			if (this.context) {
				this.context.__addWatcher(watcher)
			}
			else {
				globalWatcherSet.add(watcher)
			}
		}

		this.dataWatcher = watcher
	}

	canMergeWith(_data: Iterable<Item>, templateFn: TemplateFn<Item>): boolean {
		return templateFn.toString() === this.templateFn.toString()
	}

	merge(data: Iterable<Item> | null, templateFn: TemplateFn<Item>, options?: DirectiveTransitionOptions) {
		this.templateFn = templateFn
		this.transition.setOptions(options)
		this.watchAndUpdateData(data)
		this.firstlyMerge = false
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

	protected updateData(data: Item[]) {
		// Old
		let oldData = this.data
		let oldItemIndexMap: Map<Item, number> = new Map()
		let oldWtems = this.wtems
		

		// New
		// Here it's not in updating and we can't capture dependencies,
		// so we need to observe each item manually,
		// then later we can generate templates and automatically update them when properties of item changed.
		let newData = this.data = data
		let newItemSet: Set<Item> = new Set(this.data)
		this.wtems = []

		
		// Mark not in use and reused
		let notInUseIndexSet: Set<number> = new Set()
		let usedIndexSet: Set<number> = new Set()

		for (let i = 0; i < oldData.length; i++) {
			let oldItem = oldData[i]

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
			for (let i = startIndex; i < oldData.length; i++) {
				let oldItem = oldData[i]
				if (newItemSet.has(oldItem) && oldItemIndexMap.get(oldItem) === i) {
					return i
				}
			}

			return oldData.length
		}

		let lastMatchedOldIndex = -1
		let nextMatchedOldIndex = getNextMatchedOldIndex(0)


		for (let index = 0; index < newData.length; index++) {
			let item = newData[index]

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
					this.useMatchedOne(oldWtems[reuseIndex], index)
					usedIndexSet.add(reuseIndex)
					lastMatchedOldIndex = nextMatchedOldIndex
					nextMatchedOldIndex = getNextMatchedOldIndex(reuseIndex + 1)
					continue
				}

				if (reuseIndex > -1) {
					this.moveOne(oldWtems[reuseIndex], nextMatchedOldIndex < oldData.length ? oldWtems[nextMatchedOldIndex]: null)
					this.useMatchedOne(oldWtems[reuseIndex], index)
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
					this.moveOne(oldWtems[reuseIndex], nextMatchedOldIndex < oldData.length ? oldWtems[nextMatchedOldIndex]: null)
				}
				
				this.reuseOne(oldWtems[reuseIndex], item, index)
				notInUseIndexSet.delete(reuseIndex)
				usedIndexSet.add(reuseIndex)
				continue
			}

			this.wtems.push(
				this.createOne(
					item,
					index,
					nextMatchedOldIndex < oldData.length ? oldWtems[nextMatchedOldIndex]: null
				)
			)
		}

		// Should not follow `notInUseIndexSet` here:
		// e.g., two same items exist, and only first one reused, 
		// the second one needs to be removed but not in `notInUseIndexSet`.
		if (usedIndexSet.size < oldData.length) {
			for (let i = 0; i < oldData.length; i++) {
				if (!usedIndexSet.has(i)) {
					this.removeOne(oldWtems[i])
				}
			}
		}
	}

	private useMatchedOne(wtem: WatchedTemplate<Item>, index: number) {
		wtem.updateIndex(index + this.startIndex)
		this.wtems.push(wtem)
	}

	private reuseOne(wtem: WatchedTemplate<Item>, item: Item, index: number) {
		wtem.update(item, index + this.startIndex)
		this.wtems.push(wtem)
	}

	private moveOne(wtem: WatchedTemplate<Item>, nextOldWtem: WatchedTemplate<Item> | null) {
		let fragment = wtem.template.range.getFragment()

		if (nextOldWtem) {
			nextOldWtem.template.range.startNode.before(fragment)
		}
		else {
			this.anchor.insert(fragment)
		}
	}

	private createOne(item: Item, index: number, nextOldWtem: WatchedTemplate<Item> | null): WatchedTemplate<Item> {
		let wtem = new WatchedTemplate(this.context, this.templateFn, item, index + this.startIndex)
		let template = wtem.template
		let fragment = template.range.getFragment()
		let firstElement: HTMLElement | null = null

		if (this.transition.shouldPlayEnter(this.firstlyMerge)) {
			firstElement = fragment.firstElementChild as HTMLElement
		}

		if (nextOldWtem) {
			nextOldWtem.template.range.startNode.before(fragment)
		}
		else {
			this.anchor.insert(fragment)
		}

		if (firstElement) {
			this.transition.mayPlayEnter(firstElement)
		}

		return wtem
	}

	private removeOne(wtem: WatchedTemplate<Item>) {
		let template = wtem.template

		if (this.transition.shouldPlay()) {
			let firstElement = template.range.getFirstElement()
			if (firstElement) {
				this.transition.mayPlayLeave(firstElement).then((finish: boolean) => {
					if (finish) {
						wtem.remove()
					}
				})
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
 * Currently the repeat directive reuses rendered elements by repeat data items, not `key` can be specified.
 * If data items have changed and you do need to reuse elements by a `key`, try repeat the `key` values.
 * @param items The iterable data, each item in it will pass to `templateFn.`
 * @param templateFn The fucntion which will return a template from one iterable data and index position.
 * @param options The transition options, it can be a transition name, property or properties, or {transition, enterAtStart}.
 */
export const repeat = defineDirective(RepeatDirective) as <T>(
	items: Iterable<T> | null,
	templateFn: TemplateFn<T>,
	options?: DirectiveTransitionOptions
) => DirectiveResult
