

// //recycle empty map after watcher removed from observer
// let observerWatcherMapWillBeRecycled = {}

// function willRecycleEmptyMapOnObserver(observer, name) {
// 	observerWatcherMapWillBeRecycled[observer.id + '_' + name] = observer
// }

// function recycleEmptyMap() {
// 	for (let key in observerWatcherMapWillBeRecycled) {
// 		let watcherMap = observerWatcherMapWillBeRecycled[key].watcherMap
// 		let name = key.slice(key.indexOf('_') + 1)
// 		let map = watcherMap[name]

// 		if (util.isEmptyObject(map)) {
// 			delete watcherMap[name]
// 		}
// 	}

// 	observerWatcherMapWillBeRecycled = {}
// 	recycleEmptyMapLater()
// }

// function recycleEmptyMapLater() {
// 	setTimeout (function () {
// 		typeof requestIdleCallback === 'function' ? requestIdleCallback(recycleEmptyMap) : recycleEmptyMap()
// 	}, 10000)
// }

// recycleEmptyMapLater()



// //used to collect watchers and trigger changes on object and array
// const observerSymbol = Symbol('observer')
// const arrayProto = Array.prototype

// const Observer = function Observer(obj) {
// 	this.changes = []
// 	this.events = []
// 	this.watcherMap = {}
// 	this.id = Observer.seed++

// 	if (Array.isArray(obj)) {
// 		this.startIndex = Infinity
// 		Object.defineProperties(obj, Observer.arrayMethodsOverwrite)
// 	}

// 	obj[observerSymbol] = this
// 	this.target = obj
// }

// Observer.seed = 1

// Observer.arrayMethodsOverwrite = {

// 	push: {
// 		value (...args) {
// 			let observer = this[observerSymbol]
// 			let target = this[targetSymbol] || this
// 			let startIndex = target.length
// 			let returns = arrayProto.push.call(target, ...args)

// 			observer.onArrayChange(startIndex)
// 			return returns
// 		},
// 	},

// 	pop: {
// 		value (...args) {
// 			let observer = this[observerSymbol]
// 			let target = this[targetSymbol] || this
// 			let returns = arrayProto.pop.call(target, ...args)
// 			let startIndex = target.length

// 			observer.onArrayChange(startIndex)
// 			return returns
// 		},
// 	},

// 	unshift: {
// 		value (...args) {
// 			let observer = this[observerSymbol]
// 			let target = this[targetSymbol] || this
// 			let returns = arrayProto.unshift.call(target, ...args)

// 			observer.onArrayChange(0)
// 			return returns
// 		},
// 	},

// 	splice: {
// 		value (...args) {
// 			let observer = this[observerSymbol]
// 			let target = this[targetSymbol] || this
// 			let startIndex = args[0]
// 			let returns = arrayProto.splice.call(target, ...args)

// 			observer.onArrayChange(startIndex)
// 			return returns
// 		},
// 	},

// 	shift: {
// 		value (...args) {
// 			let observer = this[observerSymbol]
// 			let target = this[targetSymbol] || this
// 			let returns = arrayProto.shift.call(target, ...args)

// 			observer.onArrayChange(0)
// 			return returns
// 		},
// 	},

// 	sort: {
// 		value (...args) {
// 			let observer = this[observerSymbol]
// 			let target = this[targetSymbol] || this
// 			let returns = arrayProto.sort.call(target, ...args)

// 			observer.onArrayChange(0)
// 			return returns
// 		},
// 	},
// }


// Observer.prototype = {

// 	addWatcher (name, watcher) {
// 		let observer = this
// 		let {target} = this

// 		if (!target.hasOwnProperty(name) && target._inherit) {
// 			observer = this.findObserverHasOwnProperty(name)
// 		}

// 		let {watcherMap} = observer
// 		let map = watcherMap[name]

// 		if (!map) {
// 			map = watcherMap[name] = {}
// 		}

// 		map[watcher.id] = watcher
// 		watcher.addDep(name, observer)
// 	},


// 	findObserverHasOwnProperty (name) {
// 		let vm = this.target

// 		do {
// 			vm = vm._parent._readScope
// 		}
// 		while (vm && vm._inherit && !vm.hasOwnProperty(name))

// 		if (!vm) {
// 			vm = this.target._writeScope
// 		}

// 		return vm[observerSymbol]
// 	},


// 	removeWatcher (name, watcher) {
// 		let {watcherMap} = this
// 		let map = watcherMap[name]

// 		delete map[watcher.id]

// 		willRecycleEmptyMapOnObserver(this, name)
// 	},


// 	onObjectChange (name) {
// 		let {watcherMap} = this
// 		let map = watcherMap[name]

// 		if (map) {
// 			for (let id in map) {
// 				map[id].update()
// 			}
// 		}

// 		if (this.events.length > 0) {
// 			queues.addObserver(this)
// 		}
// 	},


