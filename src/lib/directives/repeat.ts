import {defineDirective, Directive, DirectiveResult} from './define'
import {TemplateResult, Template} from '../parts'
import {text} from '../parts/template-result'
import {Transition, TransitionOptions, formatShortTransitionOptions, ShortTransitionOptions} from '../transition'


type TemplateFn<T> = (item: T, index: number) => TemplateResult | string


export const repeat = defineDirective(class RepeatDirective<T> extends Directive {

	private items: T[] = []
	private templates: Template[] = []
	private templateFn: TemplateFn<T> | null = null
	private transitionOptions: TransitionOptions | null = null

	init(items: Iterable<T>, templateFn: TemplateFn<T>, transitionOptions?: ShortTransitionOptions) {
		this.items = items ? [...items] : []
		this.templateFn = templateFn
		
		let index = 0
		for (let item of this.items!) {
			let template = this.createTemplate(item, index)
			this.templates.push(template)
		}

		// Doesn't play transition for the first time
		this.initTransitionOptions(transitionOptions)
	}

	private initTransitionOptions(transitionOptions: ShortTransitionOptions | undefined) {
		if (transitionOptions) {
			this.transitionOptions = formatShortTransitionOptions(transitionOptions)
		}
		else {
			this.transitionOptions = null
		}
	}

	private createTemplate(item: T, index: number, nextNode: ChildNode = this.endNode): Template {
		let result = this.templateFn!(item, index++)
		if (typeof result === 'string') {
			result = text`${result}`
		}

		let template = new Template(result, this.context)
		let fragment = template.getFragment()

		if (this.transitionOptions) {
			let firstElement = fragment.firstElementChild as HTMLElement
			if (firstElement) {
				new Transition(firstElement, this.transitionOptions).enter()
			}
		}

		nextNode.before(fragment)

		return template
	}

	canMergeWith(_items: Iterable<T>, templateFn: TemplateFn<T>): boolean {
		return templateFn.toString() === this.templateFn!.toString()
	}

	// We want to reduce moving times, the best way is here:
	// http://citeseerx.ist.psu.edu/viewdoc/download?doi=10.1.1.4.6927&rep=rep1&type=pdf

	// Another way in `lit-html` is to check from start and end position,
	// it's good when only add or remove somes in one position:
	// https://github.com/Polymer/lit-html/blob/master/src/directives/repeat.ts

	// But here we need to keep the index of template nodes that will be removed,
	// So we check from start position to end position,
	// collected templates which will be removed but keep them in their old position.
	merge(items: Iterable<T>, _templateFn: TemplateFn<T>, transitionOptions: ShortTransitionOptions) {
		
		// Old
		let oldItems = this.items
		let oldItemIndexMap: Map<T, number> = new Map()
		let oldTemplates = this.templates
		

		// New
		let newItems = this.items = items ? [...items] : []
		let newItemSet: Set<T> = new Set(this.items)
		let newTemplates: Template[] = this.templates = []
		this.initTransitionOptions(transitionOptions)

		
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

				// Old item ust in the right position, nothing need to do
				if (item === oldItems[oldIndex]) {
					newTemplates.push(oldTemplates[oldIndex])
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
					let template = oldTemplates[reusedIndex]

					// No need to check if `reusedIndex === oldIndex`, they are not equal
					this.moveTemplate(template, oldIndex < oldItems.length ? oldTemplates[oldIndex].startNode : undefined)
					newTemplates.push(template)
					reusedIndexSet.add(reusedIndex)
					continue
				}
			}

			// Reuse template that will be removed and rerender it
			if (willRemoveIndexSet.size > 0 && !this.transitionOptions) {
				let reusedIndex = willRemoveIndexSet.keys().next().value
				let template = oldTemplates[reusedIndex]

				this.moveTemplate(template, oldIndex < oldItems.length ? oldTemplates[oldIndex].startNode : undefined)
				this.reuseTemplate(template, item, index)
				newTemplates.push(template)
				reusedIndexSet.add(reusedIndex)
				continue
			}

			newTemplates.push(this.createTemplate(item, index, oldIndex < oldItems.length ? oldTemplates[oldIndex].startNode : undefined))
		}

		if (reusedIndexSet.size < oldItems.length) {
			for (let i = 0; i < oldItems.length; i++) {
				if (!reusedIndexSet.has(i)) {
					this.removeTemplate(oldTemplates[i])
				}
			}
		}
	}

	private moveTemplate(template: Template, nextNode: ChildNode = this.endNode) {
		nextNode.before(template.getFragment())
	}

	private reuseTemplate(template: Template, item: T, index: number) {
		let result = this.templateFn!(item, index++)
		if (typeof result === 'string') {
			result = text`${result}`
		}
		template.merge(result)
	}

	private removeTemplate(template: Template) {
		if (this.transitionOptions) {
			let firstElement = template.getNodes().find(el => el.nodeType === 1) as HTMLElement | undefined
			if (firstElement) {
				new Transition(firstElement, this.transitionOptions).leave(() => {
					template.remove()
				})
			}
			else {
				template.remove()
			}
		}
		else {
			template.remove()
		}
	}
}) as <T>(items: Iterable<T>, templateFn: TemplateFn<T>, transitionOptions?: ShortTransitionOptions) => DirectiveResult
