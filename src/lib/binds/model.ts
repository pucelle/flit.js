
//supports mods: .lazy, .number
FF.registerDirective('model', {

	priority: 600,

	mods: [],


	onCompile (el) {
		let {type, localName} = el
		let isFormField = ['input', 'select', 'textarea'].includes(localName)
		let isLazy = this.mods.includes('lazy')
		let Component = FF.components[localName]

		this.isBoolValue = localName === 'input' && (type === 'checkbox' || type === 'radio')
		this.isMultiSelect = localName === 'select' && el.multiple

		if (Component) {
			this.prop = Component.prototype._modelProperty || 'value'
			this.eventName = 'change'
		}
		else if (this.isBoolValue) {
			this.prop = 'checked'
			this.eventName = 'change'
		}
		else if (isFormField) {
			this.prop = 'value'
			this.eventName = isLazy ? 'change' : 'input'
		}
		else {
			this.prop = 'innerHTML'
			this.eventName = isLazy ? 'blur' : 'input'	//div@contendeditable cant trigger change event
		}
	},


	bind () {
		let {el, eventName} = this
		let com = el[vmSymbol]

		if (com && com !== this.vm) {
			this.com = com
			com.on('change', this.onComChange, this)
		}
		else {
			this.locked = false
			dom.on(el, eventName, this.onInputOrChange, this)

			//we just want to makesure the value equals to the value of final state
			if (eventName === 'input') {
				let lazyEventName = this.prop === 'innerHTML' ? 'blur' : 'change'
				dom.on(el, lazyEventName, this.onInputOrChange, this)
			}
		}
	},


	onComChange (value) {
		let isNumber = this.mods.includes('number')
		if (isNumber) {
			value = Number(value)
		}

		this.watcher.set(value)
	},


	onInputOrChange (e) {
		let inputValue = this.el[this.prop]

		if (this.isBoolValue) {
			this.setBoolValue(inputValue)
		}
		else {
			this.setInputValue(inputValue)
		}

		this.locked = true
		queues.pushInnerTask(() => {
			this.locked = false

			//write value back to input
			if (e.type === 'change') {
				this.update(this.watcher.value)
			}
		})
	},


	setBoolValue (inputValue) {
		let {vm, watcher} = this
		let value = this.watcher.value

		watcher.set(!!inputValue)
	},


	setInputValue (inputValue) {
		let {el, vm, watcher} = this
		let isNumber = this.mods.includes('number')

		if (this.isMultiSelect) {
			let value = Array.from(el.options).filter(o => o.selected).map(o => o.value)

			if (isNumber) {
				value = value.map(Number)
			}

			watcher.set(value)
		}
		else {
			if (isNumber) {
				let numValue = Number(inputValue)
				watcher.set(numValue)
			}
			else {
				watcher.set(inputValue)
			}
		}
	},


	update (value) {
		if (this.com) {
			this.updateCom(value)
		}
		else {
			if (this.locked) {
				return
			}

			if (this.isBoolValue) {
				this.updateBooleanValue(value)
			}
			else {
				this.updateInputValue(value)
			}
		}
	},


	updateCom (value) {
		let {prop, com} = this

		if (prop) {
			com[prop] = value
		}
		else if (util.isObject(value)) {
			ff.assign(com, value)
		}
	},


	updateBooleanValue (value) {
		let {el, prop} = this
		el[prop] = !!value
	},


	updateInputValue (value) {
		let {el, prop, isMultiSelect} = this

		if (isMultiSelect && !Array.isArray(value)) {
			throw new Error('"model" directive of select[multiple] requires an array as value')
		}

		if (isMultiSelect) {
			for (let option of el.options) {
				option.selected = value.includes(option.value)
			}
		}
		else {
			el[prop] = util.isNullOrUndefined(value) ? '' : value
		}
	},
})
