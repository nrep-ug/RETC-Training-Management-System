'use client';

import { useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import {
    defaultCountries,
    FlagImage,
    parseCountry,
    usePhoneInput,
} from 'react-international-phone';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { phoneValueForInput } from '@/lib/phone';

const PREFERRED_COUNTRIES = ['ug', 'ke', 'tz', 'rw', 'ss', 'gb', 'us', 'za', 'in'];

const inputClasses = cn(
    'border-input h-9 min-w-0 flex-1 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs outline-none md:text-sm',
    'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
    'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
);

const countryButtonClasses = cn(
    'border-input inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border bg-transparent px-2.5 text-sm shadow-xs outline-none',
    'hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
    'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
);

function buildCountryList() {
    const preferred = PREFERRED_COUNTRIES
        .map((iso2) => defaultCountries.find((entry) => parseCountry(entry).iso2 === iso2))
        .filter(Boolean);
    const preferredSet = new Set(PREFERRED_COUNTRIES);
    const rest = defaultCountries.filter((entry) => !preferredSet.has(parseCountry(entry).iso2));
    return [...preferred, ...rest];
}

/**
 * International phone field with country flag + dial code picker.
 * Values are passed to the parent in E.164 form (e.g. +256712345678).
 */
export function PhoneNumberInput({
    id,
    value = '',
    onChange,
    disabled = false,
    className,
    defaultCountry = 'ug',
    placeholder = 'Phone number',
}) {
    const countries = useMemo(() => buildCountryList(), []);
    const displayValue = phoneValueForInput(value, defaultCountry);

    const {
        country,
        setCountry,
        inputValue,
        handlePhoneValueChange,
        inputRef,
    } = usePhoneInput({
        defaultCountry,
        preferredCountries: PREFERRED_COUNTRIES,
        countries,
        value: displayValue,
        forceDialCode: true,
        disableDialCodePrefill: true,
        onChange: ({ phone }) => onChange?.(phone || ''),
    });

    return (
        <div className={cn('flex w-full gap-2', className)}>
            <DropdownMenu>
                <DropdownMenuTrigger asChild disabled={disabled}>
                    <button
                        type="button"
                        className={countryButtonClasses}
                        aria-label={`Country code, currently ${country.name}`}
                    >
                        <FlagImage iso2={country.iso2} size="20px" />
                        <span className="font-medium text-slate-700">+{country.dialCode}</span>
                        <ChevronDown className="size-3.5 text-slate-500" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="max-h-72 w-72" align="start">
                    {countries.map((entry) => {
                        const parsed = parseCountry(entry);
                        const selected = parsed.iso2 === country.iso2;
                        return (
                            <DropdownMenuItem
                                key={parsed.iso2}
                                className={cn('gap-2', selected && 'bg-[#047857]/10')}
                                onSelect={() => setCountry(parsed.iso2, { focusOnInput: true })}
                            >
                                <FlagImage iso2={parsed.iso2} size="18px" />
                                <span className="flex-1 truncate">{parsed.name}</span>
                                <span className="text-muted-foreground text-xs">+{parsed.dialCode}</span>
                            </DropdownMenuItem>
                        );
                    })}
                </DropdownMenuContent>
            </DropdownMenu>

            <input
                ref={inputRef}
                id={id}
                name={id}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={inputValue}
                onChange={handlePhoneValueChange}
                disabled={disabled}
                placeholder={placeholder}
                className={inputClasses}
            />
        </div>
    );
}
