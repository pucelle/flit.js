const gulp = require('gulp')
const browserify = require('browserify')
const source = require('vinyl-source-stream')
const watchify = require('watchify')
const tsify = require('tsify')
const gutil = require('gulp-util')
const glob = require('glob')
const exorcist = require('exorcist')


function bundle(task) {
	let browser = browserify({
		basedir: '.',
		debug: true,
		entries: task.startsWith('test') ? glob.sync(__dirname + '/test/**/*.test.ts') : ['preview/index.ts']
	})
	browser.plugin(tsify)
	browser.on('log', gutil.log)

	if (task.endsWith('-watch')) {
		browser.plugin(watchify)
		browser.on('update', () => {
			browser.close()
			bundle(task)
		})
	}

	let dir = task.replace('-watch')

	return browser
		.bundle()
		.pipe(exorcist(__dirname + '/' + dir + '/bundle.js.map'))
		.pipe(source('bundle.js'))
		.pipe(gulp.dest(dir))
}

gulp.task('preview', () => bundle('preview'))
gulp.task('preview-watch', () => bundle('preview-watch'))
gulp.task('test', () => bundle('bundle'))
gulp.task('test-watch', () => bundle('bundle-watch'))