import "server-only";
import { pathToFileURL } from "url";
import path from "path";

// pdfjs-dist의 legacy(Node) 빌드는 @napi-rs/canvas 같은 CanvasFactory 없이는
// 페이지를 래스터화할 수 없다. 브라우저 없이 서버에서 PDF 페이지를 JPEG로
// 렌더링하기 위해 두 패키지를 조합한다.
export async function renderPdfPagesToJpeg(
  pdfBuffer: Buffer,
  pageNumbers: number[]
): Promise<Map<number, Buffer>> {
  const uniquePages = [...new Set(pageNumbers)].filter((n) => Number.isInteger(n) && n > 0);
  const result = new Map<number, Buffer>();
  if (uniquePages.length === 0) return result;

  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const { createCanvas } = await import("@napi-rs/canvas");

  const standardFontDataUrl = pathToFileURL(
    path.join(process.cwd(), "node_modules/pdfjs-dist/standard_fonts/") + "/"
  ).href;

  const doc = await pdfjsLib.getDocument({
    data: new Uint8Array(pdfBuffer),
    standardFontDataUrl,
  }).promise;

  for (const pageNumber of uniquePages) {
    if (pageNumber > doc.numPages) continue;
    const page = await doc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = createCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext("2d");
    await page.render({
      canvas: canvas as unknown as HTMLCanvasElement,
      canvasContext: ctx as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise;
    result.set(pageNumber, canvas.toBuffer("image/jpeg", 0.85));
  }

  return result;
}