// 	onArrayChange (startIndex) {
// 		//we need to handle watcher maps according to flush observer
// 		queues.addArrayObserver(this)

// 		if (this.events.length > 0) {
// 			queues.addObserver(this)
// 		}
// 	},


// 	addHandler (handler, scope) {
// 		this.events.push({
// 			handler,
// 			scope,
// 		})
// 	},


// 	removeHandler (handler, scope) {
// 		let {events} = this

// 		for (let i = events.length - 1; i >= 0; i--) {
// 			let event = events[i]
// 			if (event.handler === handler && event.scope === scope) {
// 				events.splice(i, 1)
// 				break
// 			}
// 		}
// 	},


// 	updateArrayWatchers () {
// 		let {watcherMap, startIndex} = this

// 		for (let name in watcherMap) {
// 			if (name === 'length' || name >= startIndex) {
// 				let map = watcherMap[name]
// 				for (let id in map) {
// 					map[id].update()
// 				}
// 			}
// 		}

// 		this.startIndex = Infinity
// 	},


// 	flush () {
// 		let {events} = this

// 		for (let i = 0, len = events.length; i < len; i++) {
// 			let event = this.events[i]

// 			try {
// 				event.handler.call(event.scope, this.target)
// 			}
// 			catch (err) {
// 				console.warn(err)
// 			}
// 		}
// 	},
// }



// //proxy is used to capture get and set operators, and generate a dependency tree
// //when set operator called, it will trigger all related watchers which run in getting process
// //May Object.observe and Array.observe's soul rest in peace
// const proxySymbol = Symbol('proxy')
// const targetSymbol = Symbol('target')

// const observerManager = {

// 	observe (obj) {
// 		return this.createProxy(obj)
// 	},


// 	observeIfNot (obj) {
// 		let proxy = obj[proxySymbol]
// 		if (proxy) {
// 			return proxy
// 		}

// 		return this.createProxy(obj)
// 	},


// 	createProxy (obj) {
// 		let observer = new Observer(obj)

// 		let proxy = new Proxy(obj, {

// 			get (obj, name) {
// 				// uncomment this would make getter been listened, but I don't think getter is good enough in readability and intelligibility
// 				// let descriptor = util.getPropertyDescriptor(obj, name)
// 				// if (descriptor && descriptor.get) {
// 				// 	return descriptor.get.call(proxy)
// 				// }

// 				let value = obj[name]

// 				if (typeof name === 'symbol') {
// 					return value
// 				}

// 				let type = typeof value

// 				if (type === 'function') {
// 					return value
// 				}

// 				let runningWatcher = Watcher.running

// 				if (type === 'object' && value !== null) {
// 					let subProxy = value[proxySymbol]
// 					if (subProxy) {
// 						value = subProxy
// 					}
// 					else if (runningWatcher) {
// 						let str = util.toString.call(value)
// 						if (str === '[object Object]' || str === '[object Array]') {
// 							value = observerManager.observe(value)
// 						}
// 					}
// 				}

// 				if (runningWatcher) {
// 					observer.addWatcher(name, runningWatcher)
// 				}

// 				return value
// 			},

// 			//can't get old length using obj.length from array
// 			//set array[index] will not cause length change, so never do it
// 			//add a property to obj will not cause JSON.stringify(obj) watcher triggerred
// 			set (obj, name, value) {
// 				if (typeof name === 'symbol') {
// 					obj[name] = value
// 				}
// 				else {
// 					let oldValue = obj[name]

// 					if (oldValue !== value || Array.isArray(obj) && name === 'length') {
// 						obj[name] = value
// 						observer.onObjectChange(name)
// 					}
// 				}

// 				return true
// 			},

// 			has (obj, name) {
// 				if (typeof name !== 'symbol' && Watcher.running) {
// 					observer.addWatcher(name, Watcher.running)
// 				}

// 				return name in obj
// 			},

// 			deleteProperty (obj, name) {
// 				if (obj.hasOwnProperty(name)) {
// 					if (typeof name !== 'symbol') {
// 						observer.onObjectChange(name)
// 					}

// 					return delete obj[name]
// 				}
// 				else {
// 					return true
// 				}
// 			},

// 			//not available currently, it will affect the watching for JSON.stringify(obj)
// 			// ownKeys (obj) {

// 			// },
// 		})

// 		obj[proxySymbol] = proxy
// 		obj[targetSymbol] = obj

// 		return proxy
// 	},


// 	observeChanges (obj, handler, scope) {
// 		let observer = obj[observerSymbol] || new Observer(obj)
// 		observer.addHandler(handler, scope)
// 	},


// 	unobserveChanges (obj, handler, scope) {
// 		let observer = obj[observerSymbol]
// 		if (observer) {
// 			observer.removeHandler(handler, scope)
// 		}
// 	},
// }
