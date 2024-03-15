import * as path from 'path';
import * as url from 'url';
import * as fs from 'fs';
import chalkTemplate from 'chalk-template';
import type {Plugin} from 'vite';
import {normalizePath, ResolvedConfig} from 'vite';
import {ImageOptions, OptimizationOptions} from './types';
import {defaultImageOptions} from './defaults';
import sharp from 'sharp';

export default (
    imgOptions?: ImageOptions,
    optOptions: Partial<OptimizationOptions> = {}
): Plugin => {
    let isDevServer: boolean = false;
    let srcDir: string;
    let tempPath: string;
    let generatedCount = 0;
    const generated: {[key: string]: Promise<void>} = {};
    imgOptions = {...defaultImageOptions, ...imgOptions};
    const {tempDirname, regexp, devMode} = imgOptions;

    return {
        name: 'vite-plugin-html-images',
        enforce: 'pre',
        configResolved: onConfigResolved,
        transformIndexHtml: {
            order: 'pre',
            handler: handleHtmlTransformation
        }
    };

    /** catches Vite ResolvedConfig and setups local config */
    function onConfigResolved(resolvedConfig: ResolvedConfig) {
        isDevServer = resolvedConfig.command === 'serve';
        srcDir = resolvedConfig.root;
        // fix for use-case when .html file is in root, not in src (Vite doesn't provide src path in config)
        if (!srcDir.endsWith('src')) srcDir += '/src';
        tempPath = path.resolve(srcDir, tempDirname);
        !fs.existsSync(tempPath) && fs.mkdirSync(tempPath);
        registerShutdownCallback();
    }

    /** entry function (put html here and it`s done) */
    async function handleHtmlTransformation(html: string): Promise<string | null | void> {
        let images = Array.from(html.matchAll(regexp));
        if (!images.length) return;
        generatedCount = 0;
        const start = new Date();
        const replacements = images.map((match) => {
            const src = match[0];
            return [src, processImage(src, tempPath)] as const;
        });
        for (const replacement of replacements) {
            const [original, processed] = replacement;
            html = html.replaceAll(original, await processed);
        }
        if (isDevServer && generatedCount) {
            const end = new Date();
            const seconds = ((end.getTime() - start.getTime()) / 1000).toString();
            console.info(
                chalkTemplate`{grey Generated} {green ${generatedCount}}{grey /${images.length} images in ${seconds}s}`
            );
        }
        return html;
    }

    /** generates image name, image and returns the string that needs to replace src */
    async function processImage(src: string, outDir: string) {
        const stripped = src.replace(/"/g, '');
        const imageUrl = url.parse(stripped, true);
        if (!imageUrl.pathname) return src;
        const decodedPathname = decodeURI(imageUrl.pathname);
        if (isDevServer && devMode === 'skip') return decodedPathname;
        const pathname = decodedPathname.startsWith('/')
            ? decodedPathname.slice(1, decodedPathname.length)
            : decodedPathname;
        const basename = path.basename(pathname);
        const filename = path.resolve(srcDir, pathname);
        const params = imageUrl.query;
        const sharpImage = sharp(filename);

        let outName = path.parse(basename).name;
        let outExt = path.parse(basename).ext;

        if (params['width'] || params['height']) {
            outName += handleResizeWidth(
                sharpImage,
                params['width'] as string,
                params['height'] as string
            );
        }
        const format = (params['format'] as string | undefined) ?? getExt(basename);
        const quality = params['quality'] as string | undefined;
        const background = params['background'] as string | undefined;
        if (format || quality || background) {
            outExt = await handleConversion(sharpImage, format, {
                quality,
                background
            });
        }

        outName += outExt;
        if (outName === stripped) return src;
        const outPath = path.resolve(outDir, outName);
        if (generated[outPath] === undefined) {
            generated[outPath] = new Promise<void>(async (res) => {
                if (!fs.existsSync(outPath)) {
                    const originalSize = getFileSize(filename);
                    const start = new Date();
                    await sharpImage.toFile(outPath);
                    const end = new Date();
                    generatedCount++;
                    isDevServer &&
                        printStats(outName, originalSize, getFileSize(outPath), start, end);
                }
                res();
            });
        }
        await generated[outPath];
        return normalizePath(`${tempDirname}/${outName}`);
    }

    /** prints optimization stats */
    function printStats(
        outName: string,
        originalSize: number,
        newSize: number,
        start: Date,
        end: Date
    ) {
        const maxLabelLength = 36;
        const seconds = ((end.getTime() - start.getTime()) / 1000).toString();
        if (outName.length > maxLabelLength)
            outName = outName.substring(0, maxLabelLength - 1) + '…';
        let cliMsgName = chalkTemplate`{grey Generated} {magenta ${outName.padEnd(40)}}`;
        const cliMsgValue = chalkTemplate`(${originalSize.toString()} kB → {${
            originalSize > newSize ? 'green' : 'red'
        } ${newSize.toString()} kB})`;
        const cliMsg = cliMsgName + cliMsgValue;
        const cliMsgTime = chalkTemplate`{grey in ${seconds}s}`;
        console.info(cliMsg.padEnd(100) + cliMsgTime);
    }

    /** Resizing images by width */
    function handleResizeWidth(sharpImage: sharp.Sharp, width?: string, height?: string) {
        if (isDevServer && devMode !== 'transform') return '';
        const _width = width ? parseInt(width) : null;
        const _height = height ? parseInt(height) : null;
        if (_width && isNaN(_width))
            console.error(`Parameter width with value ${width} is not parsable to integer.`);
        if (_height && isNaN(_height))
            console.error(`Parameter width with value ${height} is not parsable to integer.`);
        sharpImage.resize({
            width: _width,
            height: _height
        });
        return (_width ? `.w${_width}` : '') + (_height ? `.h${_height}` : '');
    }

    /** Handles format conversion and quality optimization */
    async function handleConversion(
        sharpImage: sharp.Sharp,
        format: string,
        {quality, background}: {quality?: string; background?: sharp.Color} = {}
    ): Promise<string> {
        if (isDevServer && devMode === 'skip') return '';
        if (isDevServer && devMode === 'formatOnly') return `.${format}`;
        const resolvedFormat = format.toLowerCase() === 'jpg' ? 'jpeg' : format.toLowerCase();
        const parsedQuality = quality && typeof quality === 'string' ? parseInt(quality) : null;
        if (!Object.keys(sharp.format).includes(resolvedFormat))
            console.error(`Image format ${resolvedFormat} is not supported.`);
        if (parsedQuality && isNaN(parsedQuality))
            console.error(`Image quality ${quality} is not valid integer.`);
        const baseOptions = optOptions[resolvedFormat] ?? {};
        const options = {...baseOptions};
        if (parsedQuality) options.quality = parsedQuality;
        if (background) options.background = background;
        const parsedBackground = options.background
            ? handleBackground(sharpImage, options.background)
            : null;
        const info = await sharpImage[resolvedFormat](options);
        const outputQuality = info?.options?.[`${resolvedFormat}Quality`] || null;
        return (
            (parsedBackground ? `.x${parsedBackground.replace('#', '')}` : '') +
            (outputQuality ? `.q${outputQuality}` : '') +
            `.${format}`
        );
    }

    function handleBackground(sharpImage: sharp.Sharp, background?: string) {
        const parsedBackground = parseRGBColor(background);
        sharpImage.flatten({background: parsedBackground});
        return parsedBackground;
    }

    function parseRGBColor(color: sharp.Color) {
        const givenColor = color;
        if (typeof color === 'object')
            color = `${color.r.toString(16)}${color.g.toString(16)}${color.b.toString(16)}`;
        color = color.replace('#', '');
        if (!/^([0-9a-f]{2,3})|([0-9a-f]{6})$/.test(color))
            console.error(`Background color ${givenColor} is not valid.`);
        if (color.length === 2) color = `${color.repeat(3)}`;
        if (color.length === 3)
            color = `${color[0]}${color[0]}${color[1]}${color[1]}${color[2]}${color[2]}`;
        return `#${color}`;
    }

    /** Returns extension name without dot (.jpg vs jpg). */
    function getExt(filename: string) {
        const ext = path.extname(filename || '').split('.');
        return ext[ext.length - 1];
    }

    /** megabyte rounded on 2 decimals */
    function getFileSize(filename: string): number {
        return Math.round(fs.statSync(filename).size / 1024);
    }

    /** Removes temp items on VitDevServer shutdown*/
    function registerShutdownCallback() {
        process.on('SIGINT', function () {
            fs.existsSync(tempPath) && fs.rmSync(tempPath, {recursive: true});
            process.exit();
        });
    }
};
