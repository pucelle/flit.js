(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const src_1 = require("../src");
src_1.define('test-com', class TestCom extends src_1.Component {
    constructor() {
        super(...arguments);
        this.value = 100;
        this.message = 'Hello';
        this.pie = false;
        this.a = { a: [1, 2, 3, 4, 5, 6, 7, 8, 9] };
    }
    onclick() {
        this.value++;
        this.pie = !this.pie;
        this.update();
    }
    render() {
        return src_1.html `
		<style>
		  :host { display: block; }
		  :host([hidden]) { display: none; }
		</style>
  
		<h1>Start LitElement!</h1>
		<p>${this.message}</p>
  
		<input name="myinput" id="myinput" 
		  type="checkbox"
		  ?checked="${this.pie}"
		  @change="${this.onclick}">
  
		<label for="myinput">I like pie.</label>
  
		${this.a.a.map(i => src_1.html `<div>a${i}b</div>`)}
		
		${this.pie ? src_1.html `<lazy-element a="b"></lazy-element>` : src_1.html ``}
	  `;
    }
});
},{"../src":2}],2:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var emitter_1 = require("./lib/emitter");
exports.Emitter = emitter_1.Emitter;
var element_1 = require("./lib/element");
exports.define = element_1.define;
var render_1 = require("./lib/render");
exports.render = render_1.render;
var template_1 = require("./lib/template");
exports.html = template_1.html;
exports.css = template_1.css;
exports.svg = template_1.svg;
var component_1 = require("./lib/component");
exports.getComponentAt = component_1.getComponentAt;
exports.onComponentCreatedAt = component_1.onComponentCreatedAt;
exports.Component = component_1.Component;
var binds_1 = require("./lib/binds");
exports.defineBind = binds_1.defineBind;
// export function proxy(data: T): T & Proxy {
// }
// export function target(data: T): T {
// }
// export function update() {
// }
},{"./lib/binds":5,"./lib/component":10,"./lib/element":11,"./lib/emitter":12,"./lib/render":22,"./lib/template":23}],3:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const define_1 = require("./define");
/**
 * `:class="'class1 class2'"`
 * `:class="[class1, class2]"`
 * `:class="{class1: value1, class2: value2}"`
 * `:class.class-name="value"`
 */
define_1.defineBind('class', class ClassNameBind {
    constructor(el, value, modifiers) {
        this.value = null;
        if (modifiers) {
            if (modifiers.length > 1) {
                throw new Error(`Modifier "${modifiers.join('.')}" is not allowed, only one modifier can be specified for ":class"`);
            }
            if (!/^[\w-]+$/.test(modifiers[0])) {
                throw new Error(`Modifier "${modifiers[0]}" is not a valid class name`);
            }
        }
        this.el = el;
        this.modifiers = modifiers;
        this.update(value);
    }
    update(newValue) {
        if (this.value) {
            this.removeClass(this.value);
        }
        if (newValue) {
            this.addClass(newValue);
        }
        this.value = newValue;
    }
    removeClass(value) {
        let names = this.parseClass(value);
        this.el.classList.remove(...names);
    }
    addClass(value) {
        let names = this.parseClass(value);
        this.el.classList.add(...names);
    }
    parseClass(value) {
        let o = {};
        if (this.modifiers) {
            if (value) {
                o[this.modifiers[0]] = true;
            }
        }
        else if (Array.isArray(value)) {
            for (let name of value) {
                o[name] = true;
            }
        }
        else if (value && typeof value === 'object') {
            for (let key of Object.keys(value)) {
                o[key] = !!value[key];
            }
        }
        else if (typeof value === 'string') {
            for (let name of value.split(/\s+/)) {
                if (name) {
                    o[name] = true;
                }
            }
        }
        let names = [];
        for (let name in o) {
            if (o[name]) {
                names.push(name);
            }
        }
        return names;
    }
});
},{"./define":4}],4:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const defineMap = new Map();
/**
 * Define a bind class on an element to modify attributes or properties.
 * @param name The bind name.
 * @param BindConstructor The class to handle binding and value changing.
 */
