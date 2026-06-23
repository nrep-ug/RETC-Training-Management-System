import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { downloadPdfDocument } from '@/lib/pdf-download';
import { captureElementToCanvas } from '@/lib/html2canvas-capture';
import {
    REPORT_MARGIN_X,
    appendStyledPdfFooters,
    layoutStyledReportHeader,
    pdfContentWidthMm,
    pdfFilterTableBase,
} from '@/lib/pdf-report-layout';

const PDF_FORMAT = 'a4';
const PDF_ORIENTATION = 'landscape';
const CHARTS_PER_PAGE = 2;
const PAGE_TOP = 14;
const PAGE_FOOTER = 14;
const SLOT_GAP = 6;
const CHART_TITLE_H = 7;

const SUMMARY_ACCENT_RGB = {
    green: [4, 120, 87],
    orange: [255, 136, 41],
    'green-soft': [11, 141, 104],
    'orange-soft': [249, 115, 22],
};

function fitImageToBox(canvas, maxW, maxH) {
    let width = maxW;
    let height = (canvas.height * width) / canvas.width;
    if (height > maxH) {
        height = maxH;
        width = (canvas.width * height) / canvas.height;
    }
    return { width, height };
}

function chartNeedsFullPage(canvas, contentW, slotMaxH) {
    const scaledHeight = (canvas.height * contentW) / canvas.width;
    return scaledHeight > slotMaxH * 0.95;
}

function appendSummaryMetricsGrid(doc, startY, metrics, contentW) {
    const cols = 4;
    const gap = 4;
    const cardW = (contentW - gap * (cols - 1)) / cols;
    const cardH = 24;
    let y = startY;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(51, 65, 85);
    doc.text('Summary metrics', REPORT_MARGIN_X, y);
    y += 8;

    metrics.forEach((metric, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        const x = REPORT_MARGIN_X + col * (cardW + gap);
        const cardY = y + row * (cardH + gap);
        const accent = SUMMARY_ACCENT_RGB[metric.accent] ?? SUMMARY_ACCENT_RGB.green;

        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.2);
        doc.roundedRect(x, cardY, cardW, cardH, 1.5, 1.5, 'FD');
        doc.setFillColor(...accent);
        doc.rect(x, cardY + 1, 1.2, cardH - 2, 'F');

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        doc.text(String(metric.label || ''), x + 4, cardY + 7);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(15, 23, 42);
        doc.text(String(metric.value ?? ''), x + 4, cardY + 15);

        if (metric.pct) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(...accent);
            doc.text(String(metric.pct), x + 4, cardY + cardH - 3);
        }
    });

    return y + Math.ceil(metrics.length / cols) * (cardH + gap);
}

function drawCoverPage(doc, { filterRows, summaryMetrics = [] }) {
    return layoutStyledReportHeader(doc, 'Analytics report (charts)').then(({ startY }) => {
        const contentW = pdfContentWidthMm(doc);
        const pageH = doc.internal.pageSize.getHeight();

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(51, 65, 85);
        doc.text('Report filters', REPORT_MARGIN_X, startY);
        autoTable(doc, {
            ...pdfFilterTableBase(doc),
            startY: startY + 5,
            head: [['Parameter', 'Value']],
            body: filterRows,
        });

        if (summaryMetrics.length === 0)
            return;

        const metricsStartY = doc.lastAutoTable.finalY + 10;
        const metricsEndY = metricsStartY + 8 + Math.ceil(summaryMetrics.length / 4) * 28;

        if (metricsEndY > pageH - PAGE_FOOTER) {
            doc.addPage(PDF_FORMAT, PDF_ORIENTATION);
            appendSummaryMetricsGrid(doc, PAGE_TOP + 4, summaryMetrics, contentW);
            return;
        }

        appendSummaryMetricsGrid(doc, metricsStartY, summaryMetrics, contentW);
    });
}

function drawChartTitle(doc, title, x, y) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(4, 120, 87);
    doc.text(String(title || 'Chart'), x, y);
}

/**
 * Place up to two chart images per landscape page; tall charts get a full page so nothing is cropped.
 */
class ChartPageComposer {
    constructor(doc) {
        this.doc = doc;
        this.slotsOnPage = 0;
        this.contentW = pdfContentWidthMm(doc);
        this.pageH = doc.internal.pageSize.getHeight();
        this.slotHeight = this.computeSlotHeight();
        this.slotMaxH = this.slotHeight - CHART_TITLE_H - 2;
    }

    computeSlotHeight() {
        const usable = this.pageH - PAGE_TOP - PAGE_FOOTER;
        return (usable - SLOT_GAP) / CHARTS_PER_PAGE;
    }

    beginPageIfNeeded() {
        if (this.slotsOnPage !== 0)
            return;
        this.doc.addPage(PDF_FORMAT, PDF_ORIENTATION);
        this.pageH = this.doc.internal.pageSize.getHeight();
        this.slotHeight = this.computeSlotHeight();
        this.slotMaxH = this.slotHeight - CHART_TITLE_H - 2;
    }

