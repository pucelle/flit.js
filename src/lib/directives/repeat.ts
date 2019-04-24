import {defineDirective, Directive, DirectiveResult} from './define'
import {TemplateResult, Template} from '../parts'
import {text} from '../parts/template-result'
import {Transition} from '../transition'
import {Watcher} from '../watcher'
import {observe} from '../observer'
import {Context} from '../component'
import {DirectiveTransition, DirectiveTransitionOptions} from './shared'
import {NodeAnchor} from '../node-helper'


type TemplateFn<T> = (item: T, index: number) => TemplateResult | string


class RepeatDirective<T> extends DirectiveTransition implements Directive {

	private anchorNode: NodeAnchor
	private items: T[] = []
	private wtems: WatchedTemplate<T>[] = []
	private itemsWatcher: Watcher<T[]> | null = null

	templateFn: TemplateFn<T>

	constructor(anchorNode: NodeAnchor, context: Context, items: Iterable<T> | null, templateFn: TemplateFn<T>, options?: DirectiveTransitionOptions) {
		super(context)
		this.initTransitionOptions(options)

		this.anchorNode = anchorNode
		this.items = this.getItems(items)
		this.templateFn = templateFn
		
		let index = 0
		for (let item of this.items) {
			let template = this.createTemplate(item, index, null, true)
			this.wtems.push(template)
		}
	}

	private getItems(items: Iterable<T> | null): T[] {
		if (!items) {
			return []
		}

		if (this.itemsWatcher) {
			this.itemsWatcher.disconnect()
		}

		let watchFn = () => {
			// items got here may be not been observed currently, event been updated here.
			// But they will becomes observed ones when updated from outside.
			// So here we just observe them all.
			let observedItems: T[] = []
			for (let item of items) {
				observedItems.push(observe(item))
			}
			return observedItems
		}

		let onUpdate = (items: T[]) => {
			this.updateItems(items)
		}

		this.itemsWatcher = new Watcher(watchFn, onUpdate)

		return this.itemsWatcher.value 
	}

	private createTemplate(item: T, index: number, nextNode: ChildNode | null, firstTime: boolean = false): WatchedTemplate<T> {
		let wtem = new WatchedTemplate(this, item, index)
		let template = wtem.template
		let fragment = template.nodeRange.getFragment()
		let firstElement: HTMLElement | null = null

		if (this.transitionOptions && (!firstTime || this.enterAtStart)) {
			firstElement = fragment.firstElementChild as HTMLElement
		}

		if (nextNode) {
			nextNode.before(fragment)
		}
		else {
			this.anchorNode.insert(fragment)
		}

		if (firstElement && this.transitionOptions) {
			new Transition(firstElement, this.transitionOptions).enter()
		}

		return wtem
	}

	canMergeWith(_items: Iterable<T>, templateFn: TemplateFn<T>): boolean {
		return templateFn.toString() === this.templateFn.toString()
	}

	merge(items: Iterable<T> | null, _templateFn: TemplateFn<T>, options?: DirectiveTransitionOptions) {
		this.initTransitionOptions(options)
		this.updateItems(this.getItems(items))
	}

	// We want to reduce moving times, the best way is here:
	// http://citeseerx.ist.psu.edu/viewdoc/download?doi=10.1.1.4.6927&rep=rep1&type=pdf

	// Another way in `lit-html` is to check from start and end position,
	// it's good when only add or remove somes in one position:
	// https://github.com/Polymer/lit-html/blob/master/src/directives/repeat.ts

