import {Context} from '../component'


export interface BindingConstructor<A extends any[]> {
	new(el: Element, context: Context, modifiers?: string[]): Binding<A>
}

export interface Binding<A extends any[]> {
	update(...args: A): void
	remove(): void
}


const definedMap: Map<string, BindingConstructor<any[]>> = new Map()

/**
 * Returns a define decorator to defined followed class as class as a component with specified name.
 * @param name The binding name.
 */
export function defineBinding<A extends any[]>(name: string): (Binding: BindingConstructor<A>) => void

/**
 * Define a binding class which used on an element to modify attributes or properties.
 * Returns a function call which will generate a `BingingResult`.
 * @param name The binding name.
 * @param BindConstructor The class to handle binding and value changing.
 */
export function defineBinding<A extends any[]>(name: string, Binding: BindingConstructor<A>): () => BindingResult<A>

export function defineBinding<A extends any[]>(name: string, Binding?: BindingConstructor<A>) {
	if (definedMap.has(name)) {
		console.warn(`You are trying to overwrite binding definition "${name}"`)
	}

	if (Binding) {
		definedMap.set(name, Binding)

		return function(...args: any[]) {
			return new BindingResult(name, ...args)
		}
	}
	else {
		return (Binding: BindingConstructor<A>) => {
			return defineBinding(name, Binding)
		}
	}
}

/** @hidden */
export function getDefinedBinding<A extends any[]>(name: string): BindingConstructor<A> | undefined {
	return definedMap.get(name)
}


/** 
 * Returned from calling defined bindings like `show(...)`, `hide(...)`.
 * Used to cache arguments and update template later.
 * @typeparam A Arguments type.
 */
export class BindingResult<A extends any[] = any[]> {

	name: string
	args: A

	constructor(name: string, ...args: A) {
		this.name = name
		this.args = args
	}
}