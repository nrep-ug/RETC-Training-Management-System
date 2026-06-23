const COLOR_PROPS = [
    'color',
    'background-color',
    'border-top-color',
    'border-right-color',
    'border-bottom-color',
    'border-left-color',
    'outline-color',
    'text-decoration-color',
    'fill',
    'stroke',
];

const UNSUPPORTED_COLOR_PATTERN = /(lab|lch|oklab|oklch|color)\(/i;

function resolvedColorValue(computed, prop) {
    const value = computed.getPropertyValue(prop);
    if (!value || value === 'none')
        return '';
    if (prop.includes('background') && (value === 'transparent' || value === 'rgba(0, 0, 0, 0)'))
        return '';
    if (UNSUPPORTED_COLOR_PATTERN.test(value))
        return '';
    return value;
}

/**
 * Inline computed colors as rgb/hex so html2canvas never parses lab()/oklch() from stylesheets.
 * Maps clone nodes to their live counterparts via data attribute set before capture.
 */
export function normalizeModernColorsForCapture(clonedRoot, liveRoot) {
    if (!clonedRoot || !liveRoot)
        return;

    const liveById = new Map();
    liveRoot.querySelectorAll('[data-export-capture-id]').forEach((node) => {
        liveById.set(node.getAttribute('data-export-capture-id'), node);
    });

    clonedRoot.querySelectorAll('[data-export-capture-id]').forEach((cloneNode) => {
        const liveNode = liveById.get(cloneNode.getAttribute('data-export-capture-id'));
        if (!liveNode)
            return;

        const computed = window.getComputedStyle(liveNode);
        COLOR_PROPS.forEach((prop) => {
            const value = resolvedColorValue(computed, prop);
            if (!value)
                return;
            cloneNode.style.setProperty(prop, value);
        });
    });
}

export function tagElementsForColorCapture(root) {
    if (!root)
        return;
    let index = 0;
    root.querySelectorAll('*').forEach((node) => {
        if (node instanceof Element) {
            node.setAttribute('data-export-capture-id', String(index++));
        }
    });
    if (root instanceof Element && !root.hasAttribute('data-export-capture-id')) {
        root.setAttribute('data-export-capture-id', String(index++));
    }
}

export function clearElementsForColorCapture(root) {
    root?.querySelectorAll('[data-export-capture-id]').forEach((node) => {
        node.removeAttribute('data-export-capture-id');
    });
    root?.removeAttribute?.('data-export-capture-id');
}

/** Landscape PDF content width in px — charts scale to this width in the PDF. */
const EXPORT_CHART_WIDTH_PX = 960;
const EXPORT_CHART_MIN_HEIGHT_PX = 280;
const EXPORT_SUMMARY_WIDTH_PX = EXPORT_CHART_WIDTH_PX;

function clearExportChartHeightMarkers(root) {
    root?.querySelectorAll('[data-export-chart-h]').forEach((node) => {
        node.removeAttribute('data-export-chart-h');
    });
}

/**
 * After widening for export, preserve each chart's full rendered height (never crop labels/legends).
 */
function syncChartHeightsForExport(element) {
    if (!(element instanceof HTMLElement))
        return;

    element.querySelectorAll('.recharts-responsive-container').forEach((chartEl) => {
        if (!(chartEl instanceof HTMLElement))
            return;
        const height = Math.max(
            chartEl.offsetHeight,
            chartEl.scrollHeight,
            chartEl.getBoundingClientRect().height,
            EXPORT_CHART_MIN_HEIGHT_PX,
        );
        chartEl.setAttribute('data-export-chart-h', String(Math.ceil(height)));
        chartEl.style.width = '100%';
        chartEl.style.height = `${Math.ceil(height)}px`;
        chartEl.style.minHeight = `${Math.ceil(height)}px`;
        chartEl.style.overflow = 'visible';
    });

    element.querySelectorAll('[class*="min-h-"]').forEach((slotEl) => {
        if (!(slotEl instanceof HTMLElement))
            return;
        const height = Math.max(
            slotEl.offsetHeight,
            slotEl.scrollHeight,
            slotEl.getBoundingClientRect().height,
            EXPORT_CHART_MIN_HEIGHT_PX,
        );
        slotEl.setAttribute('data-export-chart-h', String(Math.ceil(height)));
        slotEl.style.height = `${Math.ceil(height)}px`;
        slotEl.style.minHeight = `${Math.ceil(height)}px`;
        slotEl.style.overflow = 'visible';
    });

    element.style.height = 'auto';
    element.style.minHeight = `${Math.max(element.scrollHeight, EXPORT_CHART_MIN_HEIGHT_PX)}px`;
    element.style.overflow = 'visible';
}

function applyExportChartHeightsInClone(clonedElement) {
    if (!(clonedElement instanceof HTMLElement))
        return;

    clonedElement.style.width = `${EXPORT_CHART_WIDTH_PX}px`;
    clonedElement.style.height = 'auto';
    clonedElement.style.overflow = 'visible';

    clonedElement.querySelectorAll('[data-export-chart-h]').forEach((node) => {
        if (!(node instanceof HTMLElement))
            return;
        const height = Number.parseInt(node.getAttribute('data-export-chart-h') || '', 10);
        if (!Number.isFinite(height) || height <= 0)
            return;
        node.style.width = '100%';
        node.style.height = `${height}px`;
        node.style.minHeight = `${height}px`;
        node.style.overflow = 'visible';
    });
}

async function waitForChartLayout() {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    window.dispatchEvent(new Event('resize'));
    await new Promise((resolve) => setTimeout(resolve, 700));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

/**
 * Temporarily enlarge a dashboard block so html2canvas captures a crisp, full-size chart/card.
 * Returns a restore function — always call in finally.
 */
export function prepareExportCaptureTarget(element, layout = 'chart') {
    if (!(element instanceof HTMLElement))
        return () => {};

    const restores = [];

    const applyStyle = (el, props) => {
        if (!(el instanceof HTMLElement))
            return;
        const previous = {};
        Object.entries(props).forEach(([key, value]) => {
            previous[key] = el.style.getPropertyValue(key);
            el.style.setProperty(key, value);
        });
        restores.push(() => {
            Object.entries(previous).forEach(([key, value]) => {
                if (value)
                    el.style.setProperty(key, value);
                else
                    el.style.removeProperty(key);
            });
        });
    };

    if (layout === 'chart') {
        applyStyle(element, {
            position: 'fixed',
            left: '-9999px',
            top: '0',
            width: `${EXPORT_CHART_WIDTH_PX}px`,
            'max-width': `${EXPORT_CHART_WIDTH_PX}px`,
            padding: '16px',
            'box-sizing': 'border-box',
            background: '#ffffff',
            'z-index': '-1',
            overflow: 'visible',
        });
    }
    else {
        applyStyle(element, {
            width: `${EXPORT_SUMMARY_WIDTH_PX}px`,
            'max-width': `${EXPORT_SUMMARY_WIDTH_PX}px`,
            padding: '12px',
            'box-sizing': 'border-box',
        });
    }

    return () => {
        clearExportChartHeightMarkers(element);
        restores.reverse().forEach((restore) => restore());
    };
}

export async function captureElementToCanvas(element, options = {}) {
    if (!element)
        return null;

    const html2canvasModule = await import('html2canvas-pro');
    const html2canvas = html2canvasModule.default ?? html2canvasModule;
    const layout = options.layout ?? 'chart';
    const restoreCaptureTarget = prepareExportCaptureTarget(element, layout);

    tagElementsForColorCapture(element);

    try {
        await waitForChartLayout();

        if (layout === 'chart')
            syncChartHeightsForExport(element);

        await new Promise((resolve) => setTimeout(resolve, 200));

        const captureWidth = Math.max(
            element.scrollWidth,
            element.offsetWidth,
            EXPORT_CHART_WIDTH_PX,
        );
        const captureHeight = Math.max(
            element.scrollHeight,
            element.offsetHeight,
            EXPORT_CHART_MIN_HEIGHT_PX,
        );

        return await html2canvas(element, {
            scale: options.scale ?? (layout === 'chart' ? 2 : 2),
            useCORS: true,
            allowTaint: true,
            logging: false,
            backgroundColor: '#ffffff',
            scrollX: 0,
            scrollY: 0,
            width: captureWidth,
            height: captureHeight,
            windowWidth: captureWidth,
            windowHeight: captureHeight,
            onclone: (clonedDoc, clonedElement) => {
                clonedDoc.querySelectorAll('[data-analytics-export-hide]').forEach((node) => {
                    node.style.display = 'none';
                });
                clonedDoc.querySelectorAll('svg').forEach((svg) => {
                    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                });
                if (clonedElement instanceof HTMLElement) {
                    clonedElement.querySelectorAll('[data-analytics-export-pdf-hide]').forEach((node) => {
                        node.style.display = 'none';
                    });
                    if (layout === 'chart')
                        applyExportChartHeightsInClone(clonedElement);
                }
                normalizeModernColorsForCapture(clonedElement, element);
                options.onclone?.(clonedDoc, clonedElement);
            },
        });
    }
    finally {
        clearElementsForColorCapture(element);
        restoreCaptureTarget();
    }
}
