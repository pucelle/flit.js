import {Template, text, join} from '../template'
import {Component} from '../component'
import {parse} from './part-parser'
import {MayAttrPart} from './may-attr'
import {EventPart} from './event'
import {AttrPart} from './attr'
import {BindPart} from './bind'
import {PropertyPart} from './property'
import {Part, PartType} from './types'


abstract class SharedPart {

	protected value: unknown
	protected context: Component
	protected parts: (Part | null)[] = []

	constructor(context: Component) {
		this.context = context
	}
	
	update(newValue: unknown) {
		let oldValue = this.value

		if ((newValue instanceof Template)) {
			if (oldValue instanceof Template) {
				this.compareTemplate(oldValue, newValue)
			}
			else {
				this.parseTemplate(newValue)
			}
		}
		else if (Array.isArray(newValue)) {
			//TODO
		}
		else {
			if (oldValue instanceof Template) {
				this.cleanTemplate()
			}
			
			this.renderText(newValue === null || newValue === undefined ? '' : String(newValue).trim())
		}

		this.value = newValue
	}

	private compareTemplate(oldTemplate: Template, newTemplate: Template) {
		if (!newTemplate.compareType(oldTemplate) || !newTemplate.compareStrings(oldTemplate)) {
			this.cleanTemplate()
			this.parseTemplate(newTemplate)
		}
		else {
			this.mergeTemplate(oldTemplate, newTemplate)
		}
	}

	private mergeTemplate(oldTemplate: Template, newTemplate: Template) {
		let diffs = newTemplate.compareValues(oldTemplate)
		if (diffs) {
			for (let i = 0; i < diffs.length;) {
				let index = diffs[i]
				let part = this.parts[index]
				let partIndex = index

				while (!part && partIndex < this.parts.length) {
					partIndex++
					part = this.parts[partIndex]
				}

				let values = newTemplate.values.slice(partIndex - part!.width + 1, partIndex + 1)
				this.mergePart(part!, values)

				if (part!.width > 1) {
					while (i < diffs.length - 1 && diffs[i + 1] <= partIndex) {
						i++
					}
				}
				else {
					i++
				}
			}
		}
	}

	protected parseTemplate(template: Template) {
		let {fragment, nodesInPlaces, places} = parse(template.type, template.strings)
		let values = template.values
		let valueIndex = 0

		if (nodesInPlaces && places) {
			for (let i = 0; i < nodesInPlaces.length; i++) {
				let node = nodesInPlaces[i]
				let place = places[i]
				let part: Part

				switch (place.type) {
					case PartType.Child:
						let result = values[valueIndex]
						if (!(result instanceof Template)) {
							result = text([String(result)] as any as TemplateStringsArray, [])
						}
						part = new ChildPart(node as Comment, result as Template, this.context)
						break

					case PartType.MayAttr:
						part = new MayAttrPart(node as HTMLElement, place.name!, values[valueIndex])
						break

					case PartType.Event:
						part = new EventPart(node as HTMLElement, place.name!, values[valueIndex] as Function, this.context)
						break

					case PartType.Attr:
						part = new AttrPart(node as HTMLElement, place.name!, join(place.strings, values.slice(valueIndex, valueIndex + place.width)))
						break

					case PartType.Bind:
						part = new BindPart(node as HTMLElement, place.name!, join(place.strings, values.slice(valueIndex, valueIndex + place.width)), this.context)
						break

					case PartType.Property:
						part = new PropertyPart(node as HTMLElement, place.name!, join(place.strings, values.slice(valueIndex, valueIndex + place.width)))
						break
				}

				valueIndex += place.width

				part!.strings = place.strings

				//we add null as placeholders to align with values
				if (place.width > 1) {
					part!.width = place.width
					for (let i = 1; i < place.width; i++) {
						this.parts.push(null)
					}
				}

				//like `:ref="name"`
				if (place.width > 0) {
					this.parts.push(part!)
				}
			}
		}

		this.renderFragment(fragment)
	}

	protected abstract renderText(text: string): void
	protected abstract renderFragment(fragment: DocumentFragment): void
	
	private mergePart(part: Part, values: unknown[]) {
		switch (part.type) {
			case PartType.Child:
			case PartType.MayAttr:
			case PartType.Event:
				part.update(values[0])
				break

			default:
				part.update(join(part.strings, values))
		}
	}

	private cleanTemplate() {
		this.parts = []
	}
}


export class RootPart extends SharedPart implements Part {

	width = 1
	type = PartType.Root
	strings: string[] | null = null

	private el: HTMLElement

	constructor(el: HTMLElement, value: unknown, context: Component) {
		super(context)
		this.el = el
		this.update(value)
	}

	protected renderText(text: string) {
		this.el.textContent = text
	}

	protected renderFragment(fragment: DocumentFragment) {
		while (this.el.firstChild) {
			this.el.firstChild.remove()
		}

		this.el.append(fragment)
	}
}


export class ChildPart extends SharedPart implements Part {

	type: PartType = PartType.Child
	width: number = 1
	strings: string[] | null = null

	private comment: Comment
	private parentNode: Node
	private els: Node[] | null = null

	constructor(comment: Comment, value: unknown, context: Component) {
		super(context)
		this.comment = comment
		this.parentNode = comment.parentNode!
		this.update(value)
	}

	protected renderText(text: string) {
		if (this.els && this.els.length === 1 && this.els[0].nodeType === 3) {
			this.els[0].textContent = text
		}
		else {
			let fragment = document.createDocumentFragment()
			fragment.textContent = text
			this.renderFragment(fragment)
		}
	}

	protected renderFragment(fragment: DocumentFragment) {
		if (this.els) {
			this.els.forEach(el => (el as ChildNode).remove())
		}

		let els = [...fragment.childNodes]
		if (els.length > 0) {
			this.parentNode.insertBefore(fragment, this.comment)
			this.els = els
		}
		else {
			this.els = null
		}
	}
}