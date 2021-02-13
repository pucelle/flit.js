import {TemplateType} from './template-result'
import {joinWithOrderMarkers, containsOrderMarker, parseOrderMarkers, splitByOrderMarkers, extendsAttributes} from './utils'
import {trim} from '../helpers/utils'
import {parseToHTMLTokens, HTMLTokenType} from '../internals/html-token-parser'
import {getScopedClassNames} from '../internals/style-parser'


/** Type of each slot, respresent the type of `????=${...}`. */
export enum SlotType {

	/** `>${...}<` */
	Node,

	/** `<slot>` */
	SlotTag,

	/** `<tag attr=...>` */
	Attr,

	/** `<tag ?attr=...>` */
	MayAttr,

	/** `<tag .property=...>` */
	Property,

	/** `<tag @event=...>` */
	Event,

	/** `<tag :class=...>` */
	FixedBinging,

	/** `<tag ...>` */
	DynamicBinding,
}

/** Result parsed from a template. */
export interface ParsedResult {

	/** Fragment contains all the nodes that parsed from template strings. */
	fragment: DocumentFragment

	/** All the slots included in template, each one respresent a `${...}`. */
	slots: Slot[]

	/** Nodes that each slot place at. */
	nodes: Node[]
}

/** Already parsed result, can be shared with all the templates that having same strings. */
export interface SharedParsedReulst {

	/** The template element contains all the nodes that parsed from template strings. */
	template: HTMLTemplateElement

	/**  All the slots included in template, each one respresent a `???=${...}`. */
	slots: Slot[]

	/** 
	 * Attributes of root element.
	 * Be `null` if root element is not `<template>`.
	 */
	rootAttributes: {name: string, value: string}[] | null
}

/** Each slot respresent a `???=${...}`. */
export interface Slot {

	/** Slot type. */
	type: SlotType

	/** Slot attribute name, be `null` for dynamic binding `<tag ${...}>`. */
	name: string | null

	/** If defined as `???="a${...}b"`, be `[a, b]`. Otherwise be `null`. */
	strings: string[] | null

	/** 
	 * Value indices in the whole template.
	 * Having more than one values for `???="a${...}b${...}c"`.
	 * Is `null` if slot is a fixed slot defined like `???="..."`.
	 */
	valueIndices: number[] | null

	/** Index of the node the slot place at within the whole document fragment. */
	nodeIndex: number
}


/** Caches map of `scope name -> template string -> parsed result`. */
const ParsedResultCache: Map<string, Map<string, SharedParsedReulst>> = new Map()

/** Caches map of `scope name -> parser`. */
const ParserCache: Map<string, HTMLAndSVGTemplateParser> = new Map()


/**
 * Parses template strings to a document fragment and marks all slots and their associated nodes.
 * Will always prepend a comment in the front to mark current template start position.
 */
export function parseTemplate(type: TemplateType, strings: TemplateStringsArray | string[], el: HTMLElement | null): ParsedResult {
	let scopeName = el?.localName || 'global'

	// Parse it.
	if (type === 'html' || type === 'svg') {
		let string = joinWithOrderMarkers(strings as string[])
		let sharedResultMap = ParsedResultCache.get(scopeName)
		let sharedResult = sharedResultMap?.get(string)

		if (!sharedResult) {
			if (!sharedResultMap) {
				sharedResultMap = new Map()
				ParsedResultCache.set(scopeName, sharedResultMap)
			}

			let parser = ParserCache.get(scopeName)
			if (!parser) {
				parser = new HTMLAndSVGTemplateParser(scopeName)
				ParserCache.set(scopeName, parser)
			}

			sharedResult = parser.parse(type, string)
			sharedResultMap.set(string, sharedResult)
		}

		return cloneParsedResult(sharedResult, el)
	}

	// No slots, just create.
	else if (type === 'css') {
		let html = `<style>${strings[0]}</style>`
		let fragment = createTemplateFromHTML(html).content

		return {
			fragment,
			nodes: [],
			slots: [],
		}
	}

	// No slots too.
	else {
		let text = strings[0]
		let fragment = document.createDocumentFragment()
		fragment.append(document.createTextNode(text))

		return {
			fragment,
			nodes: [],
			slots: [],
		}
	}
}


/** Create a template element with `html` as content. */
function createTemplateFromHTML(html: string) {
	let template = document.createElement('template')
	template.innerHTML = html

	return template
}


class HTMLAndSVGTemplateParser {

	private readonly scopeName: string
	private readonly scopedClassNameSet: Set<string> | undefined

	private nodeIndexs: number[] = []
	private slots: Slot[] = []
	private currentNodeIndex = 0

	constructor(scopeName: string) {
		this.scopeName = scopeName
		this.scopedClassNameSet = getScopedClassNames(this.scopeName)
	}

	parse(type: TemplateType, string: string): SharedParsedReulst {
		let tokens = parseToHTMLTokens(string)
		let codes = ''

		for (let token of tokens) {
			switch (token.type) {
				case HTMLTokenType.StartTag:
					let tagName = token.tagName!
					let attributes = token.attributes!

					if (tagName === 'slot') {
						this.parseSlotTag(attributes)
					}

					// At least contains ` {flit:0}`.
					if (attributes.length >= 9) {
						attributes = this.parseAttribute(attributes)
					}
		
					codes += '<' + tagName + attributes + '>'
					this.currentNodeIndex++
					break

				case HTMLTokenType.EndTag:
					codes += `</${token.tagName}>`
					break

				case HTMLTokenType.Text:
					codes += this.parseText(token.text!)
					break
			}
		}

		let firstTag = tokens.find(token => token.type === HTMLTokenType.StartTag)
		let svgWrapped = false

		if (firstTag) {
			if (type === 'svg' && firstTag.tagName !== 'svg') {
				codes = '<svg>' + codes + '</svg>'
				svgWrapped = true
			}
		}

		let template = createTemplateFromHTML(codes)
		let attributes: {name: string, value: string}[] | null = null

		if (svgWrapped) {
			let svg = template.content.firstElementChild!
			template.content.append(...svg.childNodes)
			svg.remove()
		}

		// We can define some classes or styles on the top element if renders `<template class="...">`.
		if (firstTag && firstTag.tagName === 'template') {
			template = template.content.firstElementChild as HTMLTemplateElement
			attributes = [...template.attributes].map(({name, value}) => ({name, value}))
		}

		let result = {
			template,
			slots: this.slots,
			rootAttributes: attributes,
		}

		this.clean()

		return result
	}

