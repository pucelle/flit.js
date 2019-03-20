import {Part, PartType} from './shared'
import {Bind, getBind} from '../binds'
import {Component} from '../component'


export class BindPart implements Part {

	type: PartType = PartType.Bind
	width: number = 1
	strings: string[] | null = null

	private bind: Bind

	constructor(el: HTMLElement, name: string, value: any, context: Component) {
		let dotIndex = name.indexOf('.')
		let bindName = dotIndex > -1 ? name.slice(0, dotIndex) : name
		let bindModifiers = dotIndex > -1 ? name.slice(dotIndex + 1).split('.') : null

		let Cls = getBind(bindName)
		if (!Cls) {
			throw new Error(`"${bindName}" is not a binded class`)
		}

		this.bind = new Cls(el, value, bindModifiers, context)
	}

	update(value: any) {
		this.bind.update(value)
	}
}