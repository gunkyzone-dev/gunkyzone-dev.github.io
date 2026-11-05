import { readdir, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pdf } from 'pdf-to-img';
import sharp from 'sharp';

const projectDirectory = fileURLToPath(new URL('../', import.meta.url));
const sourceDirectory = path.join(projectDirectory, 'public', 'comics');
const outputDirectory = path.join(projectDirectory, 'dist', 'comics');
const maxPageWidth = 1920;
const maxPageHeight = 3200;
const webpQuality = 86;

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

const comicPdfs = (await readdir(sourceDirectory, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && /\.pdf$/i.test(entry.name))
  .map((entry) => entry.name)
  .sort();

if (comicPdfs.length === 0) {
  console.info('No comic PDFs found; skipping page conversion.');
  process.exit(0);
}

await mkdir(outputDirectory, { recursive: true });

const outputIssues = new Set();

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
  await rm(issueDirectory, { recursive: true, force: true });
  await mkdir(issueDirectory, { recursive: true });

  const sourcePageNames = await readSourcePages(issueName);
  const pageFiles = [];

  if (sourcePageNames) {
    for (const [index, sourcePageName] of sourcePageNames.entries()) {
      const pageName = `${issueName}_${String(index + 1).padStart(3, '0')}.webp`;
      const sourcePagePath = path.join(sourceDirectory, issueName, sourcePageName);
      await writeWebpPage(await readFile(sourcePagePath), issueDirectory, pageName);
      pageFiles.push(pageName);
    }
  } else {
    const document = await pdf(path.join(sourceDirectory, pdfName), { scale: 3 });
    try {
      for await (const image of document) {
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

  console.info(
    `${pdfName}: generated ${pageFiles.length} WebP pages (${(totalBytes / 1024 / 1024).toFixed(2)} MB).`,
  );
}
