import {parseStyleCodes} from '../internals/style-parser'
import type {TemplateResult} from '../template'
import type {ComponentConstructor} from './define'


/** Type of value returned from `Component.style()`. */
export type ComponentStyle = TemplateResult | (() => TemplateResult)


/** Caches `Component -> style element`. */
const ComponentStyleAndTagMap: Map<ComponentConstructor, HTMLStyleElement> = new Map()

/** Caches global style element and their source. */
const GlobalStyleAndTags: {style: ComponentStyle, tag: HTMLStyleElement}[] = []


/** Calls after any one instance of component constructor connected, to ensure it's relied styles appended into document. */
export function ensureComponentStyle(Com: ComponentConstructor, name: string) {
	if (Com.style && !ComponentStyleAndTagMap.has(Com)) {
		let styleTag = createStyleElement(Com.style, name)
		ComponentStyleAndTagMap.set(Com, styleTag)
	}
}


/** 
 * Create <style> tag and insert it into document head.
 * `name` should be `global` for global style.
 * Always insert into before any script tag.
 * So you may put overwritten styles after script tag.
 */
function createStyleElement(style: ComponentStyle, scopeName: string): HTMLStyleElement {
	let styleTag = document.createElement('style')
	styleTag.setAttribute('name', scopeName)
	styleTag.textContent = getStyleContent(style, scopeName)

	let scriptTag = document.head.querySelector('script')
	document.head.insertBefore(styleTag, scriptTag)

	return styleTag
}


/** Get style text from static style property. */
function getStyleContent(style: ComponentStyle, scopeName: string): string {
	if (typeof style === 'function') {
		style = style()
	}

	return parseStyleCodes(String(style), scopeName === 'global' ? '' : scopeName)
}


/** 
 * Add a global style. compare to normal style codes, it can use variables and can be updated dinamically.
 * @param style A string, css`...`, or a function return those.
 * @returns A newly created style tag element.
 */
export function addGlobalStyle(style: ComponentStyle): HTMLStyleElement {
	let scopeName = 'global'
	let styleTag = createStyleElement(style, scopeName)

	GlobalStyleAndTags.push({style, tag: styleTag})

	return styleTag
}


/** Updates all style codes for all the components, you may call this after theme changed. */
export function updateAllStyles() {
	
	// `updateStyles` should always been called along with `updateAllComponents`,
	// So we should makesure `updateStyles` in the same micro task with `updateAllComponents`.

	for (let [Com, tag] of ComponentStyleAndTagMap.entries()) {
		if (Com.style) {
			let newContent = getStyleContent(Com.style, tag.getAttribute('name')!)
			if (newContent !== tag.textContent) {
				tag.textContent = newContent
			}
		}
	}

	for (let {style, tag} of GlobalStyleAndTags) {
		if (typeof style === 'function') {
			let newContent = getStyleContent(style, tag.getAttribute('name')!)
			if (newContent !== tag.textContent) {
				tag.textContent = newContent
			}
		}
	}
}