	private parseSlotTag(attr: string) {
		let name = attr.match(/name=['"](.+?)['"]/)?.[1] || null

		this.slots.push({
			type: SlotType.SlotTag,
			name,
			strings: null,
			valueIndices: null,
			nodeIndex: this.currentNodeIndex,
		})
	}

	/** Parses `???=${...}`. */
	private parseAttribute(attr: string): string {
		const attrRE = /([.:?@\w-]+)\s*(?:=\s*(".*?"|'.*?'|\{flit:\d+\})\s*)?|\{flit:(\d+)\}\s*/g

		return attr.replace(attrRE, (m0, name: string, value: string = '', markerId: string) => {
			if (markerId) {
				this.slots.push({
					type: SlotType.DynamicBinding,
					name: null,
					strings: null,
					valueIndices: [Number(markerId)],
					nodeIndex: this.currentNodeIndex,
				})

				this.nodeIndexs.push(this.currentNodeIndex)
				return ''
			}

			let type: SlotType | undefined
			let hasMarker = containsOrderMarker(value)

			switch (name[0]) {
				case '.':
					type = SlotType.Property
					break

				case ':':
					type = SlotType.FixedBinging
					break

				case '?':
					type = SlotType.MayAttr
					break

				case '@':
					type = SlotType.Event
					break
			}

			if (type !== undefined) {
				name = name.slice(1)
			}

			if (type === undefined && hasMarker) {
				// `class=${...}` -> `:class=${...}`, so the class value can be scoped.
				if (name === 'class') {
					type = SlotType.FixedBinging
				}
				else {
					type = SlotType.Attr
				}
			}

			if (type !== undefined) {
				if (value[0] === '\'' || value[0] === '"') {
					value = value.slice(1, -1)
				}

				if (hasMarker) {
					let {strings, valueIndices} = parseOrderMarkers(value)
					this.slots.push({
						type,
						name,
						strings,
						valueIndices,
						nodeIndex: this.currentNodeIndex,
					})
				}
				else {
					this.slots.push({
						type,
						name,
						strings: [value],
						valueIndices: null,
						nodeIndex: this.currentNodeIndex,
					})
				}

				this.nodeIndexs.push(this.currentNodeIndex)

				if (type === SlotType.Attr) {
					return name + '="" '
				}
				else {
					return ''
				}
			}
			else if (name === 'class' && this.scopedClassNameSet) {
				value = value.replace(/[\w-]+/g, (m0: string) => {
					if (this.scopedClassNameSet!.has(m0)) {
						return m0 + '__' + this.scopeName
					}
					else {
						return m0
					}
				})

				return name + '=' + value
			}
			
			return m0
		})
	}

	/** Parses `<tag>${...}</tag>`. */
	private parseText(text: string): string {
		// `text` has already been trimmed here when parsing as tokens.
		if (!text) {
			return text
		}

		if (containsOrderMarker(text)) {
			let {strings, valueIndices} = splitByOrderMarkers(text)

			// Each hole may be a string, or a `TemplateResult`, so must unique them, but can't join them to a string.
			for (let i = 1; i < strings.length; i++) {
				this.slots.push({
					type: SlotType.Node,
					name: null,
					strings: null,
					valueIndices: valueIndices.slice(i - 1, i),
					nodeIndex: this.currentNodeIndex,
				})

				this.nodeIndexs.push(this.currentNodeIndex)
				this.currentNodeIndex += 1
			}

			text = strings.map(trim).join('<!--->')
		}

		return text
	}

	/** Clean properties for next time parsing. */
	private clean() {
		this.slots = []
		this.nodeIndexs = []
		this.currentNodeIndex = 0
	}
}


/** Clone parsed result fragment and link it with node indices from the parsed result. */
function cloneParsedResult(sharedResult: SharedParsedReulst, el: HTMLElement | null): ParsedResult {
	let {template, slots, rootAttributes} = sharedResult
	let fragment = template.content.cloneNode(true) as DocumentFragment
	let nodes: Node[] = []

	if (rootAttributes) {
		if (!el) {
			throw new Error('A context must be provided when rendering `<template>...`!')
		}

		extendsAttributes(el, rootAttributes)
	}

	if (slots.length > 0) {
		let nodeIndex = 0
		let slotIndex = 0
		let walker = document.createTreeWalker(fragment, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT, null)
		let node: Node | null
		let end = false

		if (rootAttributes) {
			while (slotIndex < slots.length && slots[slotIndex].nodeIndex === 0) {
				nodes.push(el!)
				slotIndex++
			}
			nodeIndex = 1
		}

		if (slotIndex < slots.length) {
			while (node = walker.nextNode()) {
				while (slots[slotIndex].nodeIndex === nodeIndex) {
					nodes.push(node)
					slotIndex++
					
					if (slotIndex === slots.length) {
						end = true
						break
					}
				}

				if (end) {
					break
				}

				nodeIndex++
			}
		}
	}

	return {
		fragment,
		slots,
		nodes,
	}
}
