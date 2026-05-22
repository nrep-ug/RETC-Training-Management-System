'use client';

import { cn } from '@/lib/utils';
import {
    getTraineeLevelBadgeClassName,
    getTraineeLevelFromDoc,
    getTraineeLevelLabel,
} from '@/lib/trainee-levels';

export function TraineeLevelBadge({ trainee, levelKey, label, className = '' }) {
    const key = levelKey != null && levelKey !== ''
        ? levelKey
        : (trainee ? getTraineeLevelFromDoc(trainee) : '');
    const display = label
        || (trainee?.trainee_level_label)
        || getTraineeLevelLabel(key);
    return (
        <span
            className={cn(
                'inline-flex max-w-full items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
                getTraineeLevelBadgeClassName(key),
                className,
            )}
        >
            {display}
        </span>
    );
}
