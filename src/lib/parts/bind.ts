import {MayStringValuePart, PartType, Context} from "./types"
import {Binding, getBindedClass} from '../bindings'


/**
 * Transfer arguments to binds module.
 * :class="${...}", :style="${...}", :props="${...}"
 */
export class BindingPart implements MayStringValuePart {

	type: PartType = PartType.Binding
	strings: string[] | null = null

	private bind: Binding

	constructor(el: HTMLElement, name: string, value: unknown, context: Context) {
		let dotIndex = name.indexOf('.')
		let bindingName = dotIndex > -1 ? name.slice(0, dotIndex) : name
		let bindingModifiers = dotIndex > -1 ? name.slice(dotIndex + 1).split('.') : null

		let BindedClass = getBindedClass(bindingName)
		if (BindedClass) {
			this.bind = new BindedClass(el, value, bindingModifiers, context as any)
		}
		else {
			throw new Error(`":${bindingName}" is not defined as a binding class`)
		}
	}

	update(value: unknown) {
		this.bind.update(value)
	}
}