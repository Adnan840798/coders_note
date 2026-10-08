import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { svelte, vitePreprocess } from '@sveltejs/vite-plugin-svelte'
import { resolve } from 'path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'electron/main.ts')
        },
        output: {
          entryFileNames: '[name].js'
        }
      }
    },
    resolve: {
      alias: { '@shared': resolve(__dirname, 'shared') }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'electron/preload.ts')
        },
        output: {
          entryFileNames: '[name].js'
        }
      }
    },
    resolve: {
      alias: { '@shared': resolve(__dirname, 'shared') }
    }
  },
  renderer: {
    root: resolve(__dirname, '.'),
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'index.html')
      }
    },
    plugins: [
      svelte({
        preprocess: vitePreprocess()
      })
    ],
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src'),
        '@shared':   resolve(__dirname, 'shared')
      }
    }
  }
})
