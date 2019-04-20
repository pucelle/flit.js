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
	After,
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
	}

	insert(node: Node) {
		if (this.type === AnchorNodeType.After) {
			(this.el as ChildNode).before(node)
		}
		else {
			if (this.type === AnchorNodeType.Root) {
				while (this.el.firstChild) {
					this.el.firstChild.remove()
				}
			}
	
			(this.el as HTMLElement).append(node)
		}
	}
}