import {Template} from './template'
import {ComponentConstructor, Component} from './component'
import {parse} from './part-parser'


export enum PartType {
	Root,
	Node,		//html`...` or text: <div>abc${def}ghi</div>, can't know about the details
	Attr,		//attr=${...}
	MayAttr,	//?checked=${...}
	Property,	//.property=${...}
	Bind,		//:class, :style, :props, :ref=${...}
	Event,		//@click, @com-event, @@click=${...}
}

interface Part {
	merge(value: any): void
}



export class RootPart implements Part {

	private template: Template
	private el: HTMLElement
	private context: Component
	private parts: Part[] = []

	constructor(template: Template, context: Component, el: HTMLElement) {
		this.template = template
		this.context = context
		this.el = el
		this.parse()
	}

	private parse() {
		let result = parse(this.template.type, this.template.strings)
	}
	
	merge(t: Template) {
		if (!t.compareType(this.template) || !t.compareStrings(this.template)) {
			this.clean()
			this.template = t
			this.parse()
		}
		else {
			let diff = t.compareValues(this.template)
			if (diff) {
				for (let i = 0; i < diff.length; i++) {
					this.mergePart(this.parts[i], diff[i].value)
				}
			}
		}
	}

	private clean() {
		this.el.innerHTML = ''
		this.parts = []
	}

	private mergePart(part: Part, value: any) {
		if (value instanceof Template && !(part instanceof ChildPart)) {

		}
		part.merge(value)
	}
}