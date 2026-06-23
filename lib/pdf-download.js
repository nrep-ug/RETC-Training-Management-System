/**
 * Trigger a PDF download in the browser. Uses a blob link so downloads still work
 * after async work (logo fetch, html2canvas, etc.).
 */
export function downloadPdfDocument(doc, filename) {
    const safeName = String(filename || 'report.pdf').trim() || 'report.pdf';
    const finalName = safeName.endsWith('.pdf') ? safeName : `${safeName}.pdf`;
    try {
        const blob = doc.output('blob');
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = finalName;
        link.rel = 'noopener';
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
    catch (_error) {
        doc.save(finalName);
    }
}
