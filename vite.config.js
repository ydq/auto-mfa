import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import copy from "rollup-plugin-copy"
import { ArcoResolver } from 'unplugin-vue-components/resolvers';

// https://vite.dev/config/
const commonCfg = defineConfig({
    plugins: [
        vue(),
        Components({
            resolvers: [
                name => {
                    if (name.startsWith('Icon'))
                        return { name, from: '@arco-design/web-vue/es/icon' }
                },
                ArcoResolver({ sideEffect: true }),
            ]
        }),
        copy({
            targets: [
                { src: "src/chrome/manifest.json", dest: "dist" },
            ],
            hook: "writeBundle",
        })
    ],

    build: {
        target: "esnext",
        rollupOptions: {
            input: ["index.html", "src/chrome/background.js"],
            output: {
                chunkFileNames: "assets/[name].[hash].js",
                assetFileNames: "assets/[name].[hash].[ext]",
                entryFileNames: "[name].js",
                dir: "dist",
            }
        },
    },
})

export default ({ command, mode }) => {
    if (command === 'build' && mode === 'watch') {
        commonCfg.build ??= {}
        commonCfg.build.watch ??= {}
    }
    return commonCfg
}