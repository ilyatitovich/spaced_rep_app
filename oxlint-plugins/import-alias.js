const PARENT = /^\.{2}(?:\/|$)/

export default {
  meta: { name: 'import-alias' },
  rules: {
    'prefer-alias': {
      meta: {
        type: 'suggestion',
        docs: {
          description:
            'Import through a path alias instead of a parent relative path.'
        }
      },
      create(context) {
        return {
          ImportDeclaration(node) {
            const value = node.source?.value
            if (typeof value === 'string' && PARENT.test(value)) {
              context.report({
                node: node.source,
                message:
                  'Import through a path alias instead of a parent relative path.'
              })
            }
          }
        }
      }
    }
  }
}
