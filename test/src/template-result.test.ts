import * as flit from '../..'
const assert = chai.assert


describe('Test template', () => {
	it('should generate template result', () => {
		let value = 100

		let tem = flit.html`abc${value}def`
		assert.deepEqual(tem.type, 'html')
		assert.deepEqual(tem.strings as any, ['abc', 'def'])
		assert.deepEqual(tem.values, [100])

		tem = flit.svg`abc${value}def`
		assert.deepEqual(tem.type, 'svg')

		tem = flit.css`abc${value}def`
		assert.deepEqual(tem.type, 'css')

		tem = flit.text`abc${value}def`
		assert.deepEqual(tem.type, 'text')
	})
})