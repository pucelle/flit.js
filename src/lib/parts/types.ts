/**
 * Should know less about outer component module.
 */
export interface Context {
	el: HTMLElement
}

export enum PartType {
	Root,
	Child,
	Attr,
	MayAttr,
	Property,
	Binding,
	Event,
	Directive
}

/**
 * Each part to manage one `${...}` expression, which may be a template, templates, attribute...
 */
export interface NodePart {
	type: PartType
	update(value: unknown): void
}

/**
 * Values may be `abc${...}`
 */
export interface MayStringValuePart extends NodePart {
	strings: string[] | null
}
