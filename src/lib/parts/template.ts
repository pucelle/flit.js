import {Part, PartType, MayStringValuePart} from './shared'
import {NodeAnchor, NodeAnchorType, NodeRange} from "../node-helper"
import {TemplateResult} from './template-result'
import {parse, Place} from './template-parser'
import {NodePart} from './node'
import {MayAttrPart} from './may-attr'
import {EventPart} from './event'
import {AttrPart} from './attr'
import {BindingPart} from './bind'
import {PropertyPart} from './property'
import {Context} from '../component'


export class Template {

	private result: TemplateResult
	private context: Context
	private parts: Part[] = []

	range: NodeRange

	/**
	 * Create an template from html`...` like template result and context
	 * @param result The template result like html`...`.
	 * @param context The context passed to event handlers.
	 */
	constructor(result: TemplateResult, context: Context) {
		this.result = result
		this.context = context

		let {fragment, nodesInPlaces, places, hasSlots} = parse(this.result.type, this.result.strings, this.context ? this.context.el : null)
		this.range = new NodeRange(fragment)
		this.parseParts(nodesInPlaces, places)

		if (hasSlots && this.context) {
			this.context.__hasSlotsToBeFilled = true
		}
	}
	
	/** Parse template result and returns a fragment. */
	private parseParts(nodesInPlaces: Node[] | null, places: Place[] | null) {
		let values = this.result.values
		let valueIndex = 0

		if (nodesInPlaces && places) {
			for (let nodeIndex = 0; nodeIndex < nodesInPlaces.length; nodeIndex++) {
				let node = nodesInPlaces[nodeIndex]
				let place = places[nodeIndex]
				let holes = place.holes
				let value = values[valueIndex]
				let part: Part | undefined

				switch (place.type) {
					case PartType.Node:
						part = new NodePart(new NodeAnchor(node, NodeAnchorType.Next), value, this.context)
						break

					case PartType.MayAttr:
						part = new MayAttrPart(node as Element, place.name!, value)
						break

					case PartType.Event:
						part = new EventPart(node as Element, place.name!, value as (...args: any) => void, this.context)
						break

					case PartType.Attr:
						let attrValues = [value]
						if (holes > 1) {
							attrValues = values.slice(valueIndex, valueIndex + holes)
						}

						part = new AttrPart(node as Element, place.name!, join(place.strings, ...attrValues))
						;(part as MayStringValuePart).strings = place.strings
						break

					case PartType.Binding:
						part = new BindingPart(node as Element, place.name!, join(place.strings, value), this.context)
						;(part as MayStringValuePart).strings = place.strings
						break

					case PartType.Property:
						part = new PropertyPart(node as Element, place.name!, join(place.strings, value))
						;(part as MayStringValuePart).strings = place.strings
						break
				}

				if (holes > 0) {
					valueIndex += holes
					this.parts.push(part!)	// part will always exist when holes > 0
				}
			}
		}
	}

	/** Compare if two template result can be merged. */
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
	 * @param result The template result to merge.
	 */
	merge(result: TemplateResult) {
		let valueIndex = 0

		for (let part of this.parts) {
			let holes = 1
			if (part instanceof AttrPart && part.strings) {
				holes = part.strings.length - 1
			}

			let changed = false
			if (holes === 1) {
				changed = result.values[valueIndex] !== this.result.values[valueIndex]
			}
			else {
				for (let i = valueIndex; i < valueIndex + holes; i++) {
					if (result.values[i] !== this.result.values[i]) {
						changed = true
						break
					}
				}
			}
			
			if (changed) {
				if (holes > 1) {
					part.update(join((part as MayStringValuePart).strings, ...result.values.slice(valueIndex, valueIndex + holes)))
				}
				else {
					this.mergePartWithValue(part, result.values[valueIndex])
				}
			}

			valueIndex += holes
		}

		this.result = result
	}

	private mergePartWithValue(part: Part, value: unknown) {
		switch (part.type) {
			case PartType.Node:
			case PartType.MayAttr:
			case PartType.Event:
				part.update(value)
				break

			default:
				part.update(join((part as MayStringValuePart).strings, value))
		}
	}

	// Been called when this template will never be used any more.
	remove() {
		this.range.getNodes().forEach(node => (node as ChildNode).remove())
	}
}


/** Join strings and values to string, returns `values[0]` if `strings` is null. */
export function join(strings: TemplateStringsArray | string[] | null, ...values: unknown[]): unknown {
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
