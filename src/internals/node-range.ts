/**
 * A node range represents a range of nodes from it's start and end position,
 * Such that we can extract nodes in the whole range and make a fragment any time,
 * no matter nodes inside was moved or removed, or insert more.
 */
export class NodeRange {

	/** Parent to contains all the nodes. */
	private container: ParentNode & Node | null = null

	/** Fixed start node of the range. */
	private startNode: ChildNode | null = null

	/** Fixed End node of the range. */
	private readonly endNode: ChildNode | null

	constructor(container: ParentNode & Node) {
		this.container = container
		
		// No need to worry about the last node, it's a fixed element, even a hole - comment node.
		// Because we always follows the rule in NodeAnchor: Insert more nodes before or in append postion.
		this.endNode = container.lastChild!
	}

	/** Get or create `startNode`. */
	private getStartNode(): ChildNode | null {
		if (this.startNode) {
			return this.startNode
		}
		
		let startNode = this.container!.firstChild!
		if (!startNode) {
			return null
		}

		// `startNode` should always ahead of any other nodes inside the template or as rest slot element,
		// But if first node is a hole - comment node, which will insert nodes before it,
		// extracting as a fragment will break this relationship.
		// So here prepend a new comment node as `startNode`.
		if (startNode.nodeType === 8) {
			startNode = document.createComment('')
			this.container!.prepend(startNode)
		}

		this.startNode = startNode

		return startNode
	}

	/** Get current container, may return `null`. */
	getCurrentContainer(): ParentNode & Node | null {
		return this.container
	}

	/** 
	 * Extract all nodes into a fragment.
	 * You must insert the extracted fragment into a container soon.
	 * Used to get just parsed fragment, or reuse template nodes.
	 */
	extractToFragment(): DocumentFragment {
		let fragment: DocumentFragment

		// Ensure `startNode` because will be inserted.
		if (!this.startNode) {
			this.getStartNode()
		}

		if (this.container instanceof DocumentFragment) {
			fragment = this.container
		}
		else {
			fragment = document.createDocumentFragment()
			fragment.append(...this.getNodes())
		}

		// Breaks the fragment-child relationship.
		this.container = null

		return fragment
	}

	/** 
	 * Moves all nodes out from parent container,
	 * and cache into a new fragment in order to use them later.
	 */
	movesOut() {
		this.container = this.extractToFragment()
	}
	
	/** Get all the nodes in the range. */
	getNodes(): ChildNode[] {
		let nodes: ChildNode[] = []
		let node = this.getStartNode()

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
		let node = this.getStartNode()

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
		this.getStartNode()?.before(range.extractToFragment())
	}

	/** Replace all the nodes in the range with the nodes of specified range. */
	replaceWith(range: NodeRange) {
		this.getStartNode()?.before(range.extractToFragment())
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