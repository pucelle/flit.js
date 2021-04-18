import {Context} from '../component'
import {ResultReferences} from '../helpers/references'
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

	/** 
	 * Removes current directive.
	 * Note it only calls when removing the binding directly,
	 * Not calls when itself as a child binding inside a removed template.
	 */
	remove(): void
}



/**
 * Defines a directive from a class which implements `Directive`.
 * Returns a function call which will generate a `DirectiveResult`.
 * 
 * A `Directive` works like Binding, but it used to generate HTML code pieces,
 * not like `Binding` to modify properties of an element.
 * 
 * It's hard to define a custom directive, please read source codes before doing this.
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


/** Class to help handle reference from directive result to it's directive class. */
class DirectiveReferencesClass extends ResultReferences<DirectiveResult, Directive> {

	/** Calls reference callback when binging instance created. */
	createFromResult(anchor: NodeAnchor, context: Context, result: DirectiveResult): Directive {
		let Dir = result.directiveConstructor
		let directive = new Dir(anchor, context)
		this.createReference(result, directive)
		directive.merge(...result.args)

		return directive
	}
}

export const DirectiveReferences = new DirectiveReferencesClass()


/** 
 * Reference to directive instance after it created and before merge.
 *  * Use it like:
 * ```ts
 * >refDirective(repeat(...))<
 * ```
 * 
 * @param result The directive result like `repeat(...)`.
 * @param ref Callback with the directive object as parameter.
 * @param unref Callback after directive instance was removed directly, not calls when was contained in a removed template.
 * @return The `result` parameter.
 */
export function refDirective(result: DirectiveResult, ref: (directive: Directive) => void, unref?: (directive: Directive) => void) {
	DirectiveReferences.addReference(result, ref)

	if (unref) {
		DirectiveReferences.addUnReference(result, unref)
	}

	return result
}