const gulp = require('gulp')
const browserSync = require('browser-sync')
const del = require('del')
const sass = require('gulp-sass')
const autoprefixer = require('autoprefixer')
const cssnano = require('cssnano')
const sourcemaps = require('gulp-sourcemaps')
const postcss = require('gulp-postcss')
const postcssImport = require('postcss-import')
const rollup = require('rollup')
const rollupMultiEntryPlugin = require('rollup-plugin-multi-entry')
const rollupResolvePlugin = require('@rollup/plugin-node-resolve')
const rollupCommonJSPlugin = require('@rollup/plugin-commonjs')
const rollupBabelPlugin = require('rollup-plugin-babel')
const { terser: rollupTerserPlugin } = require('rollup-plugin-terser')
const pug = require('gulp-pug')
const imagemin = require('gulp-imagemin')
const deepFiles = require('deep-files')

let pugConstants = {}

try {
  pugConstants = require('./src/pages/constants')
} catch (e) {}

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
  let pipeLine = gulp.src(getSourceFolder('styles/main.scss'))

  if (!isProduction) {
    pipeLine = pipeLine.pipe(sourcemaps.init())
  }

  const postcssPlugins = [postcssImport, autoprefixer]

  if (isProduction) {
    postcssPlugins.push(
      cssnano({
        preset: [
          'default',
          {
            discardComments: {
              removeAll: true,
            },
          },
        ],
      })
    )
  }

  pipeLine = pipeLine.pipe(sass()).pipe(postcss(postcssPlugins))

  if (!isProduction) {
    pipeLine = pipeLine.pipe(sourcemaps.write())
  }

  return pipeLine.pipe(gulp.dest(FOLDERS_TO.STYLES)).pipe(browserSync.stream())
}

const buildScripts = async () => {
  const plugins = [
    rollupMultiEntryPlugin(),
    rollupResolvePlugin({ extensions: ['.js', '.json', '.ts'] }),
    rollupCommonJSPlugin(),
    rollupBabelPlugin({
      exclude: 'node_modules/**',
      presets: ['@babel/preset-env', '@babel/preset-typescript'],
      modules: false,
    }),
  ]

  if (isProduction) {
    plugins.push(rollupTerserPlugin({ sourcemap: false, output: { comments: false } }))
  }

  const bundle = await rollup.rollup({
    input: FOLDERS_FROM.SCRIPTS,
    plugins,
  })

  return bundle.write({
    file: `${FOLDERS_TO.SCRIPTS}/main.js`,
    sourcemap: !isProduction && 'inline',
    format: 'umd',
    name: 'main',
  })
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