function defineBind(name, Com) {
    defineMap.set(name, Com);
}
exports.defineBind = defineBind;
function getBind(name) {
    return defineMap.get(name);
}
exports.getBind = getBind;
},{}],5:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var define_1 = require("./define");
exports.defineBind = define_1.defineBind;
exports.getBind = define_1.getBind;
require("./class");
require("./style");
require("./model");
require("./props");
require("./ref");
},{"./class":3,"./define":4,"./model":6,"./props":7,"./ref":8,"./style":9}],6:[function(require,module,exports){
"use strict";
// import {Bind, defineBind} from './index'
// import {getComponentAt, onComponentCreatedAt, Component} from '../component'
// import {queue} from '../queue'
// /**
//  * model bind should only handle fixed value.
//  */
// defineBind('model', class ModelBind implements Bind {
// 	private el: HTMLElement
// 	private modifiers: string[] | null
// 	private context: Component
// 	private value: unknown = null
// 	private allowedModifiers = ['lazy', 'number']
// 	private isComEvent: boolean
// 	private isBooleanValue: boolean = false
// 	private isMultiSelect: boolean = false
// 	private property: string
// 	private eventName: string
// 	private locked: boolean = false
// 	constructor(el: HTMLElement, value: unknown, modifiers: string[] | null, context: Component) {
// 		if (typeof value !== 'string') {
// 			throw new Error('The value of ":model" must be string type')
// 		}
// 		if (modifiers) {
// 			if (modifiers.length > 1) {
// 				throw new Error(`Modifier "${modifiers.join('.')}" is not allowed, only one modifier can be specified for ":model"`)
// 			}
// 			if (!this.allowedModifiers.includes(modifiers[1])) {
// 				throw new Error(`Modifier "${modifiers[1]}" is not allowed, it must be one of ${this.allowedModifiers.map(m => `"${m}"`).join(', ')}`)
// 			}
// 		}
// 		this.el = el
// 		this.modifiers = modifiers
// 		this.context = context
// 		this.isComEvent = el.localName.includes('-')
// 		if (this.isComEvent) {
// 			this.property = 'value'
// 			this.eventName = 'change'
// 		}
// 		else {
// 			let isFormField = ['input', 'select', 'textarea'].includes(el.localName)
// 			let isLazy = modifiers && modifiers[0] === 'lazy'
// 			this.isBooleanValue = el.localName === 'input' && ((el as HTMLInputElement).type === 'checkbox' || (el as HTMLInputElement).type === 'radio')
// 			this.isMultiSelect = el.localName === 'select' && (el as HTMLSelectElement).multiple
// 			if (this.isBooleanValue) {
// 				this.property = 'checked'
// 				this.eventName = 'change'
// 			}
// 			else if (isFormField) {
// 				this.property = 'value'
// 				this.eventName = isLazy ? 'change' : 'input'
// 			}
// 			//div@contendeditable cant trigger change event but not input event
// 			else {
// 				this.property = 'innerHTML'
// 				this.eventName = isLazy ? 'blur' : 'input'
// 			}
// 		}
// 		this.update(value)
// 	}
// 	update(modelName: string) {
// 		if (this.isComEvent) {
// 			let com = getComponentAt(this.el)
// 			if (com) {
// 				com.on(this.eventName, this.onComValueChange, this)
// 			}
// 			else {
// 				onComponentCreatedAt(this.el, this.update.bind(this, modelName))
// 			}
// 		}
// 		else {
// 			//TO DO
// 			this.el.addEventListener(this.eventName, this.onInputOrChange.bind(this))
// 		}
// 	}
// 	onComValueChange(value: unknown) {
// 		(this.context as unknown)[this.property] = value
// 	}
// 	onInputOrChange (e: Event) {
// 		let value = (this.el as unknown)[this.property]
// 		if (this.isBooleanValue) {
// 			this.setValue(!!value)
// 		}
// 		else {
// 			this.setInputValue(value)
// 		}
// 		this.locked = true
// 		queue.nextTick(() => {
// 			this.locked = false
// 			//write value back to input
// 			if (e.type === 'change') {
// 				this.update(this.watcher.value)
// 			}
// 		})
// 	}
// 	setBoolValue (inputValue) {
// 		let {vm, watcher} = this
// 		let value = this.watcher.value
// 		watcher.set(!!inputValue)
// 	},
// 	setInputValue (inputValue) {
// 		let {el, vm, watcher} = this
// 		let isNumber = this.mods.includes('number')
// 		if (this.isMultiSelect) {
// 			let value = Array.from(el.options).filter(o => o.selected).map(o => o.value)
// 			if (isNumber) {
// 				value = value.map(Number)
// 			}
// 			watcher.set(value)
// 		}
// 		else {
// 			if (isNumber) {
// 				let numValue = Number(inputValue)
// 				watcher.set(numValue)
// 			}
// 			else {
// 				watcher.set(inputValue)
// 			}
// 		}
// 	},
// 	setValue (value) {
// 		if (this.com) {
// 			this.updateCom(value)
// 		}
// 		else {
// 			if (this.locked) {
// 				return
// 			}
// 			if (this.isBooleanValue) {
// 				this.updateBooleanValue(value)
// 			}
// 			else {
// 				this.updateInputValue(value)
// 			}
// 		}
// 	},
// 	updateCom (value) {
// 		let {prop, com} = this
// 		if (prop) {
// 			com[prop] = value
// 		}
// 		else if (util.isObject(value)) {
// 			ff.assign(com, value)
// 		}
// 	},
// 	updateBooleanValue (value) {
// 		let {el, prop} = this
// 		el[prop] = !!value
// 	},
// 	updateInputValue (value) {
// 		let {el, prop, isMultiSelect} = this
// 		if (isMultiSelect && !Array.isArray(value)) {
// 			throw new Error('"model" directive of select[multiple] requires an array as value')
// 		}
// 		if (isMultiSelect) {
// 			for (let option of el.options) {
// 				option.selected = value.includes(option.value)
// 			}
// 		}
// 		else {
// 			el[prop] = util.isNullOrUndefined(value) ? '' : value
// 		}
// 	},
// })
},{}],7:[function(require,module,exports){
"use strict";
},{}],8:[function(require,module,exports){
"use strict";
},{}],9:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const define_1 = require("./define");
/**
 * `:style="'style1: value1; style2: value2'"`
 * `:style="{style1: value1, style2: value2}"`
 * `:style.style-name="value"`
 * `:style.style-name.px="value"`
 */
