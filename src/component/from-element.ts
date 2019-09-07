import {Component} from './component'
import {onComponentCreatedAt} from './life-cycle'


/** To cache `el -> com` map */
const elementComponentMap: WeakMap<HTMLElement, Component> = new WeakMap()

/**
 * Set component instance at root element.
 */
export function setComponentAtElement(el: HTMLElement, com: Component) {
	elementComponentMap.set(el, com)
}

/**
 * Get component instance from root element.
 * @param el The element to get component instance at.
 */
export function getComponent(el: HTMLElement): Component | undefined {
	return elementComponentMap.get(el)
}

/**
 * Get component instance from root element asynchronously.
 * @param el The element to get component instance at.
 */
export function getComponentAsync(el: HTMLElement): Promise<Component | undefined> {
	if (el.localName.includes('-')) {
		let com = elementComponentMap.get(el)
		if (com) {
			return Promise.resolve(com)
		}
		else {
			return new Promise(resolve => {
				onComponentCreatedAt(el, resolve)
			})
		}
	}
	else {
		return Promise.resolve(undefined)
	}
}
