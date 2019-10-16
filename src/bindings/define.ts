import {Context} from '../component'


export interface BindingConstructor<A extends any[] = any[]> {
	new(el: Element, context: Context, modifiers?: string[]): Binding<A>
}

export interface Binding<A extends any[] = any[]> {
	update(...args: A): void
	remove(): void
}


const definedMap: Map<string, BindingConstructor> = new Map()

/**
 * Returns a define decorator to defined followed class as a binding class with specified name.
 * @param name The binding name.
 */
export function defineBinding(name: string): (Binding: BindingConstructor) => void

/**
 * Define a binding class which used on an element to modify attributes or properties.
 * Returns a function call which will generate a `BingingResult`.
 * @param name The binding name.
 * @param BindingConstructor The class to handle binding and value changing.
 */
export function defineBinding<A extends any[]>(name: string, Binding: BindingConstructor<A>): () => BindingResult<A>

export function defineBinding(name: string, Binding?: BindingConstructor) {
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
		return (Binding: BindingConstructor) => {
			return defineBinding(name, Binding)
		}
	}
}

function getBindingConstructor(name: string): BindingConstructor {
	return definedMap.get(name)!
}


/** 
 * Returned from calling defined bindings like `show(...)`, `hide(...)`.
 * Used to cache arguments and update template later.
 * @typeparam A Arguments type.
 */
export class BindingResult<A extends any[] = any[]> {

	name: string
	args: A
	ref: ((binding: Binding) => void) | null = null

	constructor(name: string, ...args: A) {
		this.name = name
		this.args = args
	}
}


/** Create binding and add ref on element. */
/** @hidden */
export function createBindingFromResult(el: Element, context: Context, result: BindingResult, modifiers?: string[]): Binding {
	let BindingConstructor = getBindingConstructor(result.name)
	if (!BindingConstructor) {
		throw new Error(`":${result.name}" on "<${el.localName}>" is not a registered binding class`)
	}

	let binding = new BindingConstructor(el, context, modifiers)

	if (result.ref) {
		result.ref(binding)
	}

	binding.update(...result.args)

	return binding
}


/** Reference to binding instance after it created and before update. */
export function refBinding(result: BindingResult, ref: (binding: Binding) => void) {
	result.ref = ref
	return result
}