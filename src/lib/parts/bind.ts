import {MayStringValuePart, PartType} from "./types"
import {Binding, getBindedClass} from '../bindings'
import {Component} from '../component'


/**
 * Transfer arguments to binds module.
 * :class="${...}", :style="${...}", :props="${...}"
 */
export class BindingPart implements MayStringValuePart {

	type: PartType = PartType.Binding
	strings: string[] | null = null

	private bind: Binding

	constructor(el: HTMLElement, name: string, value: unknown, context: Component) {
		let dotIndex = name.indexOf('.')
		let bindName = dotIndex > -1 ? name.slice(0, dotIndex) : name
		let bindModifiers = dotIndex > -1 ? name.slice(dotIndex + 1).split('.') : null

		let BindedClass = getBindedClass(bindName)
		if (!BindedClass) {
			throw new Error(`"${bindName}" is not a binded class`)
		}

		this.bind = new BindedClass(el, value, bindModifiers, context)
	}

	update(value: unknown) {
		this.bind.update(value)
	}
}