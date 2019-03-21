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
		
		${this.pie ? src_1.html `<lazy-element a="b"></lazy-element>` : ''}
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
var template_result_1 = require("./lib/template-result");
exports.html = template_result_1.html;
exports.css = template_result_1.css;
exports.svg = template_result_1.svg;
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
},{"./lib/binds":5,"./lib/component":10,"./lib/element":11,"./lib/emitter":12,"./lib/render":24,"./lib/template-result":25}],3:[function(require,module,exports){
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
function getBindedClass(name) {
    return defineMap.get(name);
}
exports.getBindedClass = getBindedClass;
},{}],5:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var define_1 = require("./define");
exports.defineBind = define_1.defineBind;
exports.getBindedClass = define_1.getBindedClass;
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
/**
 * Define a component with specified name and class, called by `define()`.
 * @param name The component name, same with `define()`.
 * @param Com The component class.
 */
function defineComponent(name, Com) {
    componentMap.set(name, Com);
}
exports.defineComponent = defineComponent;
/**
 * Get component constructor from name, then we can instantiate it.
 * @param name The component name, same with `define()`.
 * @param Com The component class.
 */
function getComponentConstructor(name) {
    return componentMap.get(name);
}
exports.getComponentConstructor = getComponentConstructor;
const elementComponentMap = new WeakMap();
/**
 * Get component instance from root element.
 * @param el The element to get component instance at.
 */
function getComponentAt(el) {
    return elementComponentMap.get(el);
}
exports.getComponentAt = getComponentAt;
const componentCreatedMap = new WeakMap();
/**
 * Call callback after component instance created.
 * @param el The element which will create instance at.
 */
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
/**
 * The abstract component class, you can instantiate it from just create an element, or call `render()` if you want to config it.
 */
class Component extends emitter_1.Emitter {
    constructor(el, options) {
        super();
        this._node = null;
        this.el = el;
        Object.assign(this, options);
        elementComponentMap.set(el, this);
        emitComponentCreated(el, this);
        //TODO
        Promise.resolve().then(() => {
            this.update();
        });
    }
    /**
     * Call this to check if need to update the rendering and partial update if needed.
     * You should not overwrite this method until you know what you are doing.
     */
    update() {
        let value = this.render();
        if (this._node) {
            this._node.update(value);
        }
        else {
            this._node = new parts_1.RootPart(this.el, value, this);
        }
    }
    /**
     * Called when root element inserted into document.
     */
    onConnected() { }
    /**
     * Called when root element removed from document.
     * If you registered global listeners, don't forget to remove it here.
     */
    onDisconnected() { }
}
exports.Component = Component;
},{"./emitter":12,"./parts":17}],11:[function(require,module,exports){
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
/**
 * attr="${...}"
 */
class AttrPart {
    constructor(el, name, value) {
        this.type = types_1.PartType.Attr;
        this.strings = null;
        this.el = el;
        this.name = name;
        this.setValue(value);
    }
    setValue(value) {
        value === null || value === undefined ? '' : String(value);
        this.el.setAttribute(this.name, value);
    }
    update(value) {
        this.setValue(value);
    }
}
exports.AttrPart = AttrPart;
},{"./types":23}],14:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("./types");
const binds_1 = require("../binds");
/**
 * Transfer arguments to binds module.
 * :class="${...}", :style="${...}", :props="${...}"
 */
