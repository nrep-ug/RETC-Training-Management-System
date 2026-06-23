'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { databases, DB_ID, COLLECTIONS } from '@/lib/appwrite';
import { fetchAllDocuments, fetchCollectionOrEmpty } from '@/lib/fetch-all-documents';
import { upsertTraineeEnrollment } from '@/lib/trainee-enrollment-sync';
import { normalizeTraineeLevelKey } from '@/lib/trainee-levels';
import { TraineeStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertCircle, Upload } from 'lucide-react';
import Link from 'next/link';
import { useClientPagination } from '@/hooks/use-client-pagination';
import { TablePaginationFooter } from '@/components/table-pagination-footer';

function ImportErrorsTable({ errors, resetKey }) {
    const { pagedItems, page, setPage, pageSize, setPageSize, total, totalPages, rangeFrom, rangeTo, } = useClientPagination(errors, { resetKey });
    if (errors.length === 0) {
        return null;
    }
    return (<div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px]">
          <thead className="border-b border-gray-200 bg-gray-100">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Row</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Email</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Issue</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {pagedItems.map((error, idx) => (<tr key={`${error.row}-${error.email}-${idx}`}>
                <td className="px-4 py-3 text-sm text-gray-600">{error.row}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{error.email}</td>
                <td className="px-4 py-3 text-sm text-red-600">{error.reason}</td>
              </tr>))}
          </tbody>
        </table>
      </div>
      <TablePaginationFooter total={total} page={page} pageSize={pageSize} totalPages={totalPages} rangeFrom={rangeFrom} rangeTo={rangeTo} onPageChange={setPage} onPageSizeChange={setPageSize}/>
    </div>);
}

