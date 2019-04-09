import {ComponentConstructor, defineComponent, getComponentAtElement, Component} from './component'
import {ensureComponentStyle, mayRemoveStyle} from './style'


/**
 * Defines a component with specified name.
 * Defines a custom element, but just used to start the defined component
 * @param name The component name.
 * @param Component The Component class definition.
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

		// A potential problem here:
		// When `connectedCallback` been called, the child nodes of it is not linked yet.
		connectedCallback() {
			let com = getComponentAtElement(this)
			if (!com) {
				com = new Com(this)
				if (Com.properties) {
					assignProperties(com, Com.properties)
				}
				com.__emitFirstConnected()
			}

			com.__emitConnected()
			ensureComponentStyle(Com, name)
		}

		disconnectedCallback() {
			let com = getComponentAtElement(this)
			if (com) {
				com.__emitDisconnected()
			}

			mayRemoveStyle(Com)
		}
	})

	defineComponent(name, Com)
	return undefined
}


// Property values from element properties may be overwrited by `:props`.
function assignProperties(com: Component, properties: string[]) {
	for (let property of properties) {
		if (com.el.hasAttribute(property)) {
			let value = (com as any)[property]
			if (typeof value === "boolean") {
				(com as any)[property] = true
			}
			else if (typeof value === "number") {
				(com as any)[property] = Number(com.el.getAttribute(property))
			}
			else {
				(com as any)[property] = com.el.getAttribute(property)
			}
		}
	}
}