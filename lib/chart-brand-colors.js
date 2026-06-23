/** RETC Training Management — chart colors aligned with app branding */

export const RETC_GREEN = '#047857';
export const RETC_ORANGE = '#ff8829';
export const RETC_GREEN_MID = '#0b8d68';
export const RETC_ORANGE_MID = '#f97316';
export const RETC_GREEN_LIGHT = '#10b981';
export const RETC_ORANGE_LIGHT = '#fb923c';

/** Alternating series for multi-bar / pie slices */
export const CHART_SERIES_PALETTE = [
    RETC_GREEN,
    RETC_ORANGE,
    RETC_GREEN_MID,
    RETC_ORANGE_MID,
    RETC_GREEN_LIGHT,
    RETC_ORANGE_LIGHT,
];

export function getChartSeriesColor(index) {
    return CHART_SERIES_PALETTE[Math.abs(Number(index) || 0) % CHART_SERIES_PALETTE.length];
}

export const CHART_GENDER_COLORS = {
    Male: RETC_GREEN,
    Female: RETC_ORANGE,
    Other: RETC_GREEN_MID,
};

/** Stacked gender chart (by course category) */
export const CHART_GENDER_STACK_COLORS = {
    male: RETC_GREEN,
    female: RETC_ORANGE,
    other: '#94a3b8',
};

export const CHART_CERTIFICATION_COLORS = {
    Certified: RETC_GREEN,
    Pending: RETC_ORANGE,
    'Not Certified': '#64748b',
};

export const CHART_PROGRAM_STATUS_COLORS = {
    Upcoming: RETC_ORANGE,
    Ongoing: RETC_GREEN_MID,
    Completed: RETC_GREEN,
};

export const CHART_TRAINER_ROLE_COLORS = {
    'RETC Facilitator': RETC_GREEN,
    'Senior RETC Facilitator': RETC_ORANGE,
};

/** Participant level stacks — sky / orange / green (distinct from beginner blue) */
export const CHART_LEVEL_COLORS = {
    beginner: '#0284c7',
    technician: RETC_ORANGE,
    trainer: RETC_GREEN,
    unspecified: '#94a3b8',
};

export const chartGridProps = {
    strokeDasharray: '3 3',
    stroke: 'rgba(4, 120, 87, 0.14)',
};

export const chartAxisProps = {
    tick: { fill: '#475569', fontSize: 11 },
    axisLine: { stroke: 'rgba(4, 120, 87, 0.25)' },
    tickLine: { stroke: 'rgba(4, 120, 87, 0.2)' },
};

/** Left axis 0–100% for distribution bar/line charts */
export const chartPercentYAxisProps = {
    domain: [0, 100],
    tickFormatter: (v) => `${v}%`,
    width: 44,
    allowDecimals: false,
    tick: chartAxisProps.tick,
    axisLine: chartAxisProps.axisLine,
    tickLine: chartAxisProps.tickLine,
};

export const chartTooltipStyle = {
    contentStyle: {
        borderRadius: 8,
        border: `1px solid rgba(4, 120, 87, 0.2)`,
        boxShadow: '0 4px 12px rgba(4, 120, 87, 0.08)',
    },
};

export function colorForLabel(map, label, fallbackIndex = 0) {
    const key = String(label || '').trim();
    if (map[key])
        return map[key];
    return getChartSeriesColor(fallbackIndex);
}
