import { readFileSync, readdirSync } from 'node:fs'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => ({
    plugins: [
        vue({ features: { vapor: true, optionsAPI: false } }),
        {
            name: 'extension-manifest',
            buildStart() {
                for (const file of ['src/chrome/manifest.json', 'LICENSE', 'THIRD_PARTY_NOTICES.md', ...readdirSync('src/i18n').filter(file => file.endsWith('.json')).map(file => `src/i18n/${file}`)]) this.addWatchFile(file)
            },
            generateBundle() {
                for (const file of readdirSync('src/i18n').filter(file => file.endsWith('.json'))) {
                    const locale = file.slice(0, -5).replaceAll('-', '_')
                    const source = readFileSync(`src/i18n/${file}`, 'utf8')
                    this.emitFile({ type: 'asset', fileName: `_locales/${locale}/messages.json`, source })
                    if (locale === 'pt_BR') this.emitFile({ type: 'asset', fileName: '_locales/pt_PT/messages.json', source })
                }
                this.emitFile({ type: 'asset', fileName: 'manifest.json', source: readFileSync('src/chrome/manifest.json', 'utf8') })
                this.emitFile({ type: 'asset', fileName: 'LICENSE', source: readFileSync('LICENSE', 'utf8') })
                this.emitFile({ type: 'asset', fileName: 'THIRD_PARTY_NOTICES.md', source: readFileSync('THIRD_PARTY_NOTICES.md', 'utf8').replace('](docs/licenses/THIRD_PARTY_LICENSES.md)', '](THIRD_PARTY_LICENSES.md)') })
            },
        },
    ],
    build: {
        target: 'esnext',
        license: { fileName: 'THIRD_PARTY_LICENSES.md' },
        ...(mode === 'watch' ? { watch: {} } : {}),
        rollupOptions: {
            input: ['index.html', 'src/chrome/background.js'],
            output: {
                chunkFileNames: 'assets/[name].[hash].js',
                assetFileNames: 'assets/[name].[hash].[ext]',
                entryFileNames: '[name].js',
            },
        },
    },
}))
