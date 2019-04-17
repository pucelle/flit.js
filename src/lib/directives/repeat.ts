import {defineDirective, Directive, DirectiveResult} from './define'
import {TemplateResult, Template, AnchorNode} from '../parts'
import {text} from '../parts/template-result'
import {Transition, TransitionOptions, formatShortTransitionOptions, ShortTransitionOptions} from '../transition'
import {Watcher} from '../watcher'
import {observe} from '../observer'
import {Context} from '../component'


type TemplateFn<T> = (item: T, index: number) => TemplateResult | string


class RepeatDirective<T> implements Directive {

	private anchorNode: AnchorNode
	private items: T[] = []
	private wtems: WatchedTemplate<T>[] = []
	private transitionOptions: TransitionOptions | null = null
	private itemsWatcher: Watcher<T[]> | null = null

	context: Context
	templateFn: TemplateFn<T>

	constructor(anchorNode: AnchorNode, context: Context, items: Iterable<T>, templateFn: TemplateFn<T>, transitionOptions?: ShortTransitionOptions) {
		this.anchorNode = anchorNode
		this.context = context
		this.items = this.getItems(items)
		this.templateFn = templateFn
		
		let index = 0
		for (let item of this.items) {
			let template = this.createTemplate(item, index, null)
			this.wtems.push(template)
		}

		// Doesn't play transition for the first time
		this.initTransitionOptions(transitionOptions)
	}

	private getItems(items: Iterable<T>): T[] {
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

	private initTransitionOptions(transitionOptions: ShortTransitionOptions | undefined) {
		if (transitionOptions) {
			this.transitionOptions = formatShortTransitionOptions(transitionOptions)
		}
		else {
			this.transitionOptions = null
		}
	}

	private createTemplate(item: T, index: number, nextNode: ChildNode | null): WatchedTemplate<T> {
		let wtem = new WatchedTemplate(this, item, index)
		let template = wtem.template
		let fragment = template.getFragment()
		let firstElement: HTMLElement | null = null

		if (this.transitionOptions) {
			firstElement = fragment.firstElementChild as HTMLElement
		}

		if (nextNode) {
			nextNode.before(fragment)
		}
		else {
			this.anchorNode.before(fragment)
		}

		if (firstElement && this.transitionOptions) {
			new Transition(firstElement, this.transitionOptions).enter()
		}

		return wtem
	}

	canMergeWith(_items: Iterable<T>, templateFn: TemplateFn<T>): boolean {
		return templateFn.toString() === this.templateFn.toString()
	}

	merge(items: Iterable<T>, _templateFn: TemplateFn<T>, transitionOptions?: ShortTransitionOptions) {
		this.initTransitionOptions(transitionOptions)
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

		
		// Handle removing and reusing
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


		// Loop
		for (let index = 0, oldIndex = 0; index < newItems.length; index++) {
			let item = newItems[index]

			if (oldIndex < oldItems.length) {
				// Make sure next old item is not used or will be removed
				while (willRemoveIndexSet.has(oldIndex) || reusedIndexSet.has(oldIndex)) {
					oldIndex++
				}

				// Old item just in the right position, only update index
				if (item === oldItems[oldIndex]) {
					let wtem = oldWtems[oldIndex]
					wtem.updateIndex(index)
					newWtems.push(wtem)
					reusedIndexSet.add(oldIndex)
					oldIndex++
					continue
				}
			}

			// May reuse
			if (oldItemIndexMap.has(item)) {
				let reusedIndex = oldItemIndexMap.get(item)!
				if (reusedIndexSet.has(reusedIndex)) {
					reusedIndex = oldItems.findIndex((t, i) => t === item && !reusedIndexSet.has(i))
				}

				if (reusedIndex > -1) {
					let wtem = oldWtems[reusedIndex]
					let template = wtem.template

					// No need to check if `reusedIndex === oldIndex`, they are not equal
					this.moveTemplate(template, oldIndex < oldItems.length ? oldWtems[oldIndex].template.startNode : null)
					wtem.updateIndex(index)
					newWtems.push(wtem)
					reusedIndexSet.add(reusedIndex)
					continue
				}
			}

			// Reuse template that will be removed and rerender it
			if (willRemoveIndexSet.size > 0 && !this.transitionOptions) {
				let reusedIndex = willRemoveIndexSet.keys().next().value
				let wtem = oldWtems[reusedIndex]
				let template = wtem.template

				this.moveTemplate(template, oldIndex < oldItems.length ? oldWtems[oldIndex].template.startNode : null)
				wtem.update(item, index)
				newWtems.push(wtem)
				reusedIndexSet.add(reusedIndex)
				continue
			}

			newWtems.push(this.createTemplate(item, index, oldIndex < oldItems.length ? oldWtems[oldIndex].template.startNode : null))
		}

		if (reusedIndexSet.size < oldItems.length) {
			for (let i = 0; i < oldItems.length; i++) {
				if (!reusedIndexSet.has(i)) {
					this.removeTemplate(oldWtems[i])
				}
			}
		}
	}

	private moveTemplate(template: Template, nextNode: ChildNode | null) {
		let fragment = template.getFragment()

		if (nextNode) {
			nextNode.before(fragment)
		}
		else {
			this.anchorNode.before(fragment)
		}
	}

	private removeTemplate(wtem: WatchedTemplate<T>) {
		let template = wtem.template

		if (this.transitionOptions) {
			let firstElement = template.getNodes().find(el => el.nodeType === 1) as HTMLElement | undefined
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

export const repeat = defineDirective(RepeatDirective) as <T>(items: Iterable<T>, templateFn: TemplateFn<T>, transitionOptions?: ShortTransitionOptions) => DirectiveResult


class WatchedTemplate<T> {

	private directive: RepeatDirective<T>
	private item: T
	private index: number
	private watcher: Watcher<TemplateResult> | null = null

	template: Template

	constructor(directive: RepeatDirective<T>, item: T, index: number) {
		this.directive = directive
		this.item = item
		this.index = index
		this.template = this.getTemplate()
	}

	private getTemplate(): Template {
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
				this.template.startNode.before(newTemplate.getFragment())
				this.template.remove()
				this.template = newTemplate
			}
		}
	
		this.watcher = new Watcher(watchFn, onUpdate)

		return new Template(this.watcher.value, context)
	}

	updateIndex(index: number) {
		if (index !== this.index) {
			this.index = index
			this.watcher!.__updateImmediately()
		}
	}

	update(item: T, index: number) {
		if (item !== this.item || index !== this.index) {
			this.item = item
			this.index = index
			this.watcher!.__updateImmediately()
		}
	}

	remove() {
		this.template!.remove()
		this.watcher!.disconnect()
	}
}

