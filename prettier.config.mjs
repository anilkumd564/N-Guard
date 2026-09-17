/**
 * N-Guard — Prettier Configuration
 */

/** @type {import('prettier').Config} */
export default {
  semi            : true,
  singleQuote     : true,
  trailingComma   : 'all',
  printWidth      : 100,
  tabWidth        : 2,
  useTabs         : false,
  bracketSpacing  : true,
  arrowParens     : 'avoid',
  endOfLine       : 'lf',
  overrides: [
    {
      files  : ['*.cds'],
      options: { parser: 'babel' },
    },
    {
      files  : ['*.json'],
      options: { printWidth: 120 },
    },
  ],
};
