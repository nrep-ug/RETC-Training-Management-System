import autoTable from 'jspdf-autotable';
import {
    buildGenderByCourseCategory,
    genderCategoryPdfBody,
    genderSummaryPdfRows,
} from '@/lib/analytics-visualization';
import { COURSE_MODULE_LABELS } from '@/lib/course-module-labels';
import { getProgramIdFromTrainee } from '@/lib/renewable-energy-courses';

/** Approximate table height (mm) for page-break checks before drawing a section title + table together. */
export function estimatePdfTableHeightMm(bodyRowCount, { headerRows = 1, rowMm = 7.5 } = {}) {
    const rows = Math.max(Number(bodyRowCount) || 0, 1);
    return headerRows * rowMm + rows * rowMm + 6;
}

/** Start a new page if the block (title + table) would not fit. */
export function reservePdfVerticalSpace(doc, startY, neededMm, topMm = 18) {
    const pageH = doc.internal.pageSize.getHeight();
    const bottomMargin = 18;
    if (startY + neededMm > pageH - bottomMargin) {
        doc.addPage();
        return topMm;
    }
    return startY;
}

export function drawPdfSectionHeading(doc, title, marginX, y) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(51, 65, 85);
    doc.text(String(title || ''), marginX, y);
    return y + 7;
}

const GENDER_BY_CATEGORY_HEAD = [[
    COURSE_MODULE_LABELS.categoryFilterLabel,
    'Male (share of row)',
    'Female (share of row)',
    'Other (share of row)',
    'Total',
    '% of all trainees',
]];

/**
 * Gender summary + gender by course category tables.
 * Reserves space before the section title so the title and table stay on the same page.
 */
export function appendGenderReportSections(doc, startY, {
    marginX,
    contentWidth,
    tableBase,
    trainees,
    programById,
    summaryTitle = 'GENDER (SUMMARY)',
}) {
    let y = startY;
    if (!trainees?.length)
        return y;

    const breakdown = buildGenderByCourseCategory(trainees, programById, getProgramIdFromTrainee);
    const categoryBody = genderCategoryPdfBody(breakdown);
    const categoryRows = categoryBody.length > 0
        ? categoryBody
        : [['No category breakdown for this report', '—', '—', '—', '—', '—']];

    const columnStyles = {
        0: { cellWidth: contentWidth * 0.28, halign: 'left' },
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right', fontStyle: 'bold' },
        5: { halign: 'right', fontStyle: 'bold', textColor: [4, 120, 87] },
    };

    const summaryRows = genderSummaryPdfRows(breakdown.genderSummary);
    if (summaryRows.length > 0) {
        const summaryHeight = estimatePdfTableHeightMm(summaryRows.length);
        y = reservePdfVerticalSpace(doc, y, 7 + summaryHeight);
        y = drawPdfSectionHeading(doc, summaryTitle, marginX, y);
        autoTable(doc, {
            ...tableBase,
            theme: 'grid',
            tableWidth: contentWidth,
            startY: y,
            head: [['Gender', 'Count', '% of trainees in report']],
            body: summaryRows,
            columnStyles: {
                0: { cellWidth: contentWidth * 0.4, halign: 'left', textColor: [15, 23, 42] },
                1: { halign: 'right', fontStyle: 'bold' },
                2: { halign: 'right', fontStyle: 'bold', textColor: [4, 120, 87] },
            },
        });
        y = doc.lastAutoTable.finalY + 10;
    }

    const categoryHeight = estimatePdfTableHeightMm(categoryRows.length);
    y = reservePdfVerticalSpace(doc, y, 7 + categoryHeight);
    y = drawPdfSectionHeading(doc, 'GENDER BY COURSE CATEGORY', marginX, y);
    autoTable(doc, {
        ...tableBase,
        theme: 'grid',
        tableWidth: contentWidth,
        startY: y,
        head: GENDER_BY_CATEGORY_HEAD,
        body: categoryRows,
        headStyles: { ...tableBase.headStyles, fontSize: 8 },
        styles: { ...tableBase.styles, fontSize: 8 },
        columnStyles,
    });
    return doc.lastAutoTable.finalY + 12;
}
