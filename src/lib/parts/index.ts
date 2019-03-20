import {Template} from '../template'
import {Component} from '../component'
import {RootChildShared, Part, PartType} from './shared'


export class RootPart extends RootChildShared implements Part {

	width = 1
	type = PartType.Root
	strings: string[] | null = null

	private el: HTMLElement

	constructor(el: HTMLElement, template: Template, context: Component) {
		super(template, context)
		this.el = el
		this.parse()
	}

	protected afterParse(fragment: DocumentFragment) {
		this.el.append(fragment)
	}

	protected clean() {
		while (this.el.firstChild) {
			this.el.firstChild.remove()
		}

		this.parts = []
	}
}
