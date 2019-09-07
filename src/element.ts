import {} from './component/component'
import {ComponentConstructor, getComponent, Component, defineComponent} from './component'
import {ensureComponentStyle} from './style'


// Using queue to delay the connect and disconnect operations on components.
// Both `connectedCallback` and `disconnectedCallback` may triggered multiple times in DOM removing,
// so we must delay the component connect and disconnect operation by a queue.

let connectSoonMap: Map<HTMLElement, ComponentConstructor> = new Map()
let disconnectSoonMap: Map<HTMLElement, ComponentConstructor> = new Map()

function enqueueConnect(el: HTMLElement, Com: ComponentConstructor) {
	// When append, trigger disconnect and connect soon.
	if (disconnectSoonMap.has(el)) {
		disconnectSoonMap.delete(el)
	}
	else {
		connectSoonMap.set(el, Com)
		disconnectSoonMap.delete(el)

		if (!willUpdate) {
			enqueueUpdate()
		}
	}
}

function enqueueDisconnect(el: HTMLElement, Com: ComponentConstructor) {
	// When inserted into a fragment and then removed.
	if (connectSoonMap.has(el)) {
		connectSoonMap.delete(el)
	}
	else {
		disconnectSoonMap.set(el, Com)

		if (!willUpdate) {
			enqueueUpdate()
		}
	}
}

let willUpdate = false

function enqueueUpdate() {
	Promise.resolve().then(update)
	willUpdate = true
}

function update() {
	let connectMap = connectSoonMap
	let disconnectMap = disconnectSoonMap

	// Very import, more connect and disconnect map may be added when updating.
	// So we must reset `connectSoonMap` and `disconnectSoonMap` and set `willUpdate` to false before updating.
	connectSoonMap = new Map()
	disconnectSoonMap = new Map()
	willUpdate = false

	for (let [el] of disconnectMap.entries()) {
		disconnectElement(el)
	}

	// `el` was sorted inside map.
	for (let [el, Com] of connectMap.entries()) {
		
		// `el` may not in document,
		// e.g., inserted into a fragment.
		// No need to worry about forgetting to instantiate it,
		// it will trigger `connectedCallback` again after insert into document.
		if (document.contains(el)) {
			connectElement(el, Com)
		}
	}
}

function connectElement(el: HTMLElement, Com: ComponentConstructor) {
	let com = getComponent(el)
	if (!com) {
		com = createComponent(el, Com)
	}
	
	com.__emitConnected()
}

/** Export for `renderComponent`, which will create component manually. */
export function createComponent(el: HTMLElement, Com: ComponentConstructor): Component {
	ensureComponentStyle(Com, el.localName)

	let com = new Com(el)
	if (Com.properties && el.attributes.length > 0) {
		assignProperties(com, Com.properties)
	}
	com.__emitCreated()

	return com
}

function disconnectElement(el: HTMLElement) {
	let com = getComponent(el)
	if (com) {
		com.__emitDisconnected()
	}
}


/**
 * Returns a define decorator to defined followed class as a component with specified name.
 * @param name The component name.
 */
export function define(name: string): (Com: ComponentConstructor) => void


/**
 * Defines a component with specified name.
 * Defines a custom element, but just used to start the defined component
 * @param name The component name.
 * @param Component The Component class definition.
 */
export function define(name: string, Com: ComponentConstructor): void

export function define(name: string, Com?: ComponentConstructor) {
	if (!name.includes('-')) {
		throw new Error(`"${name}" can't be defined as custom element, it must contain "-"`)
	}

	// Used at `@define` decorator.
	if (!Com) {
		return function(Com: ComponentConstructor) {
			define(name, Com)
		}
	}

	customElements.define(name, class CustomLitElement extends HTMLElement {

		// When `connectedCallback` called on elements in start HTML Document, the child nodes of it is not ready yet.
		// So we must render all the codes in js.
		// Note that it will be called when insert element to a fragment.

		// If we insert bundled js behind all other elements, or with `defer`,
		// because elements were prepared already, then they will be instantiated in component registered order, not in element order.
		// We fix this by the `connectSoonMap`, it output elements in order when iterating.
		
		connectedCallback() {
			enqueueConnect(this, Com)
		}

		// Moving element using like `append` will also trigger this.
		disconnectedCallback() {
			enqueueDisconnect(this, Com)
		}
	})

	defineComponent(name, Com)
	return undefined
}


// Property values from element properties may be overwrited by `:props`.
function assignProperties(com: Component, properties: string[]) {
	let el = com.el

	for (let property of properties) {
		if (el.hasAttribute(property)) {
			let camelProperty = property.includes('-') ? property.replace(/-[a-z]/g, (m0: string) => m0[1].toUpperCase()) : property
			let value = (com as any)[property]

			if (typeof value === "boolean") {
				(com as any)[camelProperty] = true
			}
			else if (typeof value === "number") {
				(com as any)[camelProperty] = Number(el.getAttribute(property))
			}
			else {
				(com as any)[camelProperty] = el.getAttribute(property)
			}
		}
	}
}


/**
 * Get closest ancestor component which instanceof `Com`.
 * It's very common that you extend a component and define a new custom element,
 * So you will can't find the parent component from the tag name. 
 */
export function getClosestComponent<C extends ComponentConstructor>(el: Element, Com: C): InstanceType<C> | null {
	let parent: Element | null = el

	while (parent && parent instanceof HTMLElement) {
		if (parent.localName.includes('-')) {
			let com = getComponent(parent) as Component
			if (com instanceof Com) {
				return com as InstanceType<C>
			}
		}
		
		parent = parent.parentElement
	}

	return null
}