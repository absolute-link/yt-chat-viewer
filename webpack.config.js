const path = require('path');

module.exports = {
    mode: 'production',
    entry: './src/viewer.ts',
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        extensions: ['.ts'],
    },
    output: {
        filename: 'viewer.js',
        path: path.resolve(__dirname, 'dist'),
    },
};
