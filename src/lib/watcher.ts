
//the watcher used to watch a expression and we can 'get' or 'set' a property on a vm
//options include {vm, exp, getter, handler, scope}
function Watcher(options) {
	let isDir = !!options.scope

	ff.assign(this, options)

	this.id = Watcher.seed++
	this.deps = {}

	if (isDir) {
		let {name} = this.scope

		//see comments on 'if'
		this.updateEvenVMInactive = name === 'transition'
		this.updateForceWhenDigest = name === 'bind' || name === 'model'
	}
	else {
		this.scope = this.vm[proxySymbol]
		this.updateEvenVMInactive = false
		this.updateForceWhenDigest = false

		if (!this.getter) {
			this.getter = lexer.compileReader(this.exp)
		}
	}

	this.value = this.get()
}

Watcher.seed = 1
Watcher.running = null

Watcher.prototype = {

	get () {
		let oldDeps = this.deps
		let newDeps = this.deps = {}
		let value

		Watcher.running = this

		try {
			value = this.getter.call(this.vm._readScope[proxySymbol])
		}
		catch (err) {
			console.warn(`Failed to run "${this.exp}" - `, err.stack)
			this.deps = oldDeps
			return this.value
		}

		Watcher.running = null

		for (let key in oldDeps) {
			let oldObserver = oldDeps[key]
			if (!newDeps[key]) {
				let name = key.slice(key.indexOf('_') + 1)
				oldObserver.removeWatcher(name, this)
			}
		}

		return value
	},


	set (value) {
		let {vm} = this
		let setter = lexer.compileWritter(this.exp)

		setter.call(vm[proxySymbol], value)
	},


	update () {
		queues.addWatcher(this)
	},


	//returns needs to update and truly updated
	updateNow (forceDigest) {
		let oldValue = this.value
		let newValue = this.get()

		if (newValue !== oldValue || forceDigest && this.updateForceWhenDigest) {
			this.value = newValue
			this.handler.call(this.scope, newValue, oldValue)
		}
	},


	addDep (name, observer) {
		let key = observer.id + '_' + name
		this.deps[key] = observer
	},


	removeAllDeps () {
		let {deps} = this

		for (let key in deps) {
			let observer = deps[key]
			let name = key.slice(key.indexOf('_') + 1)

			observer.removeWatcher(name, this)
		}
	},


	destroy () {
		this.removeAllDeps()
	},
}