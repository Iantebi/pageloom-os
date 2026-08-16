import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import fontkit from "@pdf-lib/fontkit";
import bidiFactory from "bidi-js";
import { PDFDocument, rgb } from "pdf-lib";
import { type DocumentTemplate, renderTemplate } from "@pageloom/core";

const require = createRequire(import.meta.url);
const bidi = bidiFactory();
const escapeHtml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");

export function renderDocumentHtml(template: DocumentTemplate, data: Record<string, unknown>) {
  const rendered = renderTemplate(template, data);
  const paragraphs = rendered.body.split(/\r?\n/).map(line => line.trim() ? `<p>${escapeHtml(line)}</p>` : '<div class="space" aria-hidden="true"></div>').join("");
  return `<!doctype html><html lang="${escapeHtml(rendered.locale)}" dir="${rendered.direction}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(rendered.title)}</title><style>@page{size:A4;margin:22mm 20mm}*{box-sizing:border-box}body{margin:0;background:#f5f5f2;color:#171815;font-family:"Noto Sans Hebrew",Arial,sans-serif;direction:${rendered.direction};line-height:1.75}article{max-width:780px;margin:40px auto;background:#fff;padding:54px 60px;box-shadow:0 10px 35px #191a170d}header{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e5e5df;padding-bottom:18px;color:#686b64;font-size:12px}.brand{color:#171815;font-weight:800;letter-spacing:.04em}h1{margin:42px 0 28px;font-size:30px;line-height:1.25}p{margin:0 0 14px;white-space:pre-wrap}.space{height:10px}footer{margin-top:48px;border-top:1px solid #e5e5df;padding-top:16px;color:#777a73;font-size:10px}@media(max-width:640px){article{margin:0;padding:30px 22px;box-shadow:none}h1{font-size:25px}}@media print{body{background:#fff}article{margin:0;max-width:none;padding:0;box-shadow:none}header{break-after:avoid}p{orphans:3;widows:3}}</style></head><body><article><header><span class="brand">PAGELOOM</span><span>${escapeHtml(template.name)} · v${template.version}</span></header><main><h1>${escapeHtml(rendered.title)}</h1>${paragraphs}</main><footer>PageLoom · ${escapeHtml(rendered.title)}</footer></article></body></html>`;
}

function visualOrder(value: string, direction: "ltr" | "rtl") { const chars = Array.from(value); const levels = bidi.getEmbeddingLevels(value, direction); for (const [start, end] of bidi.getReorderSegments(value, levels)) { const section = chars.slice(start, end + 1).reverse(); chars.splice(start, section.length, ...section); } for (const [index, char] of bidi.getMirroredCharactersMap(value, levels)) chars[index] = char; return chars.join(""); }
function wrap(value: string, max = 74) { const lines: string[] = []; for (const paragraph of value.split(/\r?\n/)) { if (!paragraph) { lines.push(""); continue; } let line = ""; for (const word of paragraph.split(/\s+/)) { const next = line ? `${line} ${word}` : word; if (next.length > max && line) { lines.push(line); line = word; } else line = next; } if (line) lines.push(line); } return lines; }

export async function renderDocumentPdf(template: DocumentTemplate, data: Record<string, unknown>, fontBytes?: Uint8Array) {
  const rendered = renderTemplate(template, data);
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const bytes = fontBytes ?? new Uint8Array(await readFile(require.resolve("@fontsource/noto-sans-hebrew/files/noto-sans-hebrew-hebrew-400-normal.woff")));
  const font = await pdf.embedFont(bytes, { subset: true });
  const pageSize: [number, number] = [595.28, 841.89]; const margin = 54; const lineHeight = 18;
  let page = pdf.addPage(pageSize); let y = page.getHeight() - margin - 32;
  const header = () => { page.drawText("PAGELOOM", { x: margin, y: page.getHeight() - margin, size: 9, font, color: rgb(.32, .34, .3) }); page.drawLine({ start: { x: margin, y: page.getHeight() - margin - 12 }, end: { x: page.getWidth() - margin, y: page.getHeight() - margin - 12 }, thickness: .6, color: rgb(.86, .87, .84) }); };
  header();
  const draw = (text: string, size: number) => { const visual = visualOrder(text, rendered.direction); const width = font.widthOfTextAtSize(visual, size); if (y < margin + 28) { page = pdf.addPage(pageSize); header(); y = page.getHeight() - margin - 32; } page.drawText(visual, { x: rendered.direction === "rtl" ? page.getWidth() - margin - width : margin, y, size, font, color: rgb(.09, .095, .08) }); y -= size + 8; };
  draw(rendered.title, 20); y -= 10; for (const line of wrap(rendered.body)) draw(line, 11);
  const pages = pdf.getPages(); pages.forEach((item, index) => { const text = `${index + 1} / ${pages.length}`; const width = font.widthOfTextAtSize(text, 8); item.drawLine({ start: { x: margin, y: margin - 12 }, end: { x: item.getWidth() - margin, y: margin - 12 }, thickness: .6, color: rgb(.86, .87, .84) }); item.drawText(text, { x: (item.getWidth() - width) / 2, y: margin - 27, size: 8, font, color: rgb(.4, .42, .38) }); });
  pdf.setTitle(rendered.title); pdf.setLanguage(rendered.locale); pdf.setProducer("PageLoom OS Document Engine"); return pdf.save();
}
