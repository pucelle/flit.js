type EventTarget = Node | Window

type EventHandler = (e: Event) => void

interface EventListener {
	name: string
	handler: EventHandler
	wrappedHandler: EventHandler
	scope: object | undefined
	capture: boolean
}


const GLOBAL_EVENT_MODIFIERS = ['capture', 'self', 'once', 'prevent', 'stop', 'passive']
const CONTROL_KEYS = ['ctrl', 'shift', 'alt']
const CHANGE_FILTERS = ['check', 'uncheck']
const WHEEL_FILTERS = ['up', 'down']

const BUTTON_NAME_INDEX = {
	left: 0,
	middle: 1,
	right: 2,
	main: 0,
	auxiliary: 1,
	secondary: 2
}

const EVENT_FILTER_FN = {
	keydown: keyEventFilter,
	keyup: keyEventFilter,
	keypress: keyEventFilter,
	mousedown: mouseEventFilter,
	mousemove: mouseEventFilter,
	mouseup: mouseEventFilter,
	click: mouseEventFilter,
	change: changeEventFilter,
	wheel: wheelEventFilter
}


// Full key list: https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values
// Capture key at: https://keycode.info/
function keyEventFilter(e: KeyboardEvent, filters: string[]): boolean {
	let keyOrCodeFilters: string[] = []

	for (let filter of filters) {
		if (CONTROL_KEYS.includes(filter)) {
			if (!isControlKeyMatchFilters(e, filter)) {
				return false
			}
			continue
		}
		
		keyOrCodeFilters.push(filter)
	}

	return keyOrCodeFilters.length === 0
		|| keyOrCodeFilters.includes(e.key.toLowerCase())
}

function mouseEventFilter(e: MouseEvent, filters: string[]): boolean {
	let buttonFilters: string[] = []

	for (let filter of filters) {
		if (CONTROL_KEYS.includes(filter)) {
			if (!isControlKeyMatchFilters(e, filter)) {
				return false
			}
			continue
		}
		
		buttonFilters.push(filter)
	}

	if (buttonFilters.length === 0) {
		return true
	}

	if (buttonFilters.find(f => BUTTON_NAME_INDEX[f as keyof typeof BUTTON_NAME_INDEX] === e.button)) {
		return true
	}

	return false
}

function isControlKeyMatchFilters(e: KeyboardEvent | MouseEvent, filter: string) {
	switch (filter) {
		case 'ctrl':
			if (!e.ctrlKey) {
				return false
			}
			break
		
		case 'shift':
			if (!e.shiftKey) {
				return false
			}
			break

		case 'alt':
			if (!e.altKey) {
				return false
			}
			break
	}

	return true
}

function changeEventFilter(e: Event, [filter]: string[]) {
	let checked = (e.target as HTMLInputElement).checked

	return checked && filter === 'check'
		|| checked && filter === 'uncheck'
}

function wheelEventFilter(e: WheelEvent, [filter]: string[]) {
	return (e.deltaY < 0) && filter === 'up'
		|| (e.deltaY > 0) && filter === 'down'
}

function validateModifiers(rawName: string, name: string, modifiers: string[]): boolean {
	modifiers = modifiers.filter(m => !GLOBAL_EVENT_MODIFIERS.includes(m))
	if (modifiers.length === 0) {
		return true
	}

	if (name === 'change') {
		if (modifiers.length > 1 || !CHANGE_FILTERS.includes(modifiers[0])) {
			throw new Error(`"${rawName}" is valid, check filter for change event must be one of "${CHANGE_FILTERS.join(',')}"`)
		}
	}
	else if (name === 'wheel') {
		if (modifiers.length > 1 || !WHEEL_FILTERS.includes(modifiers[0])) {
			throw new Error(`"${rawName}" is valid, direction filter for wheel event must be one of "${WHEEL_FILTERS.join(',')}"`)
		}
	}
	else if (name === 'keydown' || name === 'keyup' || name === 'keypress') {
		modifiers = modifiers.filter(m => !CONTROL_KEYS.includes(m))
		if (modifiers.length > 1) {
			throw new Error(`"${rawName}" is valid, only one key name can be specified as key`)
		}
	}
	else if (name === 'mousedown' || name === 'mousemove' || name === 'mouseup' || name === 'click') {
		modifiers = modifiers.filter(m => !CONTROL_KEYS.includes(m))
		if (modifiers.length > 1 || !BUTTON_NAME_INDEX.hasOwnProperty(modifiers[0])) {
			throw new Error(`"${rawName}" is valid, button filter for mouse event must be one of "${Object.keys(BUTTON_NAME_INDEX).join(',')}"`)
		}
	}

	return true
}

