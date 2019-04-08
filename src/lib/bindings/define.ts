import {Component} from '../component'


interface BindingConstructor {
	new(el: HTMLElement, value: unknown, modifiers: string[] | null, context: Component): Binding
}

export interface Binding {
	update(value: unknown): void
}


const definedMap: Map<string, BindingConstructor> = new Map()

/**
 * Define a bind class on an element to modify attributes or properties.
 * @param name The bind name.
 * @param BindConstructor The class to handle binding and value changing.
 */
export function defineBinding(name: string, Com: BindingConstructor) {
	if (definedMap.has(name)) {
		console.warn(`You are trying to overwrite binding definition "${name}"`)
	}

	definedMap.set(name, Com)
}

export function getDefinedBinding(name: string): BindingConstructor | undefined {
	return definedMap.get(name)
}