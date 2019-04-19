import {Context} from '../component'


interface BindingConstructor {
	new(el: Element, value: unknown, modifiers: string[] | null, context: Context): Binding
}

export interface Binding {
	update(value: unknown): void
}


const definedMap: Map<string, BindingConstructor> = new Map()

/**
 * Returns a define decorator to defined followed class as class as a component with specified name.
 * @param name The binding name.
 */
export function defineBinding(name: string): (Com: BindingConstructor) => void

/**
 * Define a bind class on an element to modify attributes or properties.
 * @param name The binding name.
 * @param BindConstructor The class to handle binding and value changing.
 */
export function defineBinding(name: string, Com: BindingConstructor): undefined

export function defineBinding(name: string, Com?: BindingConstructor) {
	if (definedMap.has(name)) {
		console.warn(`You are trying to overwrite binding definition "${name}"`)
	}

	if (Com) {
		definedMap.set(name, Com)
		return undefined
	}
	else {
		return (Com: BindingConstructor) => {
			defineBinding(name, Com)
		}
	}
}

export function getDefinedBinding(name: string): BindingConstructor | undefined {
	return definedMap.get(name)
}