


//run directive type of watcher, then user created watcher, then task
const queues = {

	started: null,

	flushing: false,

	watchers: [],

	watcherMap: {},

	watcherDepsTree: {},	//watcher id => id of watcher which started it 

	observers: [],

	observerMap: {},

	arrayObservers: [],

	arrayObserverMap: {},

	innerTasks: [],

	userTasks: [],

	step: 0,


	addWatcher (watcher) {
		if (this.updatingWatcher) {
			if (this.checkWatcherCirculation(watcher)) {
				return
			}
		}

		let {watchers} = this
		let {id} = watcher

		if (!watcher.vm._inactiveState && !this.watcherMap[id]) {
			if (this.step === 1) {
				this.binaryInsert(watchers, watcher)
			}
			else {
				watchers.push(watcher)
				this.startDeferredFlushingIfNot()
			}

			this.watcherMap[id] = true
		}
	},


	binaryInsert (items, item) {
		let index = this.getBinaryInsertIndex(items, item)
		items.splice(index, 0, item)
	},


	getBinaryInsertIndex (watchers, watcher) {
		let {id} = watcher
		let len = watchers.length

		if (len === 0) {
			return 0
		}

		let startId = watchers[0].id
		if (id < startId) {
			return 0
		}

		if (len === 1) {
			return 1
		}

		let endId = watchers[len - 1].id
		if (id > endId) {
			return len
		}

		let start = 0
		let end = len - 1

		while (end - start > 1) {
			let center = Math.floor((end + start) / 2)
			let centerId = watchers[center].id

			if (id < centerId) {
				end = center
			}
			else {
				start = center
			}
		}

		return end
	},


	checkWatcherCirculation (watcher) {
		let {updatingWatcher, watcherDepsTree} = this
		let {id} = watcher
		let depWatcher = updatingWatcher
		let isInCirculation = false

		do {
			if (depWatcher.id === id) {
				isInCirculation = true
				break
			}

			depWatcher = watcherDepsTree[depWatcher.id]
		}
		while (depWatcher)

		if (isInCirculation) {
			let depWatcher = updatingWatcher
			let watchers = [watcher]

			do {
				watchers.unshift(depWatcher)

				if (depWatcher.id === id) {
					break
				}

				depWatcher = watcherDepsTree[depWatcher.id]
			}
			while (depWatcher)

			let expChain = watchers.map(v => v.exp).join(' -> ')
			console.warn(`Watchers "${expChain}" is updating circularly`)

			return true
		}
		else {
			watcherDepsTree[id] = updatingWatcher
			return false
		}
	},


	addObserver (observer) {
		let {observers} = this
		let {id} = observer

		if (!this.observerMap[id]) {
			if (this.step === 2) {
				this.binaryInsert(observers, observer)
			}
			else {
				observers.push(observer)
				this.startDeferredFlushingIfNot()
			}

			this.observerMap[id] = true
		}
	},


	addArrayObserver (observer) {
		let {arrayObservers} = this
		let {id} = observer

		if (!this.arrayObserverMap[id]) {
			if (this.step > 0) {
				observer.updateArrayWatchers()
			}
			else {
				arrayObservers.push(observer)
				this.startDeferredFlushingIfNot()
			}

			this.arrayObserverMap[id] = true
		}
	},


	//used to update like transition properties, or model value overwrite before user task
	//it should never change any datas which have been observed
	pushInnerTask (fn, ...args) {
		this.innerTasks.push({
			fn,
			args,
		})

		this.startDeferredFlushingIfNot()
	},


	pushUserTask (fn, ...args) {
		this.userTasks.push({
			fn,
			args,
		})

		this.startDeferredFlushingIfNot()
	},


	startDeferredFlushingIfNot () {
		if (!this.started) {
			Promise.resolve().then(() => this.doFlushing())
			this.started = true
		}
	},


	doFlushing () {
		let {watchers, observers, arrayObservers, userTasks, innerTasks} = this

		this.flushing = true

		if (arrayObservers.length > 0) {
			this.runArrayObservers()
		}

		this.step = 1
		if (watchers.length > 0) {
			this.runWatchers()
		}

		this.step = 2
		if (observers.length > 0) {
			this.runObservers()
		}

		this.step = 3

		if (innerTasks.length > 0) {
			this.runInnerTasks()
		}

		if (userTasks.length) {
			this.runUserTasks()
		}

		this.step = 0
		this.watcherDepsTree = {}
		this.started = false
		this.flushing = false
	},


	runWatchers () {
		let {watchers, watcherMap} = this

		watchers.sort((v1, v2) => v1.id - v2.id)

		while (watchers.length > 0) {
			let watcher = watchers.shift()
			let {vm, id} = watcher

			if (!vm._destroyed && (!vm._inactiveState || watcher.updateEvenVMInactive)) {
				this.updatingWatcher = watcher
				watcher.updateNow()
			}

			delete watcherMap[id]
		}

		this.updatingWatcher = null
	},


	runObservers () {
		let {watchers, observers, observerMap} = this

		observers.sort((v1, v2) => v1.id - v2.id)

		//must behind directive watchers, because should handle f-for data changes firstly, and then handle its partly observer changes
		while (observers.length > 0) {
			let observer = observers.shift()
			observer.flush()
			delete observerMap[observer.id]

			if (watchers.length > 0) {
				this.runWatchers()
			}
		}
	},


	runArrayObservers () {
		let {arrayObservers, arrayObserverMap} = this

		arrayObservers.sort((v1, v2) => v1.id - v2.id)

		//must behind directive watchers, because should handle f-for data changes firstly, and then handle its partly observer changes
		while (arrayObservers.length > 0) {
			let observer = arrayObservers.shift()
			observer.updateArrayWatchers()
			delete arrayObserverMap[observer.id]
		}
	},


	runInnerTasks () {
		let {innerTasks} = this

		while (innerTasks.length > 0) {
			let {fn, args} = innerTasks.shift()
			fn(...args)
		}
	},


	runUserTasks () {
		let {userTasks, watchers, observers, innerTasks} = this

		while (userTasks.length > 0) {
			let {fn, args} = userTasks.shift()

			try {
				fn(...args)
			}
			catch (err) {
				console.warn(err)
			}

			if (watchers.length > 0) {
				this.runWatchers()
			}

			if (observers.length > 0) {
				this.runObservers()
			}

			if (innerTasks.length > 0) {
				this.runInnerTasks()
			}
		}
	},
}
