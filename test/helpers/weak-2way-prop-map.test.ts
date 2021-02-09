import {Weak2WayPropMap} from '../../src/helpers/weak-2way-prop-map'


describe('Test Weak2WayPropMap', () => {
	let m: Weak2WayPropMap<any, any> = new Weak2WayPropMap()
	let a = {}
	let b = {}
	let c = {}

	m.updateFromLeft(a, new Map([[b, new Set(['e', 'f'])]]))

	it('Test get', () => {
		expect([...m.getFromRight(b, 'e')!]).toEqual([a])
		expect([...m.getFromRight(b, 'f')!]).toEqual([a])
		expect(m.getFromRight(b, 'g')).toEqual(undefined)
	})

	it('Test update', () => {
		m.updateFromLeft(a, new Map([[c, new Set(['e', 'f'])]]))

		expect([...m.getFromRight(b, 'e')!]).toEqual([])
		expect([...m.getFromRight(b, 'f')!]).toEqual([])
		expect([...m.getFromRight(c, 'e')!]).toEqual([a])
	})

	it('Test clear', () => {
		m.clearFromLeft(a)

		expect([...m.getFromRight(b, 'e')!]).toEqual([])
		expect([...m.getFromRight(b, 'f')!]).toEqual([])
	})
})