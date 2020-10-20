import {defineDirective, Directive, DirectiveResult} from './define'
import {globalWatcherGroup} from '../watcher'
import {Context} from '../component'
import {DirectiveTransition, DirectiveTransitionOptions} from '../internal/directive-transition'
import {WatchedTemplate, TemplateFn} from '../internal/watched-template'
import {NodeAnchor} from '../internal/node-helper'
import {observe} from '../observer'


/** @hidden */
export class RepeatDirective<T> implements Directive {

	protected anchor: NodeAnchor
	protected context: Context
	protected templateFn!: TemplateFn<T>
	protected transition!: DirectiveTransition
	protected data: T[] = []
	protected wtems: WatchedTemplate<T>[] = []
	protected unwatchData: (() => void) | null = null

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

	private watchAndUpdateDataImmediately(data: Iterable<T> | null) {
		// Here if `data` eauqls `lastData`, we still must update watchers.
		// Bacause the old watcher may trigger another update and cause update for twice. 
		if (this.unwatchData) {
			this.unwatchData()
			this.unwatchData = null
		}

		if (!data) {
			this.updateData([])
			return
		}

		// Here need to read each item of the `Iterable<T>` so we can observe changes like `a[i] = xxx`.
		let watchFn = () => {
			return [...data].map(observe)
		}

		let onUpdate = (data: T[]) => {
			this.updateData(data)
		}

		this.unwatchData = (this.context || globalWatcherGroup).watchImmediately(watchFn, onUpdate)
	}

	canMergeWith(_data: Iterable<T>, templateFn: TemplateFn<T>): boolean {
		return templateFn.toString() === this.templateFn.toString()
	}

	merge(data: Iterable<T> | null, templateFn: TemplateFn<T>, options?: DirectiveTransitionOptions) {
		this.templateFn = templateFn
		this.transition.updateOptions(options)
		this.watchAndUpdateDataImmediately(data)
	}

	// We want to reduce times of moving times, the best way is:
	// http://citeseerx.ist.psu.edu/viewdoc/download?doi=10.1.1.4.6927&rep=rep1&type=pdf

	// Another way in `lit-html` is to check from start and end position,
	// it's good when only add or remove somes in one position:
	// https://github.com/Polymer/lit-html/blob/master/src/directives/repeat.ts

	// But here we need to keep the index of template nodes that will be removed,
	// So we check from start position to end position,
	// collected templates which will be removed but keep them in their old position.

	// This algorthim is good when you add or remove data, but a little weak when reordering data.

	// Concepts:
	//   matched: same item, no need to update item. if duplicate items exist, only the first one match.
	//   reuse: reuse not in use item and update item on it.

