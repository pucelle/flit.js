import {defineDirective, Directive, DirectiveResult} from './define'
import {Template} from '../parts'
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

	private createTemplate(item: T, index: number, nextNode: ChildNode | null, firstTime: boolean = false): WatchedTemplate<T> {
		let wtem = new WatchedTemplate(this.context, this.templateFn, item, index)
		let template = wtem.template
		let fragment = template.range.getFragment()
		let firstElement: HTMLElement | null = null

		if (this.transition.shouldPlayEnterMayAtStart(firstTime)) {
			firstElement = fragment.firstElementChild as HTMLElement
		}

		if (nextNode) {
			nextNode.before(fragment)
		}
		else {
			this.anchor.insert(fragment)
		}

		if (firstElement) {
			this.transition.playEnterAt(firstElement)
		}

		return wtem
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
	protected updateItems(items: T[]) {
		// Old
		let oldItems = this.items
		let oldItemIndexMap: Map<T, number> = new Map()
		let oldWtems = this.wtems
		

		// New
		// Here it's not updating and we can't capture dependencies,
		// so we need to observe each item manually,
		// then later we can generate templates and automatically update them when properties of item changed.
		let newItems = this.items = items.map(observe)
		let newItemSet: Set<T> = new Set(this.items)
		let newWtems: WatchedTemplate<T>[] = this.wtems = []

		
		// Mark removing and reusing
		let willRemoveIndexSet: Set<number> = new Set()
		let reusedIndexSet: Set<number> = new Set()

		for (let i = 0; i < oldItems.length; i++) {
			let oldItem = oldItems[i]

			// Duplicate item, remove it.
			if (oldItemIndexMap.has(oldItem)) {
				willRemoveIndexSet.add(i)
			}
			else {
				oldItemIndexMap.set(oldItem, i)

				if (!newItemSet.has(oldItem)) {
					willRemoveIndexSet.add(i)
				}
			}
		}


		// The `oldIndex` means: old templates with index larger or equal it can keep it's old position
		for (let index = 0, oldIndex = 0; index < newItems.length; index++) {
			let item = newItems[index]

			// May reuse
			if (oldItemIndexMap.has(item)) {
				
				// Find the old index for item
				let reuseIndex = oldItemIndexMap.get(item)!

				// Although destnation index can be reuse, but it may be reused by another template.
				// In this scenario we don't try to find a new index match item,
				// Such that all the duplicate wtems except the first one will be removed.
				// Otherwise, this can avoid nothing to move and then cause `scrollTop` of `parentNode` changed,
				// See the comment in `updateLiveItems` of `live-repeat.ts` for more details.
				if (reusedIndexSet.has(reuseIndex)) {
					reuseIndex = -1
					//reuseIndex = oldItems.findIndex((t, i) => t === item && !reusedIndexSet.has(i))
				}

				// `oldIndex <= oldIndexForItem` means that it can keep position.
				if (oldIndex <= reuseIndex) {
					let wtem = oldWtems[reuseIndex]
					wtem.updateIndex(index + this.startIndex)
					newWtems.push(wtem)
					reusedIndexSet.add(reuseIndex)
					oldIndex = reuseIndex + 1
					continue
				}

				if (reuseIndex > -1) {
					let wtem = oldWtems[reuseIndex]
					this.moveTemplate(wtem.template, oldIndex < oldItems.length ? oldWtems[oldIndex].template.range.startNode : null)
					wtem.updateIndex(index + this.startIndex)
					newWtems.push(wtem)
					reusedIndexSet.add(reuseIndex)
					continue
				}
			}

			// Reuse template that will be removed and rerender it
			if (!this.transition.shouldPlay() && willRemoveIndexSet.size > 0) {

				// Looking for a removed index starts from `oldIndex`, but without come across any can be reused item.
				let reuseIndex = -1
				for (let i = oldIndex; i < oldItems.length; i++) {
					if (willRemoveIndexSet.has(i)) {
						reuseIndex = i
						break
					}
					else if (newItemSet.has(oldItems[i])) {
						break
					}
				}

				if (reuseIndex > -1) {
					let wtem = oldWtems[reuseIndex]
					wtem.update(item, index + this.startIndex)
					newWtems.push(wtem)
					willRemoveIndexSet.delete(reuseIndex)
					reusedIndexSet.add(reuseIndex)
					oldIndex = reuseIndex + 1
					continue
				}

				reuseIndex = willRemoveIndexSet.keys().next().value

				let wtem = oldWtems[reuseIndex]
				this.moveTemplate(wtem.template, oldIndex < oldItems.length ? oldWtems[oldIndex].template.range.startNode : null)
				wtem.update(item, index + this.startIndex)
				newWtems.push(wtem)
				willRemoveIndexSet.delete(reuseIndex)
				reusedIndexSet.add(reuseIndex)
				continue
			}

			newWtems.push(
				this.createTemplate(
					item,
					index + this.startIndex,
					oldIndex < oldItems.length ? oldWtems[oldIndex].template.range.startNode : null
				)
			)
		}

		// Should not follow `willRemoveIndexSet` here:
		// e.g., two same items exist, and only first one reused, 
		// the second one needs to be removed but not in `willRemoveIndexSet`.
		if (reusedIndexSet.size < oldItems.length) {
			for (let i = 0; i < oldItems.length; i++) {
				if (!reusedIndexSet.has(i)) {
					this.removeTemplate(oldWtems[i])
				}
			}
		}
	}

	private moveTemplate(template: Template, nextNode: ChildNode | null) {
		let fragment = template.range.getFragment()

		if (nextNode) {
			nextNode.before(fragment)
		}
		else {
			this.anchor.insert(fragment)
		}
	}

	private removeTemplate(wtem: WatchedTemplate<T>) {
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
