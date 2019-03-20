
// //supports mods: .prevent, .stop, .capture, .self, .once, .native
// FF.registerDirective('on', {

// 	//priority must behind component

// 	isListener: true,

// 	mods: [],

// 	NOT_FILTER_MODS: ['native', 'capture', 'self', 'once', 'prevent', 'stop'],


// 	onCompile () {
// 		let filters = []
// 		let {mods, NOT_FILTER_MODS} = this

// 		for (let i = 0; i < mods.length; i++) {
// 			let mod = mods[i]

// 			if (!NOT_FILTER_MODS.includes(mod)) {
// 				mods.splice(i--, 1)
// 				filters.push(mod)
// 			}
// 		}

// 		this.filters = filters.length ? '.' + filters.join('.') : ''
// 	},


// 	update (newHandler, oldHandler) {
// 		let {el, vm, prop, mods} = this
// 		let com = el[vmSymbol]
// 		let isComEvent = com && com !== vm && !mods.includes('native')

// 		if (isComEvent) {
// 			if (oldHandler) {
// 				com.off(prop, oldHandler, vm)
// 			}

// 			if (newHandler) {
// 				com.on(prop, newHandler, vm)
// 			}
// 		}
// 		else {
// 			let eventName = prop + this.filters
// 			let capture = mods.includes('capture')
// 			let passive = mods.includes('passive')
// 			let eventOptions = {capture, passive}

// 			if (oldHandler) {
// 				dom.off(el, eventName, oldHandler, eventOptions)
// 			}

// 			if (newHandler) {
// 				newHandler = this.wrapHandler(el, newHandler)
// 				dom.on(el, eventName, newHandler, eventOptions)
// 			}
// 		}

// 		this.handler = newHandler
// 	},


// 	wrapHandler (el, handler) {
// 		let {prop, mods, vm} = this

// 		let wrappedHandler = (e) => {
// 			if (mods.includes('self') && e.target !== el) {
// 				return
// 			}

// 			if (mods.includes('once')) {
// 				dom.off(el, prop, wrappedHandler, mods.includes('capture'))
// 			}

// 			if (mods.includes('prevent')) {
// 				e.preventDefault()
// 			}

// 			if (mods.includes('stop')) {
// 				e.stopPropagation()
// 			}

// 			handler.call(vm, e)
// 		}

// 		return wrappedHandler
// 	},
// })



// type KeyFilter = 'ctrl' | 'shift' | 'alt'


// interface EventListener {
// 	name: string
// 	filters: string[]
// 	handler: () => void
// 	wrappedHandler: () => void
// 	scope: object
// 	capture: boolean
// }

// const eventMap: Map<HTMLElement, EventListener[]> = new Map()


// function keyEventFilter(e, fs) {
// 	let commandKeys = ['ctrl', 'shift', 'alt']
// 	let normalFilters = []

// 	for (let f of fs) {
// 		if (commandKeys.includes(f)) {
// 			if (!e[f + 'Key']) {
// 				return false
// 			}
// 		}
// 		else {
// 			normalFilters.push(f)
// 		}
// 	}

// 	return normalFilters.length === 0 || normalFilters.includes(e.key.toLowerCase()) || normalFilters.includes(String(e.keyCode))
// }

// function mouseEventFilter(e, fs) {
// 	let commandKeys = ['ctrl', 'shift', 'alt']
// 	let normalFilters = []

// 	for (let f of fs) {
// 		if (commandKeys.includes(f)) {
// 			if (!e[f + 'Key']) {
// 				return false
// 			}
// 		}
// 		else {
// 			normalFilters.push(f)
// 		}
// 	}

// 	return normalFilters.length === 0 || normalFilters.find(f => dom.BUTTON_INDEX[f] === e.button) >= 0
// }

// //handle events
// ff.assign(dom, {

// 	EVENT_PREFIX_MAP: {

// 		transitionend: hasWebkitTransition ? 'webkittransitionend': 'transitionend',

// 		animationend: hasWebkitAnimation ? 'webkitanimationend': 'animationend',

// 		animationiteration: hasWebkitAnimation ? 'webkitanimationiteration': 'animationiteration',

// 		fullscreenchange: hasWebkitFullscreen ? 'webkitfullscreenchange': 'fullscreenchange',

// 		fullscreenerror: hasWebkitFullscreen ? 'webkitfullscreenerror': 'fullscreenerror',
// 	},


// 	EVENT_FILTER_FN: {

// 		change (e, [f]) {
// 			return e.target.checked && f === 'check'
// 				|| !e.target.checked && f === 'uncheck'
// 		},

