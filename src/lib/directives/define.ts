import {Context} from '../component'
import {NodeAnchor} from '../node-helper'


interface DirectiveConstructor<Args extends any[]> {
	new(anchor: NodeAnchor, context: Context, ...args: Args): Directive<Args>
}

export interface Directive<Args extends any[] = any[]> {
	canMergeWith(...args: Args): boolean
	merge(...args: Args): void
	remove(): void
}


let seed = 0
const directiveMap: Map<number, DirectiveConstructor<any>> = new Map()

/** get defined directive constructor from a the id the directive result. */
export function getDirectiveConstructor(id: number): DirectiveConstructor<any> {
	return directiveMap.get(id)!
}


/** Define a new directive from a class which implements `Directive`. */
export function defineDirective<Args extends any[] = any[]>(Dir: DirectiveConstructor<Args>) {
	let id = seed++

	let fn = function(...args: Args) {
		return new DirectiveResult(id, ...args)
	}

	directiveMap.set(id, Dir)
	return fn
}


/** Returns from calling directive function. */
export class DirectiveResult<Args extends any[] = any[]> {

	id: number
	args: Args

	constructor(id: number, ...args: Args) {
		this.id = id
		this.args = args
	}
}
