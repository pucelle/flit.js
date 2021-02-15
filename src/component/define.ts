import type {Component} from './component'
import {defineCustomElement} from './custom-element'
import {ComponentStyle, ensureComponentStyle} from './style'


/** Constructor of component. */
export interface ComponentConstructor {
	style: ComponentStyle | null
	new(...args: any[]): Component
}


/**
 * Returns a decorator to defined followed class as a component.
 * @param name The component name.
 */
export function define(name: string): (Com: ComponentConstructor) => void

/**
 * Defines a component with specified name.
 * Defines a custom element, but just used to start the defined component
 * @param name The component name.
 * @param Com The Component class constructor.
 */
export function define(name: string, Com: ComponentConstructor): void

export function define(name: string, Com?: ComponentConstructor) {
	if (!name.includes('-')) {
		throw new Error(`"${name}" can't be defined as custom element, a custom element name must contain "-"!`)
	}

	// Used for `@define(name)` decorator.
	if (!Com) {
		return function(Com: ComponentConstructor) {
			define(name, Com)
		}
	}

	// `define(name, Com)`
	else {
		defineComponentConstructor(name, Com)
		defineCustomElement(name)

		return undefined
	}
}


/** To cache `name -> component constructor` */
const ComponentConstructorMap: Map<string, ComponentConstructor> = new Map()


/**
 * Defines a component with specified name and class, from `define(name, Com)`.
 * @param name The component name, same with `define()`.
 * @param Com The component class constructor.
 */
function defineComponentConstructor(name: string, Com: ComponentConstructor) {
	if (ComponentConstructorMap.has(name)) {
		console.warn(`You are trying to overwrite component definition "${name}"!`)
	}

	ComponentConstructorMap.set(name, Com)
}


/**
 * Get component constructor from name, used to instantiate specified component from it's defined name.
 * @param name The component name, same with the name in `define(name, ...)`.
 */
function getComponentConstructor(name: string): ComponentConstructor | undefined {
	return ComponentConstructorMap.get(name)
}


/** Create a component manually, when we exactly know this is a custom element. */
export function createComponent(el: HTMLElement): Component {
	let Com: ComponentConstructor = getComponentConstructor(el.localName)!
	ensureComponentStyle(Com, el.localName)
	
	let com = new Com(el)
	com.__emitCreated()

	return com
}
