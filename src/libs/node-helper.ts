export enum NodeAnchorType {
	Next,
	Root,
	Parent
}

/**
 * Used for `RootPart` or `NodePart` to mark end position.
 * Please never move the command type anchor node, the whole document may be removed.
 */
export class NodeAnchor {

	el: Node
	type: NodeAnchorType

	constructor(el: Node, type: NodeAnchorType) {
		this.el = el
		this.type = type
	}

	insert(node: Node) {
		if (this.type === NodeAnchorType.Next) {
			(this.el as ChildNode).before(node)
		}
		else {
			(this.el as HTMLElement).append(node)
		}
	}
}


/**
 * Use to cache rest nodes for component, or mark the range of a template output.
 * The nodes in it may be moved or removed, or insert more.
 * We need to makesure that what ever the inner nodes change,
 * we can still get nodes from the fixed start and end node.
 */
export class NodeRange {

	fragment: DocumentFragment | null = null
	startNode: ChildNode
	endNode: ChildNode

	constructor(fragment: DocumentFragment) {
		this.fragment = fragment

		// Fragment hould include at least one node, so it's position can be tracked.
		// Because startNode should always before any other nodes inside the template or as rest slot lement,
		// So if starts with a hole - comment node, which will insert nodes before it,
		// we need to prepend a comment node as `startNode`.
		let startNode = fragment.firstChild
		if (!startNode || startNode.nodeType === 8) {
			startNode = document.createComment('')
			fragment.prepend(startNode)
		}
		this.startNode = startNode

		// The end node will never be moved.
		// It should be a fixed element, or a comment node of a child part.
		this.endNode = fragment.lastChild!
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
	
	/** Get nodes in range. */
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

	/** Get first element in range. */
	getFirstElement(): HTMLElement | null {
		let node = this.startNode

		while (node) {
			if (node.nodeType === 1) {
				return node as HTMLElement
			}

			if (node === this.endNode) {
				break
			}

			node = node.nextSibling as ChildNode
		}

		return null
	}

	/** Remove all the nodes in range from parent. */
	remove() {
		this.getNodes().forEach(node => (node as ChildNode).remove())
	}
}