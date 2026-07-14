/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-cross-module-internal-imports',
      severity: 'error',
      comment:
        'ADR-001 / Backend Guidelines: bounded contexts must not import another context internal implementation. Cross-module use is limited to the target public barrel (index.ts).',
      from: {
        path: 'apps/api/src/modules/([^/]+)/',
      },
      to: {
        path: 'apps/api/src/modules/([^/]+)/',
        pathNot: [
          'apps/api/src/modules/$1/',
          'apps/api/src/modules/[^/]+/index\\.ts$',
        ],
      },
    },
    {
      name: 'composition-uses-public-module-api',
      severity: 'error',
      comment:
        'Composition roots may wire modules only through each bounded context public barrel (index.ts).',
      from: {
        path: 'apps/api/src/(app\\.module\\.ts|main\\.ts|modules/index\\.ts)$',
      },
      to: {
        path: 'apps/api/src/modules/([^/]+)/',
        pathNot: 'apps/api/src/modules/[^/]+/index\\.ts$',
      },
    },
    {
      name: 'no-common-depends-on-modules',
      severity: 'error',
      comment:
        'Platform common layer must remain free of product bounded-context dependencies.',
      from: {
        path: 'apps/api/src/common/',
      },
      to: {
        path: 'apps/api/src/modules/',
      },
    },
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular dependencies in the API skeleton are forbidden.',
      from: {},
      to: {
        circular: true,
      },
    },
  ],
  options: {
    doNotFollow: {
      path: ['node_modules', 'dist', 'coverage', 'EduCore'],
    },
    exclude: {
      path: [
        'apps/api/src/modules/[^/]+/tests/',
        'apps/api/src/.*\\.test\\.ts$',
        'apps/api/src/.*\\.smoke\\.test\\.ts$',
      ],
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: 'tsconfig.json',
    },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
      extensions: ['.ts', '.js', '.mjs', '.cjs', '.json'],
    },
    reporterOptions: {
      text: {
        highlightFocused: true,
      },
    },
  },
};