    appendFullPage(canvas, title) {
        this.doc.addPage(PDF_FORMAT, PDF_ORIENTATION);
        this.pageH = this.doc.internal.pageSize.getHeight();
        this.slotsOnPage = 0;

        const imageTop = PAGE_TOP + CHART_TITLE_H;
        const maxH = this.pageH - PAGE_FOOTER - imageTop - 2;
        drawChartTitle(this.doc, title, REPORT_MARGIN_X, PAGE_TOP + 5);
        const { width, height } = fitImageToBox(canvas, this.contentW, maxH);
        const x = REPORT_MARGIN_X + (this.contentW - width) / 2;
        this.doc.addImage(canvas.toDataURL('image/png'), 'PNG', x, imageTop, width, height);
    }

    appendHalfPage(canvas, title) {
        this.beginPageIfNeeded();
        const slotY = PAGE_TOP + this.slotsOnPage * (this.slotHeight + SLOT_GAP);
        drawChartTitle(this.doc, title, REPORT_MARGIN_X, slotY + 5);
        const imageTop = slotY + CHART_TITLE_H;
        const { width, height } = fitImageToBox(canvas, this.contentW, this.slotMaxH);
        const x = REPORT_MARGIN_X + (this.contentW - width) / 2;
        this.doc.addImage(canvas.toDataURL('image/png'), 'PNG', x, imageTop, width, height);

        this.slotsOnPage += 1;
        if (this.slotsOnPage >= CHARTS_PER_PAGE)
            this.slotsOnPage = 0;
    }

    appendCanvas(canvas, title) {
        if (chartNeedsFullPage(canvas, this.contentW, this.slotMaxH)) {
            if (this.slotsOnPage === 1)
                this.slotsOnPage = 0;
            this.appendFullPage(canvas, title);
            return;
        }
        this.appendHalfPage(canvas, title);
    }

    appendError(title, message) {
        this.beginPageIfNeeded();
        const slotY = PAGE_TOP + this.slotsOnPage * (this.slotHeight + SLOT_GAP);
        drawChartTitle(this.doc, title, REPORT_MARGIN_X, slotY + 5);
        this.doc.setFont('helvetica', 'normal');
        this.doc.setFontSize(9);
        this.doc.setTextColor(185, 28, 28);
        this.doc.text(message, REPORT_MARGIN_X, slotY + CHART_TITLE_H + 4);
        this.slotsOnPage += 1;
        if (this.slotsOnPage >= CHARTS_PER_PAGE)
            this.slotsOnPage = 0;
    }
}

export async function captureAnalyticsDomSection(element) {
    return captureElementToCanvas(element, { layout: 'chart' });
}

export function collectAnalyticsChartExportSections(_summaryElement, scopeElement = document) {
    const sections = [];
    scopeElement.querySelectorAll('[data-analytics-export-chart]').forEach((element) => {
        sections.push({
            title: element.getAttribute('data-export-title') || 'Chart',
            element,
        });
    });
    return sections;
}

/** @deprecated use appendStyledPdfFooters — kept for tabular analytics export in page.jsx */
export function appendAnalyticsPdfFooters(doc) {
    appendStyledPdfFooters(doc);
}

export async function loadAnalyticsLogoDataUrl() {
    const { loadReportLogoDataUrl } = await import('@/lib/pdf-report-layout');
    return loadReportLogoDataUrl();
}

export function appendAnalyticsFilterTable(doc, startY, { filterRows, contentW }) {
    autoTable(doc, {
        ...pdfFilterTableBase(doc),
        startY,
        head: [['Parameter', 'Value']],
        body: filterRows,
    });
    return doc.lastAutoTable.finalY + 12;
}

/**
 * Landscape PDF matching Reports tab — cover + two charts per page when they fit; full page for tall charts.
 */
export async function exportAnalyticsChartsPdf({
    filterRows,
    summaryMetrics = [],
    sectionElements = [],
    downloadName,
}) {
    const doc = new jsPDF(PDF_ORIENTATION, 'mm', PDF_FORMAT);
    await drawCoverPage(doc, { filterRows, summaryMetrics });

    const composer = new ChartPageComposer(doc);

    for (const section of sectionElements) {
        if (!section?.element)
            continue;
        try {
            const canvas = await captureAnalyticsDomSection(section.element);
            if (!canvas || canvas.width <= 0 || canvas.height <= 0) {
                throw new Error(`Could not capture "${section.title || 'section'}".`);
            }
            composer.appendCanvas(canvas, section.title || '');
        }
        catch (sectionError) {
            const message = sectionError instanceof Error
                ? sectionError.message
                : `Could not capture "${section.title || 'section'}".`;
            composer.appendError(section.title || 'Chart', message);
        }
    }

    appendStyledPdfFooters(doc);
    downloadPdfDocument(doc, downloadName);
}