const ElementEventMap: WeakMap<EventTarget, {[key: string]: EventListener[]}> = new WeakMap()


/**
 * Register an event handler on element.
 * @param el The element to register listener on.
 * @param name The event name, it can be `click:left` or `keydown:enter`.
 * @param handler The event handler.
 * @param scope The event context used to call handler. You can remove it easily by specify the same scope.
 */
export function on(el: EventTarget, name: string, handler:　EventHandler, scope?: object) {
	bindEvent(false, el, name, handler, scope)
}


/**
 * Register an event handler on element, it will be triggered only for once.
 * @param el The element to register listener on.
 * @param name The event name, it can be `click:left` or `keydown:enter`.
 * @param handler The event handler.
 * @param scope The event context used to call handler. You can remove it easily by specify the same scope.
 */
export function once(el: EventTarget, name: string, handler:　EventHandler, scope?: object) {
	bindEvent(true, el, name, handler, scope)
}


function bindEvent(once: boolean, el: EventTarget, rawName: string, handler:　EventHandler, scope?: object) {
	let name = rawName
	let modifiers: string[] | null = null

	if (rawName.includes('.')) {
		[name, ...modifiers] = rawName.split('.')
		validateModifiers(rawName, name, modifiers)
	}

	let wrappedHandler = wrapHandler(once, modifiers, el, name, handler, scope)
	let capture = !!modifiers && modifiers.includes('capture')
	let passive = !!modifiers && modifiers.includes('passive')
	let options = passive ? {capture, passive} : capture

	let eventMap = ElementEventMap.get(el)
	if (!eventMap) {
		eventMap = {}
		ElementEventMap.set(el, eventMap)
	}
	let events = eventMap[name] || (eventMap[name] = [])

	events.push({
		name: rawName,
		handler,
		wrappedHandler,
		scope,
		capture
	})

	el.addEventListener(name, wrappedHandler, options)
}


/**
 * Unregister an event handler on element.
 * @param el The element to unregister listener on.
 * @param name The event name with or without modifiers.
 * @param handler The event handler.
 * @param scope The event context used to call handler. If specified, it must be match too.
 */
export function off(el: EventTarget, name: string, handler: EventHandler, scope?: object) {
	let eventMap = ElementEventMap.get(el)
	if (!eventMap) {
		return
	}

	name = name.replace(/\..+/, '')

	let events = eventMap[name]
	if (!events) {
		return
	}
	

	for (let i = events.length - 1; i >= 0; i--) {
		let event = events[i]
		
		let isHandlerMatch = !handler
			|| event.handler === handler
			|| event.handler.hasOwnProperty('__original') && (event.handler as any).__original === handler

		if (isHandlerMatch && (!scope || event.scope === scope)) {
			el.removeEventListener(name, event.wrappedHandler, event.capture)
			events.splice(i, 1)
		}
	}
}


function wrapHandler(once: boolean, modifiers: string[] | null, el: EventTarget, name: string, handler: EventHandler, scope?: object): EventHandler {
	let filterModifiers = modifiers ? modifiers.filter(m => !GLOBAL_EVENT_MODIFIERS.includes(m)) : null

	return function wrappedHandler(e: Event) {
		if (filterModifiers && filterModifiers.length > 0) {
			let filterFn = EVENT_FILTER_FN[name as keyof typeof EVENT_FILTER_FN]
			if (!filterFn(e as any, filterModifiers)) {
				return
			}
		}

		if (modifiers && modifiers.includes('self') && e.target !== el) {
			return
		}

		if (modifiers && modifiers.includes('prevent')) {
			e.preventDefault()
		}

		if (modifiers && modifiers.includes('stop')) {
			e.stopPropagation()
		}

		if (once || modifiers && modifiers.includes('once')) {
			off(el, name, handler, scope)
		}

		if (scope) {
			handler.call(scope, e)
		}
		else {
			handler(e)
		}
	}
}



