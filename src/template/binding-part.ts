import {Part} from './types'
import {Binding, BindingResult, createBindingFromResult} from '../bindings'
import {Context} from '../component'


/**
 * Transfer arguments to a fixed type binding module, e.g.:
 * `:class=${...}`, `:style=${...}`, `:ref="..."`.
 */
export class FixedBindingPart implements Part {

	private binding: Binding

	constructor(el: Element, name: string, value: unknown, context: Context) {
		let dotIndex = name.indexOf('.')
		let bindingName = dotIndex > -1 ? name.slice(0, dotIndex) : name
		let bindingModifiers = dotIndex > -1 ? name.slice(dotIndex + 1).split('.') : undefined
		let result = new BindingResult(bindingName, value)

		this.binding = createBindingFromResult(el, context, result, bindingModifiers)
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
	private binding: Binding | null = null
	private name: string | null = null

	constructor(el: Element, value: unknown, context: Context) {
		this.el = el
		this.context = context

		if (value instanceof BindingResult) {
			this.name = value.name
			this.binding = createBindingFromResult(el, context, value)
			this.binding.update(...value.args)
		}
	}

	update(value: unknown) {
		if (value instanceof BindingResult) {
			if (value.name === this.name) {
				this.binding!.update(...value.args)
			}
			else {
				this.removeCurrentBinding()
				this.binding = createBindingFromResult(this.el, this.context, value)
			}
		}
		else {
			this.removeCurrentBinding()
		}
	}

	private removeCurrentBinding() {
		if (this.binding) {
			this.name = null
			this.binding.remove()
			this.binding = null
		}
	}
}