define_1.defineBind('style', class StyleBind {
    constructor(el, value, modifiers) {
        this.value = null;
        this.allowedModifiers = ['px', 'percent', 'url'];
        if (modifiers) {
            if (modifiers.length > 2) {
                throw new Error(`Modifier "${modifiers.join('.')}" is not allowed, at most two modifiers can be specified for ":style"`);
            }
            if (modifiers.length === 2 && !this.allowedModifiers.includes(modifiers[1])) {
                throw new Error(`Modifier "${modifiers[1]}" is not allowed, it must be one of ${this.allowedModifiers.map(m => `"${m}"`).join(', ')}`);
            }
            if (!/^[\w-]+$/.test(modifiers[0]) || this.allowedModifiers.includes(modifiers[0])) {
                throw new Error(`Modifier "${modifiers[0]}" is not a valid dash case style name`);
            }
        }
        this.el = el;
        this.modifiers = modifiers;
        this.update(value);
    }
    update(newValue) {
        if (this.value) {
            this.removeStyle(this.value);
        }
        if (newValue) {
            this.addStyle(newValue);
        }
        this.value = newValue;
    }
    removeStyle(style) {
        let o = this.parseStyle(style);
        for (let name of Object.keys(o)) {
            this.el.style[name] = '';
        }
    }
    addStyle(style) {
        let o = this.parseStyle(style);
        let unit = this.modifiers ? this.modifiers[1] : '';
        for (let name of Object.keys(o)) {
            let value = o[name];
            if (value === null || value === undefined) {
                value = '';
            }
            else if (unit === 'px') {
                value = value + 'px';
            }
            else if (unit === 'percent') {
                value = value + '%';
            }
            else if (unit === 'url') {
                value = 'url("' + value + '")';
            }
            this.el.style[name] = value;
        }
    }
    parseStyle(style) {
        let obj = {};
        if (this.modifiers) {
            if (style && style !== null && style !== undefined) {
                obj[this.modifiers[0]] = style;
            }
        }
        else if (Array.isArray(style)) {
            for (let item of style.join(';').split(/\s*;\s*/)) {
                let [name, value] = item.split(/\s*:\s*/);
                if (name && value) {
                    obj[name] = value;
                }
            }
        }
        else if (style && typeof style === 'object') {
            obj = style;
        }
        else if (style && typeof style === 'string') {
            for (let item of style.split(/\s*;\s*/)) {
                let [name, value] = item.split(/\s*:\s*/);
                if (name && value) {
                    obj[name] = value;
                }
            }
        }
        return obj;
    }
});
},{"./define":4}],10:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const emitter_1 = require("./emitter");
const parts_1 = require("./parts");
const componentMap = new Map();
function defineComponent(name, Com) {
    componentMap.set(name, Com);
}
exports.defineComponent = defineComponent;
function getComponentConstructor(name) {
    return componentMap.get(name);
}
exports.getComponentConstructor = getComponentConstructor;
const elementComponentMap = new WeakMap();
/**
 * Get component instance from root element.
 * @param el The element.
 */
