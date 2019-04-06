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
	private fragment: DocumentFragment | null = null

	startNode: ChildNode
	endNode: ChildNode
	hasSlots: boolean = false

	/**
	 * Create an template from html`...` like template result and context
	 * @param result The template result like html`...`.
	 * @param context The context passed to event handlers.
	 */
	constructor(result: TemplateResult, context: Context) {
		this.result = result
		this.context = context
		this.fragment = this.parseAsFragment()

		// Should include at least one node, So it's position can be tracked.
		// And should always before any other nodes inside,
		// So we need to prepend a comment node if it starts with a `hole`.
		let startNode = this.fragment.firstChild
		if (!startNode || startNode.nodeType === 8) {
			startNode = document.createComment('')
			this.fragment.prepend(startNode)
		}
		this.startNode = startNode

		// The end node will never be moved.
		// It should be a fixed node, or a comment node of a child part.
		// It will never be null since the parsed result always include at least one node.
		this.endNode = this.fragment.lastChild!
	}
	
	/** Parse template result and returns a fragment. */
	private parseAsFragment(): DocumentFragment {
		let {fragment, nodesInPlaces, places, hasSlots} = parse(this.result.type, this.result.strings)
		let values = this.result.values
		let valueIndex = 0

		this.hasSlots = hasSlots

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

		return fragment
	}

	/** Can be used to get firstly parsed fragment, or reuse template nodes as a fragment. */
	getFragment(): DocumentFragment {
		let fragment: DocumentFragment

		if (this.fragment) {
			fragment = this.fragment
			this.fragment = null
		}
		else {
			fragment = document.createDocumentFragment()
			fragment.append(...this.getNodes())
		}

		return fragment
	}

	/** Cache nodes in a fragment and use them later. */
	cacheFragment() {
		this.fragment = this.getFragment()
	}
	
	/** Get nodes belongs to template. */
	getNodes(): ChildNode[] {
		let nodes: ChildNode[] = []
		let node = this.startNode

		while (node) {
			nodes.push(node)

			if (node === this.endNode) {
				break
			}

			node = node.nextSibling as ChildNode
		}

		return nodes
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

	/** Compare value difference and then merge them later. */
	compareValues(result: TemplateResult): number[] | null {
		let diff: number[] = []

		for (let i = 0; i < this.result.values.length; i++) {
			if (this.result.values[i] !== result.values[i]) {
				diff.push(i)
			}
		}

		return diff.length > 0 ? diff : null
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
		this.getNodes().forEach(node => (node as ChildNode).remove())
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
