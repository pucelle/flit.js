import {ComponentConstructor, ComponentStyle} from './component'
import {TemplateResult} from './parts'


/** Cache `Component` -> {style element, referenced count} */
const componentStyleMap: Map<ComponentConstructor, {style: HTMLStyleElement, count: number}> = new Map()


export function ensureComponentStyle(Com: ComponentConstructor, name: string) {
	if (Com.style) {
		if (componentStyleMap.has(Com)) {
			let o = componentStyleMap.get(Com)!
			o.count++
		}
		else {
			let styleTag = document.createElement('style')
			styleTag.setAttribute('name', name)
			styleTag.textContent = scopeStyle(getStyleContent(Com.style), name)
			document.head.append(styleTag)
			componentStyleMap.set(Com, {style: styleTag, count: 1})
		}
	}
}


/** Add global styles */
export function addGlobalStyle(style: ComponentStyle) {
	let styleTag = document.createElement('style')
	styleTag.setAttribute('name', 'global')
	styleTag.textContent = getStyleContent(style)
	document.head.append(styleTag)
}


export function mayRemoveStyle(Com: ComponentConstructor) {
	if (componentStyleMap.has(Com)) {
		let o = componentStyleMap.get(Com)!
		o.count--

		if (o.count === 0) {
			componentStyleMap.delete(Com)
		}
	}
}


function getStyleContent(style: ComponentStyle): string {
	if (typeof style === 'function') {
		style = style()
	}

	if (style instanceof TemplateResult) {
		style = style.join()
	}

	return style!
}


// Benchmark about nested selector: https://jsperf.com/is-nesting-selector-slower
// About 2~4% slower for each nested selector when rendering.
function scopeStyle(style: string, comName: string) {
	let re = /[^;}]+\{/g

	return style.replace(re, (m0: string) => {
			   // Replace `.class` -> `.class__comName`
		return m0.replace(/\$([\w-]+)/g, '$1__' + comName)

			// Replace `p` -> `comName p`
			.replace(/((?:^|,)\s*)([\w-]+)/g, (m0: string, before: string, tag: string) => {
				if (tag === comName || tag === 'html' || tag === 'body') {
					return m0
				}
				else {
					return before + comName + ' ' + tag
				}
			})
	})
}


/** Update all styles for components, you can update styles after theme changed. */
export function updateStyles() {
	// `updateStyles` always been called along with `update`,
	// So we may need to makesure update style in the same micro task.
	for (let [Com, {style: styleTag}] of componentStyleMap) {
		if (typeof Com.style === 'function') {
			let newContent = scopeStyle(getStyleContent(Com.style), styleTag.getAttribute('name')!)
			if (newContent !== styleTag.textContent) {
				styleTag.textContent = newContent
			}
		}
	}
}