function getComponentAt(el) {
    return elementComponentMap.get(el);
}
exports.getComponentAt = getComponentAt;
const componentCreatedMap = new WeakMap();
function onComponentCreatedAt(el, callback) {
    let callbacks = componentCreatedMap.get(el);
    if (!callbacks) {
        componentCreatedMap.set(el, (callbacks = []));
    }
    callbacks.push(callback);
}
exports.onComponentCreatedAt = onComponentCreatedAt;
function emitComponentCreated(el, com) {
    let callbacks = componentCreatedMap.get(el);
    if (callbacks) {
        for (let callback of callbacks) {
            callback(com);
        }
        componentCreatedMap.delete(el);
    }
}
class Component extends emitter_1.Emitter {
    constructor(el, options) {
        super();
        this._node = null;
        this.el = el;
        Object.assign(this, options);
        elementComponentMap.set(el, this);
        emitComponentCreated(el, this);
        Promise.resolve().then(() => {
            this.update();
        });
    }
    update() {
        let value = this.render();
        if (this._node) {
            this._node.update(value);
        }
        else {
            this._node = new parts_1.RootPart(this.el, value, this);
        }
    }
    onConnected() { }
    onDisconnected() { }
}
exports.Component = Component;
},{"./emitter":12,"./parts":16}],11:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const component_1 = require("./component");
/**
 * Defines a component with specified name.
 * Defines a custom element, but just used to start the defined component
 * @param name The component name.
 * @param Component The Component class definition.
 */
