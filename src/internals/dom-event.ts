import {DoubleKeysWeakMap} from '../helpers/double-key-map'


/** Event handler type. */
type EventHandler = (e: Event) => void

/** Each event listener and parameters after registered. */
interface EventListener {
	name: string
	handler: EventHandler
	wrappedHandler: EventHandler
	scope: object | undefined
	capture: boolean
}


/** Modefiers to limit event triggering or do some actions. */
const GlobalEventModifiers = ['capture', 'self', 'once', 'prevent', 'stop', 'passive']
const ControlKeyModefiers = ['ctrl', 'shift', 'alt']
const ChangeEventModifiers = ['check', 'uncheck']
const WheelEventModifiers = ['up', 'down']

const ButtonNameModifiers = {
	left: 0,
	middle: 1,
	right: 2,
	main: 0,
	auxiliary: 1,
	secondary: 2
}

/** Event filters to limit event triggering. */
const EventFilters = {
	keydown: keyEventFilter,
	keyup: keyEventFilter,
	keypress: keyEventFilter,
	mousedown: mouseEventFilter,
	mousemove: mouseEventFilter,
	mouseup: mouseEventFilter,
	click: mouseEventFilter,
	dblclick: mouseEventFilter,
	change: changeEventFilter,
	wheel: wheelEventFilter,
}

/** To cache all event listeners for element. */
const ElementEventListenerCache: DoubleKeysWeakMap<EventTarget, string, EventListener[]> = new DoubleKeysWeakMap()


/** Limit key event triggering. */
function keyEventFilter(e: KeyboardEvent, modifiers: string[]): boolean {
	// Full key list: https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values
	// Capture key at: https://keycode.info/

	let codeModifiers: string[] = []

	// Control keys must match.
	for (let modifier of modifiers) {
		if (ControlKeyModefiers.includes(modifier)) {
			if (!isControlKeyMatchModifier(e, modifier)) {
				return false
			}
			continue
		}
		
		codeModifiers.push(modifier)
	}

	return codeModifiers.length === 0
		|| codeModifiers.includes(e.code.toLowerCase())
		|| codeModifiers.includes(e.key.toLowerCase())
}

/** Limit mouse event triggering. */
function mouseEventFilter(e: MouseEvent, modifiers: string[]): boolean {
	let buttonModifiers: string[] = []

	// Control keys must match.
	for (let modifier of modifiers) {
		if (ControlKeyModefiers.includes(modifier)) {
			if (!isControlKeyMatchModifier(e, modifier)) {
				return false
			}
			continue
		}
		
		buttonModifiers.push(modifier)
	}

	if (buttonModifiers.length === 0) {
		return true
	}

	if (buttonModifiers.find(f => ButtonNameModifiers[f as keyof typeof ButtonNameModifiers] === e.button)) {
		return true
	}

	return false
}

/** Limit key event triggering from control keys. */
function isControlKeyMatchModifier(e: KeyboardEvent | MouseEvent, modifier: string) {
	if (modifier === 'ctrl' && (!e.ctrlKey && !e.metaKey)
		|| modifier === 'shift' && !e.shiftKey
		|| modifier === 'alt' && !e.altKey
	) {
		return false
	}

	return true
}

/** Limit change event triggering. */
function changeEventFilter(e: Event, [modifier]: string[]) {
	let checked = (e.target as HTMLInputElement).checked

	return checked && modifier === 'check'
		|| checked && modifier === 'uncheck'
}

/** Limit wheel event triggering. */
function wheelEventFilter(e: WheelEvent, [modifier]: string[]) {
	return (e.deltaY < 0) && modifier === 'up'
		|| (e.deltaY > 0) && modifier === 'down'
}


/** Valdiate event modifiers. */
function validateModifiers(propertyName: string, name: string, modifiers: string[]): boolean {
	// Exclude global modifiers.
	modifiers = modifiers.filter(m => !GlobalEventModifiers.includes(m))

	if (modifiers.length === 0) {
		return true
	}

	if (name === 'change') {
		if (modifiers.length > 1 || !ChangeEventModifiers.includes(modifiers[0])) {
			throw new Error(`"${propertyName}" is valid, change event modifier must be only one of "${ChangeEventModifiers.join(',')}"!`)
		}
	}
	else if (name === 'wheel') {
		if (modifiers.length > 1 || !WheelEventModifiers.includes(modifiers[0])) {
			throw new Error(`"${propertyName}" is valid, wheel event modifier must be only one of "${WheelEventModifiers.join(',')}"!`)
		}
	}
	else if (name === 'mousedown' || name === 'mousemove' || name === 'mouseup' || name === 'click') {
		modifiers = modifiers.filter(m => !ControlKeyModefiers.includes(m))

		if (!ButtonNameModifiers.hasOwnProperty(modifiers[0])) {
			throw new Error(`"${propertyName}" is valid, button filter for mouse event must be one of "${Object.keys(ButtonNameModifiers).join(',')}"!`)
		}
	}

	return true
}


/**
 * Register an event listener on element.
 * @param el The element to register listener on.
 * @param name The event name, it can be `click:left` or `keydown:enter`.
 * @param handler The event handler.
 * @param scope The event context used to call handler. You can remove it easily by specify the same scope.
 */
export function on(el: EventTarget, name: string, handler: EventHandler, scope?: object) {
	bindEvent(false, el, name, handler, scope)
}


/**
 * Register an event listener on element, and will be triggered only for once.
 * @param el The element to register listener on.
 * @param name The event name, it can be `click:left` or `keydown:enter`.
 * @param handler The event handler.
 * @param scope The event context used to call handler. You can remove it easily by specify the same scope.
 */
export function once(el: EventTarget, name: string, handler: EventHandler, scope?: object) {
	bindEvent(true, el, name, handler, scope)
}


function bindEvent(once: boolean, el: EventTarget, rawName: string, handler: EventHandler, scope: object | undefined) {
	let name = rawName
	let modifiers: string[] | null = null

	if (rawName.includes('.')) {
		[name, ...modifiers] = rawName.split('.')
		validateModifiers(rawName, name, modifiers)
	}

	let wrappedHandler = wrapHandler(once, modifiers, el, name, handler, scope)
	let capture = !!modifiers && modifiers.includes('capture')
	let passive = !!modifiers && modifiers.includes('passive')

	// Wheel event use passive mode by default and can't be prevented.
	let options = passive || name === 'wheel' ? {capture, passive} : capture

	let events = ElementEventListenerCache.get(el, name)
	if (!events) {
		events = []
		ElementEventListenerCache.set(el, name, events)
	}

	events.push({
		name: rawName,
		handler,
		wrappedHandler,
		scope,
		capture
	})

	el.addEventListener(name, wrappedHandler, options)
}


/** Wrap handler according to global modifiers. */
function wrapHandler(once: boolean, modifiers: string[] | null, el: EventTarget, name: string, handler: EventHandler, scope?: object): EventHandler {
	let filterModifiers = modifiers?.filter(m => !GlobalEventModifiers.includes(m))

	return function wrappedHandler(e: Event) {
		if (filterModifiers && filterModifiers.length > 0) {
			let filterFn = EventFilters[name as keyof typeof EventFilters]
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


/**
 * Unregister an event listener on element.
 * @param el The element to unregister listener on.
 * @param name The event name with or without modifiers.
 * @param handler The event handler.
 * @param scope The event context used to call handler. If specified, it must be match too.
 */
export function off(el: EventTarget, name: string, handler: EventHandler, scope?: object) {
	name = name.replace(/\..+/, '')

	let events = ElementEventListenerCache.get(el, name)
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

