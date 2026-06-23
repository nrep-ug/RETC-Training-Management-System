/** Shared PDF chrome — matches Reports tab (trainees/programs exports). */
export const REPORT_MARGIN_X = 22;

export async function loadReportLogoDataUrl() {
    try {
        const response = await fetch('/logo.png');
        if (!response.ok)
            return '';
        const blob = await response.blob();
        return await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : '');
            reader.readAsDataURL(blob);
        });
    }
    catch (_error) {
        return '';
    }
}

export function pdfContentWidthMm(doc) {
    return doc.internal.pageSize.getWidth() - REPORT_MARGIN_X * 2;
}

export async function layoutStyledReportHeader(doc, reportTitle) {
    const pageW = doc.internal.pageSize.getWidth();
    const centerX = pageW / 2;
    const logoDataUrl = await loadReportLogoDataUrl();
    doc.setFillColor(4, 120, 87);
    doc.rect(0, 0, pageW, 3.5, 'F');
    doc.setFillColor(255, 136, 41);
    doc.rect(0, 3.5, pageW, 1.2, 'F');
    let y = 14;
    const logoW = 34;
    const logoH = 34;
    if (logoDataUrl) {
        doc.addImage(logoDataUrl, 'PNG', centerX - logoW / 2, y, logoW, logoH);
        y += logoH + 6;
    }
    else {
        y += 4;
    }
    doc.setTextColor(4, 120, 87);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('RETC', centerX, y, { align: 'center' });
    y += 6.5;
    doc.setFontSize(10);
    doc.text('Training Management', centerX, y, { align: 'center' });
    y += 8;
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(20);
    doc.text(String(reportTitle || '').toUpperCase(), centerX, y, { align: 'center' });
    y += 12;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.35);
    doc.line(REPORT_MARGIN_X, y, pageW - REPORT_MARGIN_X, y);
    y += 8;
    return { startY: y, pageW, pageH: doc.internal.pageSize.getHeight(), centerX };
}

export function appendStyledPdfFooters(doc) {
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const centerX = pageW / 2;
    const totalPages = typeof doc.internal?.getNumberOfPages === 'function'
        ? doc.internal.getNumberOfPages()
        : (typeof doc.getNumberOfPages === 'function' ? doc.getNumberOfPages() : 1);
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.25);
        doc.line(REPORT_MARGIN_X, pageH - 14, pageW - REPORT_MARGIN_X, pageH - 14);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text('RETC Training Management', centerX, pageH - 9, { align: 'center' });
        doc.text(`Page ${i} of ${totalPages}`, centerX, pageH - 5, { align: 'center' });
    }
}

export function pdfFilterTableBase(doc) {
    const contentW = pdfContentWidthMm(doc);
    return {
        margin: { left: REPORT_MARGIN_X, right: REPORT_MARGIN_X, bottom: 20 },
        styles: {
            font: 'helvetica',
            fontSize: 9.5,
            cellPadding: { top: 4, right: 5, bottom: 4, left: 5 },
            lineColor: [226, 232, 240],
            lineWidth: 0.15,
            valign: 'middle',
        },
        headStyles: {
            fillColor: [4, 120, 87],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign: 'center',
            valign: 'middle',
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        theme: 'plain',
        columnStyles: {
            0: { cellWidth: contentW * 0.42, halign: 'left', fontStyle: 'bold', textColor: [71, 85, 105] },
            1: { halign: 'right', textColor: [15, 23, 42] },
        },
    };
}