function define(name, Com) {
    if (!name.includes('-')) {
        console.warn('Custom element should contains "-"');
    }
    customElements.define(name, class CustomElement extends HTMLElement {
        connectedCallback() {
            let com = component_1.getComponentAt(this);
            if (!com) {
                com = new Com(this);
            }
            com.onConnected();
        }
        disconnectedCallback() {
            let com = component_1.getComponentAt(this);
            if (com) {
                com.onDisconnected();
            }
        }
    });
    component_1.defineComponent(name, Com);
}
exports.define = define;
},{"./component":10}],12:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/** An event emitter to listen and emit events. */
class Emitter {
    constructor() {
        this._events = {};
    }
    /**
     * Register listener for specified event name.
     * @param name The event name.
     * @param handler The event handler.
     * @param scope The scope will be binded to handler.
     */
    on(name, handler, scope) {
        let events = this._events[name] || (this._events[name] = []);
        events.push({
            handler,
            scope,
            once: false,
        });
    }
    /**
     * Register listener for specified event name for only once.
     * @param name The event name.
     * @param handler The event handler.
     * @param scope The scope will be binded to handler.
     */
    once(name, handler, scope) {
        let events = this._events[name] || (this._events[name] = []);
        events.push({
            handler,
            scope,
            once: true
        });
    }
    /**
     * Stop listening specified event.
     * @param name The event name.
     * @param handler The event handler, only matched listener will be removed.
     * @param scope The scope binded to handler. If provided, remove listener only when scope match.
     */
    off(name, handler, scope) {
        let events = this._events[name];
        if (events) {
            for (let i = events.length - 1; i >= 0; i--) {
                let event = events[i];
                if (event.handler === handler && (!scope || event.scope === scope)) {
                    events.splice(i, 1);
                }
            }
        }
    }
    /**
     * Check if registered listener for specified event.
     * @param name The event name.
     * @param handler The event handler. If provided, will also check if the handler match.
     * @param scope The scope binded to handler. If provided, will additionally check if the scope match.
     */
    hasListener(name, handler, scope) {
        let events = this._events[name];
        if (!handler) {
            return !!events && events.length > 0;
        }
        else if (events && handler) {
            for (let i = 0, len = events.length; i < len; i++) {
                let event = events[i];
                if (event.handler === handler && (!scope || event.scope === scope)) {
                    return true;
                }
            }
        }
        return false;
    }
    /**
     * Emit specified event with followed arguments.
     * @param name The event name.
     * @param args The arguments that will be passed to event handlers.
     */
    emit(name, ...args) {
        let events = this._events[name];
        if (events) {
            for (let i = 0; i < events.length; i++) {
                let event = events[i];
                //the handler may call off, so must remove it before handling
                if (event.once === true) {
                    events.splice(i--, 1);
                }
                event.handler.apply(event.scope, args);
            }
        }
    }
    /** Remove all event slisteners */
    removeAllListeners() {
        this._events = {};
    }
}
exports.Emitter = Emitter;
},{}],13:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("./types");
class AttrPart {
    constructor(el, name, value) {
        this.type = types_1.PartType.Attr;
        this.width = 1;
        this.strings = null;
        this.el = el;
        this.name = name;
        this.setValue(value);
    }
    setValue(value) {
        value === null || value === undefined ? '' : String(value);
        this.el.setAttribute(this.name, value);
    }
    update(values) {
        this.setValue(values);
    }
}
exports.AttrPart = AttrPart;
},{"./types":21}],14:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("./types");
const binds_1 = require("../binds");
class BindPart {
    constructor(el, name, value, context) {
        this.type = types_1.PartType.Bind;
        this.width = 1;
        this.strings = null;
        let dotIndex = name.indexOf('.');
        let bindName = dotIndex > -1 ? name.slice(0, dotIndex) : name;
        let bindModifiers = dotIndex > -1 ? name.slice(dotIndex + 1).split('.') : null;
        let Cls = binds_1.getBind(bindName);
        if (!Cls) {
            throw new Error(`"${bindName}" is not a binded class`);
        }
        this.bind = new Cls(el, value, bindModifiers, context);
    }
    update(value) {
        this.bind.update(value);
    }
}
exports.BindPart = BindPart;
},{"../binds":5,"./types":21}],15:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const component_1 = require("../component");
const types_1 = require("./types");
class EventPart {
    constructor(el, name, handler, context) {
        this.type = types_1.PartType.Event;
        this.width = 1;
        this.strings = null;
        this.el = el;
        this.name = name[0] === '@' ? name.slice(1) : name;
        this.context = context;
        this.isComEvent = el.localName.includes('-') && name[0] !== '@';
        this.setHandler(handler);
    }
    setHandler(newHandler) {
        let oldHandler = this.handler;
        if (this.isComEvent) {
            let com = component_1.getComponentAt(this.el);
            if (com) {
                if (oldHandler) {
                    com.off(this.name, oldHandler, this.context);
                }
                com.on(this.name, newHandler, this.context);
            }
            else if (!oldHandler) {
                component_1.onComponentCreatedAt(this.el, this.setHandlerLater.bind(this));
            }
        }
        else {
            //TO DO
            // if (oldHandler) {
            // 	this.el.removeEventListener(this.name, oldHandler as Function)
            // }
            this.el.addEventListener(this.name, newHandler.bind(this.context));
        }
        this.handler = newHandler;
    }
    setHandlerLater(com) {
        com.on(this.name, this.handler, com);
    }
    update(handler) {
        this.setHandler(handler);
    }
}
exports.EventPart = EventPart;
},{"../component":10,"./types":21}],16:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var root_child_1 = require("./root-child");
exports.RootPart = root_child_1.RootPart;
},{"./root-child":20}],17:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("./types");
class MayAttrPart {
    constructor(el, name, value) {
        this.type = types_1.PartType.MayAttr;
        this.width = 1;
        this.strings = null;
        this.el = el;
        this.name = name;
        this.setValue(value);
    }
    setValue(value) {
        if (value) {
            this.el.setAttribute(this.name, '');
        }
        else {
            this.el.removeAttribute(this.name);
        }
    }
    update(value) {
        this.setValue(value);
    }
}
exports.MayAttrPart = MayAttrPart;
},{"./types":21}],18:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("./types");
const parseResultMap = new Map();
const VALUE_MARKER = '${flit}';
const SELF_CLOSE_TAGS = {
    area: true,
    base: true,
    br: true,
    col: true,
    embed: true,
    hr: true,
    img: true,
    input: true,
    link: true,
    meta: true,
    param: true,
    source: true,
    track: true,
    wbr: true
};
function parse(type, strings) {
    if (type === 'html' || type === 'svg') {
        let string = strings.join(VALUE_MARKER);
        let sharedResult = parseResultMap.get(string);
        if (!sharedResult) {
            sharedResult = new ElementParser(type, string).parse();
            parseResultMap.set(string, sharedResult);
        }
        return generateParseResult(sharedResult);
    }
    else {
        return {
            fragment: createTemplate(strings[0].trim()).content,
            nodesInPlaces: null,
            places: null
        };
    }
}
exports.parse = parse;
function createTemplate(html) {
    let template = document.createElement('template');
    template.innerHTML = html;
    return template;
}
class ElementParser {
    constructor(type, string) {
        this.nodeIndex = 0;
        this.places = [];
        this.placeNodeIndexs = [];
        this.type = type;
        this.string = string;
    }
    parse() {
        const tagRE = /<!--[\s\S]*?-->|<(\w+)([\s\S]*?)\/?>|<\/\w+>/g;
        let codes = '';
        let lastIndex = 0;
        let isFirstTag = false;
        let svgWrapped = false;
        let match;
        while (match = tagRE.exec(this.string)) {
            let code = match[0];
            codes += this.parseText(this.string.slice(lastIndex, tagRE.lastIndex - code.length));
            lastIndex = tagRE.lastIndex;
            //ignore comment nodes
            if (code[1] === '!') {
                continue;
            }
            if (code[1] === '/') {
                codes += code;
            }
            else {
                let tag = match[1];
                let attr = match[2];
                if (!isFirstTag) {
                    if (this.type === 'svg' && tag !== 'svg') {
                        codes = '<svg>' + codes;
                        svgWrapped = true;
                    }
                    isFirstTag = true;
                }
                if (attr.length > 5) {
                    attr = this.parseAttribute(attr);
                }
                codes += '<' + tag + attr + '>';
                //`<div/>` -> `<div></div>`
                if (code[code.length - 2] === '/' && !SELF_CLOSE_TAGS.hasOwnProperty(tag)) {
                    codes += '</' + tag + '>';
                }
                this.nodeIndex++;
            }
        }
        codes += this.parseText(this.string.slice(lastIndex));
        if (svgWrapped) {
            codes += '</svg>';
        }
        let template = createTemplate(codes);
        if (svgWrapped) {
            let svg = template.content.firstElementChild;
            template.content.append(...svg.childNodes);
            svg.remove();
        }
        return {
            template,
            valuePlaces: this.places
        };
    }
    parseText(text) {
        text = text.trim();
        if (!text) {
            return text;
        }
        if (text.includes(VALUE_MARKER)) {
            let splitted = text.split(VALUE_MARKER);
            text = splitted.join('<!--->');
            for (let i = 1; i < splitted.length; i++) {
                this.places.push({
                    type: types_1.PartType.Child,
                    name: null,
                    strings: null,
                    width: 1,
                    nodeIndex: this.nodeIndex
                });
                this.placeNodeIndexs.push(this.nodeIndex);
                this.nodeIndex += 1;
            }
        }
        return text;
    }
    parseAttribute(attr) {
        const attrRE = /(\S+)\s*=\s*(".*?"|'.*?'|\$\{flit\})\s*/g;
        return attr.replace(attrRE, (m0, name, value) => {
            let type = undefined;
            let hasMarker = value.includes(VALUE_MARKER);
            switch (name[0]) {
                case '.':
                    type = types_1.PartType.Property;
                    break;
                case ':':
                    type = types_1.PartType.Bind;
                    break;
                case '?':
                    type = types_1.PartType.MayAttr;
                    break;
                case '@':
                    type = types_1.PartType.Event;
                    break;
            }
            if (type !== undefined) {
                name = name.slice(1);
            }
            if (type === undefined && hasMarker) {
                type = types_1.PartType.Attr;
            }
            if (type !== undefined) {
                if (value[0] === '\'' || value[0] === '"') {
                    value = value.slice(1, -1);
                }
                let strings = value === VALUE_MARKER || type === types_1.PartType.MayAttr || type === types_1.PartType.Event ? null
                    : hasMarker ? value.split(VALUE_MARKER)
                        : [value];
                this.places.push({
                    type,
                    name,
                    strings,
                    width: strings ? strings.length - 1 : 1,
                    nodeIndex: this.nodeIndex
                });
                this.placeNodeIndexs.push(this.nodeIndex);
                if (type === types_1.PartType.Attr) {
                    return name + '="" ';
                }
                else {
                    return '';
                }
            }
            return m0;
        });
    }
}
//TreeWalker Benchmark: https://jsperf.com/treewalker-vs-nodeiterator
function generateParseResult(sharedResult) {
    let { template, valuePlaces } = sharedResult;
    let fragment = document.importNode(template.content, true);
    let nodeIndex = 0; //ignore root fragment
    let nodesInPlaces = [];
    if (valuePlaces.length > 0) {
        let valueIndex = 0;
        let walker = document.createTreeWalker(fragment, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT, null);
        let node;
        let end = false;
        while (node = walker.nextNode()) {
            while (valuePlaces[valueIndex].nodeIndex === nodeIndex) {
                nodesInPlaces.push(node);
                valueIndex++;
                if (valueIndex === valuePlaces.length) {
                    end = true;
                    break;
                }
            }
            if (end) {
                break;
            }
            nodeIndex++;
        }
    }
    return {
        fragment,
        nodesInPlaces,
        places: valuePlaces
    };
}
},{"./types":21}],19:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("./types");
class PropertyPart {
    constructor(el, name, value) {
        this.type = types_1.PartType.Property;
        this.width = 1;
        this.strings = null;
        this.el = el;
        this.name = name;
        this.setValue(value);
    }
    setValue(value) {
        this.el[this.name] = value;
    }
    update(values) {
        this.setValue(values);
    }
}
exports.PropertyPart = PropertyPart;
},{"./types":21}],20:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const template_1 = require("../template");
const part_parser_1 = require("./part-parser");
const may_attr_1 = require("./may-attr");
const event_1 = require("./event");
const attr_1 = require("./attr");
const bind_1 = require("./bind");
const property_1 = require("./property");
const types_1 = require("./types");
class RootChildShared {
    constructor(context) {
        this.parts = [];
        this.context = context;
    }
    update(newValue) {
        let oldValue = this.value;
        if ((newValue instanceof template_1.Template)) {
            if (oldValue instanceof template_1.Template) {
                this.compareTemplate(oldValue, newValue);
            }
            else {
                this.parseTemplate(newValue);
            }
        }
        else {
            if (oldValue instanceof template_1.Template) {
                this.cleanTemplate();
            }
            this.renderText(newValue === null || newValue === undefined ? '' : String(newValue).trim());
        }
        this.value = newValue;
    }
    compareTemplate(oldTemplate, newTemplate) {
        if (!newTemplate.compareType(oldTemplate) || !newTemplate.compareStrings(oldTemplate)) {
            this.cleanTemplate();
            this.parseTemplate(newTemplate);
        }
        else {
            this.mergeTemplate(oldTemplate, newTemplate);
        }
    }
    mergeTemplate(oldTemplate, newTemplate) {
        let diffs = newTemplate.compareValues(oldTemplate);
        if (diffs) {
            for (let i = 0; i < diffs.length;) {
                let index = diffs[i];
                let part = this.parts[index];
                let partIndex = index;
                while (!part && partIndex < this.parts.length) {
                    partIndex++;
                    part = this.parts[partIndex];
                }
                let values = newTemplate.values.slice(partIndex - part.width + 1, partIndex + 1);
                this.mergePart(part, values);
                if (part.width > 1) {
                    while (i < diffs.length - 1 && diffs[i + 1] <= partIndex) {
                        i++;
                    }
                }
                else {
                    i++;
                }
            }
        }
    }
    parseTemplate(template) {
        let { fragment, nodesInPlaces, places } = part_parser_1.parse(template.type, template.strings);
        let values = template.values;
        let valueIndex = 0;
        if (nodesInPlaces && places) {
            for (let i = 0; i < nodesInPlaces.length; i++) {
                let node = nodesInPlaces[i];
                let place = places[i];
                let part;
                switch (place.type) {
                    case types_1.PartType.Child:
                        let result = values[valueIndex];
                        if (!(result instanceof template_1.Template)) {
                            result = template_1.text([String(result)], []);
                        }
                        part = new ChildPart(node, result, this.context);
                        break;
                    case types_1.PartType.MayAttr:
                        part = new may_attr_1.MayAttrPart(node, place.name, values[valueIndex]);
                        break;
                    case types_1.PartType.Event:
                        part = new event_1.EventPart(node, place.name, values[valueIndex], this.context);
                        break;
                    case types_1.PartType.Attr:
                        part = new attr_1.AttrPart(node, place.name, template_1.join(place.strings, values.slice(valueIndex, valueIndex + place.width)));
                        break;
                    case types_1.PartType.Bind:
                        part = new bind_1.BindPart(node, place.name, template_1.join(place.strings, values.slice(valueIndex, valueIndex + place.width)), this.context);
                        break;
                    case types_1.PartType.Property:
                        part = new property_1.PropertyPart(node, place.name, template_1.join(place.strings, values.slice(valueIndex, valueIndex + place.width)));
                        break;
                }
                valueIndex += place.width;
                part.strings = place.strings;
                //we add null as placeholders to align with values
                if (place.width > 1) {
                    part.width = place.width;
                    for (let i = 1; i < place.width; i++) {
                        this.parts.push(null);
                    }
                }
                //like `:ref="name"`
                if (place.width > 0) {
                    this.parts.push(part);
                }
            }
        }
        this.renderFragment(fragment);
    }
    mergePart(part, values) {
        switch (part.type) {
            case types_1.PartType.Child:
            case types_1.PartType.MayAttr:
            case types_1.PartType.Event:
                part.update(values[0]);
                break;
            default:
                part.update(template_1.join(part.strings, values));
        }
    }
    cleanTemplate() {
        this.parts = [];
    }
}
class RootPart extends RootChildShared {
    constructor(el, value, context) {
        super(context);
        this.width = 1;
        this.type = types_1.PartType.Root;
        this.strings = null;
        this.el = el;
        this.update(value);
    }
    renderText(text) {
        this.el.textContent = text;
    }
    renderFragment(fragment) {
        while (this.el.firstChild) {
            this.el.firstChild.remove();
        }
        this.el.append(fragment);
    }
}
exports.RootPart = RootPart;
class ChildPart extends RootChildShared {
    constructor(comment, value, context) {
        super(context);
        this.type = types_1.PartType.Child;
        this.width = 1;
        this.strings = null;
        this.els = null;
        this.comment = comment;
        this.parentNode = comment.parentNode;
        this.update(value);
    }
    renderText(text) {
        if (this.els && this.els.length === 1 && this.els[0].nodeType === 3) {
            this.els[0].textContent = text;
        }
        else {
            let fragment = document.createDocumentFragment();
            fragment.textContent = text;
            this.renderFragment(fragment);
        }
    }
    renderFragment(fragment) {
        let els = [...fragment.childNodes];
        if (els.length) {
            if (this.els) {
                this.parentNode.insertBefore(fragment, this.els[0]);
                this.els.forEach(el => el.remove());
            }
            else {
                this.comment.replaceWith(fragment);
            }
        }
        else {
            this.restoreComment();
        }
        this.els = els.length ? els : null;
    }
    restoreComment() {
        if (this.els) {
            this.parentNode.insertBefore(this.comment, this.els[0]);
            this.els.forEach(el => el.remove());
        }
    }
}
exports.ChildPart = ChildPart;
},{"../template":23,"./attr":13,"./bind":14,"./event":15,"./may-attr":17,"./part-parser":18,"./property":19,"./types":21}],21:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var PartType;
(function (PartType) {
    PartType[PartType["Root"] = 0] = "Root";
    PartType[PartType["Child"] = 1] = "Child";
    PartType[PartType["Attr"] = 2] = "Attr";
    PartType[PartType["MayAttr"] = 3] = "MayAttr";
    PartType[PartType["Property"] = 4] = "Property";
    PartType[PartType["Bind"] = 5] = "Bind";
    PartType[PartType["Event"] = 6] = "Event";
})(PartType = exports.PartType || (exports.PartType = {}));
},{}],22:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const component_1 = require("./component");
function render(htmlCodes, options, target) {
    let template = document.createElement('template');
    template.innerHTML = clearWhiteSpaces(htmlCodes);
    if (options instanceof HTMLElement) {
        target = options;
        options = null;
    }
    if (options) {
        let fragment = template.content;
        if (fragment.children.length > 1) {
            throw new Error('Only one element is allowed when "render" an component');
        }
        if (!fragment.firstElementChild) {
            throw new Error('One element is required when "render" an component');
        }
        let tagName = fragment.firstElementChild.localName;
        let Com = component_1.getComponentConstructor(tagName);
        if (!Com) {
            throw new Error(`"${tagName}" is not defined as an component`);
        }
        new Com(fragment.firstElementChild, options);
    }
    if (target) {
        target.append(template.content);
    }
    return template.content;
}
exports.render = render;
function clearWhiteSpaces(htmlCodes) {
    return htmlCodes.trimLeft().replace(/>[ \t\r\n]+/g, '>');
}
},{"./component":10}],23:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function html(strings, ...values) {
    return new Template('html', strings, values);
}
exports.html = html;
function svg(strings, ...values) {
    return new Template('svg', strings, values);
}
exports.svg = svg;
function css(strings, ...values) {
    return new Template('css', strings, values);
}
exports.css = css;
function text(strings, ...values) {
    return new Template('text', strings, values);
}
exports.text = text;
function join(strings, values) {
    if (!strings) {
        return values[0];
    }
    let text = strings[0];
    for (let i = 0; i < strings.length - 1; i++) {
        let value = values[i];
        text += value === null || value === undefined ? '' : String(value);
        text += strings[i + 1];
    }
    return text;
}
exports.join = join;
class Template {
    constructor(type, strings, values) {
        this.type = type;
        this.strings = strings;
        this.values = values;
    }
    compareType(t) {
        return this.type === t.type;
    }
    compareStrings(t) {
        if (this.strings.length !== t.strings.length) {
            return false;
        }
        for (let i = 0; i < this.strings.length; i++) {
            if (this.strings[i] !== t.strings[i]) {
                return false;
            }
        }
        return true;
    }
    compareValues(t) {
        let diff = [];
        for (let i = 0; i < this.values.length; i++) {
            if (this.values[i] !== t.values[i]) {
                diff.push(i);
            }
        }
        return diff.length > 0 ? diff : null;
    }
}
exports.Template = Template;
},{}]},{},[1])
//# sourceMappingURL=bundle.js.map
