import {Component} from '../component'
import './class'
import './style'
import './model'
import './props'
import './ref'


interface BindConstructor {
	new(el: HTMLElement, value: any, modifiers: string[] | null, context: Component): Bind
}

export interface Bind {
	update(value: any): void
}


const defineMap: Map<string, BindConstructor> = new Map()

/**
 * Define a bind class on an element to modify attributes or properties.
 * @param name The bind name.
 * @param BindConstructor The class to handle binding and value changing.
 */
export function defineBind(name: string, Com: BindConstructor) {
	defineMap.set(name, Com)
}

export function getBind(name: string): BindConstructor | undefined{
	return defineMap.get(name)
}