import {Template} from '../template'
import {Component} from '../component'
import {RootChildShared, Part, PartType} from './shared'


export class ChildPart extends RootChildShared implements Part {
	width = 1
	type = PartType.Child
	private comment: Comment
	private parentNode: Node
	private els: Node[] | null = null

	constructor(commentEl: Comment, template: Template, context: Component) {
		super(template, context)
		this.comment = commentEl
		this.parentNode = commentEl.parentNode!
		this.parse()
	}

	protected afterParse(fragment: DocumentFragment) {
		let els = [...fragment.childNodes]

		if (els.length) {
			if (this.els) {
				this.parentNode.insertBefore(fragment, this.els[0])
				this.els.forEach(el => (el as ChildNode).remove())
			}
			else {
				this.comment.replaceWith(fragment)
			}
		}
		else {
			this.restoreComment()
		}

		if (this.els) {
			
		}

		this.els = els.length ? els : null
	}

	private restoreComment() {
		if (this.els) {
			this.parentNode.insertBefore(this.comment, this.els[0])
			this.els.forEach(el => (el as ChildNode).remove())
		}
	}

	protected clean() {
		this.restoreComment()
		this.parts = []
	}
}