/**
 * A node range represents a range of nodes from it's start and end position,
 * Such that we can extract nodes in the whole range and make a fragment any time,
 * no matter nodes inside was moved or removed, or insert more.
 */
export class NodeRange {

	/** Parent to contains all the nodes. */
	protected fragment: DocumentFragment | null = null

	/** Fixed start node of the range. */
	protected readonly startNode!: ChildNode

	/** Fixed End node of the range. */
	protected readonly endNode: ChildNode | null

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
		
		// No need to worry about the last node, it's a fixed element, even for a hole - it's a comment node.
		// Because we always follows the rule in NodeAnchor: Insert more nodes before or in append postion.
		this.endNode = fragment.lastChild!
	}

	/** Get current container, may return `null`. */
	getCurrentFragment(): DocumentFragment | null {
		return this.fragment
	}

	/** 
	 * Extract all nodes into a fragment.
	 * You must insert the extracted fragment into a container soon.
	 * Used to get just parsed fragment, or reuse template nodes.
	 */
	extractToFragment(): DocumentFragment {
		let fragment: DocumentFragment

		if (this.fragment instanceof DocumentFragment) {
			fragment = this.fragment
		}
		else {
			fragment = document.createDocumentFragment()
			fragment.append(...this.getNodes())
		}

		// Breaks the fragment-child relationship.
		this.fragment = null

		return fragment
	}

	/** 
	 * Moves all nodes out from parent container,
	 * and cache into a new fragment in order to use them later.
	 */
	movesOut() {
		this.fragment = this.extractToFragment()
	}
	
	/** Get all the nodes in the range. */
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
	getFirstElement(): Element | null {
		let node = this.startNode

		while (node) {
			if (node.nodeType === 1) {
				return node as Element
			}

			if (node === this.endNode) {
				break
			}

			node = node.nextSibling as ChildNode
		}

		return null
	}

	/** Insert all the nodes of specified range before start node of current range. */
	before(range: NodeRange) {
		this.startNode.before(range.extractToFragment())
	}

	/** Replace all the nodes in the range with the nodes of specified range. */
	replaceWith(range: NodeRange) {
		this.startNode.before(range.extractToFragment())
		this.remove()
	}

	/** 
	 * Remove all the nodes in range from parent container.
	 * Call this means you will never reuse nodes in the range.
	 */
	remove() {
		this.getNodes().forEach(node => (node as ChildNode).remove())
	}
}


/** Compare to `NodeRange`, it only marks end node. */
 export class ContainerRange {

	/** Parent to contains all the nodes. */
	protected container: ParentNode & Node

	/** Fixed End node of the range. */
	protected readonly endNode: ChildNode | null

	constructor(container: ParentNode & Node) {
		this.container = container
		this.endNode = container.lastChild!
	}

	/** 
	 * Extract all nodes into a fragment.
	 * You must insert the extracted fragment into a container soon.
	 * Used to get just parsed fragment, or reuse template nodes.
	 */
	extractToFragment(): DocumentFragment {
		let fragment = document.createDocumentFragment()
		fragment.append(...this.getNodes())

		return fragment
	}
	
	/** Get all the nodes in the range. */
	getNodes(): ChildNode[] {
		let nodes: ChildNode[] = []
		let node = this.container.firstChild

		while (node) {
			nodes.push(node)

			if (node === this.endNode) {
				break
			}

			node = node.nextSibling as ChildNode
		}

		return nodes
	}

	/** 
	 * Remove all the nodes in range from parent container.
	 * Call this means you will never reuse nodes in the range.
	 */
	remove() {
		this.getNodes().forEach(node => (node as ChildNode).remove())
	}
}