

//:src="url", cant use 
//:class="'class1 class2'", :class="[class1, class2]", :class="{class1: value1, class2: value2}", :class.class1="value1"
//:style same as :class, otherwise :style.name.px="value"
//:attr="{name: value}", :attr.name="value"
//not support :="{a, b}", but support :="obj"
//use .camel to support properties like viewBox
//use .px to add px as unit, .percentage to add %, .url to add url()
FF.registerDirective('bind', {

	priority: 600,

	prop: '',

	mods: [],

	onCompile () {
		let {prop, mods} = this

		this.prop = ff.toCamerCase(prop)

		if (mods.indexOf('camel') > 0) {
			mods[0] = ff.toCamerCase(mods[0])
		}
	},


	bind () {
		let {el, prop} = this
		let com = el[vmSymbol]

		if (com && !['class', 'style', 'attr'].includes(prop)) {
			if (com !== this.vm) {
				this.com = com
			}
		}
	},


	update (newValue, oldValue) {
		let {el, prop} = this

		if (this.com) {
			this.updateCom(newValue)
		}
		else if (prop === 'attr') {
			this.updateAttr(newValue, oldValue)
		}
		else if (prop === 'class') {
			this.updateClass(newValue, oldValue)
		}
		else if (prop === 'style') {
			this.updateStyle(newValue, oldValue)
		}
		else {
			newValue = util.isNullOrUndefined(newValue) ? '' : newValue

			//reset value of textarea to the same value will reset insert postition to the start
			//a problem exists: we need to ignore setting src to '' for <img> in Firefox, or the pseudo will not work
			let isEditableProp = prop === 'value' || prop === 'innerHTML'
			if (!isEditableProp || el[prop] !== newValue) {
				el[prop] = newValue
			}
		}
	},


	updateCom (value) {
		let {com, prop} = this

		if (prop) {
			com[prop] = value
		}
		else if (util.isObject(value)) {
			ff.assign(com, value)
		}
	},


	updateAttr (newValue, oldValue) {
		let mod0 = this.mods[0]

		if (mod0) {
			if ([false, undefined, null].includes(newValue)) {
				this.removeAttribute(mod0)
			}
			else {
				this.setAttribute(mod0, newValue)
			}
		}
		else {
			let oldObj = util.isObject(oldValue) ? oldValue : {}
			let newObj = util.isObject(newValue) ? newValue : {}
			let {add, remove} = this.compare(oldObj, newObj)

			if (remove.length > 0) {
				for (let attr of remove) {
					this.removeAttribute(attr)
				}
			}

			if (add.length > 0) {
				for (let attr of add) {
					this.setAttribute(attr, newValue[attr])
				}
			}
		}
	},


	setAttribute (name, value) {
		let {el} = this

		if (name.startsWith('xlink:')) {
			el.setAttributeNS('http://www.w3.org/1999/xlink', name, value)
		}
		else {
			el.setAttribute(name, value)
		}
	},


	removeAttribute (name) {
		let {el} = this

		if (name.startsWith('xlink:')) {
			el.removeAttributeNS('http://www.w3.org/1999/xlink', name)
		}
		else {
			el.removeAttribute(name)
		}
	},


	compare (oldObj = {}, newObj = {}) {
		let add = []
		let remove = []
		let falseValues = [false, undefined, null]

		for (let key in oldObj) {
			let oldValue = oldObj[key]
			let newValue = newObj[key]

			if (!falseValues.includes(oldValue) && falseValues.includes(newValue)) {
				remove.push(key)
			}
		}

		for (let key in newObj) {
			let oldValue = oldObj[key]
			let newValue = newObj[key]

			if (oldValue !== newValue) {
				add.push(key)
			}
		}

		return {
			add,
			remove,
		}
	},


	updateClass (newValue, oldValue) {
		let {el} = this
		let oldObj = this.parseClass(oldValue)
		let newObj = this.parseClass(newValue)
		let {add, remove} = this.compare(oldObj, newObj)

		if (remove.length > 0) {
			dom.removeClass(el, ...remove)
		}

		if (add.length > 0) {
			dom.addClass(el, ...add)
		}
	},


	parseClass (value) {
		let mod0 = this.mods[0]
		let obj = {}

		if (mod0) {
			if (value) {
				obj[mod0] = true
			}
		}
		else if (Array.isArray(value)) {
			for (let item of value) {
				if (typeof item === 'object') {
					for (let key in item) {
						obj[key] = !!item[key]
					}
				}
				else {
					for (let cls of String(item).split(/\s+/)) {
						obj[cls] = true
					}
				}
			}
		}
		else if (util.isObject(value)) {
			for (let key in value) {
				obj[key] = !!value[key]
			}
		}
		else if (typeof value === 'string') {
			if (/\s/.test(value)) {
				for (let cls of value.split(/\s+/)) {
					obj[cls] = true
				}
			}
			else if (value) {
				obj[value] = true
			}
		}

		return obj
	},


	updateStyle (newValue, oldValue) {
		let oldObj = this.parseStyle(oldValue)
		let newObj = this.parseStyle(newValue)
		let {add, remove} = this.compare(oldObj, newObj)
		let willAddPX = this.mods.includes('px')
		let willAddPercentage = this.mods.includes('percent')
		let willAddURL = this.mods.includes('url')

		if (add.length + remove.length > 0) {
			let obj = {}

			for (let key of remove) {
				obj[key] = ''
			}

			for (let key of add) {
				let value = newObj[key]

				if (util.isNullOrUndefined(value)) {
					value = ''
				}
				else if (willAddPX) {
					value = value + 'px'
				}
				else if (willAddPercentage) {
					value = value + '%'
				}
				else if (willAddURL) {
					value = 'url("' + value + '")'
				}

				obj[key] = value
			}

			dom.setCSS(this.el, obj)
		}
	},


	parseStyle (value) {
		let mod0 = this.mods[0]
		let obj = {}

		if (mod0) {
			if (!util.isNullOrUndefined(value)) {
				obj[mod0] = value
			}
		}
		else if (Array.isArray(value)) {
			for (let item of value) {
				if (typeof item === 'object') {
					ff.assign(obj, item)
				}
				else {
					for (let style of String(item).split(/\s*;\s*/)) {
						let [k, v] = style.split(/\s*:\s*/)
						if (k && v) {
							obj[k] = v
						}
					}
				}
			}
		}
		else if (util.isObject(value)) {
			obj = value
		}
		else if (value && !util.isNullOrUndefined(value)) {
			for (let style of String(value).split(/\s*;\s*/)) {
				let [k, v] = style.split(/\s*:\s*/)
				if (k && v) {
					obj[k] = v
				}
			}
		}

		return obj
	},
})
