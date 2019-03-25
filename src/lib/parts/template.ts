import {NodePart, PartType, MayStringValuePart, Context} from './types'
import {TemplateResult} from './template-result'
import {parse} from './template-parser'
import {ChildPart} from './child'
import {MayAttrPart} from './may-attr'
import {EventPart} from './event'
import {AttrPart} from './attr'
import {BindingPart} from './bind'
import {PropertyPart} from './property'


export class Template {

	private result: TemplateResult
	private context: Context
	private parts: NodePart[] = []
	private fixedNodes: Node[] | null = null

	/**
	 * Create an template from html`...` like template result and context
	 * @param result The template result like html`...`.
	 * @param context The context passed to event handlers.
	 */
	constructor(result: TemplateResult, context: Context) {
		this.result = result
		this.context = context
	}
	
	/**
	 * Compare if two template result can be merged.
	 */
	canMergeWith(result: TemplateResult): boolean {
		if (this.result.type !== result.type) {
			return false
		}

		if (this.result.strings.length !== result.strings.length) {
			return false
		}

		for (let i = 0; i < this.result.strings.length; i++) {
			if (this.result.strings[i] !== result.strings[i]) {
				return false
			}
		}

		return true
	}

	/**
	 * Merge with another template result.
	 * @param result The template result to merge
	 */
	merge(result: TemplateResult) {
		let diffs = this.compareValues(result)
		if (!diffs) {
			return
		}

		for (let i = 0; i < diffs.length; i++) {
			let index = diffs[i]
			this.mergePart(this.parts[index], result.values[index] as unknown)
		}

		this.result = result
	}

	/**
	 * Compare value difference and then merge them later.
	 */
	compareValues(result: TemplateResult): number[] | null {
		let diff: number[] = []

		for (let i = 0; i < this.result.values.length; i++) {
			if (this.result.values[i] !== result.values[i]) {
				diff.push(i)
			}
		}

		return diff.length > 0 ? diff : null
	}

	/**
	 * Parse template result and returns a fragment.
	 * If willTrack and there is no fixed nodes, append a comment node in the front
	 */
	parseMayTrack(willTrack: boolean): DocumentFragment {
		let {fragment, nodesInPlaces, places} = parse(this.result.type, this.result.strings)
		let values = this.result.values
		let valueIndex = 0

		if (nodesInPlaces) {
			for (let nodeIndex = 0; nodeIndex < nodesInPlaces.length; nodeIndex++) {
				let node = nodesInPlaces[nodeIndex]
				let place = places![nodeIndex]
				let value = values[valueIndex]
				let part: NodePart

				switch (place.type) {
					case PartType.Child:
						part = new ChildPart(node as Comment, value, this.context)
						break

					case PartType.MayAttr:
						part = new MayAttrPart(node as HTMLElement, place.name!, value)
						break

					case PartType.Event:
						part = new EventPart(node as HTMLElement, place.name!, value as Function, this.context)
						break

					case PartType.Attr:
						part = new AttrPart(node as HTMLElement, place.name!, join(place.strings, value))
						;(part as MayStringValuePart).strings = place.strings
						break

					case PartType.Binding:
						part = new BindingPart(node as HTMLElement, place.name!, join(place.strings, value), this.context)
						;(part as MayStringValuePart).strings = place.strings
						break

					case PartType.Property:
						part = new PropertyPart(node as HTMLElement, place.name!, join(place.strings, value))
						;(part as MayStringValuePart).strings = place.strings
						break
				}

				if (place.placeable) {
					valueIndex += place.placeable ? 1 : 0
					this.parts.push(part!)
				}
			}
		}

		this.fixedNodes = [...fragment.childNodes].filter(node => node.nodeType !== 8)
		if (this.fixedNodes.length === 0 && willTrack) {
			let comment = new Comment()
			fragment.prepend(comment)
			this.fixedNodes.push(comment)
		}

		return fragment
	}
	
	private mergePart(part: NodePart, value: unknown) {
		switch (part.type) {
			case PartType.Child:
			case PartType.MayAttr:
			case PartType.Event:
				part.update(value)
				break

			default:
				part.update(join((part as MayStringValuePart).strings, value))
		}
	}

	remove() {
		this.fixedNodes!.forEach(node => (node as ChildNode).remove())

		for (let part of this.parts) {
			if (part instanceof ChildPart) {
				part.remove()
			}
		}
	}

	replaceWithFragment(fragment: DocumentFragment) {
		(this.fixedNodes![0] as ChildNode).before(fragment)
		this.remove()
	}
}


function join(strings: TemplateStringsArray | string[] | null, ...values: unknown[]): unknown {
	if (!strings) {
		return values[0]
	}

	let text = strings[0]

	for (let i = 0; i < strings.length - 1; i++) {
		let value = values[i]
		text += value === null || value === undefined ? '' : String(value)
		text += strings[i + 1]
	}

	return text
}
