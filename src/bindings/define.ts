import {Context} from '../component'


interface BindingConstructor<Args extends any[]> {
	new(el: Element, context: Context, modifiers?: string[]): Binding<Args>
}

export interface Binding<Args extends any[]> {
	update(...args: Args): void
	remove(): void
}


const definedMap: Map<string, BindingConstructor<any[]>> = new Map()

/**
 * Returns a define decorator to defined followed class as class as a component with specified name.
 * @param name The binding name.
 */
export function defineBinding<Args extends any[]>(name: string): (Binding: BindingConstructor<Args>) => void

/**
 * Define a binding class which used on an element to modify attributes or properties.
 * Returns a function call which will generate a `BingingResult`.
 * @param name The binding name.
 * @param BindConstructor The class to handle binding and value changing.
 */
export function defineBinding<Args extends any[]>(name: string, Binding: BindingConstructor<Args>): () => BindingResult<Args>

export function defineBinding<Args extends any[]>(name: string, Binding?: BindingConstructor<Args>) {
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
		return (Binding: BindingConstructor<Args>) => {
			return defineBinding(name, Binding)
		}
	}
}

export function getDefinedBinding<Args extends any[]>(name: string): BindingConstructor<Args> | undefined {
	return definedMap.get(name)
}


/** Returned from like `show(...)`, `hide(...)`, to cache arguments and which will be used to update a binding instance later. */
export class BindingResult<Args extends any[] = any[]> {

	name: string
	args: Args

	constructor(name: string, ...args: Args) {
		this.name = name
		this.args = args
	}
}