	// But here we need to keep the index of template nodes that will be removed,
	// So we check from start position to end position,
	// collected templates which will be removed but keep them in their old position.
	updateItems(items: T[]) {
		// Old
		let oldItems = this.items
		let oldItemIndexMap: Map<T, number> = new Map()
		let oldWtems = this.wtems
		

		// New
		let newItems = this.items = items
		let newItemSet: Set<T> = new Set(this.items)
		let newWtems: WatchedTemplate<T>[] = this.wtems = []

		
		// Mark removing and reusing
		let willRemoveIndexSet: Set<number> = new Set()
		let reusedIndexSet: Set<number> = new Set()

		for (let i = 0; i < oldItems.length; i++) {
			let oldItem = oldItems[i]
			if (!oldItemIndexMap.has(oldItem)) {
				oldItemIndexMap.set(oldItem, i)
			}
			if (!newItemSet.has(oldItem)) {
				willRemoveIndexSet.add(i)
			}
		}

		let oldIndex = 0
		while (willRemoveIndexSet.has(oldIndex)) {
			oldIndex++
		}


		// The `oldIndex` means: old templates with index larger or equal it can keep it's old position
		for (let index = 0, oldIndex = 0; index < newItems.length; index++) {
			let item = newItems[index]

			// May reuse
			if (oldItemIndexMap.has(item)) {
				
				// Find the old index for item
				let reuseIndex = oldItemIndexMap.get(item)!

				// Although destnation index can be reuse, but it may be reused by another template.
				// In this scenario we try to find a new index.
				if (reusedIndexSet.has(reuseIndex)) {
					reuseIndex = oldItems.findIndex((t, i) => t === item && !reusedIndexSet.has(i))
				}

				// `oldIndex <= oldIndexForItem` means that it can keep position.
				if (oldIndex <= reuseIndex) {
					let wtem = oldWtems[reuseIndex]
					wtem.updateIndex(index)
					newWtems.push(wtem)
					reusedIndexSet.add(reuseIndex)
					oldIndex = reuseIndex + 1
					continue
				}

				if (reuseIndex > -1) {
					let wtem = oldWtems[reuseIndex]
					this.moveTemplate(wtem.template, oldIndex < oldItems.length ? oldWtems[oldIndex].template.nodeRange.startNode : null)
					wtem.updateIndex(index)
					newWtems.push(wtem)
					reusedIndexSet.add(reuseIndex)
					continue
				}
			}

			// Reuse template that will be removed and rerender it
			if (!this.transitionOptions && willRemoveIndexSet.size > 0) {

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
					wtem.update(item, index)
					newWtems.push(wtem)
					willRemoveIndexSet.delete(reuseIndex)
					reusedIndexSet.add(reuseIndex)
					oldIndex = reuseIndex + 1
					continue
				}

				reuseIndex = willRemoveIndexSet.keys().next().value

				let wtem = oldWtems[reuseIndex]
				this.moveTemplate(wtem.template, oldIndex < oldItems.length ? oldWtems[oldIndex].template.nodeRange.startNode : null)
				wtem.update(item, index)
				newWtems.push(wtem)
				willRemoveIndexSet.delete(reuseIndex)
				reusedIndexSet.add(reuseIndex)
				continue
			}

			newWtems.push(this.createTemplate(item, index, oldIndex < oldItems.length ? oldWtems[oldIndex].template.nodeRange.startNode : null))
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
		let fragment = template.nodeRange.getFragment()

		if (nextNode) {
			nextNode.before(fragment)
		}
		else {
			this.anchorNode.insert(fragment)
		}
	}

	private removeTemplate(wtem: WatchedTemplate<T>) {
		let template = wtem.template

		if (this.transitionOptions) {
			let firstElement = template.nodeRange.getNodes().find(el => el.nodeType === 1) as HTMLElement | undefined
			if (firstElement) {
				new Transition(firstElement, this.transitionOptions).leave().then(() => {
					wtem.remove()
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
		for (let template of this.wtems) {
			template.remove()
		}
	}
}

export const repeat = defineDirective(RepeatDirective) as <T>(items: Iterable<T> | null, templateFn: TemplateFn<T>, options?: DirectiveTransitionOptions) => DirectiveResult


class WatchedTemplate<T> {

	private directive: RepeatDirective<T>
	private item: T
	private index: number
	private watcher!: Watcher<TemplateResult>
	template!: Template

	constructor(directive: RepeatDirective<T>, item: T, index: number) {
		this.directive = directive
		this.item = item
		this.index = index
		this.parseAndWatchTemplate()
	}

	private parseAndWatchTemplate() {
		let templateFn = this.directive.templateFn
		let context = this.directive.context

		let watchFn = () => {
			let result = templateFn(this.item, this.index)
			if (typeof result === 'string') {
				result = text`${result}`
			}
			return result
		}
	
		let onUpdate = (result: TemplateResult) => {
			// Note that the template update in the watcher updating queue.
			if (this.template.canMergeWith(result)) {
				this.template.merge(result)
			}
			else {
				let newTemplate = new Template(result, context)
				this.template.nodeRange.startNode.before(newTemplate.nodeRange.getFragment())
				this.template.remove()
				this.template = newTemplate
			}
		}
	
		this.watcher = new Watcher(watchFn, onUpdate)
		this.template = new Template(this.watcher.value, context)
	}

	updateIndex(index: number) {
		if (index !== this.index) {
			this.index = index
			this.watcher.__updateImmediately()
		}
	}

	update(item: T, index: number) {
		if (item !== this.item || index !== this.index) {
			this.item = item
			this.index = index
			this.watcher.__updateImmediately()
		}
	}

	remove() {
		this.template!.remove()
		this.watcher.disconnect()
	}
}

