import {Weak2WayMap} from '../../src/helpers/weak-2way-map'


describe('Test TwoWayMap', () => {
	let m: Weak2WayMap<any, any> = new Weak2WayMap()
	let a = {}
	let b = {}
	let c = {}
	let d = {}

	m.updateFromLeft(a, new Set([b, c]))

	it('Test get', () => {
		expect([...m.getFromRight(b)!]).toEqual([a])
		expect(m.getFromRight(a)).toEqual(undefined)
	})

	it('Test update', () => {
		m.updateFromLeft(a, new Set([d]))

		expect([...m.getFromRight(b)!]).toEqual([])
		expect([...m.getFromRight(c)!]).toEqual([])
		expect([...m.getFromRight(d)!]).toEqual([a])
	})

	it('Test clear', () => {
		m.clearFromLeft(a)

		expect([...m.getFromRight(b)!]).toEqual([])
		expect([...m.getFromRight(c)!]).toEqual([])
	})
})