export class OffsetChildren {

	private readonly parent: ParentNode
	private readonly offset: number

	constructor(parent: ParentNode, offset: number) {
		this.parent = parent
		this.offset = offset
	}

	getChildren() {
		return [...this.parent.children].slice(this.offset)
	}

	childAt(index: number) {
		return this.parent.children[this.offset + index]
	}
}