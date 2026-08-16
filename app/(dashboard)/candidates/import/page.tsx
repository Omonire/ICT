'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  UploadCloud,
  Users,
} from 'lucide-react';
import { uploadCsv, apiPost } from '@/lib/api';
import { ApiRequestError } from '@/lib/api';
import type { ImportPreview, ImportCommit } from '@/lib/types';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';

type Step = 'upload' | 'review' | 'done';

const REQUIRED_COLUMNS = ['name', 'email', 'careerGroup'];

function downloadTemplate() {
  const rows = [
    'name,email,careerGroup,matricNo',
    'Adaeze Adeyemi,adaeze.adeyemi@student.fut.edu.ng,Management Sciences,FUT/2025/101',
    'Ibrahim Garba,ibrahim.garba@student.fut.edu.ng,Engineering,FUT/2025/102',
    'Ngozi Okafor,ngozi.okafor@student.fut.edu.ng,Natural Sciences,FUT/2025/103',
  ];
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'candidates-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export default function ImportPage() {
  const router = useRouter();
  const { success, error } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [committing, setCommitting] = useState(false);
  const [result, setResult] = useState<ImportCommit | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    setFileError(null);
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) {
      setFileError('Only .csv files are supported. Export your spreadsheet as CSV and try again.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setFileError('The file is larger than 10 MB. Split it into smaller batches.');
      return;
    }
    setFileName(file.name);
    setUploading(true);
    try {
      const res = await uploadCsv<ImportPreview>(file);
      setPreview(res);
      setStep('review');
    } catch (err) {
      setFileError(err instanceof Error ? err.message : 'Could not parse the file.');
      setStep('upload');
    } finally {
      setUploading(false);
    }
  }

  async function confirmImport() {
    if (!preview) return;
    setCommitting(true);
    try {
      const res = await apiPost<{ data: ImportCommit }>('/api/candidates/import/confirm', {
        importId: preview.importId,
      });
      setResult(res.data);
      setStep('done');
      success('Import complete', `${res.data.imported} candidates added.`);
    } catch (err) {
      error('Import failed', err instanceof Error ? err.message : undefined);
    } finally {
      setCommitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Import candidates"
        description="Upload a CSV, review the validation report, then commit the import."
        actions={
          <Button variant="outline" onClick={() => router.push('/candidates')}>
            <ArrowLeft className="h-4 w-4" /> Back to candidates
          </Button>
        }
      />

      {step === 'upload' && (
        <Card>
          <div className="p-6">
            <div className="mb-5 flex items-start gap-3 rounded-lg border-[0.5px] border-slate-200 bg-slate-50 px-4 py-3">
              <FileSpreadsheet className="mt-0.5 h-4 w-4 shrink-0 text-purple-600" />
              <div className="text-[13px] leading-relaxed text-slate-600">
                Your CSV needs these columns:{' '}
                <span className="font-mono text-[12px] text-slate-800">{REQUIRED_COLUMNS.join(', ')}</span>.
                The <span className="font-mono">careerGroup</span> value must match a career group name
                (e.g. “Engineering”). A <span className="font-mono">matricNo</span> column is optional.
              </div>
            </div>

            <button
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                void handleFile(e.dataTransfer.files[0]);
              }}
              className={`flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-14 transition-colors ${
                dragOver ? 'border-purple-600 bg-purple-50/60' : 'border-slate-300 bg-slate-50/50 hover:border-purple-500 hover:bg-purple-50/30'
              }`}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-50 text-purple-600">
                {uploading ? <Spinner className="h-5 w-5" /> : <UploadCloud className="h-6 w-6" />}
              </div>
              <div className="text-center">
                <p className="text-[15px] font-semibold text-slate-800">
                  {uploading ? 'Parsing file…' : 'Drop your CSV here'}
                </p>
                <p className="mt-1 text-[13px] text-slate-500">
                  or <span className="font-medium text-purple-700">browse</span> your computer · max 10 MB
                </p>
              </div>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => void handleFile(e.target.files?.[0])}
            />

            {fileError && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border-[0.5px] border-red-200 bg-red-50 px-3 py-2.5 text-[13px] text-red-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {fileError}
              </div>
            )}

            <div className="mt-5 flex items-center justify-center">
              <Button variant="outline" onClick={downloadTemplate}>
                <Download className="h-4 w-4" /> Download CSV template
              </Button>
            </div>
          </div>
        </Card>
      )}

      {step === 'review' && preview && (
        <Card>
          <div className="p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-semibold text-slate-900">{fileName}</h2>
                <p className="mt-0.5 text-[13px] text-slate-500">
                  {preview.totalRows} rows parsed · {preview.validCount} valid
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep('upload')}>
                  Choose another file
                </Button>
                <Button onClick={() => void confirmImport()} disabled={committing || preview.validCount === 0}>
                  {committing ? <Spinner className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                  Import {preview.validCount} candidates
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border-[0.5px] border-gold-200 bg-gold-50 px-4 py-3">
                <p className="text-xl font-semibold text-gold-700">{preview.validCount}</p>
                <p className="text-[12px] text-gold-700/80">Valid rows</p>
              </div>
              <div className="rounded-lg border-[0.5px] border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-xl font-semibold text-amber-700">{preview.duplicateCount}</p>
                <p className="text-[12px] text-amber-700/80">Duplicates</p>
              </div>
              <div className="rounded-lg border-[0.5px] border-red-200 bg-red-50 px-4 py-3">
                <p className="text-xl font-semibold text-red-700">{preview.errorCount}</p>
                <p className="text-[12px] text-red-700/80">Errors</p>
              </div>
            </div>

            <div className="mt-6">
              <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-slate-500">
                Preview of valid rows
              </h3>
              <div className="overflow-hidden rounded-lg border-[0.5px] border-slate-200">
                <table className="w-full text-[13px]">
                  <thead className="bg-slate-50">
                    <tr>
                      {['Name', 'Email', 'Programme', 'Matric'].map((h) => (
                        <th key={h} className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.preview.map((row, i) => (
                      <tr key={i} className="border-t-[0.5px] border-slate-100">
                        <td className="px-3 py-2 font-medium text-slate-800">{row.name}</td>
                        <td className="px-3 py-2 font-mono text-[12px] text-slate-600">{row.email}</td>
                        <td className="px-3 py-2 text-slate-600">{row.careerGroup}</td>
                        <td className="px-3 py-2 font-mono text-[12px] text-slate-500">{row.id}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.validCount > preview.preview.length && (
                  <p className="border-t-[0.5px] border-slate-100 px-3 py-2 text-[12px] text-slate-500">
                    …and {preview.validCount - preview.preview.length} more rows
                  </p>
                )}
              </div>
            </div>

            {preview.errors.length > 0 && (
              <div className="mt-6">
                <h3 className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-wide text-red-600">
                  <AlertTriangle className="h-3.5 w-3.5" /> {preview.errors.length} rows need attention
                </h3>
                <div className="max-h-64 overflow-y-auto rounded-lg border-[0.5px] border-red-200">
                  <table className="w-full text-[12px]">
                    <thead className="bg-red-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-red-600">Row</th>
                        <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-red-600">Field</th>
                        <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-red-600">Issue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.errors.slice(0, 50).map((err, i) => (
                        <tr key={i} className="border-t-[0.5px] border-red-100">
                          <td className="px-3 py-1.5 font-mono">{err.row}</td>
                          <td className="px-3 py-1.5">{err.field ?? '—'}</td>
                          <td className="px-3 py-1.5 text-red-700">{err.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {step === 'done' && result && (
        <Card>
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gold-50">
              <CheckCircle2 className="h-7 w-7 text-gold-600" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-slate-900">Import complete</h2>
            <p className="mt-1 max-w-sm text-[13px] text-slate-500">
              <span className="font-semibold text-gold-700">{result.imported}</span> candidates added to the
              register. {result.skipped > 0 && <span>{result.skipped} rows skipped.</span>}
            </p>
            {result.errors.length > 0 && (
              <div className="mt-4 w-full max-w-md rounded-lg border-[0.5px] border-amber-200 bg-amber-50 px-4 py-3 text-left">
                <p className="text-[12px] font-semibold text-amber-800">Skipped rows</p>
                <ul className="mt-1 space-y-1 text-[12px] text-amber-700">
                  {result.errors.slice(0, 5).map((e, i) => (
                    <li key={i} className="font-mono">
                      {e.email} — {e.reason}
                    </li>
                  ))}
                  {result.errors.length > 5 && <li>…and {result.errors.length - 5} more</li>}
                </ul>
              </div>
            )}
            <div className="mt-8 flex gap-2">
              <Button onClick={() => router.push('/candidates')}>
                <Users className="h-4 w-4" /> View candidates
              </Button>
              <Button variant="outline" onClick={() => router.push('/schedule')}>
                Schedule them <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
