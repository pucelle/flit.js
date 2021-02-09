import type {Context} from '../component'


/** Constructor of all Binding class. */
interface BindingConstructor {
	new (el: Element, context: Context, modifiers?: string[]): Binding
}

/** Binding interface, all binding class should implement it. */
export interface Binding<V = any> {

	/** Update binding value to element. */
	update(value: V, ...args: any[]): void

	/** Remove current binding and clear properties from element. */
	remove(): void
}


/** Cache all binding classes. */
const DefinedBindingMap: Map<string, BindingConstructor> = new Map()

/**
 * Returns a define decorator to defined followed class as a binding class with specified name.
 * @param name The binding name.
 */
export function defineBinding(name: string): (Binding: BindingConstructor) => void

/**
 * Define a binding class which with bind with an element and modify it's attributes or properties.
 * Returns a function call which will generate a `BingingResult`.
 * @param name The binding name.
 * @param BindingConstructor The class to handle binding and value updating.
 */
export function defineBinding<A extends any[]>(name: string, Binding: BindingConstructor): () => BindingResult<A>

export function defineBinding(name: string, Binding?: BindingConstructor) {
	if (DefinedBindingMap.has(name)) {
		console.warn(`You are trying to overwrite binding definition "${name}"`)
	}

	if (Binding) {
		DefinedBindingMap.set(name, Binding)

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


/** 
 * Returned from calling defined bindings like `show(...)`, `hide(...)`.
 * Used to cache parameters and update template later.
 * @typeparam A parameters type.
 */
export class BindingResult<A extends any[] = any[]> {

	readonly name: string
	readonly args: A
	ref: ((binding: Binding) => void) | null = null

	constructor(name: string, ...args: A) {
		this.name = name
		this.args = args
	}
}


/** Create binding and add ref on element. */
export function createBindingFromResult(el: Element, context: Context, result: BindingResult, modifiers?: string[]): Binding {
	let BindingConstructor = DefinedBindingMap.get(result.name)
	if (!BindingConstructor) {
		throw new Error(`":${result.name}" on "<${el.localName}>" is not a registered binding class!`)
	}

	let binding = new BindingConstructor(el, context, modifiers)

	if (result.ref) {
		result.ref(binding)
	}

	binding.update(...result.args as [any])

	return binding
}


/** Reference binding instance after it created and before updating. */
export function refBinding(result: BindingResult, ref: (binding: Binding) => void) {
	result.ref = ref
	return result
}