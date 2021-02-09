import {TwoWayMap} from '../../src/helpers/two-way-map'


describe('Test TwoWayMap', () => {
	let m: TwoWayMap<number, number> = new TwoWayMap()
	m.add(1, 2)
	m.add(2, 3)

	it('Test has', () => {
		expect(m.hasLeft(1)).toEqual(true)
		expect(m.hasLeft(3)).toEqual(false)

		expect(m.hasRight(2)).toEqual(true)
		expect(m.hasRight(4)).toEqual(false)

		expect(m.getSize()).toEqual(2)
	})

	it('Test get', () => {
		expect(m.getFromLeft(1)).toEqual(2)
		expect(m.getFromLeft(3)).toEqual(undefined)

		expect(m.getFromRight(2)).toEqual(1)
		expect(m.getFromRight(4)).toEqual(undefined)
	})

	it('Test getAll', () => {
		expect([...m.getAllLeft()]).toEqual([1, 2])
		expect([...m.getAllRight()]).toEqual([2, 3])
	})

	it('Test delete', () => {
		expect(m.deleteFromLeft(1)).toEqual(true)
		expect(m.hasLeft(1)).toEqual(false)

		expect(m.deleteFromRight(3)).toEqual(true)
		expect(m.hasRight(3)).toEqual(false)

		expect(m.deleteFromLeft(3)).toEqual(false)

		expect(m.getSize()).toEqual(0)
	})
})