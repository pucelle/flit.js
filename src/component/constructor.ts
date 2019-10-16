import {Component} from './component'
import {getComponent, getComponentAsync, getClosestComponent} from './from-element'
import {ComponentStyle, addGlobalStyle, updateStyles} from './style'
import {updateComponents} from './life-cycle'


export interface ComponentConstructor {
	get: typeof getComponent
	getAsync: typeof getComponentAsync
	closest: typeof getClosestComponent
	updateComponents: typeof updateComponents
	updateStyles: typeof updateStyles
	addGlobalStyle: typeof addGlobalStyle
	style: ComponentStyle | null

	new(...args: any[]): Component
}


/** To cache `name -> component constructor` */
const componentConstructorMap: Map<string, ComponentConstructor> = new Map()

/**
 * Define a component with specified name and class, called by `define()`.
 * @param name The component name, same with `define()`.
 * @param Com The component class.
 */
export function defineComponentConstructor(name: string, Com: ComponentConstructor) {
	if (componentConstructorMap.has(name)) {
		console.warn(`You are trying to overwrite component definition "${name}"`)
	}

	componentConstructorMap.set(name, Com)
}

/**
 * Get component constructor from name, then we can instantiate it.
 * @param name The component name, same with `define()`.
 * @param Com The component class.
 */
export function getComponentConstructor(name: string): ComponentConstructor | undefined {
	return componentConstructorMap.get(name)
}
