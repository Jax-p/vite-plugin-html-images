import type {Sharp, OutputOptions, FormatEnum, Color} from "sharp";

/**
 * The optimization options for each specific image format
 */
export type OptimizationOptions = {
    [F in keyof FormatEnum]:
      // the options Sharp provides for each format
        ( F extends keyof Sharp ? Parameters<Sharp[F]>[0] : OutputOptions )
      // options added specifically by this plugin
      & { background?: Color }
}

export interface ImageOptions
{
    /**
     * The temporary directory must be inside the source directory (src)
     * so that the images can be accessed from the browser while the dev server is running.
     */
    tempDirname?: string,

    /**
     * Regular expression that retrieves URLs of images in HTML.
     * Match (the image url) must be on index 0.
     */
    regexp?: RegExp

    /**
     * Behavior of the plugin when vite is in dev mode.
     * - "transform" - transform images as intended (slowest)
     * - "skip" - skip any image transformation and use the original image (fastest, practically disables the plugin in dev mode)
     * - "formatOnly" - only tranform images to the specified format (faster than "transform" when using multiple transforms of the same image)
     * @default "transform"
     */
    devMode?: "transform" | "skip" | "formatOnly"
}
