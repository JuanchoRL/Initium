'use client';

import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';

/**
 * Captures a DOM element and generates a multi-page A4 PDF.
 * Uses html2canvas-pro for accurate rendering of modern CSS
 * (gradients, backdrop-blur, shadows, etc.).
 */
export async function exportDashboardToPdf(
  element: HTMLElement,
  filename = 'informe-evaluacion.pdf'
): Promise<void> {
  // Temporarily expand the element so everything is visible (no scroll clipping)
  const originalStyle = {
    overflow: element.style.overflow,
    maxHeight: element.style.maxHeight,
    height: element.style.height,
  };

  element.style.overflow = 'visible';
  element.style.maxHeight = 'none';
  element.style.height = 'auto';

  // Hide elements that shouldn't appear in the PDF
  const hiddenElements: HTMLElement[] = [];
  element.querySelectorAll('button, [data-testid="copy-summary-btn"]').forEach((el) => {
    const htmlEl = el as HTMLElement;
    if (!htmlEl.dataset.printKeep) {
      hiddenElements.push(htmlEl);
      htmlEl.style.display = 'none';
    }
  });

  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#fafaf9',
      logging: false,
      windowWidth: 1200,
    });

    // A4 dimensions in mm
    const A4_WIDTH = 210;
    const A4_HEIGHT = 297;
    const MARGIN = 12;
    const CONTENT_WIDTH = A4_WIDTH - MARGIN * 2;
    const CONTENT_HEIGHT = A4_HEIGHT - MARGIN * 2;

    // Calculate image dimensions
    const imgWidth = CONTENT_WIDTH;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    const pdf = new jsPDF('p', 'mm', 'a4');

    // Header branding on first page
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    const now = new Date();
    const dateStr = now.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    // Multi-page slicing
    let remainingHeight = imgHeight;
    let sourceY = 0;
    let pageNumber = 1;

    while (remainingHeight > 0) {
      if (pageNumber > 1) {
        pdf.addPage();
      }

      // Calculate how much of the source image to use for this page
      const pageContentHeight = Math.min(remainingHeight, CONTENT_HEIGHT);
      const sourceHeight = (pageContentHeight / imgHeight) * canvas.height;

      // Create a temporary canvas for this page slice
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = sourceHeight;
      const ctx = pageCanvas.getContext('2d')!;
      ctx.drawImage(
        canvas,
        0, sourceY,             // source x, y
        canvas.width, sourceHeight, // source width, height
        0, 0,                    // dest x, y
        canvas.width, sourceHeight  // dest width, height
      );

      const pageImgData = pageCanvas.toDataURL('image/png');
      pdf.addImage(pageImgData, 'PNG', MARGIN, MARGIN, imgWidth, pageContentHeight);

      // Footer
      pdf.setFontSize(7);
      pdf.setTextColor(180, 180, 180);
      pdf.text(`Initium Assessment · ${dateStr}`, MARGIN, A4_HEIGHT - 5);
      pdf.text(`Página ${pageNumber}`, A4_WIDTH - MARGIN - 15, A4_HEIGHT - 5);

      sourceY += sourceHeight;
      remainingHeight -= pageContentHeight;
      pageNumber++;
    }

    pdf.save(filename);
  } finally {
    // Restore original styles
    element.style.overflow = originalStyle.overflow;
    element.style.maxHeight = originalStyle.maxHeight;
    element.style.height = originalStyle.height;

    // Restore hidden elements
    hiddenElements.forEach((el) => {
      el.style.display = '';
    });
  }
}
