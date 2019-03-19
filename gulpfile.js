const gulp = require('gulp')
const browserify = require('browserify')
const source = require('vinyl-source-stream')
const watchify = require('watchify')
const gutil = require('gulp-util')
const exorcist = require('exorcist')


function bundle(task) {
	let browser = browserify({
		basedir: '.',
		debug: true,
		entries: ['out/index.js']
	})
	browser.plugin(tsify)
	browser.on('log', gutil.log)

	if (task === 'bundle-watch') {
		browser.plugin(watchify)
		browser.on('update', () => {
			browser.close()
			bundle(task)
		})
	}

	return browser
		.bundle()
		.pipe(exorcist(__dirname + '/out/bundle.js.map'))
		.pipe(source('bundle.js'))
		.pipe(gulp.dest('out/'))
}

gulp.task('bundle', () => bundle('bundle'))
gulp.task('bundle-watch', () => bundle('bundle-watch'))