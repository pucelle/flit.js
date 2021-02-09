import {Binding, BindingResult, createBindingFromResult} from '../../bindings'
import type {Context} from '../../component'


/**
 * Passes value to a specified named Binding class:
 * 
 * `:class=${...}`
 * `:style=${...}`
 * `:ref="..."`
 */
export class FixedBindingPart implements Part {

	private readonly binding: Binding

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
 * Passes a binding result to a binding module, used in:
 * `<tag show(...)>`, `<tag hide(...)>`, `<tag cache(...)>`.
 */
export class DynamicBindingPart implements Part {

	private readonly el: Element
	private readonly context: Context

	private binding: Binding | null = null
	private name: string | null = null

	constructor(el: Element, value: unknown, context: Context) {
		this.el = el
		this.context = context
		this.update(value)
	}

	update(value: unknown) {
		if (value instanceof BindingResult) {
			if (value.name === this.name) {
				this.binding!.update(...value.args as [any])
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
