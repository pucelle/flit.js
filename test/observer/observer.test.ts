import {observe, observeComTarget, startUpdating, endUpdating, clearDependenciesOf, observeGetting} from '../../src/observer/index'


describe('Test observer', () => {
	let a = observeComTarget({p: true, update: jest.fn()})
	let b = observeComTarget({p: true, update: jest.fn()})
	let c = observe({p: true})
	let d = observe({_p: true, get p() {return this._p}})


	it('Test dependencies', () => {
		startUpdating(a)
		b.p
		c.p
		endUpdating(a)

		b.p = false
		c.p = false
		expect(a.update).toBeCalledTimes(2)
	})

	it('Test update dependencies', () => {
		startUpdating(a)
		b.p
		endUpdating(a)

		b.p = false
		c.p = false
		expect(a.update).toBeCalledTimes(3)
	})

	it('Test clear dependencies', () => {
		clearDependenciesOf(a)

		b.p = false
		c.p = false
		expect(a.update).toBeCalledTimes(3)
	})

	it('Test observeGetter', () => {
		startUpdating(a)
		observeGetting(d, 'p')
		endUpdating(a)
		
		d._p = false
		expect(a.update).toBeCalledTimes(4)
	})
})