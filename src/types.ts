import * as sharp from "sharp";

export interface OptimizationOptions {
    jpeg?: sharp.JpegOptions,
    png?: sharp.PngOptions
}

export interface ImageOptions
{
    /**
     * The temporary directory must be inside the source directory (src)
     * so that the images can be accessed from the browser while the dev server is running.
     */
    tempDirname: string,

    /**
     * Regular expression that retrieves URLs of images in HTML.
     * Match (the image url) must be on index 0.
     */
    regexp: RegExp
}