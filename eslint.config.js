import js from '@eslint/js'
import globals from 'globals'
import {defineConfig} from 'eslint/config'

export default defineConfig([
    {
        files: ['**/*.{js,mjs,cjs}'],
        plugins: {js},
        extends: ['js/recommended'],
        languageOptions: {globals: globals.node},
        rules: {
            ...js.configs.recommended.rules, // Spread the recommended rules

            // Customizations:
            'no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                },
            ],
            'no-useless-catch': 'warn',
            'no-console': 'off', // Since you're transitioning to Pino, you might want this off for now
        },
    },
])