	protected updateData(data: T[]) {
		let shouldPaly = this.transition.shouldPlay()

		// Old
		let oldData = this.data
		let oldItemIndexMap: Map<T, number> = new Map()
		let oldWtems = this.wtems
		

		// New
		// Here it's not in updating and we can't capture dependencies,
		// so we need to observe each item manually,
		// then later we can generate templates and automatically update them when properties of item changed.
		let newData = this.data = data
		let newItemSet: Set<T> = new Set(this.data)
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


		// `nextMatchedOldIndex` is the core indicator we moving elements according to,
		// The element at `nextMatchedOldIndex` will keep it's position.

		// When we check other element whose new index before it:
		//   if is a matched one and before it: move it before
		//   if is a matched one and after or is it: leave it and upgrade `nextMatchedOldIndex`

		// If we have upgrade `nextMatchedOldIndex` to new value,
		// we can leave elements between last and new `nextMatchedOldIndex` and reuse them without moving.
		// Note that if we moved an matched item before `nextMatchedOldIndex` element,
		// we need to move all the following items until `nextMatchedOldIndex`.
		function getNextMatchedOldIndex(startIndex: number): number {
			for (let i = startIndex; i < oldData.length; i++) {
				let oldItem = oldData[i]
				if (newItemSet.has(oldItem) && oldItemIndexMap.get(oldItem) === i) {
					return i
				}
			}

			return oldData.length
		}

		let nextMatchedOldIndex = getNextMatchedOldIndex(0)
		let lastStayedOldIndex = -1


		for (let i = 0; i < newData.length; i++) {
			let item = newData[i]
			let index = i + this.startIndex

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

				// Already in the right position, no need to move.
				if (reuseIndex >= nextMatchedOldIndex) {
					this.useMatchedOne(oldWtems[reuseIndex], index)
					usedIndexSet.add(reuseIndex)
					lastStayedOldIndex = reuseIndex
					nextMatchedOldIndex = getNextMatchedOldIndex(reuseIndex + 1)
					continue
				}

				if (reuseIndex > -1) {
					this.moveOneBefore(oldWtems[reuseIndex], nextMatchedOldIndex < oldData.length ? oldWtems[nextMatchedOldIndex]: null)
					this.useMatchedOne(oldWtems[reuseIndex], index)
					usedIndexSet.add(reuseIndex)
					lastStayedOldIndex = nextMatchedOldIndex
					continue
				}
			}

			// Reuse template that will be removed and rerender it
			if (!shouldPaly && this.shouldReuse(item) && notInUseIndexSet.size > 0) {
				let reuseIndex = notInUseIndexSet.keys().next().value	// index in `notInUseIndexSet` is ordered.

				// If the index betweens `lastStayedOldIndex + 1` and `nextMatchedOldIndex`, no need to move it.
				let canStay = reuseIndex > lastStayedOldIndex && reuseIndex < nextMatchedOldIndex
				if (!canStay) {
					this.moveOneBefore(oldWtems[reuseIndex], nextMatchedOldIndex < oldData.length ? oldWtems[nextMatchedOldIndex]: null)
					lastStayedOldIndex = nextMatchedOldIndex
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

	protected shouldReuse(_item: T) {
		return true
	}

	protected useMatchedOne(wtem: WatchedTemplate<T>, index: number) {
		wtem.updateIndex(index)
		this.wtems.push(wtem)
	}

	protected reuseOne(wtem: WatchedTemplate<T>, item: T, index: number) {
		wtem.update(item, index)
		this.wtems.push(wtem)
	}

	protected moveOneBefore(wtem: WatchedTemplate<T>, nextOldWtem: WatchedTemplate<T> | null) {
		let fragment = wtem.template.range.getFragment()

		if (nextOldWtem) {
			nextOldWtem.template.range.startNode.before(fragment)
		}
		else {
			this.anchor.insert(fragment)
		}
	}

	protected createOne(item: T, index: number, nextOldWtem: WatchedTemplate<T> | null): WatchedTemplate<T> {
		let wtem = this.createWatchedTemplate(item, index)
		let template = wtem.template
		let fragment = template.range.getFragment()
		let firstElement: HTMLElement | null = null

		if (this.transition.shouldPlayEnter()) {
			firstElement = fragment.firstElementChild as HTMLElement
		}

		if (nextOldWtem) {
			nextOldWtem.template.range.startNode.before(fragment)
		}
		else {
			this.anchor.insert(fragment)
		}

		if (firstElement) {
			this.transition.playEnter(firstElement)
		}

		return wtem
	}

	protected createWatchedTemplate(item: T, index: number) {
		return new WatchedTemplate(this.context, this.templateFn, item, index)
	}

	protected removeOne(wtem: WatchedTemplate<T>) {
		let template = wtem.template

		if (this.transition.shouldPlay()) {
			let firstElement = template.range.getFirstElement()
			if (firstElement) {
				this.transition.playLeave(firstElement).then((finish: boolean) => {
					if (finish) {
						this.onWatchedTemplateNotInUse(wtem)
					}
				})
			}
			else {
				this.onWatchedTemplateNotInUse(wtem)
			}
		}
		else {
			this.onWatchedTemplateNotInUse(wtem)
		}
	}

	protected onWatchedTemplateNotInUse(wtem: WatchedTemplate<T>) {
		wtem.remove()
	}

	remove() {
		if (this.unwatchData) {
			this.unwatchData()
		}

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
