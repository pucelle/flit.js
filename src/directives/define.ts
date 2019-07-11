import {Context} from '../component'
import {NodeAnchor} from '../libs/node-helper'


interface DirectiveConstructor<Args extends any[]> {
	new(anchor: NodeAnchor, context: Context): Directive<Args>
}

export interface Directive<Args extends any[] = any[]> {
	canMergeWith(...args: Args): boolean
	merge(...args: Args): void
	remove(): void
}


let seed = 0
const directiveMap: Map<number, DirectiveConstructor<any>> = new Map()


/** Define a new directive from a class which implements `Directive`. */
export function defineDirective<Args extends any[] = any[]>(Dir: DirectiveConstructor<Args>) {
	let id = seed++
	directiveMap.set(id, Dir)
	
	return function(...args: Args) {
		return new DirectiveResult(id, ...args)
	}
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


/** Create directive from directive result. used in `node.ts` */
export function createDirectiveFromResult(anchor: NodeAnchor, context: Context, result: DirectiveResult): Directive {
	let Dir = directiveMap.get(result.id)!
	let directive = new Dir(anchor, context)
	directive.merge(...result.args)

	return directive
}
