import * as flit from '../../out'


describe('Test TemplateResult', () => {
	it('Should generate right template result', () => {
		let value = 100
		let tem = flit.html`abc${value}def`

		expect(tem.type).toEqual('html')
		expect(tem.strings).toEqual(['abc', 'def'])
		expect(tem.values).toEqual([100])

		tem = flit.svg`abc${value}def`
		expect(tem.type).toEqual('svg')

		tem = flit.css`abc${value}def`
		expect(tem.type).toEqual('css')
	})
})