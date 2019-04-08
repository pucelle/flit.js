import {updateAllComponents} from './lib/component'
import {updateAllStyles} from './lib/element'

export {Emitter} from './lib/emitter'
export {define} from './lib/element'
export {render} from './lib/render'
export {html, css, svg, text} from './lib/parts'
export {Component} from './lib/component'
export {defineBinding} from './lib/bindings'
export {on, once, off} from './lib/dom-event'
export {observe} from './lib/observer'
export {watch, watchOnce, watchUntil} from './lib/watcher'
export {onRendered, renderComplete} from './lib/queue'
export {defineDirective, Directive, DirectiveResult, repeat, cache} from './lib/directives'
export {defineTransion} from './lib/transition'

export function update() {
	updateAllStyles()
	updateAllComponents()
}