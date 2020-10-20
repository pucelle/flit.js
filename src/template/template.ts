import {Part} from './types'
import {NodeAnchor, NodeAnchorType, NodeRange} from "../Internal/node-helper"
import {TemplateResult} from './template-result'
import {parse, Place, PartType} from './template-parser'
import {NodePart} from './node-part'
import {MayAttrPart} from './may-attr-part'
import {EventPart} from './event-part'
import {AttrPart} from './attr-part'
import {BindingPart, FixedBindingPart} from './binding-part'
import {PropertyPart} from './property-part'
import {Context, getComponentConstructor, getComponent, createComponent} from '../component'


interface CanUpdateParts {
	part: Part
	strings: string[] | null
	valueIndexes: number[]
}


/**
 * Class to parse a template result returned from html`...` to element,
 * And can do some patches on it according to newly rendered template result.
 */
export class Template {

	private result: TemplateResult
	private context: Context
	private canUpdateParts: CanUpdateParts[] = []

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
			this.context.__foundSlotsWhenRendering()
		}
	}
	
	/** Parse template result and returns a fragment. */
	private parseParts(nodesInPlaces: Node[] | null, places: Place[] | null) {
		let resultValues = this.result.values

		if (nodesInPlaces && places) {
			for (let nodeIndex = 0; nodeIndex < nodesInPlaces.length; nodeIndex++) {
				let node = nodesInPlaces[nodeIndex]
				let place = places[nodeIndex]
				let strings = place.strings
				let valueIndexes = place.valueIndexes
				let values = valueIndexes ? valueIndexes.map(index => resultValues[index]) : null
				let value = join(strings, values)
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
						part = new AttrPart(node as Element, place.name!, value)
						break

					case PartType.Property:
						part = new PropertyPart(node as Element, place.name!, value, !valueIndexes)
						break
	
					case PartType.FixedBinging:
						part = new FixedBindingPart(node as Element, place.name!, value, this.context)
						break

					case PartType.Binding:
						part = new BindingPart(node as Element, value, this.context)
						break
				}

				if (part && valueIndexes) {
					this.canUpdateParts.push({
						part,
						strings,
						valueIndexes
					})
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
		for (let {part, strings, valueIndexes} of this.canUpdateParts) {
			let changed = valueIndexes.some(index => this.result.values[index] !== result.values[index])
			
			if (changed) {
				let values = valueIndexes.map(index => result.values[index])
				let value = join(strings, values)
				part.update(value)
			}
		}

		this.result = result
	}

	// Been called when this template will never be used any more.
	remove() {
		this.range.remove()

		for (let {part} of this.canUpdateParts) {
			part.remove()
		}
	}

	/** 
	 * Initialize components inside a template and update it immediately.
	 * Elements are not connected but will be pre rendered.
	 */
	preRender() {
		let fragment = this.range.fragment
		if (!fragment) {
			return
		}

		let walker = document.createTreeWalker(fragment, NodeFilter.SHOW_ELEMENT, null)
		let el: Node | null

		while (el = walker.nextNode()) {
			if (el instanceof HTMLElement && el.localName.includes('-')) {
				let Com = getComponentConstructor(el.localName)
				if (Com && !getComponent(el)) {
					let com = createComponent(el, Com)
					com.__updateImmediately(true)
				}
			}
		}
	}
}


/** Join strings and values to string, returns `values[0]` if `strings` is null. */
function join(strings: TemplateStringsArray | string[] | null, values: unknown[] | null): any {
	if (!strings) {
		return values![0]
	}

	let text = strings[0]

	for (let i = 0; i < strings.length - 1; i++) {
		let value = values![i]
		text += value === null || value === undefined ? '' : String(value)
		text += strings[i + 1]
	}

	return text
}