import {defineDirective, Directive, DirectiveResult} from './define'
import {TemplateResult, Template} from '../parts'
import {text} from '../parts/template-result'


type TemplateFn<T> = (item: T, index: number) => TemplateResult | string


export const repeat = defineDirective(class RepeatDirective<T> extends Directive {

	items: T[] = []
	templates: Template[] = []
	templateFn: TemplateFn<T> | null = null

	initialize(items: Iterable<T>, templateFn: TemplateFn<T>) {
		this.items = items ? [...items] : []
		this.templateFn = templateFn
		
		let index = 0
		for (let item of this.items!) {
			let template = this.createTemplate(item, index)
			this.templates.push(template)
		}
	}

	private createTemplate(item: T, index: number, mayNextTemplateIndex: number = -1): Template {
		let result = this.templateFn!(item, index++)
		if (typeof result === 'string') {
			result = text`${result}`
		}

		let template = new Template(result, this.context)
		let fragment = template.parseToFragment()

		if (mayNextTemplateIndex >= 0 && mayNextTemplateIndex < this.templates.length && this.templates[mayNextTemplateIndex]) {
			this.templates[mayNextTemplateIndex].startNode!.before(fragment)
		}
		else {
			this.endNode.before(fragment)
		}

		return template
	}

	canMergeWith(_items: Iterable<T>, templateFn: TemplateFn<T>): boolean {
		return templateFn.toString() === this.templateFn!.toString()
	}

	merge(items: Iterable<T>, _templateFn: TemplateFn<T>) {
		let oldItems = this.items
		let oldItemSet: Set<T> = new Set(oldItems)
		let oldTemplates = this.templates
		let newItems = items ? [...items] : []
		let newItemSet: Set<T> = new Set(newItems)
		let newTemplates: Template[] = new Array(newItems.length)
		let headIndex = 0
		let tailIndex = newItems.length - 1
		let movedOrCreated = false
		
		this.items = newItems
		this.templates = newTemplates	// Need to use it when creating and moving templates.

		while (headIndex <= tailIndex) {
			let headItem = newItems[headIndex]
			let tailItem = newItems[tailIndex]

			if (oldItems.length === 0) {
				newTemplates[headIndex] = this.createTemplate(headItem, headIndex, tailIndex + 1)
				headIndex++
				continue
			}

			// Start position match, no need to move.
			if (!movedOrCreated && headItem === oldItems[0]) {
				oldItems.shift()
				newTemplates[headIndex] = oldTemplates.shift()!
				headIndex++
				continue
			}

			// End position match, no need to move.
			if (!movedOrCreated && tailItem === oldItems[oldItems.length - 1]) {
				oldItems.pop()
				newTemplates[tailIndex] = oldTemplates.pop()!
				tailIndex--
				continue
			}

			// Can reuse template for head item.
			if (oldItemSet.has(headItem)) {
				let index = oldItems.indexOf(headItem)
				if (index > -1) {
					oldItems.splice(index, 1)
					let template = oldTemplates.splice(index, 1)[0]
					this.moveTemplateAfter(template, headIndex - 1, tailIndex + 1)
					newTemplates[headIndex] = template
					headIndex++
					movedOrCreated = true
					continue
				}
			}

			// Can reuse template for tail item.
			if (oldItemSet.has(tailItem)) {
				let index = oldItems.indexOf(tailItem)
				if (index > -1) {
					oldItems.splice(index, 1)
					let template = oldTemplates.splice(index, 1)[0]
					this.moveTemplateBefore(template, tailIndex + 1)
					newTemplates[tailIndex] = template
					tailIndex--
					movedOrCreated = true
					continue
				}
			}

			// Need to reuse template and rerender it.
			let index = oldItems.findIndex(item => !newItemSet.has(item))
			if (index > -1) {
				oldItems.splice(index, 1)
				let template = oldTemplates.splice(index, 1)[0]
				this.moveTemplateAfter(template, headIndex - 1, tailIndex + 1)
				this.reuseTemplate(template, headItem, headIndex)
				newTemplates[headIndex] = template
			}
			else {
				newTemplates[headIndex] = this.createTemplate(headItem, headIndex, tailIndex + 1)
			}

			headIndex++
			movedOrCreated = true
		}

		if (oldTemplates.length > 0) {
			for (let template of oldTemplates) {
				template.remove()
			}
		}
	}

	private moveTemplateBefore(template: Template, mayNextTemplateIndex: number) {
		if (mayNextTemplateIndex < this.templates.length && this.templates[mayNextTemplateIndex]) {
			template.beInsertedBefore(this.templates[mayNextTemplateIndex].startNode!)
		}
		else {
			template.beInsertedBefore(this.endNode)
		}
	}

	private moveTemplateAfter(template: Template, mapPrevTemplateIndex: number, mayNextTemplateIndex: number) {
		if (mapPrevTemplateIndex >= 0 && this.templates[mapPrevTemplateIndex]) {
			template.beInsertedAfter(this.templates[mapPrevTemplateIndex].endNode!)
		}
		else if (mayNextTemplateIndex < this.templates.length && this.templates[mayNextTemplateIndex]) {
			template.beInsertedBefore(this.templates[mayNextTemplateIndex].startNode!)
		}
		else {
			template.beInsertedBefore(this.endNode)
		}
	}

	private reuseTemplate(template: Template, item: T, index: number) {
		let result = this.templateFn!(item, index++)
		if (typeof result === 'string') {
			result = text`${result}`
		}

		template.merge(result)
	}
}) as <T>(items: Iterable<T>, templateFn: TemplateFn<T>) => DirectiveResult
