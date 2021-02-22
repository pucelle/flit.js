import {NodeRange} from "../internals/node-range"
import {NodeAnchor, NodeAnchorType} from "../internals/node-anchor"
import {TemplateResult} from './template-result'
import {parseTemplate, Slot, SlotType} from './template-parser'
import {NodePart} from './parts/node-part'
import {MayAttrPart} from './parts/may-attr-part'
import {EventPart} from './parts/event-part'
import {AttrPart} from './parts/attr-part'
import {DynamicBindingPart, FixedBindingPart} from './parts/binding-part'
import {PropertyPart} from './parts/property-part'
import {Context, createComponent} from '../component'
import {joinStringsAndValues} from "./utils"
import {SlotPart} from "./parts/slot-part"
import {Part} from './parts/types'


/** Each updatable part. */
interface UpdatablePart {

	/** Part handle class. */
	part: Part

	/** Only available for slot like `???="a${...}b"`. */
	strings: string[] | null

	/** 
	 * Value indices in the whole template.
	 * Having more than one values for `???="a${...}b${...}c"`.
	 */
	valueIndices: number[]
}


/**
 * Class to parse a template result returned from html`...`,
 * and attach everything 
 * And can do some patches on it according to newly rendered template result.
 */
export class Template {

	private readonly context: Context
	private readonly range: NodeRange
	private readonly parts: UpdatablePart[] = []

	private currentResult: TemplateResult

	/**
	 * Create an template from html`...` like template result and context
	 * @param result The template result like html`...`.
	 * @param context The context passed to event handlers.
	 */
	constructor(result: TemplateResult, context: Context) {
		this.currentResult = result
		this.context = context

		let {fragment, nodes, slots} = parseTemplate(result.type, result.strings, this.context?.el || null)

		this.range = new NodeRange(fragment)
		this.parseParts(nodes, slots)
	}
	
	/** Parse template result and returns a fragment. */
	private parseParts(nodes: Node[] | null, slots: Slot[] | null) {
		let resultValues = this.currentResult.values

		if (nodes && slots) {
			for (let nodeIndex = 0; nodeIndex < nodes.length; nodeIndex++) {
				let node = nodes[nodeIndex]
				let slot = slots[nodeIndex]
				let part: Part | undefined

				switch (slot.type) {
					case SlotType.SlotTag:
						part = new SlotPart(node as Element, slot.name, this.context)
						break

					case SlotType.Node:
						part = new NodePart(new NodeAnchor(node, NodeAnchorType.Next), this.context)
						break

					case SlotType.MayAttr:
						part = new MayAttrPart(node as Element, slot.name!)
						break

					case SlotType.Event:
						part = new EventPart(node as Element, slot.name!, this.context)
						break

					case SlotType.Attr:
						part = new AttrPart(node as Element, slot.name!)
						break

					case SlotType.Property:
						part = new PropertyPart(node as Element, slot.name!, !slot.valueIndices)
						break
	
					case SlotType.FixedBinging:
						part = new FixedBindingPart(node as Element, slot.name!, this.context)
						break

					case SlotType.DynamicBinding:
						part = new DynamicBindingPart(node as Element, this.context)
						break
				}

				if (slot.type === SlotType.SlotTag) {
					(part as SlotPart).update()
				}
				else {
					let {strings, valueIndices} = slot
					let values = valueIndices?.map(index => resultValues[index]) || null
					let value = joinStringsAndValues(strings, values)

					part.update(value)

					// Only when `valueIndices` exist then value is dynamic so this part is updatable.
					if (valueIndices) {
						this.parts.push({
							part,
							strings,
							valueIndices,
						})
					}
				}
			}
		}
	}

	/** Compare if current template result can merge with `result`. */
	canMergeWith(result: TemplateResult): boolean {
		if (this.currentResult.type !== result.type) {
			return false
		}

		if (this.currentResult.strings.length !== result.strings.length) {
			return false
		}

		for (let i = 0; i < this.currentResult.strings.length; i++) {
			if (this.currentResult.strings[i] !== result.strings[i]) {
				return false
			}
		}

		return true
	}

	/** Merge current result with `result`. */
	merge(result: TemplateResult) {
		for (let {part, strings, valueIndices} of this.parts) {
			let changed = valueIndices.some(index => this.currentResult.values[index] !== result.values[index])
			
			if (changed) {
				let values = valueIndices.map(index => result.values[index])
				let value = joinStringsAndValues(strings, values)
				part.update(value)
			}
		}

		this.currentResult = result
	}

	/** 
	 * Initialize components inside a template and update it immediately.
	 * Elements are not connected but will be pre rendered.
	 */
	preRender() {
		let fragment = this.range.getCurrentContainer()
		if (!fragment || fragment instanceof DocumentFragment) {
			throw new Error(`Can only prerender contents in a fragment!`)
		}

		let walker = document.createTreeWalker(fragment, NodeFilter.SHOW_ELEMENT, null)
		let el: Node | null

		while (el = walker.nextNode()) {
			if (el instanceof HTMLElement && el.localName.includes('-')) {
				let com = createComponent(el)

				// Here it doesn't emit connected or created, just to pre render all the inner nodes.
				// May add more inner components and pre rendering them later.
				com.__updateImmediately(true)
			}
		}
	}

	/**
	 * Append all nodes into target element or selector.
	 * @param fragment The fragment to append.
	 * @param target The target element where will append to.
	 */
	appendTo(target: Element | string) {
		let fragment = this.extractToFragment()

		if (typeof target === 'string') {
			let targetEl = document.querySelector(target)
			if (targetEl) {
				targetEl.append(fragment)
			}
		}
		else if (target) {
			target.append(fragment)
		}
	}

	/** 
	 * Extract all nodes into a fragment.
	 * You must insert the extracted fragment into a container soon.
	 * Used to get just parsed fragment, or reuse template nodes.
	 */
	extractToFragment() {
		return this.range.extractToFragment()
	}

	/** 
	 * Moves all nodes out from parent container,
	 * and cache into a new fragment in order to use them later.
	 */
	movesOut() {
		this.range.movesOut()
	}
	
	/** Get all the nodes in the template. */
	getNodes(): ChildNode[] {
		return this.range.getNodes()
	}

	/** Get first element in template. */
	getFirstElement(): Element | null {
		return this.range.getFirstElement()
	}

	/** Insert all the nodes in specified template before start node of current template. */
	before(template: Template) {
		this.range.before(template.range)
	}

	/** Replace all the nodes in current template with the nodes of specified template. */
	replaceWith(template: Template) {
		this.range.replaceWith(template.range)
	}

	/** Removes all the nodes in the template. */
	remove() {
		this.range.remove()
	}
}
