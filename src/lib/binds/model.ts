// import {Bind, defineBind} from './index'
// import {getComponentAt, onComponentCreatedAt, Component} from '../component'
// import {queue} from '../queue'


// /**
//  * model bind should only handle fixed value.
//  */
// defineBind('model', class ModelBind implements Bind {

// 	private el: HTMLElement
// 	private modifiers: string[] | null
// 	private context: Component
// 	private value: any = null
// 	private allowedModifiers = ['lazy', 'number']
// 	private isComEvent: boolean
// 	private isBooleanValue: boolean = false
// 	private isMultiSelect: boolean = false
// 	private property: string
// 	private eventName: string
// 	private locked: boolean = false

// 	constructor(el: HTMLElement, value: any, modifiers: string[] | null, context: Component) {
// 		if (typeof value !== 'string') {
// 			throw new Error('The value of ":model" must be string type')
// 		}

// 		if (modifiers) {
// 			if (modifiers.length > 1) {
// 				throw new Error(`Modifier "${modifiers.join('.')}" is not allowed, only one modifier can be specified for ":model"`)
// 			}

// 			if (!this.allowedModifiers.includes(modifiers[1])) {
// 				throw new Error(`Modifier "${modifiers[1]}" is not allowed, it must be one of ${this.allowedModifiers.map(m => `"${m}"`).join(', ')}`)
// 			}
// 		}

// 		this.el = el
// 		this.modifiers = modifiers
// 		this.context = context
// 		this.isComEvent = el.localName.includes('-')

// 		if (this.isComEvent) {
// 			this.property = 'value'
// 			this.eventName = 'change'
// 		}
// 		else {
// 			let isFormField = ['input', 'select', 'textarea'].includes(el.localName)
// 			let isLazy = modifiers && modifiers[0] === 'lazy'

// 			this.isBooleanValue = el.localName === 'input' && ((el as HTMLInputElement).type === 'checkbox' || (el as HTMLInputElement).type === 'radio')
// 			this.isMultiSelect = el.localName === 'select' && (el as HTMLSelectElement).multiple

// 			if (this.isBooleanValue) {
// 				this.property = 'checked'
// 				this.eventName = 'change'
// 			}
// 			else if (isFormField) {
// 				this.property = 'value'
// 				this.eventName = isLazy ? 'change' : 'input'
// 			}

// 			//div@contendeditable cant trigger change event but not input event
// 			else {
// 				this.property = 'innerHTML'
// 				this.eventName = isLazy ? 'blur' : 'input'
// 			}
// 		}

// 		this.update(value)
// 	}

// 	update(modelName: string) {
// 		if (this.isComEvent) {
// 			let com = getComponentAt(this.el)
// 			if (com) {
// 				com.on(this.eventName, this.onComValueChange, this)
// 			}
// 			else {
// 				onComponentCreatedAt(this.el, this.update.bind(this, modelName))
// 			}
// 		}
// 		else {
// 			//TO DO
// 			this.el.addEventListener(this.eventName, this.onInputOrChange.bind(this))
// 		}
// 	}

// 	onComValueChange(value: any) {
// 		(this.context as any)[this.property] = value
// 	}

// 	onInputOrChange (e: Event) {
// 		let value = (this.el as any)[this.property]

// 		if (this.isBooleanValue) {
// 			this.setValue(!!value)
// 		}
// 		else {
// 			this.setInputValue(value)
// 		}

// 		this.locked = true
// 		queue.nextTick(() => {
// 			this.locked = false

// 			//write value back to input
// 			if (e.type === 'change') {
// 				this.update(this.watcher.value)
// 			}
// 		})
// 	}


// 	setBoolValue (inputValue) {
// 		let {vm, watcher} = this
// 		let value = this.watcher.value

// 		watcher.set(!!inputValue)
// 	},


// 	setInputValue (inputValue) {
// 		let {el, vm, watcher} = this
// 		let isNumber = this.mods.includes('number')

// 		if (this.isMultiSelect) {
// 			let value = Array.from(el.options).filter(o => o.selected).map(o => o.value)

// 			if (isNumber) {
// 				value = value.map(Number)
// 			}

// 			watcher.set(value)
// 		}
// 		else {
// 			if (isNumber) {
// 				let numValue = Number(inputValue)
// 				watcher.set(numValue)
// 			}
// 			else {
// 				watcher.set(inputValue)
// 			}
// 		}
// 	},


// 	setValue (value) {
// 		if (this.com) {
// 			this.updateCom(value)
// 		}
// 		else {
// 			if (this.locked) {
// 				return
// 			}

// 			if (this.isBooleanValue) {
// 				this.updateBooleanValue(value)
// 			}
// 			else {
// 				this.updateInputValue(value)
// 			}
// 		}
// 	},


// 	updateCom (value) {
// 		let {prop, com} = this

// 		if (prop) {
// 			com[prop] = value
// 		}
// 		else if (util.isObject(value)) {
// 			ff.assign(com, value)
// 		}
// 	},


// 	updateBooleanValue (value) {
// 		let {el, prop} = this
// 		el[prop] = !!value
// 	},


// 	updateInputValue (value) {
// 		let {el, prop, isMultiSelect} = this

// 		if (isMultiSelect && !Array.isArray(value)) {
// 			throw new Error('"model" directive of select[multiple] requires an array as value')
// 		}

// 		if (isMultiSelect) {
// 			for (let option of el.options) {
// 				option.selected = value.includes(option.value)
// 			}
// 		}
// 		else {
// 			el[prop] = util.isNullOrUndefined(value) ? '' : value
// 		}
// 	},
// })
