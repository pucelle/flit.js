import {Binding, defineBinding} from './define'
import {Component, getComponent, onComponentCreatedAt, Context} from '../component'
import {on} from '../dom-event'


const ALLOWED_MODIFIERS = ['lazy', 'number']


/** 
 * Handle `:model="name"`, it binds and auto update a specified property name in current context
 * with the `<input>` or `<com>` which has `value` or `checked` property, and `change` event.
 * Supports `:model="a.b"`.
 * Model bind should only handle fixed model name.
 */
defineBinding('model', class ModelBinding implements Binding<[string]> {

	private el: HTMLElement
	private modifiers: string[] | undefined
	private context: Component
	private isComModel: boolean
	private isBooleanValue: boolean = false
	private isMultiSelect: boolean = false
	private property: string
	private eventName: string

	private modelName!: string
	private com: Component | undefined
	private unwatch: (() => void) | null = null

	constructor(el: Element, context: Context, modifiers?: string[]) {
		if (!context) {
			throw new Error(`A context must be provided when using ":model=property"`)
		}

		if (modifiers) {
			if (modifiers.length > 2) {
				throw new Error(`Modifier "${modifiers.join('.')}" is not allowed, at most two modifiers can be specified for ":model"`)
			}

			for (let modifier of modifiers) {
				if (!ALLOWED_MODIFIERS.includes(modifier)) {
					throw new Error(`Modifier "${modifiers}" is not allowed, it must be one of ${ALLOWED_MODIFIERS.map(m => `"${m}"`).join(', ')}`)
				}
			}
		}

		this.el = el as HTMLElement
		this.modifiers = modifiers
		this.context = context
		this.isComModel = el.localName.includes('-')

		if (this.isComModel) {
			this.property = 'value' // or checked
			this.eventName = 'change'
		}
		else {
			let isFormField = ['input', 'select', 'textarea'].includes(el.localName)
			let isLazy = modifiers && modifiers[0] === 'lazy'

			this.isBooleanValue = el.localName === 'input' && ((el as HTMLInputElement).type === 'checkbox' || (el as HTMLInputElement).type === 'radio')
			this.isMultiSelect = el.localName === 'select' && (el as HTMLSelectElement).multiple

			if (this.isBooleanValue) {
				this.property = 'checked'
				this.eventName = 'change'
			}
			else if (isFormField) {
				this.property = 'value'
				this.eventName = isLazy ? 'change' : 'input'
			}

			// `div@contendeditable` cant trigger change and blur event but not input event
			else {
				this.property = 'innerHTML'
				this.eventName = isLazy ? 'blur' : 'input'
			}
		}
	}

	// Normally this should only be called for once.
	update(modelName: string) {
		if (!modelName || typeof modelName !== 'string') {
			throw new Error(`"${modelName}" is not a valid model name`)
		}

		this.modelName = modelName

		if (this.isComModel) {
			let com = getComponent(this.el)
			if (com) {
				this.bindCom(com)
			}
			else {
				onComponentCreatedAt(this.el, this.bindCom.bind(this))
			}
		}
		else {
			this.watchContextModelValue()
			on(this.el, this.eventName, this.onEventInputOrChange.bind(this))
		}
	}

	private bindCom(com: Component) {
		// Avoid bind event twice when model changed.
		if (!this.com) {
			this.com = com

			// Some component use `checked` property as model value.
			if (com.hasOwnProperty('checked') && typeof (com as any).checked === 'boolean') {
				this.property = 'checked'
			}

			com.on(this.eventName, this.setModelValueToContext, this)
		}

		this.watchContextModelValue()
	}

	private watchContextModelValue() {
		if (this.unwatch) {
			this.unwatch()
		}

		// There is a problem here:
		// When the `:model` was included in a `if` part, it can't be unwatch after relatated element removed.
		// `:model` is convient but eval, isn't it?
		this.unwatch = this.context!.watchImmediately(this.getModelValueFromContext.bind(this), this.setModelValueToTarget.bind(this))
	}

	private getModelValueFromContext(): unknown {
		let properties = this.modelName.split('.')
		let value: unknown = this.context

		for (let property of properties) {
			if (value && typeof value === 'object') {
				value = (value as any)[property]
			}
			else {
				value = undefined
				break
			}
		}

		return value
	}

	private setModelValueToContext(value: unknown) {
		let properties = this.modelName.split('.')
		let object: object = this.context

		for (let i = 0; i < properties.length; i++) {
			let property = properties[i]

			if (object && typeof object === 'object') {
				if (i < properties.length - 1) {
					object = (object as any)[property]
				}
				else {
					(object as any)[property] = value
				}
			}
			else {
				break
			}
		}
	}

	private onEventInputOrChange(_e: Event) {
		let value: unknown
		let isNumber = this.modifiers && this.modifiers.includes('number')

		if (this.isMultiSelect) {
			value = Array.from((this.el as HTMLSelectElement).options).filter(o => o.selected).map(o => o.value)

			if (isNumber) {
				value = (value as string[]).map(Number)
			}
		}
		else {
			value = (this.el as any)[this.property]

			if (isNumber) {
				value = Number(value)
			}
		}
		
		this.setModelValueToContext(value)
	}

	private setModelValueToTarget(value: unknown) {
		if (this.isComModel) {
			let com = this.com as any
			if (com[this.property] !== value) {
				com[this.property] = value
			}
		}
		else {
			this.setInputValue(value)
		}
	}

	private setInputValue(value: unknown) {
		if (this.isMultiSelect && !Array.isArray(value)) {
			throw new Error(`:model="${this.modelName}" of select[multiple] requires an array as value`)
		}

		if (this.isMultiSelect) {
			for (let option of (this.el as HTMLSelectElement).options) {
				option.selected = (value as string[]).includes(option.value)
			}
		}
		else {
			let el = this.el as any
			value = value === null || value === undefined ? '' : value

			// Here need to avoid:
			//   input value changed ->
			//   write value to context ->
			//   trigger watcher ->
			//   write same value to input, which may cause cursor position lost.

			// So we must compare the value firstly.

			if (el[this.property] !== value) {
				el[this.property] = value
			}
		}
	}

	remove() {
		this.setInputValue('')
	}
})
