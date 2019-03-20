import {ComponentConstructor, defineComponent, get} from './component'


/**
 * Defines a component with specified name.
 * Defines a custom element, but just used to start the defined component
 * @param name The component name.
 * @param Component The Component class definition.
 */
export function define(name: string, Com: ComponentConstructor) {
	if (!name.includes('-')) {
		console.warn('Custom element should contains "-"')
	}

	customElements.define(name, class CustomElement extends HTMLElement {
		connectedCallback() {
			let com = get(this)
			if (!com) {
				com = new Com(this)
			}
		}
	})

	defineComponent(name, Com)
}
