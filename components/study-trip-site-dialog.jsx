'use client';

import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PhoneNumberInput } from '@/components/phone-input';
import { Label } from '@/components/ui/label';
import { STUDY_TRIP_SITE_LABELS } from '@/lib/study-trip-site-labels';
import {
    getStudyTripSiteContactPerson,
    getStudyTripSiteContactPhone,
    getStudyTripSiteLocation,
    getStudyTripSiteName,
} from '@/lib/study-trip-site-fields';
import { hasMeaningfulPhoneDigits } from '@/lib/phone';

export function StudyTripSiteDialog({ open, onOpenChange, site, onSave }) {
    const [isLoading, setIsLoading] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [currentStep, setCurrentStep] = useState(1);
    const totalSteps = 2;
    const [formData, setFormData] = useState({
        site: '',
        location: '',
        technology: '',
        type: '',
        size: '',
        contactperson: '',
        email: '',
        contact_phone: '',
    });
    const lastSiteKeyRef = useRef('');

    useEffect(() => {
        const key = site?.$id ? `edit:${site.$id}` : 'new';
        if (!open) {
            lastSiteKeyRef.current = '';
            return;
        }
        if (key === lastSiteKeyRef.current)
            return;
        lastSiteKeyRef.current = key;
        setSubmitError('');
        setCurrentStep(1);
        if (site) {
            setFormData({
                site: getStudyTripSiteName(site),
                location: getStudyTripSiteLocation(site),
                technology: site.technology || '',
                type: site.type || '',
                size: site.size != null ? String(site.size) : '',
                contactperson: getStudyTripSiteContactPerson(site),
                email: site.email || '',
                contact_phone: getStudyTripSiteContactPhone(site),
            });
        }
        else {
            setFormData({
                site: '',
                location: '',
                technology: '',
                type: '',
                size: '',
                contactperson: '',
                email: '',
                contact_phone: '',
            });
        }
    }, [site, open]);

    const validateStep = (step) => {
        if (step === 1) {
            if (!String(formData.site || '').trim())
                return 'Site name is required.';
            if (!String(formData.location || '').trim())
                return 'Location is required.';
            if (!String(formData.technology || '').trim())
                return 'Technology is required.';
        }
        if (step === 2) {
            if (!String(formData.contactperson || '').trim())
                return 'Contact person is required.';
            if (!String(formData.email || '').trim())
                return 'Email is required.';
            if (!String(formData.email || '').includes('@'))
                return 'Please enter a valid email address.';
            if (!hasMeaningfulPhoneDigits(formData.contact_phone))
                return 'Phone is required.';
        }
        return '';
    };

    const handleChange = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleNext = () => {
        const validationError = validateStep(currentStep);
        if (validationError) {
            setSubmitError(validationError);
            return;
        }
        setSubmitError('');
        setCurrentStep((prev) => Math.min(prev + 1, totalSteps));
    };

    const handleBack = () => {
        setSubmitError('');
        setCurrentStep((prev) => Math.max(prev - 1, 1));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setIsLoading(true);
            setSubmitError('');
            const validationError = validateStep(2);
            if (validationError)
                throw new Error(validationError);
            await onSave({ ...formData });
        }
        catch (error) {
            setSubmitError(error instanceof Error ? error.message : 'Failed to save site.');
        }
        finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>{site ? STUDY_TRIP_SITE_LABELS.editTitle : STUDY_TRIP_SITE_LABELS.addTitle}</DialogTitle>
                    <DialogDescription>
                        {site ? 'Update study trip site details.' : 'Register a new study trip destination.'}
                    </DialogDescription>
                </DialogHeader>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (currentStep < totalSteps)
                            return;
                        void handleSubmit(e);
                    }}
                    className="space-y-4"
                >
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                            <span>Step {currentStep} of {totalSteps}</span>
                            <span>{Math.round((currentStep / totalSteps) * 100)}% complete</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-[#047857] to-[#ff8829] transition-all duration-300"
                                style={{ width: `${(currentStep / totalSteps) * 100}%` }}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                            {['Site profile', 'Contact'].map((label, idx) => {
                                const stepNo = idx + 1;
                                const active = currentStep === stepNo;
                                const completed = currentStep > stepNo;
                                return (
                                    <div
                                        key={label}
                                        className={`rounded-md border px-2 py-1 text-center transition-colors ${
                                            completed
                                                ? 'border-[#047857]/40 bg-[#047857]/10 text-[#047857]'
                                                : active
                                                    ? 'border-[#ff8829]/40 bg-[#ff8829]/10 text-[#b45309]'
                                                    : 'border-slate-200 text-slate-500'
                                        }`}
                                    >
                                        {label}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {submitError && (
                        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                            {submitError}
                        </div>
                    )}

                    {currentStep === 1 && (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="site_name">Site name *</Label>
                                <Input
                                    id="site_name"
                                    value={formData.site}
                                    onChange={(e) => handleChange('site', e.target.value)}
                                    placeholder="Site name"
                                    maxLength={100}
                                    disabled={isLoading}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="site_location">Location *</Label>
                                <Input
                                    id="site_location"
                                    value={formData.location}
                                    onChange={(e) => handleChange('location', e.target.value)}
                                    placeholder="District, address, or area"
                                    maxLength={100}
                                    disabled={isLoading}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="site_technology">Technology *</Label>
                                <Input
                                    id="site_technology"
                                    value={formData.technology}
                                    onChange={(e) => handleChange('technology', e.target.value)}
                                    placeholder="e.g. Grid-tied PV, EV charging"
                                    maxLength={100}
                                    disabled={isLoading}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="site_type">Type</Label>
                                <Input
                                    id="site_type"
                                    value={formData.type}
                                    onChange={(e) => handleChange('type', e.target.value)}
                                    placeholder="e.g. Factory, field installation"
                                    maxLength={100}
                                    disabled={isLoading}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="site_size">Size</Label>
                                <Input
                                    id="site_size"
                                    value={formData.size}
                                    onChange={(e) => handleChange('size', e.target.value)}
                                    placeholder="e.g. 15–20 participants, 2 hectares"
                                    maxLength={100}
                                    disabled={isLoading}
                                />
                            </div>
                        </>
                    )}

                    {currentStep === 2 && (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="site_contactperson">Contact person *</Label>
                                <Input
                                    id="site_contactperson"
                                    value={formData.contactperson}
                                    onChange={(e) => handleChange('contactperson', e.target.value)}
                                    placeholder="Focal person at the site"
                                    maxLength={100}
                                    disabled={isLoading}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="site_email">Email *</Label>
                                <Input
                                    id="site_email"
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => handleChange('email', e.target.value)}
                                    placeholder="site@example.com"
                                    disabled={isLoading}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="site_phone">Phone *</Label>
                                <PhoneNumberInput
                                    id="site_phone"
                                    value={formData.contact_phone}
                                    onChange={(phone) => handleChange('contact_phone', phone)}
                                    disabled={isLoading}
                                />
                            </div>
                        </>
                    )}

                    <div className="flex gap-3 pt-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading} className="flex-1">
                            Cancel
                        </Button>
                        {currentStep > 1 && (
                            <Button type="button" variant="outline" onClick={handleBack} disabled={isLoading} className="flex-1">
                                Back
                            </Button>
                        )}
                        {currentStep < totalSteps ? (
                            <Button
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    handleNext();
                                }}
                                disabled={isLoading}
                                className="flex-1"
                            >
                                Next
                            </Button>
                        ) : (
                            <Button type="submit" disabled={isLoading} className="flex-1">
                                {isLoading ? 'Saving...' : 'Save Site'}
                            </Button>
                        )}
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
