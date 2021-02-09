import {Binding, defineBinding} from './define'
import {getComponentEarly} from '../component'
import type {Component, Context} from '../component'
import {on} from '../internals/dom-event'


/** All modifiers for model binding. */
const AllowedModelModifiers = ['lazy', 'number']


/** 
 * `:model` binding will bind inputable element's value with specified property of current component.
 * 
 * `:model="propertyName"` - Bind with property of current component.
 * `:model="objectProperty.propertyName"` - Bind with sub property of one object in current component.
 * `:model.lazy="propertyName"` - Uses `change` event to update component value, not `input`.
 * `:model.number="propertyName"` - Convert input value to number and then update component value.
 */
@defineBinding('model')
export class ModelBinding implements Binding<string> {

	private readonly el: HTMLElement
	private readonly modifiers: string[] | undefined
	private readonly context: Component

	/** If is `<com :model=${...}>`, this value is true. */
	private readonly isComModel: boolean

	/** Is boolean value, `true` for checkbox or radio. */
	private readonly isBooleanValue: boolean = false

	/** Is `<select multiple>`. */
	private readonly isMultiSelect: boolean = false

	/** Event name, `change` or `input`. */
	private readonly eventName: string

	private property: string
	private modelName!: string
	private com: Component | null = null
	private unwatch: (() => void) | null = null

	constructor(el: Element, context: Context, modifiers?: string[]) {
		if (!context) {
			throw new ReferenceError(`A context must be provided when using ":model=property"!`)
		}

		if (modifiers) {
			if (modifiers.length > 2) {
				throw new Error(`Modifier "${modifiers.join('.')}" is not allowed, at most two modifiers can be specified for ":model"!`)
			}

			for (let modifier of modifiers) {
				if (!AllowedModelModifiers.includes(modifier)) {
					throw new Error(`Modifier "${modifiers}" is not allowed, it must be one of ${AllowedModelModifiers.map(m => `"${m}"`).join(', ')}!`)
				}
			}
		}

		this.el = el as HTMLElement
		this.modifiers = modifiers
		this.context = context
		this.isComModel = el.localName.includes('-')

		if (this.isComModel) {
			this.property = 'value'	 	// will check `checked` property later.
			this.eventName = 'change'	// never be `input`.
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

	// Normally this method should only be called for once.
	update(modelName: string) {
		if (!modelName || typeof modelName !== 'string') {
			throw new Error(`"${modelName}" is not a valid model name!`)
		}

		this.modelName = modelName

		if (this.isComModel) {
			if (this.com) {
				this.updateComModel()
			}
			else {
				getComponentEarly(this.el, com => {
					this.bindComModel(com!)
					this.updateComModel()
				})
			}
		}
		else {
			this.updateElementModel()
			this.watchContextModelValue()
		}
	}

	private bindComModel(com: Component) {
		this.com = com
	}

	private updateComModel() {
		let com = this.com!

		// Some component use `checked` property as model value.
		if (com.hasOwnProperty('checked') && typeof (com as any).checked === 'boolean') {
			this.property = 'checked'
		}

		com.on(this.eventName as any, this.assignModelValueToContext as any, this)

		this.watchContextModelValue()
	}

	private watchContextModelValue() {
		if (this.unwatch) {
			this.unwatch()
		}

		// There is a problem here:
		// When the `:model` part was removed, it can't be unwatch after relatated element removed.
		// `:model` is convient but eval, isn't it?
		this.unwatch = this.context!.watchImmediately(this.getModelValueFromContext.bind(this), this.setModelValueToTarget.bind(this))
	}

	private getModelValueFromContext(): any {
		let properties = this.modelName.split('.')
		let value: any = this.context

		for (let property of properties) {
			if (value && typeof value === 'object') {
				value = value[property]
			}
			else {
				value = undefined
				break
			}
		}

		return value
	}

	private assignModelValueToContext(value: unknown) {
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

	private updateElementModel() {
		on(this.el, this.eventName, this.onEventInputOrChange.bind(this))
	}

	private onEventInputOrChange(_e: Event) {
		let value: any
		let isNumber = this.modifiers && this.modifiers.includes('number')

		if (this.isMultiSelect) {
			value = Array.from((this.el as HTMLSelectElement).options).filter(o => o.selected).map(o => o.value)

			if (isNumber) {
				value = value.map(Number)
			}
		}
		else {
			value = (this.el as any)[this.property]

			if (isNumber) {
				value = Number(value)
			}
		}
		
		this.assignModelValueToContext(value)
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
			throw new Error(`:model="${this.modelName}" of select[multiple] requires an array as value!`)
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
}
