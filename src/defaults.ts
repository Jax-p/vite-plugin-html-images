import {ImageOptions, OptimizationOptions} from "./types";

export const defaultOptimizationOptions: OptimizationOptions = {
    jpeg: {
        mozjpeg: true,
        quality: 81
    },
    png: {
        compressionLevel: 9,
        quality: 81
    }
}

export const defaultImageOptions: ImageOptions = {
    tempDirname: '.img',
    regexp: /img\/.+\.(jpg|jpeg|png|gif)[^( |"|')]+/g
}