export default {
  multipass: true,
  plugins: [
    {
      name: 'preset-default',
      params: {
        overrides: {
          cleanupIds: false
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
