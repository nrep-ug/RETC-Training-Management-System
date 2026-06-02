'use client';

import Link from 'next/link';
import { formatEventDateRange, getStatusBadgeClass } from '@/lib/facility-calendar';
import { FACILITY_CALENDAR_LABELS } from '@/lib/facility-calendar-labels';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

function statusBadgeClass(status) {
    return getStatusBadgeClass(status);
}

export function FacilityCalendarEventDialog({
    event,
    open,
    onOpenChange,
    isAdmin = false,
}) {
    if (!event)
        return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90dvh] w-[calc(100vw-1.5rem)] max-w-md gap-0 overflow-hidden p-0">
                <DialogHeader className="border-b border-slate-100 bg-gradient-to-r from-[#047857] to-[#0b8d68] px-5 py-4 text-left">
                    <div className="flex items-start justify-between gap-2">
                        <DialogTitle className="pr-2 text-lg font-bold text-white">
                            {event.title}
                        </DialogTitle>
                        <span
                            className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${statusBadgeClass(event.status)}`}
                        >
                            {event.status}
                        </span>
                    </div>
                    <p className="text-sm text-white/85">
                        {formatEventDateRange(event.start, event.end)}
                    </p>
                </DialogHeader>

                <dl className="space-y-3 px-5 py-4 text-sm">
                    <div>
                        <dt className="text-xs font-medium uppercase text-slate-500">Course</dt>
                        <dd className="font-medium text-slate-900">{event.courseLabel}</dd>
                    </div>
                    <div>
                        <dt className="text-xs font-medium uppercase text-slate-500">Partner</dt>
                        <dd className="font-medium text-slate-900">{event.trainingPartner}</dd>
                        {event.otherPartners?.length > 0 && (
                            <dd className="mt-0.5 text-slate-600">
                                Also: {event.otherPartners.join(', ')}
                            </dd>
                        )}
                    </div>
                    {event.hasOverlap && (
                        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                            Overlaps another booking — adjust dates on Courses.
                        </p>
                    )}
                </dl>

                <DialogFooter className="border-t border-slate-100 bg-slate-50/80 px-5 py-3">
                    <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                    {isAdmin && (
                        <Button asChild size="sm" className="bg-[#047857] hover:bg-[#065f46]">
                            <Link href="/dashboard/programs">
                                {FACILITY_CALENDAR_LABELS.editBookingButton}
                            </Link>
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
