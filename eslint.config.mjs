import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', 'coverage/'] },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    // Plain Node scripts (scripts/*.mjs) and this config file run under Node.
    files: ['**/*.mjs'],
    languageOptions: { globals: globals.node },
  },
  prettier
);
