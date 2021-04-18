import {Binding, BindingResult, BindingReferences} from '../../bindings'
import type {Context} from '../../component'
import {Part} from './types'


/**
 * Passes value to a specified named Binding class:
 * 
 * `:class=${...}`
 * `:style=${...}`
 * `:ref="..."`
 */
export class FixedBindingPart implements Part {

	private readonly el: Element
	private readonly context: Context
	private readonly bindingName: string
	private readonly bindingModifiers: string[] | undefined

	private binding: Binding | null = null

	constructor(el: Element, name: string, context: Context) {
		this.el = el
		this.context = context

		let dotIndex = name.indexOf('.')
		this.bindingName = dotIndex > -1 ? name.slice(0, dotIndex) : name
		this.bindingModifiers = dotIndex > -1 ? name.slice(dotIndex + 1).split('.') : undefined
	}

	update(value: unknown) {
		if (!this.binding) {
			let result = new BindingResult(this.bindingName, value)
			this.binding = BindingReferences.createFromResult(this.el, this.context, result, this.bindingModifiers)
		}
		else {
			this.binding.update(value)
		}
	}

	remove() {}
}


/**
 * Passes a binding result to a binding module, used in:
 * `<tag show(...)>`, `<tag hide(...)>`, `<tag cache(...)>`.
 */
export class DynamicBindingPart implements Part {

	private readonly el: Element
	private readonly context: Context

	private name: string | null = null
	private binding: Binding | null = null

	constructor(el: Element, context: Context) {
		this.el = el
		this.context = context
	}

	update(value: unknown) {
		if (value instanceof BindingResult) {
			if (value.name === this.name) {
				this.binding!.update(...value.args as [any])
			}
			else {
				if (this.binding) {
					this.removeCurrentBinding()
				}

				this.name = value.name
				this.binding = BindingReferences.createFromResult(this.el, this.context, value)
			}
		}
		else {
			this.removeCurrentBinding()
		}
	}

	private removeCurrentBinding() {
		if (this.binding) {
			this.name = null
			this.binding!.remove()
			BindingReferences.removeReference(this.binding)
			this.binding = null
		}
	}
}
