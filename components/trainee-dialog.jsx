'use client';
import { useState, useEffect, useRef } from 'react';
import { TraineeStatus } from '@/lib/types';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from '@/components/ui/select';
export function TraineeDialog({ open, onOpenChange, trainee, onSave, programs = [], isProgramsLoading = false, }) {
    const [isLoading, setIsLoading] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [currentStep, setCurrentStep] = useState(1);
    const totalSteps = 3;
    const [formData, setFormData] = useState({
        email: '',
        name: '',
        phone: '',
        gender: 'Male',
        program_id: '',
        status: TraineeStatus.ENROLLED,
        district: '',
        qualification: '',
        next_of_kin_name: '',
        next_of_kin_phone: '',
        consent_given: false,
        consent_date: '',
    });
    const lastTraineeKeyRef = useRef('');
    useEffect(() => {
        const id = trainee?.$id ?? trainee?.documentId ?? trainee?.id;
        const key = id != null && String(id) !== '' ? `edit:${id}` : 'new';
        if (!open) {
            lastTraineeKeyRef.current = '';
            return;
        }
        if (key !== lastTraineeKeyRef.current) {
            lastTraineeKeyRef.current = key;
        }
        else {
            return;
        }
        setSubmitError('');
        setCurrentStep(1);
        if (trainee) {
            const rawGender = String(trainee.gender || '').trim().toLowerCase();
            const normalizedGender = rawGender === 'm' || rawGender === 'male'
                ? 'Male'
                : rawGender === 'f' || rawGender === 'female'
                    ? 'Female'
                    : '';
            setFormData({
                email: trainee.email,
                name: trainee.name,
                phone: trainee.phone || '',
                gender: normalizedGender,
                program_id: trainee.program_id || '',
                status: trainee.status || TraineeStatus.ENROLLED,
                district: trainee.district || '',
                qualification: trainee.qualification || '',
                next_of_kin_name: trainee.next_of_kin_name || '',
                next_of_kin_phone: trainee.next_of_kin_phone || '',
                consent_given: Boolean(trainee.consent_given),
                consent_date: trainee.consent_date ? String(trainee.consent_date).split('T')[0] : '',
            });
        }
        else {
            setFormData({
                email: '',
                name: '',
                phone: '',
                gender: 'Male',
                program_id: '',
                status: TraineeStatus.ENROLLED,
                district: '',
                qualification: '',
                next_of_kin_name: '',
                next_of_kin_phone: '',
                consent_given: false,
                consent_date: '',
            });
        }
    }, [trainee, open]);
    const validateStep = (step) => {
        if (step === 1) {
            if (!String(formData.name || '').trim()) {
                return 'Full name is required.';
            }
            if (!String(formData.email || '').trim()) {
                return 'Email is required.';
            }
            return '';
        }
        if (step === 2) {
            if (!formData.gender) {
                return 'Gender is required.';
            }
            if (!String(formData.program_id || '').trim()) {
                return 'Program is required.';
            }
            if (!String(formData.status || '').trim()) {
                return 'Status is required.';
            }
            return '';
        }
        if (step === 3) {
            if (!String(formData.qualification || '').trim()) {
                return 'Qualification is required.';
            }
            return '';
        }
        return '';
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setIsLoading(true);
            setSubmitError('');
            const validationError = validateStep(1) || validateStep(2) || validateStep(3);
            if (validationError) {
                throw new Error(validationError);
            }
            const normalizedGender = String(formData.gender || '').trim().toLowerCase();
            const gender = normalizedGender === 'female' ? 'Female' : 'Male';
            await onSave({
                ...formData,
                gender,
                consent_date: formData.consent_given && formData.consent_date
                    ? new Date(formData.consent_date).toISOString()
                    : (formData.consent_given ? new Date().toISOString() : ''),
            });
        }
        catch (error) {
            console.error('Error saving trainee:', error);
            setSubmitError(error instanceof Error ? error.message : 'Failed to save trainee. Please try again.');
        }
        finally {
            setIsLoading(false);
        }
    };
    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };
    const handleNext = () => {
        const validationError = validateStep(currentStep);
        if (validationError) {
            setSubmitError(validationError);
            return;
        }
        setSubmitError('');
        setCurrentStep((prev) => Math.min(prev + 1, 3));
    };
    const handleBack = () => {
        setSubmitError('');
        setCurrentStep((prev) => Math.max(prev - 1, 1));
    };
    return (<Dialog open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{trainee ? 'Edit Trainee' : 'Add New Trainee'}</DialogTitle>
          <DialogDescription>
            {trainee
            ? 'Update trainee information'
            : 'Create a new trainee record'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => {
            e.preventDefault();
            if (currentStep < totalSteps)
                return;
            void handleSubmit(e);
        }} className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Step {currentStep} of {totalSteps}</span>
              <span>{Math.round((currentStep / totalSteps) * 100)}% complete</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-gradient-to-r from-[#047857] to-[#ff8829] transition-all duration-300" style={{ width: `${(currentStep / totalSteps) * 100}%` }}/>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              {['Basic Info', 'Enrollment', 'Additional'].map((label, idx) => {
            const stepNo = idx + 1;
            const active = currentStep === stepNo;
            const completed = currentStep > stepNo;
            return (<div key={label} className={`rounded-md border px-2 py-1 text-center transition-colors ${completed
                    ? 'border-[#047857]/40 bg-[#047857]/10 text-[#047857]'
                    : active
                        ? 'border-[#ff8829]/40 bg-[#ff8829]/10 text-[#b45309]'
                        : 'border-slate-200 text-slate-500'}`}>
                    {label}
                  </div>);
        })}
            </div>
          </div>
          {submitError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {submitError}
            </div>
          )}
          {currentStep === 1 && (<>
          <div className="space-y-2">
            <Label htmlFor="name">Full Name *</Label>
            <Input id="name" value={formData.name} onChange={(e) => handleChange('name', e.target.value)} placeholder="John Doe" disabled={isLoading}/>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input id="email" type="email" value={formData.email} onChange={(e) => handleChange('email', e.target.value)} placeholder="john@example.com" disabled={isLoading || !!trainee}/>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input id="phone" value={formData.phone} onChange={(e) => handleChange('phone', e.target.value)} placeholder="+1234567890" disabled={isLoading}/>
          </div>
          </>)}

          {currentStep === 2 && (<>
          <div className="space-y-2">
            <Label htmlFor="gender">Gender *</Label>
            <Select value={formData.gender} onValueChange={(value) => handleChange('gender', value)}>
              <SelectTrigger disabled={isLoading}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Male">Male</SelectItem>
                <SelectItem value="Female">Female</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="program_id">Program *</Label>
            <Select value={formData.program_id} onValueChange={(value) => handleChange('program_id', value)}>
              <SelectTrigger disabled={isLoading || isProgramsLoading || programs.length === 0}>
                <SelectValue placeholder={isProgramsLoading
                    ? 'Loading programs...'
                    : programs.length === 0
                        ? 'No programs available'
                        : 'Select program'}/>
              </SelectTrigger>
              <SelectContent>
                {programs.map((program) => (
                  <SelectItem key={program.$id} value={program.$id}>
                    {program.title || program.name || program.program_name || `Program ${program.$id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!isProgramsLoading && programs.length === 0 && (
              <p className="text-xs text-amber-700">
                No programs found. Create a program first, then add trainees.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status *</Label>
            <Select value={formData.status} onValueChange={(value) => handleChange('status', value)}>
              <SelectTrigger disabled={isLoading}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TraineeStatus.ENROLLED}>Enrolled</SelectItem>
                <SelectItem value={TraineeStatus.IN_PROGRESS}>In Progress</SelectItem>
                <SelectItem value={TraineeStatus.COMPLETED}>Completed</SelectItem>
                <SelectItem value={TraineeStatus.DROPPED}>Dropped</SelectItem>
              </SelectContent>
            </Select>
          </div>
          </>)}

          {currentStep === 3 && (<>
          <div className="space-y-2">
            <Label htmlFor="district">District</Label>
            <Input id="district" value={formData.district} onChange={(e) => handleChange('district', e.target.value)} placeholder="District name" disabled={isLoading}/>
          </div>

          <div className="space-y-2">
            <Label htmlFor="qualification">Qualification *</Label>
            <Input id="qualification" value={formData.qualification} onChange={(e) => handleChange('qualification', e.target.value)} placeholder="e.g., Bachelor&apos;s Degree" disabled={isLoading}/>
          </div>
          <div className="space-y-2">
            <Label htmlFor="next_of_kin_name">Next of Kin Name</Label>
            <Input id="next_of_kin_name" value={formData.next_of_kin_name} onChange={(e) => handleChange('next_of_kin_name', e.target.value)} placeholder="Next of kin full name" disabled={isLoading}/>
          </div>
          <div className="space-y-2">
            <Label htmlFor="next_of_kin_phone">Next of Kin Phone</Label>
            <Input id="next_of_kin_phone" value={formData.next_of_kin_phone} onChange={(e) => handleChange('next_of_kin_phone', e.target.value)} placeholder="+256..." disabled={isLoading}/>
          </div>
          <div className="space-y-2">
            <Label htmlFor="consent_given">Data Consent</Label>
            <Select value={formData.consent_given ? 'yes' : 'no'} onValueChange={(value) => handleChange('consent_given', value === 'yes')}>
              <SelectTrigger disabled={isLoading}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">Consent Given</SelectItem>
                <SelectItem value="no">No Consent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {formData.consent_given && (<div className="space-y-2">
              <Label htmlFor="consent_date">Consent Date</Label>
              <Input id="consent_date" type="date" value={formData.consent_date} onChange={(e) => handleChange('consent_date', e.target.value)} disabled={isLoading}/>
            </div>)}
          </>)}

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading} className="flex-1">
              Cancel
            </Button>
            {currentStep > 1 && (<Button type="button" variant="outline" onClick={handleBack} disabled={isLoading} className="flex-1">
                Back
              </Button>)}
            {currentStep < 3 ? (<Button type="button" onClick={(e) => {
                    e.preventDefault();
                    handleNext();
                }} disabled={isLoading || (currentStep === 2 && (isProgramsLoading || programs.length === 0))} className="flex-1">
                Next
              </Button>) : (<Button type="submit" disabled={isLoading || isProgramsLoading || programs.length === 0} className="flex-1">
                {isLoading ? 'Saving...' : 'Save Trainee'}
              </Button>)}
          </div>
        </form>
      </DialogContent>
    </Dialog>);
}
