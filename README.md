# vite-plugin-html-images
[Vite](https://github.com/vitejs/vite) plugin that transforms images with query parameters from HTML using [sharp](https://github.com/lovell/sharp).

✔️ Works with ViteDevServer (*tempDir* must be in *src* directory)  
✔️ Finds images in `<img src/>`, `srcset` and `source` (with default settings, otherwise it works according to your regular expression)

## Install
**Yarn**
```
yarn add vite-plugin-imagemin -D
```
or **npm**
```
npm i vite-plugin-imagemin --save-dev
```

## Usage
The vite-plugin-html-images plugin transforms and optimize images that are contained in HTML.
### Configuration
Use plugin in your Vite config (`vite.config.ts`)
```
import htmlImages from 'vite-plugin-html-images'

export default {
    plugins: [
        htmlImages(),
    ]
}
```
### Usage in HTML
Use the image as always but add the parameters you would like to change.   
**Input**: `src/index.html`:
```
<img src="img/example.png?width=500&format=webp&quality=70"/>
```   
**Output**: `dist/index.html`:
```
<img src="/assets/example.w500.q70.84abd836.webp"/>
```
*The image has been scaled to 500 pixels by width and converted to Webp format with 70% quality optimization.*


## Advanced usage
### Default optimization options
You can setup default optimization options for each image type.
```
import htmlImages from 'vite-plugin-html-images'

export default {
    plugins: [
        htmlImages({
            { tempDirname: '.myTempDirForImages' },
            { jpeg: {quality: 20, mozjpeg: true} }
        }),
    ]
}
```
In this sample, tempdir is set to a custom folder (don't forget to add it to .gitignore) and the default optimization for files that will be converted to JPG format. Images that do not have the quality parameter will be converted with 20% quality.

## Options
### Plugin options
Interface `ImageOptions`

| Parameter | Type  | Description |
| ----------- | -----------  | ----------- |
| tempDirname | `string` | The temporary directory must be inside the source directory (src) so that the images can be accessed from the browser while the dev server is running.
| regexp   | RegExp  | Regular expression that retrieves URLs of images in HTML. Match (the image url) must be on index 0.
You can check default values in [defaults.ts](src/defaults.ts).

### Optimization options
Interface `OptimizationOptions`

| Parameter | Type  |
| ----------- | -----------  | 
| jpeg |  sharp.JpegOptions
| png   | sharp.PngOptions  | 
| webp   | sharp.WebpOptions  | 
View a detailed list of [sharp types](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/sharp/index.d.ts).