'use strict';

var path = require('path');

/**
 * Lazily required module dependencies
 */

var lazy = {};

// object/array/type utils
lazy.clone = require('clone');
lazy.isBuffer = require('is-buffer');
lazy.paginationator = require('paginationator');
lazy.sortBy = require('array-sort');
lazy.groupBy = require('group-array');
lazy.define = require('define-property');
lazy.merge = require('mixin-deep');
lazy.extend = require('extend-shallow');
lazy.reduce = require('object.reduce');

// routing
lazy.router = require('en-route');

// engines, templates and helpers
lazy.loader = require('load-helpers');
lazy.engine = require('engine-base');
lazy.Engines = require('engine-cache');
lazy.Helpers = require('helper-cache');
lazy.rethrow = require('template-error');
lazy.inflect = require('inflection');
lazy.layouts = require('layouts');

// glob/matching utils
lazy.globby = require('globby');
lazy.mm = require('micromatch');
lazy.isValidGlob = require('is-valid-glob');
lazy.hasGlob = require('has-glob');

/**
 * Utils
 */

var utils = lazy;

/**
 * Default router methods used in all Template instances
 */

utils.methods = [
  'onLoad',
  'preCompile',
  'preLayout',
  'onLayout',
  'postLayout',
  'onMerge',
  'postCompile',
  'preRender',
  'postRender'
];

/**
 * FILE / GLOB UTILS
 * --------------------------------
 */

/**
 * Resolve the absolute file paths for a glob of files.
 */

utils.resolveGlob = function resolveGlob(patterns, options) {
  var opts = utils.extend({cwd: process.cwd()}, options);
  return utils.globby.sync(patterns, opts).map(function (fp) {
    return path.resolve(opts.cwd, fp);
  });
};

/**
 * Require a glob of files
 */

utils.requireGlob = function requireGlob(patterns, options) {
  return utils.resolveGlob(patterns, options).reduce(function (acc, fp) {
    if (/\.(js(?:on)?)/.test(fp)) {
      acc[utils.rename(fp, options)] = utils.tryRequire(fp);
    }
    return acc;
  }, {});
};

/**
 * Attempt to require a file. Fail silently.
 */

utils.tryRequire = function tryRequire(fp, opts) {
  try {
    return require(fp);
  } catch(err) {
    try {
      opts = opts || {};
      fp = path.resolve(fp);
      return require(fp);
    } catch(err) {}
  }
  return null;
};

/**
 * OBJECT / ARRAY / TYPE UTILS
 * --------------------------------
 */

/**
 * Format an error object.
 */

utils.error = function error(msg, val) {
  return new Error(msg + JSON.stringify(val));
};

/**
 * Do nothing.
 */

utils.noop = function noop() {};

/**
 * Return the given value as-is.
 */

utils.identity = function identity(val) {
  return val;
};

/**
 * Arrayify the given value by casting it to an array.
 */

utils.arrayify = function arrayify(val) {
  return val ? (Array.isArray(val) ? val : [val]) : [];
};

/**
 * Returns true if an array have the given element
 * @return {Boolean}
 */

utils.has = function has(keys, key) {
  return keys.indexOf(key) > -1;
};

/**
 * Return true if the given value is an object.
 * @return {Boolean}
 */

utils.isObject = function isObject(val) {
  return val && (typeof val === 'function' || typeof val === 'object')
    && !Array.isArray(val);
};

/**
 * Return true if the given value is a stream.
 */

utils.isStream = function isStream(val) {
  return val && (typeof val === 'function' || typeof val === 'object')
    && !Array.isArray(val)
    && (typeof val.pipe === 'function')
    && (typeof val.on === 'function');
};

/**
 * Bind a `thisArg` to all the functions on the target
 *
 * @param  {Object|Array} `target` Object or Array with functions as values that will be bound.
 * @param  {Object} `thisArg` Object to bind to the functions
 * @return {Object|Array} Object or Array with bound functions.
 */

utils.bindAll = function bindAll(target, thisArg) {
  return utils.reduce(target, function (acc, fn, key) {
    if (typeof fn === 'object') {
      acc[key] = utils.bindAll(fn, thisArg);
    } else if (typeof fn === 'function') {
      acc[key] = fn.bind(thisArg);
      // get `async` flag or any other helper options on `fn`
      for (var k in fn) acc[key][k] = fn[k];
    }
    return acc;
  }, {});
};


/**
 * VIEW UTILS
 * --------------------------------
 */

/**
 * Rename a file
 */

utils.rename = function rename(fp, options) {
  var opts = utils.extend({renameFn: name}, options);
  return opts.renameFn(fp);
};

/**
 * Singularize the given `name`
 */

utils.single = function single(name) {
  return utils.inflect.singularize(name);
};

/**
 * Pluralize the given `name`
 */

utils.plural = function plural(name) {
  return utils.inflect.pluralize(name);
};

/**
 * Return true if the given value is a view.
 */

