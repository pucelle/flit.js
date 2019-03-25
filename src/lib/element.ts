import {ComponentConstructor, defineComponent, getComponentAtElement} from './component'


/**
 * Defines a component with specified name.
 * Defines a custom element, but just used to start the defined component
 * @param name The component name.
 * @param Component The Component class definition.
 */
export function define(name: string, Com: ComponentConstructor) {
	if (!name.includes('-')) {
		throw new Error(`"${name}" can't be defined as custom element, it must contain "-"`)
	}

	customElements.define(name, class CustomLitElement extends HTMLElement {
		connectedCallback() {
			let com = getComponentAtElement(this)
			if (!com) {
				com = new Com(this)
				com.__emitFirstConnected()
			}
			com.__emitConnected()
		}

		disconnectedCallback() {
			let com = getComponentAtElement(this)
			if (com) {
				com.__emitDisconnected()
			}
		}
	})

	defineComponent(name, Com)
}
