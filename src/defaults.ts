import {ImageOptions} from "./types";

export const defaultImageOptions: ImageOptions = {
    tempDirname: '.img',
    regexp: /img\/.+\.(jpg|jpeg|png|gif)[^( |"|')]+/g
}