import {Component} from './component'
import {TemplateResult} from '../parts'


export interface ComponentConstructor {
	new(...args: any[]): Component
	style: ComponentStyle | null
	properties: string[] | null
}

export type ComponentStyle = TemplateResult | string | (() => TemplateResult | string)


/** To cache `name -> component constructor` */
const componentConstructorMap: Map<string, ComponentConstructor> = new Map()

/**
 * Define a component with specified name and class, called by `define()`.
 * @param name The component name, same with `define()`.
 * @param Com The component class.
 */
export function defineComponent(name: string, Com: ComponentConstructor) {
	if (componentConstructorMap.has(name)) {
		console.warn(`You are trying to overwrite component definition "${name}"`)
	}

	// `properties` can be camel cased or dash cased.
	if (Com.properties) {
		for (let i = 0; i < Com.properties.length; i++) {
			let prop = Com.properties[i]
			if (/[A-Z]/.test(prop)) {
				Com.properties[i] = prop.replace(/[A-Z]/g, (m0: string) => '-' + m0.toLowerCase())
			}
		}
	}

	componentConstructorMap.set(name, Com)
}

/**
 * Get component constructor from name, then we can instantiate it.
 * @param name The component name, same with `define()`.
 * @param Com The component class.
 */
export function getComponentConstructorByName(name: string): ComponentConstructor | undefined {
	return componentConstructorMap.get(name)
}
