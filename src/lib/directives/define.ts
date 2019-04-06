import {Component} from '../component'


interface DirectiveConstructor<Args extends any[]> {
	new(comment: Comment, context: Component): Directive<Args>
}


export abstract class Directive<Args extends any[] = any[]> {

	protected endNode: Comment
	protected context: Component

	constructor(comment: Comment, context: Component) {
		this.endNode = comment
		this.context = context
	}

	abstract init(...args: Args): void
	abstract canMergeWith(...args: Args): boolean
	abstract merge(...args: Args): void
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
