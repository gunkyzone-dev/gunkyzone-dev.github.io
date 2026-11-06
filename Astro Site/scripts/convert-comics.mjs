import { readdir, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pdf } from 'pdf-to-img';
import sharp from 'sharp';

const projectDirectory = fileURLToPath(new URL('../', import.meta.url));
const sourceDirectory = path.join(projectDirectory, 'public', 'comics');
const outputDirectory = path.join(projectDirectory, 'dist', 'comics');
const thumbnailDirectory = path.join(projectDirectory, 'dist', 'thumbnails');
const mediaCatalogPath = path.join(projectDirectory, 'dist', 'data', 'media.json');
const titleManifestPath = path.join(projectDirectory, 'dist', 'data', 'comic-titles.json');
const maxPageWidth = 1920;
const maxPageHeight = 3200;
const webpQuality = 86;
const thumbnailWidth = 480;
const thumbnailHeight = 720;
const thumbnailQuality = 80;

async function readSourcePages(issueName) {
  const manifestPath = path.join(sourceDirectory, issueName, 'pages.json');
  let manifestContents;

  try {
    manifestContents = await readFile(manifestPath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }

  let pageNames;
  try {
    pageNames = JSON.parse(manifestContents);
  } catch (error) {
    throw new Error(`Invalid comic page manifest: ${manifestPath}`, { cause: error });
  }

  if (!Array.isArray(pageNames) || pageNames.length === 0) {
    throw new Error(`Comic page manifest must contain a non-empty array: ${manifestPath}`);
  }

  for (const pageName of pageNames) {
    if (
      typeof pageName !== 'string' ||
      path.basename(pageName) !== pageName ||
      /[\\/]/.test(pageName) ||
      !/\.(?:webp|png|jpe?g|avif)$/i.test(pageName)
    ) {
      throw new Error(`Invalid page filename in ${manifestPath}: ${pageName}`);
    }
  }

  return pageNames;
}

async function writeWebpPage(image, issueDirectory, pageName) {
  await sharp(Buffer.from(image))
    .resize({
      width: maxPageWidth,
      height: maxPageHeight,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: webpQuality, effort: 5, smartSubsample: true })
    .toFile(path.join(issueDirectory, pageName));
}

async function writeComicThumbnail(image, thumbnailPath) {
  await sharp(Buffer.from(image))
    .resize({
      width: thumbnailWidth,
      height: thumbnailHeight,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: thumbnailQuality, effort: 5, smartSubsample: true })
    .toFile(thumbnailPath);
}

function comicIssueKey(url) {
  const fileName = String(url || '')
    .split(/[?#]/, 1)[0]
    .replace(/\/+$/, '')
    .split('/')
    .pop();
  return (fileName || '').replace(/(?:_compressed)?\.pdf$/i, '').toLowerCase();
}

const comicPdfs = (await readdir(sourceDirectory, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && /\.pdf$/i.test(entry.name))
  .map((entry) => entry.name)
  .sort();

if (comicPdfs.length === 0) {
  console.info('No comic PDFs found; skipping page conversion.');
  process.exit(0);
}

const titleManifest = JSON.parse(await readFile(titleManifestPath, 'utf8'));
if (!titleManifest || typeof titleManifest !== 'object' || Array.isArray(titleManifest)) {
  throw new Error(`Invalid comic title manifest object: ${titleManifestPath}`);
}

const pdfNames = new Set(comicPdfs.map((name) => name.toLowerCase()));
const titleOverrides = new Map();
for (const [pdfName, title] of Object.entries(titleManifest)) {
  if (path.basename(pdfName) !== pdfName || /[\\/]/.test(pdfName) || !/\.pdf$/i.test(pdfName)) {
    throw new Error(`Invalid PDF filename in comic title manifest: ${pdfName}`);
  }
  if (!pdfNames.has(pdfName.toLowerCase())) {
    throw new Error(`Comic title manifest references a missing PDF: ${pdfName}`);
  }
  if (typeof title !== 'string' || !title.trim() || title.trim().length > 120) {
    throw new Error(`Comic title must be a non-empty string of at most 120 characters: ${pdfName}`);
  }
  const normalizedName = pdfName.toLowerCase();
  if (titleOverrides.has(normalizedName)) {
    throw new Error(`Duplicate comic title manifest entry: ${pdfName}`);
  }
  titleOverrides.set(normalizedName, title.trim());
}

await mkdir(outputDirectory, { recursive: true });
await mkdir(thumbnailDirectory, { recursive: true });

const outputIssues = new Set();
const generatedComics = [];

for (const pdfName of comicPdfs) {
  const issueName = pdfName.replace(/(?:_compressed)?\.pdf$/i, '');
  if (!/^[\w-]+$/.test(issueName)) {
    throw new Error(`Comic PDF filename must use letters, numbers, "_" or "-": ${pdfName}`);
  }
  if (outputIssues.has(issueName.toLowerCase())) {
    throw new Error(`Multiple comic PDFs map to the output folder "${issueName}".`);
  }
  outputIssues.add(issueName.toLowerCase());

  const issueDirectory = path.join(outputDirectory, issueName);
  const thumbnailName = `${issueName}_THUMB.webp`;
  const thumbnailPath = path.join(thumbnailDirectory, thumbnailName);
  await rm(issueDirectory, { recursive: true, force: true });
  await mkdir(issueDirectory, { recursive: true });

  const sourcePageNames = await readSourcePages(issueName);
  const pageFiles = [];

  if (sourcePageNames) {
    for (const [index, sourcePageName] of sourcePageNames.entries()) {
      const pageName = `${issueName}_${String(index + 1).padStart(3, '0')}.webp`;
      const sourcePage = await readFile(path.join(sourceDirectory, issueName, sourcePageName));
      if (index === 0) await writeComicThumbnail(sourcePage, thumbnailPath);
      await writeWebpPage(sourcePage, issueDirectory, pageName);
      pageFiles.push(pageName);
    }
  } else {
    const document = await pdf(path.join(sourceDirectory, pdfName), { scale: 3 });
    try {
      for await (const image of document) {
        if (pageFiles.length === 0) await writeComicThumbnail(image, thumbnailPath);
        const pageName = `${issueName}_${String(pageFiles.length + 1).padStart(3, '0')}.webp`;
        await writeWebpPage(image, issueDirectory, pageName);
        pageFiles.push(pageName);
      }
    } finally {
      await document.destroy();
    }
  }

  if (pageFiles.length === 0) {
    throw new Error(`No pages could be converted from ${pdfName}.`);
  }

  await writeFile(
    path.join(issueDirectory, 'pages.json'),
    `${JSON.stringify(pageFiles)}\n`,
    'utf8',
  );

  const totalBytes = await Promise.all(
    pageFiles.map(async (pageName) => (await stat(path.join(issueDirectory, pageName))).size),
  ).then((sizes) => sizes.reduce((total, size) => total + size, 0));

  const titleOverride = titleOverrides.get(pdfName.toLowerCase());
  generatedComics.push({
    title: titleOverride || issueName.replace(/[_-]+/g, ' ').toUpperCase(),
    url: `/comics/${pdfName}`,
    thumbnail: `/thumbnails/${thumbnailName}`,
    uploadedAt: Date.now(),
    autoGenerated: true,
    ...(titleOverride ? { titleOverride: true } : {}),
  });

  console.info(
    `${pdfName}: generated ${pageFiles.length} WebP pages (${(totalBytes / 1024 / 1024).toFixed(2)} MB).`,
  );
}

const mediaCatalog = JSON.parse(await readFile(mediaCatalogPath, 'utf8'));
if (!mediaCatalog || typeof mediaCatalog !== 'object' || Array.isArray(mediaCatalog)) {
  throw new Error(`Invalid media catalog object: ${mediaCatalogPath}`);
}
if (mediaCatalog.comics !== undefined && !Array.isArray(mediaCatalog.comics)) {
  throw new Error(`Media catalog comics field must be an array: ${mediaCatalogPath}`);
}
const comicEntries = [...(mediaCatalog.comics || [])];
const existingIssueIndexes = new Map();
comicEntries.forEach((comic, index) => {
  const issueKey = comicIssueKey(comic && comic.url);
  if (issueKey && !existingIssueIndexes.has(issueKey)) existingIssueIndexes.set(issueKey, index);
});
let addedEntries = 0;

for (const comic of generatedComics) {
  const issueKey = comicIssueKey(comic.url);
  const existingIndex = existingIssueIndexes.get(issueKey);
  if (existingIndex !== undefined) {
    if (comic.titleOverride) {
      comicEntries[existingIndex] = {
        ...comicEntries[existingIndex],
        title: comic.title,
        titleOverride: true,
      };
    }
    continue;
  }
  comicEntries.push(comic);
  existingIssueIndexes.set(issueKey, comicEntries.length - 1);
  addedEntries++;
}

mediaCatalog.comics = comicEntries;
await writeFile(mediaCatalogPath, `${JSON.stringify(mediaCatalog, null, 2)}\n`, 'utf8');
console.info(`Comic catalog updated: ${addedEntries} new ${addedEntries === 1 ? 'entry' : 'entries'}.`);
