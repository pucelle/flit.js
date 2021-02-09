import {Context} from '../component'
import {NodeAnchor} from "../internals/node-anchor"


/** Directive constructor. */
export interface DirectiveConstructor {
	new(anchor: NodeAnchor, context: Context): Directive
}


/** An interface that must implement when defining directives. */
export interface Directive<A extends any[] = any[]> {

	/** Whenter the directive parameters can merge with current directive. */
	canMergeWith(...args: A): boolean

	/** Merges directive parameters to current directive. */
	merge(...args: A): void

	/** Removes current directive. */
	remove(): void
}



/**
 * Defines a directive from a class which implements `Directive`.
 * Returns a function call which will generate a `DirectiveResult`.
 * 
 * A `Directive` works like Binding, but it used to generate HTML code pieces,
 * not like `Binding` to modify properties of an element.
 */
export function defineDirective(Dir: DirectiveConstructor) {
	return function(...args: any[]) {
		return new DirectiveResult(Dir, ...args)
	}
}


/** 
 * Returned from calling directive functions like `repeat`.
 * Used to cache parameters and update template later.
 */
export class DirectiveResult {

	/** Associated defined class constructor. */
	readonly directiveConstructor: DirectiveConstructor

	/** All parameters pass to directive. */
	readonly args: any[]

	/** Reference function when uses `refDirective(...)`. */
	ref: ((directive: Directive) => void) | null = null

	constructor(Dir: DirectiveConstructor, ...args: any[]) {
		this.directiveConstructor = Dir
		this.args = args
	}
}


/** Create directive instance from directive result. */
export function createDirectiveFromResult(anchor: NodeAnchor, context: Context, result: DirectiveResult): Directive {
	let Dir = result.directiveConstructor
	let directive = new Dir(anchor, context)

	if (result.ref) {
		result.ref(directive)
	}

	directive.merge(...result.args)

	return directive
}


/** Reference to directive instance after it created and before merge. */
export function refDirective(result: DirectiveResult, ref: (directive: Directive) => void) {
	result.ref = ref
	return result
}