// 		wheel (e, [f]) {
// 			return (e.deltaY < 0) && f === 'up'
// 				|| (e.deltaY > 0) && f === 'down'
// 		},

// 		//See key list at: https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values
// 		keydown: keyEventFilter,

// 		keyup: keyEventFilter,

// 		keypress: keyEventFilter,

// 		mousedown: mouseEventFilter,

// 		mousemove: mouseEventFilter,

// 		mouseup: mouseEventFilter,
// 	},


// 	BUTTON_INDEX: {
// 		left: 0,
// 		middle: 1,
// 		right: 2,
// 	},


// 	on (el, name, handler, scope, options) {
// 		dom._bindEvent(false, el, name, handler, scope, options)
// 	},


// 	once (el, name, handler, scope, options) {
// 		dom._bindEvent(true, el, name, handler, scope, options)
// 	},


// 	_bindEvent (isOnce, el, name, originalHandler, scope, options = false) {
// 		if (typeof scope === 'boolean') {
// 			options = scope
// 			scope = null
// 		}

// 		let handler = originalHandler
// 		let filters
// 		let capture = typeof options === 'object' ? options.capture : options

// 		if (name.includes('.')) {
// 			[name, ...filters] = name.split('.')
// 		}

// 		let localName = dom.EVENT_PREFIX_MAP[name] || name

// 		if (scope) {
// 			handler = originalHandler.bind(scope)
// 		}

// 		if (isOnce) {
// 			handler = dom._wrapOnce(el, name, handler, originalHandler, scope, options)
// 		}

// 		if (filters && dom.EVENT_FILTER_FN[name]) {
// 			handler = dom._wrapFilter(el, name, filters, handler)
// 		}

// 		let map = el[eventsSymbol] || (el[eventsSymbol] = {})
// 		let events = map[name] || (map[name] = [])

// 		events.push({
// 			name,
// 			filters,
// 			originalHandler,
// 			handler,
// 			scope,
// 			capture,
// 		})

// 		el.addEventListener(localName, handler, options)
// 	},


// 	_wrapOnce (el, name, handler, originalHandler, scope, capture) {
// 		return function (e) {
// 			dom.off(el, name, originalHandler, scope, capture)
// 			handler(e)
// 		}
// 	},


// 	_wrapFilter (el, name, filters, handler) {
// 		let filterFn = dom.EVENT_FILTER_FN[name]

// 		return function (e) {
// 			if (filterFn(e, filters)) {
// 				handler(e)
// 			}
// 		}
// 	},


// 	//if scope is not exist, unbind all the handler matched, no matter what the scope is
// 	//if no handler, unbind all events name matched
// 	off (el, name, handler, scope, capture = false) {
// 		if (typeof scope === 'boolean') {
// 			options = scope
// 			scope = null
// 		}

// 		let localName = dom.EVENT_PREFIX_MAP[name] || name
// 		let events

// 		if (!el[eventsSymbol] || !(events = el[eventsSymbol][name])) {
// 			return
// 		}

// 		for (let i = events.length - 1; i >= 0; i--) {
// 			let event = events[i]

// 			if ((!handler || event.originalHandler === handler || event.originalHandler.original === handler)
// 				&& (!scope || event.scope === scope)
// 				&& event.capture === capture)
// 			{
// 				el.removeEventListener(localName, event.handler, capture)
// 				events.splice(i, 1)
// 			}
// 		}
// 	},


// 	hasListener (el, name, handler, scope, capture = false) {
// 		let events

// 		if (!el[eventsSymbol] || !(events = el[eventsSymbol][name])) {
// 			return
// 		}

// 		for (let i = events.length - 1; i >= 0; i--) {
// 			let event = events[i]

// 			if ((!handler || event.handler === handler)
// 				&& (!scope || event.scope === scope)
// 				&& event.capture === capture)
// 			{
// 				return true
// 			}
// 		}

// 		return false
// 	},


// 	emit (el, name, init = {}) {
// 		let filters

// 		if (name.includes('.')) {
// 			let [name, ...filters] = name.split('.')
// 		}

// 		let localName = dom.EVENT_PREFIX_MAP[name] || name
// 		let event = new CustomEvent(localName, init)

// 		if (localName === 'wheel' && filters.includes('up')) {
// 			event.deltaY = -120
// 		}
// 		else if (localName === 'wheel' && filters.includes('down')) {
// 			event.deltaY = 120
// 		}

// 		el.dispatchEvent(event)
// 	},
// })