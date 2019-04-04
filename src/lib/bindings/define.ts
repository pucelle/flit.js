import {Component} from '../component'


interface BindingConstructor {
	new(el: HTMLElement, value: unknown, modifiers: string[] | null, context: Component): Binding
}

export interface Binding {
	update(value: unknown): void
}


const defineMap: Map<string, BindingConstructor> = new Map()

/**
 * Define a bind class on an element to modify attributes or properties.
 * @param name The bind name.
 * @param BindConstructor The class to handle binding and value changing.
 */
export function defineBinding(name: string, Com: BindingConstructor) {
	defineMap.set(name, Com)
}

export function getDefinedBinding(name: string): BindingConstructor | undefined {
	return defineMap.get(name)
}