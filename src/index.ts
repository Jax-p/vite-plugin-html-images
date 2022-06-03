import * as path from 'path';
import * as url from 'url';
import * as fs from "fs";
import chalk from "chalk";
import {normalizePath, ResolvedConfig} from "vite";
import {ImageOptions, OptimizationOptions} from "./types";
import {defaultImageOptions} from "./defaults";
import sharp from "sharp";

export default (
    imgOptions?: ImageOptions,
    optOptions: Partial<OptimizationOptions> = {}
) => {
    let isDevServer: boolean = false;
    let srcDir: string;
    let tempPath: string;
    imgOptions = {...defaultImageOptions, ...imgOptions};
    const {tempDirname, regexp} = imgOptions;

    return {
        name: 'vite-plugin-html-images',
        enforce: 'pre',
        configResolved: onConfigResolved,
        transformIndexHtml: {
            enforce: 'pre',
            transform: handleHtmlTransformation
        },
    }

    /** catches Vite ResolvedConfig and setups local config */
    function onConfigResolved(resolvedConfig: ResolvedConfig) {
        isDevServer = resolvedConfig.command === 'serve'
        srcDir = resolvedConfig.root;
        // fix for use-case when .html file is in root, not in src (Vite doesn't provide src path in config)
        if (!srcDir.endsWith('src')) srcDir += '/src'
        tempPath = path.resolve(srcDir, tempDirname)
        !fs.existsSync(tempPath) && fs.mkdirSync(tempPath);
        registerShutdownCallback();
    }

    /** entry function (put html here and it`s done) */
    async function handleHtmlTransformation (html: string): Promise<string | null | void> {
        let images;
        images = Array.from(html.matchAll(regexp));
        if (!images.length) return;
        for (const match of images) {
            html = await processImage(match[0], tempPath, html);
        }
        return html;
    }

    /** generates image name, image and replaces paths in html */
    async function processImage(src: string, outDir: string, html: string) {
        const stripped = src.replace(/"/g, '');
        const imageUrl = url.parse(stripped, true);
        if (!imageUrl.pathname) return html;
        const decodedPathname = decodeURI(imageUrl.pathname);
        const pathname = decodedPathname.startsWith('/') ? decodedPathname.slice(1,decodedPathname.length) : decodedPathname;
        const basename = path.basename(pathname);
        const filename = path.resolve(srcDir, pathname);
        const params = imageUrl.query;
        const sharpImage = await sharp(filename);

        let outName = path.parse(basename).name;
        let outExt = path.parse(basename).ext;

        if (params['width'] || params['height']) {
            outName += await handleResizeWidth(sharpImage, params['width'] as string, params['height'] as string)
        }
        if (params['format']) {
            outExt = await handleFormat(params['format'] as string, sharpImage, params.format)
        }
        else if (params['quality']) {
            outExt = await handleFormat(getExt(basename), sharpImage, params.quality)
        }

        outName += outExt;
        if (outName === stripped) return html;
        const outPath = path.resolve(outDir, outName);
        if (!fs.existsSync(outPath)) {
            const originalSize = getFileSize(filename);
            const start = new Date();
            await sharpImage.toFile(outPath)
            const end = new Date();
            isDevServer && printStats(outName, originalSize, getFileSize(outPath), start, end);
        }
        return html.replace(src, normalizePath(`${tempDirname}/${outName}`))
    }

    /** prints optimization stats */
    function printStats(outName: string, originalSize: number, newSize: number, start: Date, end: Date) {
        const maxLabelLength = 30;
        const seconds = ((end.getTime() - start.getTime()) / 1000).toString();
        if (outName.length > maxLabelLength)
            outName = outName.substring(0, maxLabelLength - 1) + '…';
        let cliMsgName = chalk`{grey Generated} {magenta ${outName.padEnd(40)}}`;
        const cliMsgValue = chalk`(${originalSize.toString()} kB → {${originalSize > newSize ? 'green' : 'red'} ${newSize.toString()} kB})`;
        const cliMsg = cliMsgName + cliMsgValue;
        const cliMsgTime = chalk`{grey in ${seconds}s}`
        console.info(cliMsg.padEnd(100) + cliMsgTime);
    }

    /** Resizing images by width */
    async function handleResizeWidth(sharpImage: sharp.Sharp, width?: string, height?: string): Promise<string> {
        const _width = width ? parseInt(width) : null;
        const _height = height ? parseInt(height) : null;
        if (_width && isNaN(_width))
            console.error(`Parameter width with value ${width} is not parsable to integer.`)
        if (_height && isNaN(_height))
            console.error(`Parameter width with value ${height} is not parsable to integer.`)
        await sharpImage.resize({
            width: _width,
            height: _height
        });
        return (_width ? `.w${_width}` : '') + (_height ? `.h${_height}` : '');
    }

    /** Handles format conversion and quality optimization */
    async function handleFormat(format: string, sharpImage: sharp.Sharp, quality?: unknown): Promise<string> {
        const resolvedFormat = format === 'jpg' ? 'jpeg' : format;
        const parsedQuality = quality && typeof quality === 'string' ? parseInt(quality) : null;
        if (!Object.keys(sharp.format).includes(resolvedFormat))
            console.error(`Image format ${resolvedFormat} is not supported.`);
        if (parsedQuality && isNaN(parsedQuality))
            console.error(`Image quality ${quality} is not valid integer.`);
        const baseOptions = optOptions[resolvedFormat] || {};
        const options = parsedQuality ? {...baseOptions, quality: parsedQuality} : baseOptions;
        const info = await sharpImage[resolvedFormat](options);
        const outputQuality = info?.options?.[`${resolvedFormat}Quality`] || null;
        return (outputQuality ? `.q${outputQuality}` : '') + `.${format}`;
    }

    /** Returns extension name without dot (.jpg vs jpg). */
    function getExt(filename: string) {
        const ext = path.extname(filename||'').split('.');
        return ext[ext.length - 1];
    }

    /** megabyte rounded on 2 decimals */
    function getFileSize(filename: string): number {
        return Math.round(fs.statSync(filename).size / (1024));
    }

    /** Removes temp items on VitDevServer shutdown*/
    function registerShutdownCallback() {
        process.on('SIGINT', function() {
            fs.existsSync(tempPath) && fs.rmSync(tempPath, {recursive: true});
            process.exit();
        });
    }
}
