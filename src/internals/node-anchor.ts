/** Anchor type to indicate where to put the anchor at. */
export enum NodeAnchorType {

	/** Anchor node is next to inserted node. */
	Next,

	/** Anchor node is a container element and will insert new node as it's last child. */
	Container,
}


/**
 * To mark position to insert nodes.
 * Please never move the anchor node, the whole document may be removed.
 */
export class NodeAnchor {

	/** Anchor node, normally a container element or a comment node. */
	readonly el: Node

	/** Anchor type. */
	readonly type: NodeAnchorType

	constructor(el: Node, type: NodeAnchorType) {
		this.el = el
		this.type = type
	}

	/** Insert element to the anchor position. */
	insert(node: Node) {
		if (this.type === NodeAnchorType.Next) {
			(this.el as ChildNode).before(node)
		}
		else {
			(this.el as HTMLElement).append(node)
		}
	}
}