utils.isView = function isView(val) {
  return val && val.hasOwnProperty('content')
    || val.hasOwnProperty('contents')
    || val.hasOwnProperty('path');
};

*
 * Return true if the given value is a view.
 

utils.hasView = function hasView(val) {
  var keys = Object.keys(val);
  if (keys.length > 1) return false;
  return utils.isView(val[keys[0]]);
};

/**
 * Return the first object with a key that matches
 * the given glob pattern.
 *
 * @param {Object} `object`
 * @param {String|Array} `patterns`
 * @param {Object} `options`
 * @return {Object}
 */

utils.matchKey = function matchKey(obj, patterns, options) {
  if (!utils.isObject(obj)) return null;
  var keys = utils.mm(Object.keys(obj), patterns, options);
  return obj[keys[0]];
};

/**
 * Return all objects with keys that match
 * the given glob pattern.
 *
 * @param {Object} `object`
 * @param {String|Array} `patterns`
 * @param {Object} `options`
 * @return {Object}
 */

utils.matchKeys = function matchKeys(obj, patterns, options) {
  var keys = utils.mm(Object.keys(obj), patterns, options).sort();
  var len = keys.length, i = 0;
  var res = {};

  while (len--) {
    var key = keys[i++];
    res[key] = obj[key];
  }
  return res;
};

/**
 * Sync the _content and _contents properties on a view to ensure
 * both are set when setting one.
 *
 * @param {Object} `view` instance of a `View`
 * @param {String|Buffer|Stream|null} `contents` contents to set on both properties
 */

utils.syncContents = function syncContents(view, contents) {
  if (contents === null) {
    view._contents = null;
    view._content = null;
  }
  if (typeof contents === 'string') {
    view._contents = new Buffer(contents);
    view._content = contents;
  }
  if (utils.isBuffer(contents)) {
    view._contents = contents;
    view._content = contents.toString();
  }
  if (utils.isStream(contents)) {
    view._contents = contents;
    // what should be done here?
    view._content = contents;
  }
};

/**
 * Return true if the given value is a view.
 */

utils.renameKey = function(app) {
  utils.define(app, 'renameKey', function renameKey(key, fn) {
    if (typeof key === 'function') {
      fn = key;
      key = null;
    }

    if (this.option && typeof fn !== 'function') {
      fn = this.option('renameKey');
    }
    if (typeof fn !== 'function') {
      fn = utils.identity;
    }

    this.options.renameKey = fn;
    if (typeof key === 'string') {
      return fn(key);
    }
    return fn;
  }.bind(app));
};

/**
 * Set or get an option value. This is a factory for
 * adding an `option` method to a class
 */

utils.option = function option(app, prop) {
  utils.define(app, 'option', function(key, value) {
    if (typeof key === 'string') {
      if (arguments.length === 1) {
        return this.get('options.' + key);
      }
      this.set('options.' + key, value);
      this.emit('option', key, value);
      return this;
    }
    if (typeof key !== 'object') {
      throw new TypeError('expected a string or object.');
    }
    this.visit('option', key);
    return this;
  }.bind(app));
};

/**
 * Ensure file extensions are formatted properly for lookups.
 *
 * ```js
 * utils.formatExt('hbs');
 * //=> '.hbs'
 *
 * utils.formatExt('.hbs');
 * //=> '.hbs'
 * ```
 *
 * @param {String} `ext` File extension
 * @return {String}
 * @api public
 */

utils.formatExt = function formatExt(ext) {
  if (typeof ext !== 'string') {
    throw new Error('utils.formatExt() expects `ext` to be a string.');
  }
  if (ext.charAt(0) !== '.') {
    return '.' + ext;
  }
  return ext;
};

/**
 * Strip the dot from a file extension
 *
 * ```js
 * utils.stripDot('.hbs');
 * //=> 'hbs'
 * ```
 *
 * @param {String} `ext` extension
 * @return {String}
 * @api public
 */

utils.stripDot = function stripDot(ext) {
  if (typeof ext !== 'string') {
    throw new Error('utils.stripDot() expects `ext` to be a string.');
  }
  if (ext.charAt(0) === '.') {
    return ext.slice(1);
  }
  return ext;
};

/**
 * Get locals from helper arguments.
 *
 * @param  {Object} `locals`
 * @param  {Object} `options`
 */

utils.getLocals = function getLocals(locals, options) {
  options = options || {};
  locals = locals || {};
  var ctx = {};

  if (options.hasOwnProperty('hash')) {
    utils.extend(ctx, locals);
    utils.extend(ctx, options.hash);

  } else if (locals.hasOwnProperty('hash')) {
    utils.extend(ctx, locals.hash);

  } else if (!locals.hasOwnProperty('hash') && !options.hasOwnProperty('hash')) {
    utils.extend(ctx, options);
    utils.extend(ctx, locals);
  }
  return ctx;
};

/**
 * Get the basename from a filepath, excluding extension.
 */

function name(fp) {
  return path.basename(fp, path.extname(fp));
}

/**
 * Expose utils
 */

module.exports = lazy;
