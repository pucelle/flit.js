import {MayStringValuePart, PartType} from './shared'
import {Binding, getDefinedBinding} from '../bindings'
import {Context, Component, getComponent, onComponentCreatedAt} from '../component'


/**
 * Transfer arguments to binding module.
 * `:class=${...}`, `:style=${...}`, `:props=${...}`.
 */
export class BindingPart implements MayStringValuePart {

	type: PartType = PartType.Binding
	strings: string[] | null = null

	private binding: Binding | null = null
	private property: string = ''
	private com: Component | null = null
	private value: unknown = undefined

	constructor(el: Element, name: string, value: unknown, context: Context) {
		let dotIndex = name.indexOf('.')
		let bindingName = dotIndex > -1 ? name.slice(0, dotIndex) : name
		let bindingModifiers = dotIndex > -1 ? name.slice(dotIndex + 1).split('.') : null
		let isPropertyBinding = bindingName[0] === ':'
		let BindingClass: any

		if (isPropertyBinding) {
			bindingName = bindingName.slice(1)
		}

		if (!isPropertyBinding && (BindingClass = getDefinedBinding(bindingName))) {
			this.binding = new BindingClass(el, value, bindingModifiers, context)
		}
		else {
			this.bindComProperty(el, bindingName)
			this.updateComProperty(value)
		}
	}

	private bindComProperty(el: Element, property: string) {
		this.property = property

		let com = getComponent(el as HTMLElement)
		if (com) {
			this.com = com
		}
		else {
			onComponentCreatedAt(el as HTMLElement, this.onComCreated.bind(this))
		}
	}

	private onComCreated(com: Component) {
		this.com = com
		this.setComProperty(this.value)
		this.value = undefined	
	}

	update(value: unknown) {
		if (this.binding) {
			this.binding.update(value)
		}
		else {
			this.updateComProperty(value)
		}
	}

	private updateComProperty(value: unknown) {
		if (this.com) {
			this.setComProperty(value)
		}
		else {
			this.value = value
		}
	}

	setComProperty(value: unknown) {
		// We did compare values in component value setting to trigger update,
		// Such that here no need compare again.
		(this.com as any)[this.property] = value
	}
}
