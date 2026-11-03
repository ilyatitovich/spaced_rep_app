import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const plugin = require('eslint-plugin-boundaries')
const resolved = plugin.default ?? plugin
const dependencies = resolved.rules.dependencies

const resolverPath = require.resolve('./import-resolver.cjs')

// oxlint does not call the plugin's esquery selectors, so forward each
// import and export source to them. Also resolve @/ and @ext/: the plugin's
// resolver does not know those aliases.
function asLiteral(source, parent) {
  if (!source || typeof source.value !== 'string') return null
  if (source.type === 'Literal') return source
  return {
    type: 'Literal',
    value: source.value,
    parent,
    loc: source.loc,
    range: source.range
  }
}

function visitSource(visitors, key, node) {
  const literal = asLiteral(node.source, node)
  if (literal) visitors[key]?.(literal)
}

export default {
  meta: { name: 'boundaries' },
  rules: {
    ...resolved.rules,
    dependencies: {
      ...dependencies,
      create(context) {
        const settings = {
          ...context.settings,
          'import/resolver': { [resolverPath]: {} }
        }
        const wrapped = new Proxy(context, {
          get(target, prop, receiver) {
            if (prop === 'settings') return settings
            return Reflect.get(target, prop, receiver)
          }
        })
        const visitors = dependencies.create(wrapped)
        return {
          ImportDeclaration(node) {
            visitSource(
              visitors,
              node.importKind === 'type'
                ? 'ImportDeclaration[importKind=type] > Literal'
                : 'ImportDeclaration:not([importKind=type]) > Literal',
              node
            )
          },
          ExportAllDeclaration(node) {
            visitSource(
              visitors,
              node.exportKind === 'type'
                ? 'ExportAllDeclaration[exportKind=type] > Literal'
                : 'ExportAllDeclaration:not([exportKind=type]) > Literal',
              node
            )
          },
          ExportNamedDeclaration(node) {
            visitSource(
              visitors,
              node.exportKind === 'type'
                ? 'ExportNamedDeclaration[exportKind=type] > Literal'
                : 'ExportNamedDeclaration:not([exportKind=type]) > Literal',
              node
            )
          }
        }
      }
    }
  }
}
