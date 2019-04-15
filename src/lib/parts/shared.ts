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


enum AnchorNodeType {
	Comment,
	Element
}

/** Used for `RootPart` or `NodePart` to mark end position */
export class AnchorNode {

	private el: HTMLElement | Comment
	private type: AnchorNodeType

	constructor(el: HTMLElement | Comment) {
		this.el = el
		this.type = el.nodeType === 8 ? AnchorNodeType.Comment : AnchorNodeType.Element
	}

	before(node: Node) {
		if (this.type === AnchorNodeType.Comment) {
			this.el.before(node)
		}
		else {
			while (this.el.firstChild) {
				this.el.firstChild.remove()
			}
	
			(this.el as HTMLElement).append(node)
		}
	}
}