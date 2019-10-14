import {Part} from './types'
import {Binding, getDefinedBinding} from '../bindings'
import {Context} from '../component'
import {BindingResult} from '../bindings/define'


/**
 * Transfer arguments to a fixed type binding module, for:
 * `:class=${...}`, `:style=${...}`, `:props=${...}`.
 */
export class FixedBindingPart implements Part {

	private binding: Binding<any[]>

	constructor(el: Element, name: string, value: unknown, context: Context) {
		let dotIndex = name.indexOf('.')
		let bindingName = dotIndex > -1 ? name.slice(0, dotIndex) : name
		let bindingModifiers = dotIndex > -1 ? name.slice(dotIndex + 1).split('.') : undefined
		let BindingClass = getDefinedBinding(bindingName)

		if (!BindingClass) {
			throw new Error(`":${name}" on "<${el.localName}>" is not a registered binding class`)
		}

		this.binding = new BindingClass(el, context, bindingModifiers)
		this.update(value)
	}

	update(value: unknown) {
		this.binding.update(value)
	}
}


/**
 * Transfer arguments to binding module, used in:
 * `show(...)`, `hide(...)`, `cache(...)`.
 */
export class BindingPart implements Part {

	private el: Element
	private context: Context
	private binding: Binding<any[]> | null = null

	constructor(el: Element, value: unknown, context: Context) {
		this.el = el
		this.context = context

		if (value instanceof BindingResult) {
			let name = value.name
			let BindingClass = getDefinedBinding(name)!
			this.binding = new BindingClass(el, context)
			this.binding.update(...value.args)
		}
	}

	update(value: unknown) {
		if (value instanceof BindingResult) {
			let BindingClass = getDefinedBinding(value.name)!
			if (this.binding) {
				let isSameNameClass = this.binding instanceof BindingClass
				if (isSameNameClass) {
					this.binding.update(...value.args)
				}
				else {
					this.binding.remove()
					this.binding = new BindingClass(this.el, this.context)
					this.binding.update(...value.args)
				}
			}
		}
		else {
			if (this.binding) {
				this.binding.remove()
			}
		}
	}
}
