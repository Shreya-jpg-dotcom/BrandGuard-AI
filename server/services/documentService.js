import path from 'node:path';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import * as cheerio from 'cheerio';

const privateRoot = path.resolve(process.env.PRIVATE_STORAGE_DIR || './private_uploads');
const allowed = {
  '.pdf': ['application/pdf'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/zip','application/octet-stream'],
  '.txt': ['text/plain','application/octet-stream'],
  '.md': ['text/markdown','text/plain','application/octet-stream'],
  '.html': ['text/html','application/xhtml+xml','text/plain']
};
export function validateUpload(file, { asset = false } = {}) {
  if (!file) throw Object.assign(new Error('Choose a file to upload.'), { status: 400 });
  if (file.size > 15 * 1024 * 1024) throw Object.assign(new Error('Files must be 15 MB or smaller.'), { status: 413 });
  const ext = path.extname(file.originalname).toLowerCase();
  if (asset) {
    const ok = ['.png','.jpg','.jpeg','.webp','.svg','.woff','.woff2','.ttf','.otf'];
    if (!ok.includes(ext)) throw Object.assign(new Error('Use PNG, JPG, WEBP, SVG or supported font files.'), { status: 400 });
    if (ext === '.png' && file.buffer.subarray(0,8).toString('hex') !== '89504e470d0a1a0a') throw Object.assign(new Error('The uploaded file is not a valid PNG.'), { status: 400 });
    if (['.jpg','.jpeg'].includes(ext) && file.buffer.subarray(0,3).toString('hex') !== 'ffd8ff') throw Object.assign(new Error('The uploaded file is not a valid JPEG.'), { status: 400 });
    if (ext === '.webp' && (file.buffer.subarray(0,4).toString() !== 'RIFF' || file.buffer.subarray(8,12).toString() !== 'WEBP')) throw Object.assign(new Error('The uploaded file is not a valid WEBP image.'), { status: 400 });
    if (ext === '.woff' && file.buffer.subarray(0,4).toString() !== 'wOFF') throw Object.assign(new Error('The uploaded file is not a valid WOFF font.'), { status: 400 });
    if (ext === '.woff2' && file.buffer.subarray(0,4).toString() !== 'wOF2') throw Object.assign(new Error('The uploaded file is not a valid WOFF2 font.'), { status: 400 });
    if (ext === '.ttf' && !['00010000','4f54544f'].includes(file.buffer.subarray(0,4).toString('hex'))) throw Object.assign(new Error('The uploaded file is not a valid TTF font.'), { status: 400 });
    if (ext === '.otf' && file.buffer.subarray(0,4).toString() !== 'OTTO') throw Object.assign(new Error('The uploaded file is not a valid OTF font.'), { status: 400 });
    if (ext === '.svg' && !/<svg[\s>]/i.test(file.buffer.toString('utf8'))) throw Object.assign(new Error('The uploaded file is not a valid SVG.'), { status: 400 });
    return ext;
  }
  if (!allowed[ext]) throw Object.assign(new Error('Supported formats are PDF, DOCX, TXT, MD and HTML.'), { status: 415 });
  if (!allowed[ext].includes(file.mimetype) && file.mimetype !== 'application/octet-stream') throw Object.assign(new Error('The file extension and MIME type do not match.'), { status: 415 });
  if (ext === '.pdf' && file.buffer.subarray(0,5).toString() !== '%PDF-') throw Object.assign(new Error('This does not appear to be a valid PDF file.'), { status: 400 });
  if (ext === '.docx' && file.buffer.subarray(0,2).toString() !== 'PK') throw Object.assign(new Error('This does not appear to be a valid DOCX file.'), { status: 400 });
  return ext;
}
export async function extractBuffer(buffer, ext) {
  let text = '', metadata = { pages: null };
  const structure = { headings: [], links: [], images: [] };
  try {
    if (ext === '.pdf') {
      const parsed = await pdfParse(buffer);
      text = parsed.text || '';
      metadata.pages = parsed.numpages || null;
    } else if (ext === '.docx') {
      const parsed = await mammoth.extractRawText({ buffer });
      const html = await mammoth.convertToHtml({ buffer });
      text = parsed.value || '';
      const $ = cheerio.load(html.value);
      structure.headings = $('h1,h2,h3,h4,h5,h6').map((_, el) => ({ level: Number(el.tagName.slice(1)), text: $(el).text().trim() })).get();
      structure.links = $('a').map((_, el) => ({ text: $(el).text().trim(), href: $(el).attr('href') || '' })).get();
      structure.images = $('img').map((_, el) => ({ alt: $(el).attr('alt') || '' })).get();
    } else if (ext === '.html') {
      const $ = cheerio.load(buffer.toString('utf8'));
      $('script,style,noscript').remove();
      text = $('body').text().replace(/\s+/g, ' ').trim();
      structure.headings = $('h1,h2,h3,h4,h5,h6').map((_, el) => ({ level: Number(el.tagName.slice(1)), text: $(el).text().trim() })).get();
      structure.links = $('a').map((_, el) => ({ text: $(el).text().trim(), href: $(el).attr('href') || '' })).get();
      structure.images = $('img').map((_, el) => ({ alt: $(el).attr('alt') || '' })).get();
    } else {
      text = buffer.toString('utf8').replace(/^\uFEFF/, '');
    }
  } catch {
    throw Object.assign(new Error('The file could not be read. It may be corrupted or password-protected.'), { status: 422 });
  }
  text = text.replace(/\u0000/g, '').trim();
  if (!text) throw Object.assign(new Error('No readable text was found in this file. It may be empty, image-only or corrupted.'), { status: 422 });
  return { text, metadata, structure };
}
export async function storePrivateFile(buffer, ext, folder = 'documents') {
  const directory = path.join(privateRoot, folder);
  await mkdir(directory, { recursive: true });
  const filename = `${randomUUID()}${ext}`;
  const storagePath = path.join(directory, filename);
  await writeFile(storagePath, buffer, { flag: 'wx', mode: 0o600 });
  return storagePath;
}
export async function removePrivateFile(filePath) {
  if (!filePath) return;
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(privateRoot + path.sep)) return;
  await unlink(resolved).catch(() => {});
}
export function publicDocument(document) {
  const item = document.toObject ? document.toObject() : document;
  delete item.storagePath; delete item.extractedText;
  return item;
}
