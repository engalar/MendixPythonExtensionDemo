(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.Awilix = {}));
})(this, (function (exports) { 'use strict';

  /**
   * Newline.
   */
  const EOL = '\n';
  /**
   * An extendable error class.
   * @author https://github.com/bjyoungblood/es6-error/
   */
  class ExtendableError extends Error {
      /**
       * Constructor for the error.
       *
       * @param  {String} message
       * The error message.
       */
      constructor(message) {
          super(message);
          // extending Error is weird and does not propagate `message`
          Object.defineProperty(this, 'message', {
              enumerable: false,
              value: message,
          });
          Object.defineProperty(this, 'name', {
              enumerable: false,
              value: this.constructor.name,
          });
          // Not all browsers have this function.
          /* istanbul ignore else */
          if ('captureStackTrace' in Error) {
              Error.captureStackTrace(this, this.constructor);
          }
          else {
              Object.defineProperty(this, 'stack', {
                  enumerable: false,
                  value: Error(message).stack,
                  writable: true,
                  configurable: true,
              });
          }
      }
  }
  /**
   * Base error for all Awilix-specific errors.
   */
  class AwilixError extends ExtendableError {
  }
  /**
   * Error thrown to indicate a type mismatch.
   */
  class AwilixTypeError extends AwilixError {
      /**
       * Constructor, takes the function name, expected and given
       * type to produce an error.
       *
       * @param {string} funcDescription
       * Name of the function being guarded.
       *
       * @param {string} paramName
       * The parameter there was an issue with.
       *
       * @param {string} expectedType
       * Name of the expected type.
       *
       * @param {string} givenType
       * Name of the given type.
       */
      constructor(funcDescription, paramName, expectedType, givenType) {
          super(`${funcDescription}: expected ${paramName} to be ${expectedType}, but got ${givenType}.`);
      }
      /**
       * Asserts the given condition, throws an error otherwise.
       *
       * @param {*} condition
       * The condition to check
       *
       * @param {string} funcDescription
       * Name of the function being guarded.
       *
       * @param {string} paramName
       * The parameter there was an issue with.
       *
       * @param {string} expectedType
       * Name of the expected type.
       *
       * @param {string} givenType
       * Name of the given type.
       */
      static assert(condition, funcDescription, paramName, expectedType, givenType) {
          if (!condition) {
              throw new AwilixTypeError(funcDescription, paramName, expectedType, givenType);
          }
          return condition;
      }
  }
  /**
   * A nice error class so we can do an instanceOf check.
   */
  class AwilixResolutionError extends AwilixError {
      /**
       * Constructor, takes the registered modules and unresolved tokens
       * to create a message.
       *
       * @param {string|symbol} name
       * The name of the module that could not be resolved.
       *
       * @param  {string[]} resolutionStack
       * The current resolution stack
       */
      constructor(name, resolutionStack, message) {
          const stringName = name.toString();
          const nameStack = resolutionStack.map(({ name: val }) => val.toString());
          nameStack.push(stringName);
          const resolutionPathString = nameStack.join(' -> ');
          let msg = `Could not resolve '${stringName}'.`;
          if (message) {
              msg += ` ${message}`;
          }
          msg += EOL + EOL;
          msg += `Resolution path: ${resolutionPathString}`;
          super(msg);
      }
  }
  /**
   * A nice error class so we can do an instanceOf check.
   */
  class AwilixRegistrationError extends AwilixError {
      /**
       * Constructor, takes the registered modules and unresolved tokens
       * to create a message.
       *
       * @param {string|symbol} name
       * The name of the module that could not be registered.
       */
      constructor(name, message) {
          const stringName = name.toString();
          let msg = `Could not register '${stringName}'.`;
          if (message) {
              msg += ` ${message}`;
          }
          super(msg);
      }
  }

  /**
   * Resolution modes.
   */
  const InjectionMode = {
      /**
       * The dependencies will be resolved by injecting the cradle proxy.
       *
       * @type {String}
       */
      PROXY: 'PROXY',
      /**
       * The dependencies will be resolved by inspecting parameter names of the function/constructor.
       *
       * @type {String}
       */
      CLASSIC: 'CLASSIC',
  };

  /**
   * Lifetime types.
   */
  const Lifetime = {
      /**
       * The registration will be resolved once and only once.
       * @type {String}
       */
      SINGLETON: 'SINGLETON',
      /**
       * The registration will be resolved every time (never cached).
       * @type {String}
       */
      TRANSIENT: 'TRANSIENT',
      /**
       * The registration will be resolved once per scope.
       * @type {String}
       */
      SCOPED: 'SCOPED',
  };
  /**
   * Returns true if and only if the first lifetime is strictly longer than the second.
   */
  function isLifetimeLonger(a, b) {
      return ((a === Lifetime.SINGLETON && b !== Lifetime.SINGLETON) ||
          (a === Lifetime.SCOPED && b === Lifetime.TRANSIENT));
  }

  /**
   * Creates a tokenizer for the specified source.
   *
   * @param source
   */
  function createTokenizer(source) {
      const end = source.length;
      let pos = 0;
      let type = 'EOF';
      let value = '';
      let flags = 0 /* TokenizerFlags.None */;
      // These are used to greedily skip as much as possible.
      // Whenever we reach a paren, we increment these.
      let parenLeft = 0;
      let parenRight = 0;
      return {
          next,
          done,
      };
      /**
       * Advances the tokenizer and returns the next token.
       */
      function next(nextFlags = 0 /* TokenizerFlags.None */) {
          flags = nextFlags;
          advance();
          return createToken();
      }
      /**
       * Advances the tokenizer state.
       */
      function advance() {
          value = '';
          type = 'EOF';
          while (true) {
              if (pos >= end) {
                  return (type = 'EOF');
              }
              const ch = source.charAt(pos);
              // Whitespace is irrelevant
              if (isWhiteSpace(ch)) {
                  pos++;
                  continue;
              }
              switch (ch) {
                  case '(':
                      pos++;
                      parenLeft++;
                      return (type = ch);
                  case ')':
                      pos++;
                      parenRight++;
                      return (type = ch);
                  case '*':
                      pos++;
                      return (type = ch);
                  case ',':
                      pos++;
                      return (type = ch);
                  case '=':
                      pos++;
                      if ((flags & 1 /* TokenizerFlags.Dumb */) === 0) {
                          // Not in dumb-mode, so attempt to skip.
                          skipExpression();
                      }
                      // We need to know that there's a default value so we can
                      // skip it if it does not exist when resolving.
                      return (type = ch);
                  case '/': {
                      pos++;
                      const nextCh = source.charAt(pos);
                      if (nextCh === '/') {
                          skipUntil((c) => c === '\n', true);
                          pos++;
                      }
                      if (nextCh === '*') {
                          skipUntil((c) => {
                              const closing = source.charAt(pos + 1);
                              return c === '*' && closing === '/';
                          }, true);
                          pos++;
                      }
                      break;
                  }
                  default:
                      // Scans an identifier.
                      if (isIdentifierStart(ch)) {
                          scanIdentifier();
                          return type;
                      }
                      // Elegantly skip over tokens we don't care about.
                      pos++;
              }
          }
      }
      /**
       * Scans an identifier, given it's already been proven
       * we are ready to do so.
       */
      function scanIdentifier() {
          const identStart = source.charAt(pos);
          const start = ++pos;
          while (isIdentifierPart(source.charAt(pos))) {
              pos++;
          }
          value = '' + identStart + source.substring(start, pos);
          type = value === 'function' || value === 'class' ? value : 'ident';
          if (type !== 'ident') {
              value = '';
          }
          return value;
      }
      /**
       * Skips everything until the next comma or the end of the parameter list.
       * Checks the parenthesis balance so we correctly skip function calls.
       */
      function skipExpression() {
          skipUntil((ch) => {
              const isAtRoot = parenLeft === parenRight + 1;
              if (ch === ',' && isAtRoot) {
                  return true;
              }
              if (ch === '(') {
                  parenLeft++;
                  return false;
              }
              if (ch === ')') {
                  parenRight++;
                  if (isAtRoot) {
                      return true;
                  }
              }
              return false;
          });
      }
      /**
       * Skips strings and whitespace until the predicate is true.
       *
       * @param callback stops skipping when this returns `true`.
       * @param dumb if `true`, does not skip whitespace and strings;
       * it only stops once the callback returns `true`.
       */
      function skipUntil(callback, dumb = false) {
          while (pos < source.length) {
              const ch = source.charAt(pos);
              if (callback(ch)) {
                  return;
              }
              if (!dumb) {
                  if (isWhiteSpace(ch)) {
                      pos++;
                      continue;
                  }
                  if (isStringQuote(ch)) {
                      skipString();
                      continue;
                  }
              }
              pos++;
          }
      }
      /**
       * Given the current position is at a string quote, skips the entire string.
       */
      function skipString() {
          const quote = source.charAt(pos);
          pos++;
          while (pos < source.length) {
              const ch = source.charAt(pos);
              const prev = source.charAt(pos - 1);
              // Checks if the quote was escaped.
              if (ch === quote && prev !== '\\') {
                  pos++;
                  return;
              }
              // Template strings are a bit tougher, we want to skip the interpolated values.
              if (quote === '`') {
                  const next = source.charAt(pos + 1);
                  if (next === '$') {
                      const afterDollar = source.charAt(pos + 2);
                      if (afterDollar === '{') {
                          // This is the start of an interpolation; skip the ${
                          pos = pos + 2;
                          // Skip strings and whitespace until we reach the ending }.
                          // This includes skipping nested interpolated strings. :D
                          skipUntil((ch) => ch === '}');
                      }
                  }
              }
              pos++;
          }
      }
      /**
       * Creates a token from the current state.
       */
      function createToken() {
          if (value) {
              return { value, type };
          }
          return { type };
      }
      /**
       * Determines if we are done parsing.
       */
      function done() {
          return type === 'EOF';
      }
  }
  /**
   * Determines if the given character is a whitespace character.
   *
   * @param  {string}  ch
   * @return {boolean}
   */
  function isWhiteSpace(ch) {
      switch (ch) {
          case '\r':
          case '\n':
          case ' ':
              return true;
      }
      return false;
  }
  /**
   * Determines if the specified character is a string quote.
   * @param  {string}  ch
   * @return {boolean}
   */
  function isStringQuote(ch) {
      switch (ch) {
          case "'":
          case '"':
          case '`':
              return true;
      }
      return false;
  }
  // NOTE: I've added the `.` character, optionally prefixed by `?` so
  // that member expression paths are seen as identifiers.
  // This is so we don't get a constructor token for stuff
  // like `MyClass.prototype?.constructor()`
  const IDENT_START_EXPR = /^[_$a-zA-Z\xA0-\uFFFF]$/;
  const IDENT_PART_EXPR = /^[?._$a-zA-Z0-9\xA0-\uFFFF]$/;
  /**
   * Determines if the character is a valid JS identifier start character.
   */
  function isIdentifierStart(ch) {
      return IDENT_START_EXPR.test(ch);
  }
  /**
   * Determines if the character is a valid JS identifier start character.
   */
  function isIdentifierPart(ch) {
      return IDENT_PART_EXPR.test(ch);
  }

  /**
   * Creates a { name: value } object if the input isn't already in that format.
   *
   * @param  {string|object} name
   * Either a string or an object.
   *
   * @param  {*} value
   * The value, only used if name is not an object.
   *
   * @return {object}
   */
  function nameValueToObject(name, value) {
      const obj = name;
      if (typeof obj === 'string' || typeof obj === 'symbol') {
          return { [name]: value };
      }
      return obj;
  }
  /**
   * Returns the last item in the array.
   *
   * @param  {*[]} arr
   * The array.
   *
   * @return {*}
   * The last element.
   */
  function last(arr) {
      return arr[arr.length - 1];
  }
  /**
   * Determines if the given function is a class.
   *
   * @param  {Function} fn
   * @return {boolean}
   */
  function isClass(
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  fn) {
      if (typeof fn !== 'function') {
          return false;
      }
      // Should only need 2 tokens.
      const tokenizer = createTokenizer(fn.toString());
      const first = tokenizer.next();
      if (first.type === 'class') {
          return true;
      }
      const second = tokenizer.next();
      if (first.type === 'function' && second.value) {
          if (second.value[0] === second.value[0].toUpperCase()) {
              return true;
          }
      }
      return false;
  }
  /**
   * Determines if the given value is a function.
   *
   * @param  {unknown} val
   * Any value to check if it's a function.
   *
   * @return {boolean}
   * true if the value is a function, false otherwise.
   */
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  function isFunction(val) {
      return typeof val === 'function';
  }
  /**
   * Returns the unique items in the array.
   *
   * @param {Array<T>}
   * The array to remove dupes from.
   *
   * @return {Array<T>}
   * The deduped array.
   */
  function uniq(arr) {
      return Array.from(new Set(arr));
  }

  /*
   * Parses the parameter list of a function string, including ES6 class constructors.
   *
   * @param {string} source
   * The source of a function to extract the parameter list from
   *
   * @return {Array<Parameter> | null}
   * Returns an array of parameters, or `null` if no
   * constructor was found for a class.
   */
  function parseParameterList(source) {
      const { next: _next, done } = createTokenizer(source);
      const params = [];
      let t = null;
      nextToken();
      while (!done()) {
          switch (t.type) {
              case 'class': {
                  const foundConstructor = advanceToConstructor();
                  // If we didn't find a constructor token, then we know that there
                  // are no dependencies in the defined class.
                  if (!foundConstructor) {
                      return null;
                  }
                  break;
              }
              case 'function': {
                  const next = nextToken();
                  if (next.type === 'ident' || next.type === '*') {
                      // This is the function name or a generator star. Skip it.
                      nextToken();
                  }
                  break;
              }
              case '(':
                  // Start parsing parameter names.
                  parseParams();
                  break;
              case ')':
                  // We're now out of the parameter list.
                  return params;
              // When we're encountering an identifier token
              // at this level, it could be because it's an arrow function
              // with a single parameter, e.g. `foo => ...`.
              // This path won't be hit if we've already identified the `(` token.
              case 'ident': {
                  // Likely a paren-less arrow function
                  // which can have no default args.
                  const param = { name: t.value, optional: false };
                  if (t.value === 'async') {
                      // Given it's the very first token, we can assume it's an async function,
                      // so skip the async keyword if the next token is not an equals sign, in which
                      // case it is a single-arg arrow func.
                      const next = nextToken();
                      if (next && next.type !== '=') {
                          break;
                      }
                  }
                  params.push(param);
                  return params;
              }
              /* istanbul ignore next */
              default:
                  throw unexpected();
          }
      }
      return params;
      /**
       * After having been placed within the parameter list of
       * a function, parses the parameters.
       */
      function parseParams() {
          // Current token is a left-paren
          let param = { name: '', optional: false };
          while (!done()) {
              nextToken();
              switch (t.type) {
                  case 'ident':
                      param.name = t.value;
                      break;
                  case '=':
                      param.optional = true;
                      break;
                  case ',':
                      params.push(param);
                      param = { name: '', optional: false };
                      break;
                  case ')':
                      if (param.name) {
                          params.push(param);
                      }
                      return;
                  /* istanbul ignore next */
                  default:
                      throw unexpected();
              }
          }
      }
      /**
       * Advances until we reach the constructor identifier followed by
       * a `(` token.
       *
       * @returns `true` if a constructor was found, `false` otherwise.
       */
      function advanceToConstructor() {
          while (!done()) {
              if (isConstructorToken()) {
                  // Consume the token
                  nextToken(1 /* TokenizerFlags.Dumb */);
                  // If the current token now isn't a `(`, then it wasn't the actual
                  // constructor.
                  if (t.type !== '(') {
                      continue;
                  }
                  return true;
              }
              nextToken(1 /* TokenizerFlags.Dumb */);
          }
          return false;
      }
      /**
       * Determines if the current token represents a constructor, and the next token after it is a paren
       * @return {boolean}
       */
      function isConstructorToken() {
          return t.type === 'ident' && t.value === 'constructor';
      }
      /**
       * Advances the tokenizer and stores the previous token in history
       */
      function nextToken(flags = 0 /* TokenizerFlags.None */) {
          t = _next(flags);
          return t;
      }
      /**
       * Returns an error describing an unexpected token.
       */
      /* istanbul ignore next */
      function unexpected() {
          return new SyntaxError(`Parsing parameter list, did not expect ${t.type} token${t.value ? ` (${t.value})` : ''}`);
      }
  }

  // We parse the signature of any `Function`, so we want to allow `Function` types.
  /* eslint-disable @typescript-eslint/no-unsafe-function-type */
  /**
   * RESOLVER symbol can be used by modules loaded by
   * `loadModules` to configure their lifetime, injection mode, etc.
   */
  const RESOLVER = Symbol('Awilix Resolver Config');
  /**
   * Creates a simple value resolver where the given value will always be resolved. The value is
   * marked as leak-safe since in strict mode, the value will only be resolved when it is not leaking
   * upwards from a child scope to a parent singleton.
   *
   * @param  {string} name The name to register the value as.
   *
   * @param  {*} value The value to resolve.
   *
   * @return {object} The resolver.
   */
  function asValue(value) {
      return {
          resolve: () => value,
          isLeakSafe: true,
      };
  }
  /**
   * Creates a factory resolver, where the given factory function
   * will be invoked with `new` when requested.
   *
   * @param  {string} name
   * The name to register the value as.
   *
   * @param  {Function} fn
   * The function to register.
   *
   * @param {object} opts
   * Additional options for the resolver.
   *
   * @return {object}
   * The resolver.
   */
  function asFunction(fn, opts) {
      if (!isFunction(fn)) {
          throw new AwilixTypeError('asFunction', 'fn', 'function', fn);
      }
      const defaults = {
          lifetime: Lifetime.TRANSIENT,
      };
      opts = makeOptions(defaults, opts, fn[RESOLVER]);
      const resolve = generateResolve(fn);
      const result = {
          resolve,
          ...opts,
      };
      return createDisposableResolver(createBuildResolver(result));
  }
  /**
   * Like a factory resolver, but for classes that require `new`.
   *
   * @param  {string} name
   * The name to register the value as.
   *
   * @param  {Class} Type
   * The function to register.
   *
   * @param {object} opts
   * Additional options for the resolver.
   *
   * @return {object}
   * The resolver.
   */
  function asClass(Type, opts) {
      if (!isFunction(Type)) {
          throw new AwilixTypeError('asClass', 'Type', 'class', Type);
      }
      const defaults = {
          lifetime: Lifetime.TRANSIENT,
      };
      opts = makeOptions(defaults, opts, Type[RESOLVER]);
      // A function to handle object construction for us, as to make the generateResolve more reusable
      const newClass = function newClass(...args) {
          return Reflect.construct(Type, args);
      };
      const resolve = generateResolve(newClass, Type);
      return createDisposableResolver(createBuildResolver({
          ...opts,
          resolve,
      }));
  }
  /**
   * Resolves to the specified registration. Marked as leak-safe since the alias target is what should
   * be checked for lifetime leaks.
   */
  function aliasTo(name) {
      return {
          resolve(container) {
              return container.resolve(name);
          },
          isLeakSafe: true,
      };
  }
  /**
   * Given an options object, creates a fluid interface
   * to manage it.
   *
   * @param {*} obj
   * The object to return.
   *
   * @return {object}
   * The interface.
   */
  function createBuildResolver(obj) {
      function setLifetime(value) {
          return createBuildResolver({
              ...this,
              lifetime: value,
          });
      }
      function setInjectionMode(value) {
          return createBuildResolver({
              ...this,
              injectionMode: value,
          });
      }
      function inject(injector) {
          return createBuildResolver({
              ...this,
              injector,
          });
      }
      return updateResolver(obj, {
          setLifetime,
          inject,
          transient: partial(setLifetime, Lifetime.TRANSIENT),
          scoped: partial(setLifetime, Lifetime.SCOPED),
          singleton: partial(setLifetime, Lifetime.SINGLETON),
          setInjectionMode,
          proxy: partial(setInjectionMode, InjectionMode.PROXY),
          classic: partial(setInjectionMode, InjectionMode.CLASSIC),
      });
  }
  /**
   * Given a resolver, returns an object with methods to manage the disposer
   * function.
   * @param obj
   */
  function createDisposableResolver(obj) {
      function disposer(dispose) {
          return createDisposableResolver({
              ...this,
              dispose,
          });
      }
      return updateResolver(obj, {
          disposer,
      });
  }
  /**
   * Partially apply arguments to the given function.
   */
  function partial(fn, arg1) {
      return function partiallyApplied() {
          return fn.call(this, arg1);
      };
  }
  /**
   * Makes an options object based on defaults.
   *
   * @param  {object} defaults
   * Default options.
   *
   * @param  {...} rest
   * The input to check and possibly assign to the resulting object
   *
   * @return {object}
   */
  function makeOptions(defaults, ...rest) {
      return Object.assign({}, defaults, ...rest);
  }
  /**
   * Creates a new resolver with props merged from both.
   *
   * @param source
   * @param target
   */
  function updateResolver(source, target) {
      const result = {
          ...source,
          ...target,
      };
      return result;
  }
  /**
   * Returns a wrapped `resolve` function that provides values
   * from the injector and defers to `container.resolve`.
   *
   * @param  {AwilixContainer} container
   * @param  {Object} locals
   * @return {Function}
   */
  function wrapWithLocals(container, locals) {
      return function wrappedResolve(name, resolveOpts) {
          if (name in locals) {
              return locals[name];
          }
          return container.resolve(name, resolveOpts);
      };
  }
  /**
   * Returns a new Proxy that checks the result from `injector`
   * for values before delegating to the actual container.
   *
   * @param  {Object} cradle
   * @param  {Function} injector
   * @return {Proxy}
   */
  function createInjectorProxy(container, injector) {
      const locals = injector(container);
      const allKeys = uniq([
          ...Reflect.ownKeys(container.cradle),
          ...Reflect.ownKeys(locals),
      ]);
      // TODO: Lots of duplication here from the container proxy.
      // Need to refactor.
      const proxy = new Proxy({}, {
          /**
           * Resolves the value by first checking the locals, then the container.
           */
          get(target, name) {
              if (name === Symbol.iterator) {
                  return function* iterateRegistrationsAndLocals() {
                      for (const prop in container.cradle) {
                          yield prop;
                      }
                      for (const prop in locals) {
                          yield prop;
                      }
                  };
              }
              if (name in locals) {
                  return locals[name];
              }
              return container.resolve(name);
          },
          /**
           * Used for `Object.keys`.
           */
          ownKeys() {
              return allKeys;
          },
          /**
           * Used for `Object.keys`.
           */
          getOwnPropertyDescriptor(target, key) {
              if (allKeys.indexOf(key) > -1) {
                  return {
                      enumerable: true,
                      configurable: true,
                  };
              }
              return undefined;
          },
      });
      return proxy;
  }
  /**
   * Returns a resolve function used to construct the dependency graph
   *
   * @this {Registration}
   * The `this` context is a resolver.
   *
   * @param {Function} fn
   * The function to construct
   *
   * @param {Function} dependencyParseTarget
   * The function to parse for the dependencies of the construction target
   *
   * @param {boolean} isFunction
   * Is the resolution target an actual function or a mask for a constructor?
   *
   * @return {Function}
   * The function used for dependency resolution
   */
  function generateResolve(fn, dependencyParseTarget) {
      // If the function used for dependency parsing is falsy, use the supplied function
      if (!dependencyParseTarget) {
          dependencyParseTarget = fn;
      }
      // Parse out the dependencies
      // NOTE: we do this regardless of whether PROXY is used or not,
      // because if this fails, we want it to fail early (at startup) rather
      // than at resolution time.
      const dependencies = parseDependencies(dependencyParseTarget);
      // Use a regular function instead of an arrow function to facilitate binding to the resolver.
      return function resolve(container) {
          // Because the container holds a global reolutionMode we need to determine it in the proper order of precedence:
          // resolver -> container -> default value
          const injectionMode = this.injectionMode ||
              container.options.injectionMode ||
              InjectionMode.PROXY;
          if (injectionMode !== InjectionMode.CLASSIC) {
              // If we have a custom injector, we need to wrap the cradle.
              const cradle = this.injector
                  ? createInjectorProxy(container, this.injector)
                  : container.cradle;
              // Return the target injected with the cradle
              return fn(cradle);
          }
          // We have dependencies so we need to resolve them manually
          if (dependencies.length > 0) {
              const resolve = this.injector
                  ? wrapWithLocals(container, this.injector(container))
                  : container.resolve;
              const children = dependencies.map((p) => resolve(p.name, { allowUnregistered: p.optional }));
              return fn(...children);
          }
          return fn();
      };
  }
  /**
   * Parses the dependencies from the given function.
   * If it's a class that extends another class, and it does
   * not have a defined constructor, attempt to parse it's super constructor.
   */
  function parseDependencies(fn) {
      const result = parseParameterList(fn.toString());
      if (!result) {
          // No defined constructor for a class, check if there is a parent
          // we can parse.
          const parent = Object.getPrototypeOf(fn);
          if (typeof parent === 'function' && parent !== Function.prototype) {
              // Try to parse the parent
              return parseDependencies(parent);
          }
          return [];
      }
      return result;
  }

  /**
   * Family tree symbol.
   */
  const FAMILY_TREE = Symbol('familyTree');
  /**
   * Roll Up Registrations symbol.
   */
  const ROLL_UP_REGISTRATIONS = Symbol('rollUpRegistrations');
  /**
   * The string representation when calling toString.
   */
  const CRADLE_STRING_TAG = 'AwilixContainerCradle';
  /**
   * Creates an Awilix container instance.
   *
   * @param {Function} options.require The require function to use. Defaults to require.
   *
   * @param {string} options.injectionMode The mode used by the container to resolve dependencies.
   * Defaults to 'Proxy'.
   *
   * @param {boolean} options.strict True if the container should run in strict mode with additional
   * validation for resolver configuration correctness. Defaults to false.
   *
   * @return {AwilixContainer<T>} The container.
   */
  function createContainer(options = {}) {
      return createContainerInternal(options);
  }
  function createContainerInternal(options, parentContainer, parentResolutionStack) {
      options = {
          injectionMode: InjectionMode.PROXY,
          strict: false,
          ...options,
      };
      /**
       * Tracks the names and lifetimes of the modules being resolved. Used to detect circular
       * dependencies and, in strict mode, lifetime leakage issues.
       */
      const resolutionStack = parentResolutionStack ?? [];
      // Internal registration store for this container.
      const registrations = {};
      /**
       * The `Proxy` that is passed to functions so they can resolve their dependencies without
       * knowing where they come from. I call it the "cradle" because
       * it is where registered things come to life at resolution-time.
       */
      const cradle = new Proxy({
      /* removed in browser build */
      }, {
          /**
           * The `get` handler is invoked whenever a get-call for `container.cradle.*` is made.
           *
           * @param  {object} _target
           * The proxy target. Irrelevant.
           *
           * @param  {string} name
           * The property name.
           *
           * @return {*}
           * Whatever the resolve call returns.
           */
          get: (_target, name) => resolve(name),
          /**
           * Setting things on the cradle throws an error.
           *
           * @param  {object} target
           * @param  {string} name
           */
          set: (_target, name) => {
              throw new Error(`Attempted setting property "${name}" on container cradle - this is not allowed.`);
          },
          /**
           * Used for `Object.keys`.
           */
          ownKeys() {
              return Array.from(cradle);
          },
          /**
           * Used for `Object.keys`.
           */
          getOwnPropertyDescriptor(target, key) {
              const regs = rollUpRegistrations();
              if (Object.getOwnPropertyDescriptor(regs, key)) {
                  return {
                      enumerable: true,
                      configurable: true,
                  };
              }
              return undefined;
          },
      });
      // The container being exposed.
      const container = {
          options,
          cradle,
          inspect,
          cache: new Map(),
          loadModules: () => { throw new Error("loadModules is not supported in the browser."); },
          createScope,
          register: register,
          build,
          resolve,
          hasRegistration,
          dispose,
          getRegistration,
          /* removed in browser build */
          [ROLL_UP_REGISTRATIONS]: rollUpRegistrations,
          get registrations() {
              return rollUpRegistrations();
          },
      };
      // Track the family tree.
      const familyTree = parentContainer
          ? [container].concat(parentContainer[FAMILY_TREE])
          : [container];
      container[FAMILY_TREE] = familyTree;
      // We need a reference to the root container,
      // so we can retrieve and store singletons.
      const rootContainer = last(familyTree);
      return container;
      /**
       * Used by util.inspect (which is used by console.log).
       */
      function inspect() {
          return `[AwilixContainer (${parentContainer ? 'scoped, ' : ''}registrations: ${Object.keys(container.registrations).length})]`;
      }
      /**
       * Rolls up registrations from the family tree.
       *
       * This can get pretty expensive. Only used when
       * iterating the cradle proxy, which is not something
       * that should be done in day-to-day use, mostly for debugging.
       *
       * @param {boolean} bustCache
       * Forces a recomputation.
       *
       * @return {object}
       * The merged registrations object.
       */
      function rollUpRegistrations() {
          return {
              ...(parentContainer && parentContainer[ROLL_UP_REGISTRATIONS]()),
              ...registrations,
          };
      }
      /**
       * Used for providing an iterator to the cradle.
       */
      function* cradleIterator() {
          const registrations = rollUpRegistrations();
          for (const registrationName in registrations) {
              yield registrationName;
          }
      }
      /**
       * Creates a scoped container.
       *
       * @return {object}
       * The scoped container.
       */
      function createScope() {
          return createContainerInternal(options, container, resolutionStack);
      }
      /**
       * Adds a registration for a resolver.
       */
      function register(arg1, arg2) {
          const obj = nameValueToObject(arg1, arg2);
          const keys = [...Object.keys(obj), ...Object.getOwnPropertySymbols(obj)];
          for (const key of keys) {
              const resolver = obj[key];
              // If strict mode is enabled, check to ensure we are not registering a singleton on a non-root
              // container.
              if (options.strict && resolver.lifetime === Lifetime.SINGLETON) {
                  if (parentContainer) {
                      throw new AwilixRegistrationError(key, 'Cannot register a singleton on a scoped container.');
                  }
              }
              registrations[key] = resolver;
          }
          return container;
      }
      /**
       * Returned to `util.inspect` and Symbol.toStringTag when attempting to resolve
       * a custom inspector function on the cradle.
       */
      function toStringRepresentationFn() {
          return Object.prototype.toString.call(cradle);
      }
      /**
       * Recursively gets a registration by name if it exists in the
       * current container or any of its' parents.
       *
       * @param name {string | symbol} The registration name.
       */
      function getRegistration(name) {
          const resolver = registrations[name];
          if (resolver) {
              return resolver;
          }
          if (parentContainer) {
              return parentContainer.getRegistration(name);
          }
          return null;
      }
      /**
       * Resolves the registration with the given name.
       *
       * @param {string | symbol} name
       * The name of the registration to resolve.
       *
       * @param {ResolveOptions} resolveOpts
       * The resolve options.
       *
       * @return {any}
       * Whatever was resolved.
       */
      function resolve(name, resolveOpts) {
          resolveOpts = resolveOpts || {};
          try {
              // Grab the registration by name.
              const resolver = getRegistration(name);
              if (resolutionStack.some(({ name: parentName }) => parentName === name)) {
                  throw new AwilixResolutionError(name, resolutionStack, 'Cyclic dependencies detected.');
              }
              // Used in JSON.stringify.
              if (name === 'toJSON') {
                  return toStringRepresentationFn;
              }
              // Used in console.log.
              if (name === 'constructor') {
                  return createContainer;
              }
              if (!resolver) {
                  // Checks for some edge cases.
                  switch (name) {
                      // The following checks ensure that console.log on the cradle does not
                      // throw an error (issue #7).
                      case 'inspect':
                      case 'toString':
                          return toStringRepresentationFn;
                      case Symbol.toStringTag:
                          return CRADLE_STRING_TAG;
                      // Edge case: Promise unwrapping will look for a "then" property and attempt to call it.
                      // Return undefined so that we won't cause a resolution error. (issue #109)
                      case 'then':
                          return undefined;
                      // When using `Array.from` or spreading the cradle, this will
                      // return the registration names.
                      case Symbol.iterator:
                          return cradleIterator;
                  }
                  if (resolveOpts.allowUnregistered) {
                      return undefined;
                  }
                  throw new AwilixResolutionError(name, resolutionStack);
              }
              const lifetime = resolver.lifetime || Lifetime.TRANSIENT;
              // if we are running in strict mode, this resolver is not explicitly marked leak-safe, and any
              // of the parents have a shorter lifetime than the one requested, throw an error.
              if (options.strict && !resolver.isLeakSafe) {
                  const maybeLongerLifetimeParentIndex = resolutionStack.findIndex(({ lifetime: parentLifetime }) => isLifetimeLonger(parentLifetime, lifetime));
                  if (maybeLongerLifetimeParentIndex > -1) {
                      throw new AwilixResolutionError(name, resolutionStack, `Dependency '${name.toString()}' has a shorter lifetime than its ancestor: '${resolutionStack[maybeLongerLifetimeParentIndex].name.toString()}'`);
                  }
              }
              // Pushes the currently-resolving module information onto the stack
              resolutionStack.push({ name, lifetime });
              // Do the thing
              let cached;
              let resolved;
              switch (lifetime) {
                  case Lifetime.TRANSIENT:
                      // Transient lifetime means resolve every time.
                      resolved = resolver.resolve(container);
                      break;
                  case Lifetime.SINGLETON:
                      // Singleton lifetime means cache at all times, regardless of scope.
                      cached = rootContainer.cache.get(name);
                      if (!cached) {
                          // if we are running in strict mode, perform singleton resolution using the root
                          // container only.
                          resolved = resolver.resolve(options.strict ? rootContainer : container);
                          rootContainer.cache.set(name, { resolver, value: resolved });
                      }
                      else {
                          resolved = cached.value;
                      }
                      break;
                  case Lifetime.SCOPED:
                      // Scoped lifetime means that the container
                      // that resolves the registration also caches it.
                      // If this container cache does not have it,
                      // resolve and cache it rather than using the parent
                      // container's cache.
                      cached = container.cache.get(name);
                      if (cached !== undefined) {
                          // We found one!
                          resolved = cached.value;
                          break;
                      }
                      // If we still have not found one, we need to resolve and cache it.
                      resolved = resolver.resolve(container);
                      container.cache.set(name, { resolver, value: resolved });
                      break;
                  default:
                      throw new AwilixResolutionError(name, resolutionStack, `Unknown lifetime "${resolver.lifetime}"`);
              }
              // Pop it from the stack again, ready for the next resolution
              resolutionStack.pop();
              return resolved;
          }
          catch (err) {
              // When we get an error we need to reset the stack. Mutate the existing array rather than
              // updating the reference to ensure all parent containers' stacks are also updated.
              resolutionStack.length = 0;
              throw err;
          }
      }
      /**
       * Checks if the registration with the given name exists.
       *
       * @param {string | symbol} name
       * The name of the registration to resolve.
       *
       * @return {boolean}
       * Whether or not the registration exists.
       */
      function hasRegistration(name) {
          return !!getRegistration(name);
      }
      /**
       * Given a registration, class or function, builds it up and returns it.
       * Does not cache it, this means that any lifetime configured in case of passing
       * a registration will not be used.
       *
       * @param {Resolver|Constructor|Function} targetOrResolver
       * @param {ResolverOptions} opts
       */
      function build(targetOrResolver, opts) {
          if (targetOrResolver && targetOrResolver.resolve) {
              return targetOrResolver.resolve(container);
          }
          const funcName = 'build';
          const paramName = 'targetOrResolver';
          AwilixTypeError.assert(targetOrResolver, funcName, paramName, 'a registration, function or class', targetOrResolver);
          AwilixTypeError.assert(typeof targetOrResolver === 'function', funcName, paramName, 'a function or class', targetOrResolver);
          const resolver = isClass(targetOrResolver)
              ? asClass(targetOrResolver, opts)
              : asFunction(targetOrResolver, opts);
          return resolver.resolve(container);
      }
      /**
       * Disposes this container and it's children, calling the disposer
       * on all disposable registrations and clearing the cache.
       */
      function dispose() {
          const entries = Array.from(container.cache.entries());
          container.cache.clear();
          return Promise.all(entries.map(([, entry]) => {
              const { resolver, value } = entry;
              const disposable = resolver;
              if (disposable.dispose) {
                  return Promise.resolve().then(() => disposable.dispose(value));
              }
              return Promise.resolve();
          })).then(() => undefined);
      }
  }

  exports.AwilixError = AwilixError;
  exports.AwilixRegistrationError = AwilixRegistrationError;
  exports.AwilixResolutionError = AwilixResolutionError;
  exports.AwilixTypeError = AwilixTypeError;
  exports.InjectionMode = InjectionMode;
  exports.Lifetime = Lifetime;
  exports.RESOLVER = RESOLVER;
  exports.aliasTo = aliasTo;
  exports.asClass = asClass;
  exports.asFunction = asFunction;
  exports.asValue = asValue;
  exports.createBuildResolver = createBuildResolver;
  exports.createContainer = createContainer;
  exports.createDisposableResolver = createDisposableResolver;
  exports.isClass = isClass;
  exports.isFunction = isFunction;

}));
