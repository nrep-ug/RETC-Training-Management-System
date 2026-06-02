'use client';

import { format } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { MONTH_OPTIONS } from '@/lib/facility-calendar-nav';

export function FacilityCalendarToolbar({
    selectedYear,
    selectedMonth,
    selectedDay,
    viewMode,
    statusFilter,
    yearOptions = [],
    bookingCount = 0,
    onYearChange,
    onMonthChange,
    onViewModeChange,
    onStatusFilterChange,
    onToday,
    onPrev,
    onNext,
    canGoPrev = true,
    canGoNext = true,
}) {
    const periodLabel = viewMode === 'year'
        ? String(selectedYear)
        : viewMode === 'month'
            ? format(new Date(selectedYear, selectedMonth, 1), 'MMMM yyyy')
            : format(new Date(selectedYear, selectedMonth, selectedDay), 'EEEE, d MMMM yyyy');

    return (
        <div className="mb-4 space-y-3 rounded-xl border border-[#047857]/15 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1">
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-9"
                        disabled={!canGoPrev}
                        onClick={onPrev}
                        aria-label="Previous"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="h-9" onClick={onToday}>
                        Today
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-9"
                        disabled={!canGoNext}
                        onClick={onNext}
                        aria-label="Next"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
                <p className="text-lg font-semibold text-slate-900">{periodLabel}</p>
                <p className="text-xs text-slate-500">
                    {bookingCount} booking{bookingCount === 1 ? '' : 's'} in {selectedYear}
                </p>
            </div>

            <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">Year</Label>
                    <Select
                        value={String(selectedYear)}
                        onValueChange={(v) => onYearChange(Number(v))}
                    >
                        <SelectTrigger className="h-9 w-[100px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {yearOptions.map((y) => (
                                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {(viewMode === 'month' || viewMode === 'day') && (
                    <div className="space-y-1.5">
                        <Label className="text-xs text-slate-500">Month</Label>
                        <Select
                            value={String(selectedMonth)}
                            onValueChange={(v) => onMonthChange(Number(v))}
                        >
                            <SelectTrigger className="h-9 w-[140px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {MONTH_OPTIONS.map((m) => (
                                    <SelectItem key={m.value} value={String(m.value)}>
                                        {m.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}

                <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">View</Label>
                    <Select value={viewMode} onValueChange={onViewModeChange}>
                        <SelectTrigger className="h-9 w-[110px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="day">Day</SelectItem>
                            <SelectItem value="month">Month</SelectItem>
                            <SelectItem value="year">Year</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">Courses</Label>
                    <Select value={statusFilter} onValueChange={onStatusFilterChange}>
                        <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All in this year</SelectItem>
                            <SelectItem value="upcoming">Upcoming</SelectItem>
                            <SelectItem value="ongoing">Ongoing</SelectItem>
                            <SelectItem value="completed">Completed (past)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <p className="text-xs text-slate-500">
                Choose a year, then a month or day. Use Completed (past) to see courses that already happened in that year.
            </p>
        </div>
    );
}
