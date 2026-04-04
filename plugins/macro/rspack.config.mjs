// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { defineConfig } from "@rspack/cli";

export default defineConfig({
    devtool: false,
    entry: {
        main: "./src/index.ts",
    },
    externals: {
        "@chili3d/core": "Chili3dCore",
        "@chili3d/element": "Chili3dElement",
    },
    externalsType: "assign",
    experiments: {
        css: true,
        outputModule: true,
    },
    module: {
        parser: {
            "css/auto": {
                namedExports: false,
            },
        },
        rules: [
            {
                test: /\.wasm$/,
                type: "asset",
            },
            {
                test: /\.cur$/,
                type: "asset",
            },
            {
                test: /\.jpg$/,
                type: "asset",
            },
            {
                test: /\.(j|t)s$/,
                loader: "builtin:swc-loader",
                options: {
                    jsc: {
                        parser: {
                            syntax: "typescript",
                            decorators: true,
                        },
                        target: "esnext",
                    },
                },
            },
        ],
    },
    resolve: {
        extensions: [".ts", ".js", ".json", ".wasm"],
    },
    optimization: {
        concatenateModules: true,
        avoidEntryIife: true,
        splitChunks: false,
        minimize: true,
    },
    output: {
        clean: true,
        filename: "extension.js",
        module: true,
        chunkFormat: "module",
        library: {
            type: "modern-module",
        },
        chunkLoading: "import",
        workerChunkLoading: "import",
    },
});
