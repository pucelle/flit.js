export enum PartType {
	Node,
	Attr,
	MayAttr,
	Property,
	Binding,
	Event,
	Directive
}

/** Each part to manage one `${...}` expression, which may be a template, templates, attribute... */
export interface Part {
	type: PartType
	update(value: unknown): void
}

/** Values may be `abc${...}` */
export interface MayStringValuePart extends Part {
	strings: string[] | null
}


export enum AnchorNodeType {
	Next,
	Root,
	Parent
}

/**
 * Used for `RootPart` or `NodePart` to mark end position.
 * Please never move the command type anchor node, the whole document may be removed.
 */
export class AnchorNode {

	el: Node
	type: AnchorNodeType

	constructor(el: Node, type: AnchorNodeType ) {
		this.el = el
		this.type = type

		if (this.type === AnchorNodeType.Root) {
			while (el.firstChild) {
				el.firstChild.remove()
			}
		}
	}

	insert(node: Node) {
		if (this.type === AnchorNodeType.Next) {
			(this.el as ChildNode).before(node)
		}
		else {
			(this.el as HTMLElement).append(node)
		}
	}
}