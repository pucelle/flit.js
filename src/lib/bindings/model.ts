import {Binding, defineBinding} from './define'
import {Component, getComponentAtElement, onComponentCreatedAt} from '../component'
import {on} from '../dom-event'


const ALLOWED_MODIFIERS = ['lazy', 'number']


/** Model bind should only handle fixed model name. */
defineBinding('model', class ModelBinding implements Binding {

	private el: HTMLElement
	private modifiers: string[] | null
	private context: Component
	private isComModel: boolean
	private isBooleanValue: boolean = false
	private isMultiSelect: boolean = false
	private property: string
	private eventName: string

	private modelName: string | null = null
	private com: Component | null = null
	private unwatch: (() => void) | null = null

	constructor(el: Element, value: unknown, modifiers: string[] | null, context: Component) {
		if (typeof value !== 'string') {
			throw new Error('The value of ":model" must be string type')
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
			this.property = 'value'
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

			// `div@contendeditable` cant trigger change event but not input event
			else {
				this.property = 'innerHTML'
				this.eventName = isLazy ? 'blur' : 'input'
			}
		}

		this.update(value)
	}

	update(modelName: string) {
		if (!modelName) {
			throw new Error(`"${modelName}" is not a valid model name`)
		}

		this.modelName = modelName

		if (this.isComModel) {
			let com = getComponentAtElement(this.el)
			if (com) {
				this.bindCom(com)
			}
			else {
				onComponentCreatedAt(this.el, this.bindCom)
			}
		}
		else {
			on(this.el, this.eventName, this.onEventInputOrChange.bind(this))
			this.watchContextModelValue()
		}

		this.setModelValue((this.context as any)[modelName!])
	}

	bindCom(com: Component) {
		// Avoid bind twice when model changed.
		if (!this.com) {
			this.com = com
			;(com as any).on(this.eventName, this.writeModelValueBackToContext, this)
		}

		this.watchContextModelValue()
	}

	watchContextModelValue() {
		if (this.unwatch) {
			this.unwatch()
		}

		// There is a problem here, we do not support destroy parts and templates and bindings as a tree,
		// So when the `:model` was included in a `if` part, it can't be unwatch after relatated element removed.
		// `:model` is convient but eval, isn't it?
		this.unwatch = this.context.watch(this.modelName! as any, this.setModelValue.bind(this))
	}

	writeModelValueBackToContext(value: unknown) {
		(this.context as any)[this.modelName!] = value
	}

	onEventInputOrChange(_e: Event) {
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
		
		this.writeModelValueBackToContext(value)
	}

	setModelValue(value: unknown) {
		if (this.isComModel) {
			this.setComValue(value)
		}
		else {
			this.setInputValue(value)
		}
	}

	setComValue(value: unknown) {
		let com = this.com as any
		if (com && com[this.property] !== value) {
			com[this.property] = value
		}
	}

	setInputValue(value: unknown) {
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
})
