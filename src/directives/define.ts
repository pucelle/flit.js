import {Context} from '../component'
import {NodeAnchor} from '../libs/node-helper'


export interface DirectiveConstructor<A extends any[]> {
	new(anchor: NodeAnchor, context: Context): Directive<A>
}

export interface Directive<A extends any[] = any[]> {
	canMergeWith(...args: A): boolean
	merge(...args: A): void
	remove(): void
}


let seed = 0
const directiveMap: Map<number, DirectiveConstructor<any>> = new Map()


/** 
 * Defines a directive from a class which implements `Directive`.
 * Returns a function call which will generate a `DirectiveResult`.
 * A `Directive` works like Binding, but it used to generate HTML code pieces,
 * not like `Binding` to modify properties of an element.
 */
export function defineDirective<A extends any[] = any[]>(Dir: DirectiveConstructor<A>) {
	let id = seed++
	directiveMap.set(id, Dir)
	
	return function(...args: A) {
		return new DirectiveResult(id, ...args)
	}
}


/** 
 * Returned from calling directive functions like `repeat`.
 * Used to cache arguments and update template later.
 */
export class DirectiveResult<A extends any[] = any[]> {

	id: number
	args: A

	constructor(id: number, ...args: A) {
		this.id = id
		this.args = args
	}
}


/** Create directive from directive result. used in `node.ts` */
/** @hidden */
export function createDirectiveFromResult(anchor: NodeAnchor, context: Context, result: DirectiveResult): Directive {
	let Dir = directiveMap.get(result.id)!
	let directive = new Dir(anchor, context)
	directive.merge(...result.args)

	return directive
}
