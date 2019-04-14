import {ComponentConstructor, defineComponent, getComponentAtElement, Component} from './component'
import {ensureComponentStyle, mayRemoveStyle} from './style'


// When element moved when using APIs like `append`,
// it will trigger `disconnectedCallback` and then `connectedCallback`.
// So we using a set to cache will disconnected elements and disconnect them if they still exist in.
const disconnectLaterSet: Set<HTMLElement> = new Set()


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
			if (disconnectLaterSet.has(this)) {
				disconnectLaterSet.delete(this)
			}
			else {
				ensureComponentStyle(Com, name)
				
				let com = getComponentAtElement(this)
				if (!com) {
					com = new Com(this)
					if (Com.properties && this.attributes.length > 0) {
						assignProperties(com, Com.properties)
					}
					com.__emitFirstConnected()
				}

				com.__emitConnected()
			}
		}

		// Moving element using like `append` will also trigger this.
		disconnectedCallback() {
			disconnectLaterSet.add(this)

			Promise.resolve().then(() => {
				if (disconnectLaterSet.has(this)) {
					let com = getComponentAtElement(this)
					if (com) {
						com.__emitDisconnected()
					}

					mayRemoveStyle(Com)
					disconnectLaterSet.delete(this)
				}
			})
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