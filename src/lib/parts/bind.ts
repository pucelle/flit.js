import {MayStringValuePart, PartType} from "./shared"
import {Binding, getDefinedBinding} from '../bindings'
import {Context} from "../component"


/**
 * Transfer arguments to binding module.
 * :class="${...}", :style="${...}", :props="${...}"
 */
export class BindingPart implements MayStringValuePart {

	type: PartType = PartType.Binding
	strings: string[] | null = null

	private binding: Binding

	constructor(el: Element, name: string, value: unknown, context: Context) {
		let dotIndex = name.indexOf('.')
		let bindingName = dotIndex > -1 ? name.slice(0, dotIndex) : name
		let bindingModifiers = dotIndex > -1 ? name.slice(dotIndex + 1).split('.') : null

		let BindedClass = getDefinedBinding(bindingName)
		if (BindedClass) {
			this.binding = new BindedClass(el, value, bindingModifiers, context as any)
		}
		else {
			// `:property` eauqls `:prop.property`
			BindedClass = getDefinedBinding('prop')!
			bindingModifiers = bindingModifiers || []
			bindingModifiers.unshift(bindingName)
			this.binding = new BindedClass(el, value, bindingModifiers, context as any)
		}
	}

	update(value: unknown) {
		this.binding.update(value)
	}
}