class BindPart {
    constructor(el, name, value, context) {
        this.type = types_1.PartType.Bind;
        this.strings = null;
        let dotIndex = name.indexOf('.');
        let bindName = dotIndex > -1 ? name.slice(0, dotIndex) : name;
        let bindModifiers = dotIndex > -1 ? name.slice(dotIndex + 1).split('.') : null;
        let BindedClass = binds_1.getBindedClass(bindName);
        if (!BindedClass) {
            throw new Error(`"${bindName}" is not a binded class`);
        }
        this.bind = new BindedClass(el, value, bindModifiers, context);
    }
    update(value) {
        this.bind.update(value);
    }
}
exports.BindPart = BindPart;
},{"../binds":5,"./types":23}],15:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const template_result_1 = require("../template-result");
const types_1 = require("./types");
const template_1 = require("./template");
class ChildPart {
    constructor(comment, value, context) {
        this.type = types_1.PartType.Child;
        this.templates = null;
        this.textNode = null;
        this.context = context;
        this.comment = comment;
        this.update(value);
    }
    update(value) {
        if (value instanceof template_result_1.TemplateResult) {
            value = [value];
        }
        if (Array.isArray(value)) {
            this.becomeTemplateResults(value);
        }
        if (this.templates) {
            if (Array.isArray(value)) {
                this.mergeTemplates(value);
            }
            else {
                for (let template of this.templates) {
                    template.remove();
                }
                this.templates = null;
                this.renderText(value);
            }
        }
        else {
            if (Array.isArray(value)) {
                this.restoreComment();
                this.templates = [];
                this.mergeTemplates(value);
            }
            else {
                this.renderText(value);
            }
        }
    }
    becomeTemplateResults(array) {
        for (let i = 0; i < array.length; i++) {
            if (!(array[i] instanceof template_result_1.TemplateResult)) {
                array[i] = template_result_1.text `${array[i]}`;
            }
        }
        return array;
    }
    mergeTemplates(results) {
        let templates = this.templates;
        if (templates.length > 0 && results.length > 0) {
            for (let i = 0; i < templates.length && i < results.length; i++) {
                let template = templates[i];
                let result = results[i];
                if (template.canMergeWith(result)) {
                    template.merge(result);
                }
                else {
                    let newTemplate = new template_1.Template(result, this.context);
                    template.replaceWithFragment(newTemplate.parse());
                    templates[i] = newTemplate;
                }
            }
        }
        if (results.length < templates.length) {
            for (let i = results.length; i < templates.length; i++) {
                let template = templates[i];
                template.remove();
            }
        }
        else if (templates.length < results.length) {
            for (let i = templates.length; i < results.length; i++) {
                let template = new template_1.Template(results[i], this.context);
                this.renderFragment(template.parse());
                this.templates.push(template);
            }
        }
    }
    renderFragment(fragment) {
        this.comment.before(fragment);
    }
    renderText(value) {
        let text = value === null || value === undefined ? '' : String(value).trim();
        if (text) {
            if (!this.textNode) {
                this.textNode = document.createTextNode(text);
                this.comment.replaceWith(this.textNode);
            }
            else {
                this.textNode.textContent = text;
                if (!this.textNode.parentNode) {
                    this.comment.replaceWith(this.textNode);
                }
            }
        }
        else {
            if (this.textNode) {
                this.textNode.textContent = '';
            }
        }
    }
    restoreComment() {
        if (this.textNode && this.textNode.parentNode) {
            this.textNode.replaceWith(this.comment);
        }
    }
    remove() {
        if (this.templates) {
            this.templates.forEach(template => template.remove());
        }
        if (this.comment && this.comment.parentNode) {
            this.comment.remove();
        }
        if (this.textNode && this.textNode.parentNode) {
            this.textNode.remove();
        }
    }
}
exports.ChildPart = ChildPart;
},{"../template-result":25,"./template":22,"./types":23}],16:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const component_1 = require("../component");
const types_1 = require("./types");
/**
 * <component-name @custom-event="${this.onAny}">
 * <div @click="${this.onClick}">
 */
class EventPart {
    constructor(el, name, handler, context) {
        this.type = types_1.PartType.Event;
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
},{"../component":10,"./types":23}],17:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var root_1 = require("./root");
exports.RootPart = root_1.RootPart;
},{"./root":20}],18:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("./types");
/**
 * ?checked="${...}", remove the attribute if expression returns false.
 */
class MayAttrPart {
    constructor(el, name, value) {
        this.type = types_1.PartType.MayAttr;
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
},{"./types":23}],19:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("./types");
/**
 * .property="${...}", which will be assigned by `element.property = value`.
 */
class PropertyPart {
    constructor(el, name, value) {
        this.type = types_1.PartType.Property;
        this.strings = null;
        this.el = el;
        this.name = name;
        this.setValue(value);
    }
    setValue(value) {
        this.el[this.name] = value;
    }
    update(value) {
        this.setValue(value);
    }
}
exports.PropertyPart = PropertyPart;
},{"./types":23}],20:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const template_result_1 = require("../template-result");
const template_1 = require("./template");
const types_1 = require("./types");
class RootPart {
    constructor(el, value, context) {
        this.type = types_1.PartType.Root;
        this.template = null;
        this.el = el;
        this.context = context;
        this.update(value);
    }
    update(value) {
        if (this.template) {
            if (value instanceof template_result_1.TemplateResult) {
                if (this.template.canMergeWith(value)) {
                    this.template.merge(value);
                }
                else {
                    this.template.remove();
                    this.createTemplateAndRender(value);
                }
            }
        }
        else {
            if (value instanceof template_result_1.TemplateResult) {
                this.createTemplateAndRender(value);
            }
            else {
                this.renderText(value);
            }
        }
    }
    createTemplateAndRender(result) {
        this.template = new template_1.Template(result, this.context);
        this.renderFragment(this.template.parse());
    }
    renderFragment(fragment) {
        while (this.el.firstChild) {
            this.el.firstChild.remove();
        }
        this.el.append(fragment);
    }
    renderText(value) {
        let text = value === null || value === undefined ? '' : String(value).trim();
        this.el.textContent = text;
    }
}
exports.RootPart = RootPart;
},{"../template-result":25,"./template":22,"./types":23}],21:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("./types");
const parseResultMap = new Map();
const VALUE_MARKER = '${flit}';
/**
 * Parse template strings to an fragment and interlations and their related nodes.
 * Always prepend a comment in the front to mark current template start position.
 * @param type
 * @param strings
 */
