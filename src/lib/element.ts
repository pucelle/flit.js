import {ComponentConstructor, Component, defineComponent} from './component'


const elementComponentMap: WeakMap<HTMLElement, Component> = new WeakMap()

/**
 * Defines a component with specified name.
 * It will defined a custom element, but it just used to start this component
 * @param name The component name.
 * @param Component The Component class definition.
 */
export function define(name: string, Com: ComponentConstructor) {
	if (!name.includes('-')) {
		console.warn('Custom element should contains "-"')
	}

	customElements.define(name, class CustomElement extends HTMLElement {
		connectedCallback() {
			let com = elementComponentMap.get(this)
			if (!com) {
				com = new Com(this)
				elementComponentMap.set(this, com)
			}
		}
	})

	defineComponent(name, Com)
}


/**
 * Get component instance from root element.
 * @param el The element.
 */
export function get(el: HTMLElement): Component | undefined {
	return elementComponentMap.get(el)
}