export default function ImportTraineesPage() {
    const router = useRouter();
    const [isDragging, setIsDragging] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState(null);
    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };
    const handleDragLeave = () => {
        setIsDragging(false);
    };
    const parseCSV = (text) => {
        const lines = text.split('\n').filter(line => line.trim());
        if (lines.length === 0)
            return [];
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const requiredHeaders = ['email', 'name'];
        const hasRequiredHeaders = requiredHeaders.every(header => headers.includes(header));
        if (!hasRequiredHeaders) {
            throw new Error(`CSV must contain headers: ${requiredHeaders.join(', ')}`);
        }
        return lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim());
            const row = {};
            headers.forEach((header, index) => {
                row[header] = values[index] || '';
            });
            return row;
        });
    };
    const validateRow = (row, index) => {
        if (!row.email || !row.email.includes('@')) {
            return { valid: false, error: 'Invalid email format' };
        }
        if (!row.name || row.name.trim().length === 0) {
            return { valid: false, error: 'Name is required' };
        }
        return { valid: true };
    };
    const handleFileUpload = async (file) => {
        try {
            setIsLoading(true);
            setResult(null);
            // Check file size (50MB limit)
            if (file.size > 50 * 1024 * 1024) {
                throw new Error('File size exceeds 50MB limit');
            }
            const text = await file.text();
            const rows = parseCSV(text);
            if (rows.length === 0) {
                throw new Error('CSV file is empty');
            }
            const importResult = {
                success: 0,
                failed: 0,
                skipped: 0,
                errors: [],
            };
            const enrollmentRows = await fetchCollectionOrEmpty(databases, DB_ID, COLLECTIONS.ENROLLMENTS);
            // Process each row
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const validation = validateRow(row, i + 2);
                if (!validation.valid) {
                    importResult.failed++;
                    importResult.errors.push({
                        row: i + 2,
                        email: row.email || 'N/A',
                        reason: validation.error || 'Unknown error',
                    });
                    continue;
                }
                try {
                    // Check if trainee already exists
                    const existing = await databases.listDocuments(DB_ID, COLLECTIONS.TRAINEES, [`["email", "==", "${row.email}"]`]);
                    if (existing.documents.length > 0) {
                        const existingTrainee = existing.documents[0];
                        if (row.program_id && COLLECTIONS.ENROLLMENTS) {
                            const importLevel = normalizeTraineeLevelKey(row.trainee_level || row.level || '');
                            await upsertTraineeEnrollment(
                                databases,
                                DB_ID,
                                COLLECTIONS.ENROLLMENTS,
                                existingTrainee.$id,
                                row.program_id,
                                TraineeStatus.ENROLLED,
                                importLevel,
                                enrollmentRows,
                            );
                            importResult.success++;
                        }
                        else {
                            importResult.skipped++;
                        }
                        continue;
                    }
                    // Create trainee
                    const traineePayload = {
                        email: row.email,
                        name: row.name,
                        status: TraineeStatus.ENROLLED,
                    };
                    if (row.phone) {
                        const normalizedPhone = row.phone.trim().replace(/\s+/g, '');
                        if (normalizedPhone.length > 12) {
                            throw new Error('Phone must be at most 12 characters.');
                        }
                        traineePayload.phone = normalizedPhone;
                    }
                    if (row.gender)
                    {
                        const gender = row.gender.trim().toLowerCase();
                        if (gender === 'm' || gender === 'male') {
                            traineePayload.gender = 'Male';
                        }
                        else if (gender === 'f' || gender === 'female') {
                            traineePayload.gender = 'Female';
                        }
                        else {
                            throw new Error('Gender must be Male or Female.');
                        }
                    }
                    // Enforce valid enum value for Appwrite.
                    if (!traineePayload.gender) {
                        traineePayload.gender = 'Male';
                    }
                    if (row.district)
                        traineePayload.district = row.district;
                    if (row.qualification)
                        traineePayload.qualification = row.qualification;
                    const programIdForRow = row.program_id ? String(row.program_id).trim() : '';
                    const importLevel = normalizeTraineeLevelKey(row.trainee_level || row.level || '');
                    if (programIdForRow)
                        traineePayload.program_id = programIdForRow;
                    if (importLevel)
                        traineePayload.trainee_level = importLevel;
                    if (row.next_of_kin_name)
                        traineePayload.next_of_kin_name = row.next_of_kin_name;
                    if (row.next_of_kin_phone) {
                        const normalizedKinPhone = row.next_of_kin_phone.trim().replace(/\s+/g, '');
                        if (normalizedKinPhone.length > 12) {
                            throw new Error('Next of kin phone must be at most 12 characters.');
                        }
                        traineePayload.next_of_kin_phone = normalizedKinPhone;
                    }
                    if (row.consent_given) {
                        const consentValue = String(row.consent_given).trim().toLowerCase();
                        traineePayload.consent_given = (consentValue === 'true' || consentValue === 'yes' || consentValue === '1')
                            ? 'yes'
                            : 'no';
                    }
                    if (row.consent_date) {
                        const consentDate = new Date(row.consent_date);
                        if (Number.isNaN(consentDate.getTime())) {
                            throw new Error('Consent date must be a valid date.');
                        }
                        traineePayload.consent_date = consentDate.toISOString();
                    }
                    const created = await databases.createDocument(DB_ID, COLLECTIONS.TRAINEES, 'unique()', {
                        ...traineePayload,
                    });
                    if (programIdForRow && COLLECTIONS.ENROLLMENTS) {
                        await upsertTraineeEnrollment(
                            databases,
                            DB_ID,
                            COLLECTIONS.ENROLLMENTS,
                            created.$id,
                            programIdForRow,
                            TraineeStatus.ENROLLED,
                            importLevel,
                            enrollmentRows,
                        );
                    }
                    importResult.success++;
                }
                catch (error) {
                    importResult.failed++;
                    importResult.errors.push({
                        row: i + 2,
                        email: row.email,
                        reason: error instanceof Error ? error.message : 'Unknown error',
                    });
                }
            }
            setResult(importResult);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to import file';
            setResult({
                success: 0,
                failed: 0,
                skipped: 0,
                errors: [
                    {
                        row: 1,
                        email: 'N/A',
                        reason: errorMessage,
                    },
                ],
            });
        }
        finally {
            setIsLoading(false);
        }
    };
    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileUpload(files[0]);
        }
    };
    const handleFileInput = (e) => {
        const files = e.currentTarget.files;
        if (files && files.length > 0) {
            handleFileUpload(files[0]);
        }
    };
    if (result) {
        return (<div className="p-4 sm:p-6 lg:p-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl lg:text-4xl">Import Results</h1>
          <p className="text-gray-600 mt-2">Review the import summary below</p>
        </div>

        <Card className="p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-600">Successfully Imported</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{result.success}</p>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-600">Skipped (Duplicates)</p>
              <p className="text-3xl font-bold text-yellow-600 mt-2">{result.skipped}</p>
            </div>
            <div className="bg-red-50 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-600">Failed</p>
              <p className="text-3xl font-bold text-red-600 mt-2">{result.failed}</p>
            </div>
          </div>

          {result.errors.length > 0 && (<div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Errors & Issues</h2>
              <ImportErrorsTable errors={result.errors} resetKey={`${result.success}-${result.skipped}-${result.failed}-${result.errors.length}`}/>
            </div>)}
        </Card>

        <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
          <Link href="/dashboard/trainees" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto">Back to Trainees</Button>
          </Link>
          <Button className="w-full sm:w-auto" variant="outline" onClick={() => setResult(null)}>
            Import Another File
          </Button>
        </div>
      </div>);
    }
    return (<div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl lg:text-4xl">Import Trainees</h1>
        <p className="mt-2 text-gray-600">Bulk import trainees from CSV file</p>
      </div>

      <Card className="p-4 sm:p-6 lg:p-8">
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">CSV Format</h2>
          <div className="overflow-x-auto rounded-lg bg-gray-50 p-3 font-mono text-xs text-gray-600 break-words sm:p-4 sm:text-sm">
            <p>email,name,phone,gender,district,qualification,program_id,next_of_kin_name,next_of_kin_phone,consent_given,consent_date</p>
            <p className="text-gray-500 mt-2">Example:</p>
            <p>john@example.com,John Doe,256123456789,Male,District1,Bachelor&apos;s,program123,Jane Doe,256700000000,yes,2026-04-30</p>
            <p>jane@example.com,Jane Smith,25698765432,Female,District2,Master&apos;s,program123,John Smith,256711111111,no,</p>
          </div>
        </div>

        <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors sm:p-12 ${isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 bg-gray-50'}`}>
          <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4"/>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Drag and drop your CSV file here
          </h3>
          <p className="text-gray-600 mb-4">or click to browse</p>

          <input type="file" accept=".csv" onChange={handleFileInput} disabled={isLoading} className="hidden" id="csv-input"/>
          <label htmlFor="csv-input">
            <Button type="button" variant="outline" disabled={isLoading} asChild>
              <span>{isLoading ? 'Importing...' : 'Select File'}</span>
            </Button>
          </label>

          <p className="text-sm text-gray-500 mt-4">
            Maximum file size: 50MB
          </p>
        </div>

        <div className="mt-8 bg-blue-50 rounded-lg p-4 flex gap-4">
          <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5"/>
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Requirements:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>CSV requires email and name; supports program_id, next_of_kin_name, next_of_kin_phone, consent_given, and consent_date</li>
              <li>Phone must be a string and no longer than 12 characters</li>
              <li>Next of kin phone must be no longer than 12 characters</li>
              <li>Gender values must be Male or Female</li>
              <li>Existing emails with a program_id are enrolled in that course (no duplicate person)</li>
              <li>All trainees will be created with &apos;Currently Enrolled&apos; status</li>
            </ul>
          </div>
        </div>
      </Card>

      <div className="mt-8">
        <Link href="/dashboard/trainees">
          <Button variant="outline">Back to Trainees</Button>
        </Link>
      </div>
    </div>);
}
