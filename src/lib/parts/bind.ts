import {MayStringValuePart, PartType} from './shared'
import {Binding, getDefinedBinding} from '../bindings'
import {Context} from '../component'


/**
 * Transfer arguments to binding module.
 * `:class=${...}`, `:style=${...}`, `:props=${...}`.
 */
export class BindingPart implements MayStringValuePart {

	type: PartType = PartType.Binding
	strings: string[] | null = null

	private binding: Binding

	constructor(el: Element, name: string, value: unknown, context: Context) {
		let dotIndex = name.indexOf('.')
		let bindingName = dotIndex > -1 ? name.slice(0, dotIndex) : name
		let bindingModifiers = dotIndex > -1 ? name.slice(dotIndex + 1).split('.') : null
		let BindingClass = getDefinedBinding(bindingName)

		if (!BindingClass) {
			throw new Error(`":${name}" on <${el.localName}> is not a registered binding class`)
		}

		this.binding = new BindingClass(el, value, bindingModifiers, context)
	}

	update(value: unknown) {
		this.binding.update(value)
	}
}
