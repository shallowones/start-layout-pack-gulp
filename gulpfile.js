const gulp = require('gulp')
const browserSync = require('browser-sync')
const del = require('del')
const sass = require('gulp-sass')
const autoprefixer = require('autoprefixer')
const cssnano = require('cssnano')
const sourcemaps = require('gulp-sourcemaps')
const postcss = require('gulp-postcss')
const babel = require('gulp-babel')
const merge = require('merge-stream')
const concat = require('gulp-concat')
const terser = require('gulp-terser-js')
const pug = require('gulp-pug')
const imagemin = require('gulp-imagemin')
const deepFiles = require('deep-files')
const { vendor, pugConstants } = require('./layout.config')

const { NODE_ENV } = process.env
const isProduction = NODE_ENV && NODE_ENV.trim().toLowerCase() === 'production'
const buildFolder = isProduction ? 'dist' : 'build'

const getSourceFolder = path => `src/${path}`
const getBuildFolder = path => `${buildFolder}/${path}`

const FOLDERS_FROM = {
  STYLES: getSourceFolder('styles/*.scss'),
  SCRIPTS: getSourceFolder('scripts/*.ts'),
  PAGES: getSourceFolder('pages/*.pug'),
  FONTS: getSourceFolder('fonts/*'),
  IMAGES: getSourceFolder('images/*.{jpg,png,svg,gif}'),
}

const FOLDERS_TO = {
  STYLES: getBuildFolder('css'),
  SCRIPTS: getBuildFolder('js'),
  PAGES: buildFolder,
  FONTS: getBuildFolder('fonts'),
  IMAGES: getBuildFolder('images'),
}

const clean = () => del(`./${buildFolder}`)

const buildStyles = () => {
  let pipeLine = gulp
    .src(FOLDERS_FROM.STYLES)
    .pipe(sourcemaps.init())
    .pipe(sass())
    .pipe(sourcemaps.write())

  if (vendor.css && vendor.css.length) {
    pipeLine = merge(gulp.src(vendor.css), pipeLine)
  }

  const postcssPlugins = [autoprefixer]

  if (isProduction) {
    postcssPlugins.push(cssnano)
  }

  return pipeLine
    .pipe(concat('main.css'))
    .pipe(postcss(postcssPlugins))
    .pipe(gulp.dest(FOLDERS_TO.STYLES))
    .pipe(browserSync.stream())
}

const buildScripts = () => {
  let pipeLine = gulp
    .src(FOLDERS_FROM.SCRIPTS)
    .pipe(sourcemaps.init())
    .pipe(babel({ presets: ['@babel/preset-env', '@babel/preset-typescript'] }))
    .pipe(sourcemaps.write())

  if (vendor.js && vendor.js.length) {
    pipeLine = merge(gulp.src(vendor.js), pipeLine)
  }

  if (isProduction) {
    pipeLine = pipeLine.pipe(terser())
  }

  return pipeLine.pipe(concat('main.js')).pipe(gulp.dest(FOLDERS_TO.SCRIPTS))
}

const buildPages = () => {
  return gulp
    .src(FOLDERS_FROM.PAGES, { ignore: getSourceFolder('pages/layout.pug') })
    .pipe(
      pug({
        data: {
          ...pugConstants,
          pages: deepFiles('src/pages', '*.pug').reduce((acc, pathToPage) => {
            const match = pathToPage.match(/((\d|\w|-|_)+).pug/)

            if (match && typeof match[1] === 'string' && match[1] !== 'index' && match[1] !== 'layout') {
              acc.push(`${match[1]}.html`)
            }

            return acc
          }, []),
        },
      })
    )
    .pipe(gulp.dest(FOLDERS_TO.PAGES))
}

const buildFonts = () => {
  return gulp.src(FOLDERS_FROM.FONTS).pipe(gulp.dest(FOLDERS_TO.FONTS))
}

const buildImages = () => {
  return gulp
    .src(FOLDERS_FROM.IMAGES)
    .pipe(
      imagemin([
        imagemin.gifsicle({ interlaced: true }),
        imagemin.mozjpeg({ quality: 75, progressive: true }),
        imagemin.optipng({ optimizationLevel: 5 }),
        imagemin.svgo({
          plugins: [{ removeViewBox: true }, { cleanupIDs: false }],
        }),
      ])
    )
    .pipe(gulp.dest(FOLDERS_TO.IMAGES))
}

const watch = () => {
  gulp.watch(FOLDERS_FROM.STYLES, buildStyles)
  gulp.watch(FOLDERS_FROM.SCRIPTS, buildScripts)
  gulp.watch(FOLDERS_FROM.PAGES, buildPages)
  gulp.watch(FOLDERS_FROM.FONTS, buildFonts)
  gulp.watch(FOLDERS_FROM.IMAGES, buildImages)
}

const serve = () => {
  browserSync.init({ server: buildFolder, watch: true, notify: false })
}

const scriptsToProd = [clean, buildStyles, buildScripts, gulp.parallel(buildPages, buildFonts, buildImages)]
const scriptsToDev = [gulp.parallel(serve, watch)]

exports.default = gulp.series(isProduction ? scriptsToProd : scriptsToProd.concat(scriptsToDev))
