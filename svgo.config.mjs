export default {
  multipass: false,
  plugins: [
    {
      name: 'preset-default',
      params: {
        overrides: {
          cleanupIds: false,
          mergePaths: false,
          convertShapeToPath: false,
          removeHiddenElems: false,
          removeUselessDefs: false,
          collapseGroups: false,
          moveGroupAttrsToElems: false,
          moveElemsAttrsToGroup: false,
          inlineStyles: false,
          minifyStyles: false,
          convertPathData: { floatPrecision: 3 }
        }
      }
    },
    {
      name: 'prefixIds',
      params: {
        delim: '_',
        prefixIds: true,
        prefixClassNames: false
      }
    }
  ]
};