function parse(type, strings) {
    if (type === 'html' || type === 'svg') {
        let string = strings.join(VALUE_MARKER);
        let sharedResult = parseResultMap.get(string);
        if (!sharedResult) {
            sharedResult = new ElementParser(type, string).parse();
            parseResultMap.set(string, sharedResult);
        }
        return cloneParseResult(sharedResult);
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
        this.nodeIndex = 1;
        this.places = [];
        this.nodeIndexs = [];
        this.type = type;
        this.string = string;
    }
    //Benchmark: https://jsperf.com/regexp-exec-match-replace-speed
    parse() {
        const tagRE = /<!--[\s\S]*?-->|<(\w+)([\s\S]*?)>|<\/\w+>/g;
        let codes = '<!---->';
        let lastIndex = 0;
        let isFirstTag = false;
        let svgWrapped = false;
        let match;
        while (match = tagRE.exec(this.string)) {
            let code = match[0];
            codes += this.parseText(this.string.slice(lastIndex, tagRE.lastIndex - code.length));
            lastIndex = tagRE.lastIndex;
            //ignore existed comment nodes
            if (code[1] === '!') {
                continue;
            }
            else if (code[1] === '/') {
                codes += code;
                continue;
            }
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
            this.nodeIndex++;
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
                    nodeIndex: this.nodeIndex,
                    placeable: true,
                });
                this.nodeIndexs.push(this.nodeIndex);
                this.nodeIndex += 1;
            }
        }
        return text;
    }
    parseAttribute(attr) {
        const attrRE = /(\S+)\s*=\s*(".*?"|'.*?'|\$\{flit\})\s*/g;
        return attr.replace(attrRE, (m0, name, value) => {
            let type = undefined;
            let markerIndex = value.indexOf(VALUE_MARKER);
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
            if (type === undefined && markerIndex > -1) {
                type = types_1.PartType.Attr;
            }
            if (markerIndex > -1 && value.slice(markerIndex + VALUE_MARKER.length).includes(VALUE_MARKER)) {
                throw new Error(`Only one "\${...}" is allowed in one attribute value`);
            }
            if (type !== undefined) {
                if (value[0] === '\'' || value[0] === '"') {
                    value = value.slice(1, -1);
                }
                let strings = value === VALUE_MARKER || type === types_1.PartType.MayAttr || type === types_1.PartType.Event ? null
                    : markerIndex > -1 ? value.split(VALUE_MARKER)
                        : [value];
                this.places.push({
                    type,
                    name,
                    strings,
                    nodeIndex: this.nodeIndex,
                    placeable: markerIndex > -1
                });
                this.nodeIndexs.push(this.nodeIndex);
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
/**
 * Clone the result fragment and link it with node indexes from the parsed result.
 */
//TreeWalker Benchmark: https://jsperf.com/treewalker-vs-nodeiterator
//Clone benchmark: https://jsperf.com/clonenode-vs-importnode
function cloneParseResult(sharedResult) {
    let { template, valuePlaces } = sharedResult;
    let fragment = template.content.cloneNode(true);
    let nodeIndex = 0;
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
},{"./types":23}],22:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("./types");
const template_parser_1 = require("./template-parser");
const child_1 = require("./child");
const may_attr_1 = require("./may-attr");
const event_1 = require("./event");
const attr_1 = require("./attr");
const bind_1 = require("./bind");
const property_1 = require("./property");
class Template {
    constructor(result, context) {
        this.comment = null;
        this.parts = [];
        this.notInPartsNodes = null;
        this.result = result;
        this.context = context;
    }
    /**
     * Compare if two template result can be merged.
     */
    canMergeWith(result) {
        if (this.result.type !== result.type) {
            return false;
        }
        if (this.result.strings.length !== result.strings.length) {
            return false;
        }
        for (let i = 0; i < this.result.strings.length; i++) {
            if (this.result.strings[i] !== result.strings[i]) {
                return false;
            }
        }
        return true;
    }
    /**
     * Merge with another template result.
     * @param result The template result to merge
     */
    merge(result) {
        let diffs = this.compareValues(result);
        if (!diffs) {
            return;
        }
        for (let i = 0; i < diffs.length; i++) {
            let index = diffs[i];
            this.mergePart(this.parts[index], result.values[index]);
        }
        this.result = result;
    }
    /**
     * Compare value difference and then merge them later.
     */
    compareValues(result) {
        let diff = [];
        for (let i = 0; i < this.result.values.length; i++) {
            if (this.result.values[i] !== result.values[i]) {
                diff.push(i);
            }
        }
        return diff.length > 0 ? diff : null;
    }
    /**
     * Parse template result and returns a fragment
     */
    parse() {
        let { fragment, nodesInPlaces, places } = template_parser_1.parse(this.result.type, this.result.strings);
        let values = this.result.values;
        let valueIndex = 0;
        this.comment = fragment.firstChild;
        if (nodesInPlaces) {
            this.notInPartsNodes = [...fragment.childNodes].filter(node => node.nodeType !== 8);
            for (let nodeIndex = 0; nodeIndex < nodesInPlaces.length; nodeIndex++) {
                let node = nodesInPlaces[nodeIndex];
                let place = places[nodeIndex];
                let value = values[valueIndex];
                let part;
                switch (place.type) {
                    case types_1.PartType.Child:
                        part = new child_1.ChildPart(node, value, this.context);
                        break;
                    case types_1.PartType.MayAttr:
                        part = new may_attr_1.MayAttrPart(node, place.name, value);
                        break;
                    case types_1.PartType.Event:
                        part = new event_1.EventPart(node, place.name, value, this.context);
                        break;
                    case types_1.PartType.Attr:
                        part = new attr_1.AttrPart(node, place.name, join(place.strings, value));
                        part.strings = place.strings;
                        break;
                    case types_1.PartType.Bind:
                        part = new bind_1.BindPart(node, place.name, join(place.strings, value), this.context);
                        part.strings = place.strings;
                        break;
                    case types_1.PartType.Property:
                        part = new property_1.PropertyPart(node, place.name, join(place.strings, value));
                        part.strings = place.strings;
                        break;
                }
                if (place.placeable) {
                    valueIndex += place.placeable ? 1 : 0;
                    this.parts.push(part);
                }
            }
        }
        return fragment;
    }
    mergePart(part, value) {
        switch (part.type) {
            case types_1.PartType.Child:
            case types_1.PartType.MayAttr:
            case types_1.PartType.Event:
                part.update(value);
                break;
            default:
                part.update(join(part.strings, value));
        }
    }
    remove() {
        if (this.notInPartsNodes) {
            this.notInPartsNodes.forEach(node => node.remove());
        }
        this.comment.remove();
        for (let part of this.parts) {
            if (part instanceof child_1.ChildPart) {
                part.remove();
            }
        }
    }
    replaceWithFragment(fragment) {
        this.comment.before(fragment);
        this.remove();
    }
}
exports.Template = Template;
function join(strings, ...values) {
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
},{"./attr":13,"./bind":14,"./child":15,"./event":16,"./may-attr":18,"./property":19,"./template-parser":21,"./types":23}],23:[function(require,module,exports){
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
},{}],24:[function(require,module,exports){
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
    return htmlCodes.trimLeft().replace(/>\s+/g, '>');
}
},{"./component":10}],25:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function html(strings, ...values) {
    return new TemplateResult('html', strings, values);
}
exports.html = html;
function svg(strings, ...values) {
    return new TemplateResult('svg', strings, values);
}
exports.svg = svg;
function css(strings, ...values) {
    return new TemplateResult('css', strings, values);
}
exports.css = css;
function text(strings, ...values) {
    return new TemplateResult('text', strings, values);
}
exports.text = text;
/**
 * Created from each html`...` or svg`...`.
 * Every time call `Component.update` will generate a new template result tree.
 * Then we will check if each result can be merged or need to be replaced recursively.
 */
class TemplateResult {
    constructor(type, strings, values) {
        this.type = type;
        this.strings = strings;
        this.values = values;
    }
}
exports.TemplateResult = TemplateResult;
},{}]},{},[1])
//# sourceMappingURL=bundle.js.map
