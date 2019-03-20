import {Template, text, join} from '../template'
import {Component} from '../component'
import {parse} from './part-parser'
import {ChildPart} from './child'
import {MayAttrPart} from './may-attr'
import {EventPart} from './event'
import {AttrPart} from './attr'
import {BindPart} from './bind'
import {PropertyPart} from './property'


export enum PartType {
	Root,
	Child,		//html`...` or text: <div>abc${def}ghi</div>, can't know about the details
	Attr,		//attr=${...}
	MayAttr,	//?checked=${...}
	Property,	//.property=${...}
	Bind,		//:class, :style, :props, :ref=${...}
	Event,		//@click, @com-event, @@click=${...}
}

export interface Part {
	type: PartType
	width: number
	strings: string[] | null
	update(value: any): void
}


export abstract class RootChildShared {

	protected template: Template
	protected context: Component
	protected parts: (Part | null)[] = []

	constructor(template: Template, context: Component) {
		this.template = template
		this.context = context
	}
	
	protected parse() {
		let {fragment, nodesInPlaces, places} = parse(this.template.type, this.template.strings)
		let values = this.template.values
		let valueIndex = 0

		if (nodesInPlaces && places) {
			for (let i = 0; i < nodesInPlaces.length; i++) {
				let node = nodesInPlaces[i]
				let place = places[i]
				let part: Part

				switch (place.type) {
					case PartType.Child:
						let result = values[valueIndex]
						if (!(result instanceof Template)) {
							result = text([String(result)], [])
						}
						part = new ChildPart(node as Comment, result, this.context)
						break

					case PartType.MayAttr:
						part = new MayAttrPart(node as HTMLElement, place.name!, values[valueIndex])
						break

					case PartType.Event:
						part = new EventPart(node as HTMLElement, place.name!, values[valueIndex], this.context)
						break

					case PartType.Attr:
						part = new AttrPart(node as HTMLElement, place.name!, join(place.strings, values.slice(valueIndex, valueIndex + place.width)))
						break

					case PartType.Bind:
						part = new BindPart(node as HTMLElement, place.name!, join(place.strings, values.slice(valueIndex, valueIndex + place.width)), this.context)
						break

					case PartType.Property:
						part = new PropertyPart(node as HTMLElement, place.name!, join(place.strings, values.slice(valueIndex, valueIndex + place.width)))
						break
				}

				valueIndex += place.width

				part!.strings = place.strings

				//we add null as placeholders to align with values
				if (place.width > 1) {
					part!.width = place.width
					for (let i = 1; i < place.width; i++) {
						this.parts.push(null)
					}
				}

				//like `:ref="name"`
				if (place.width > 0) {
					this.parts.push(part!)
				}
			}
		}

		this.afterParse(fragment)
	}

	protected abstract afterParse(fragment: DocumentFragment): void
	
	update(t: Template) {
		if (!t.compareType(this.template) || !t.compareStrings(this.template)) {
			this.clean()
			this.template = t
			this.parse()
		}
		else {
			let diffs = t.compareValues(this.template)
			if (diffs) {
				for (let i = 0; i < diffs.length;) {
					let index = diffs[i]
					let part = this.parts[index]
					let partIndex = index

					while (!part && partIndex < this.parts.length) {
						partIndex++
						part = this.parts[partIndex]
					}

					let values = t.values.slice(partIndex - part!.width + 1, partIndex + 1)
					this.mergePart(part!, values)

					if (part!.width > 1) {
						while (i < diffs.length - 1 && diffs[i + 1] <= partIndex) {
							i++
						}
					}
					else {
						i++
					}
				}
			}
		}
	}

	private mergePart(part: Part, values: any[]) {
		switch (part.type) {
			case PartType.Child:
			case PartType.MayAttr:
			case PartType.Event:
				part.update(values[0])
				break

			default:
				part.update(join(part.strings, values))
		}
	}

	protected abstract clean(): void
}


