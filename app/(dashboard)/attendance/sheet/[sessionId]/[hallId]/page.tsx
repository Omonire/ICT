'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Download, Printer } from 'lucide-react';
import { apiGet, downloadFile } from '@/lib/api';
import type { AttendanceSheet } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import { formatDate } from '@/lib/format';

export default function AttendanceSheetPage() {
  const { sessionId, hallId } = useParams<{ sessionId: string; hallId: string }>();
  const { error } = useToast();
  const [sheet, setSheet] = useState<AttendanceSheet | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    apiGet<{ data: AttendanceSheet }>(`/api/attendance-sheets/${sessionId}/${hallId}/generate`)
      .then((r) => setSheet(r.data))
      .catch((err) => error('Could not load sheet', err instanceof Error ? err.message : undefined));
  }, [sessionId, hallId, error]);

  async function downloadPdf() {
    if (!sheet) return;
    setDownloading(true);
    try {
      await downloadFile(
        `/api/attendance-sheets/${sessionId}/${hallId}/pdf`,
        `attendance-${sheet.hall.name}.pdf`
      );
    } catch (err) {
      error('Download failed', err instanceof Error ? err.message : undefined);
    } finally {
      setDownloading(false);
    }
  }

  if (!sheet) return <PageLoader label="Preparing attendance sheet…" />;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <a
            href="/attendance"
            className="mb-1 inline-flex items-center gap-1 text-[12px] font-medium text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Attendance sheets
          </a>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            {sheet.hall.name} · {sheet.session.name} · {formatDate(sheet.session.examDate)}
          </h1>
          <p className="mt-1 text-[13px] text-slate-500">
            {sheet.total} candidates · generated {new Date(sheet.generatedAt).toLocaleString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void downloadPdf()} disabled={downloading}>
            <Download className="h-4 w-4" /> {downloading ? 'Downloading…' : 'Download PDF'}
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print / save as PDF
          </Button>
        </div>
      </div>

      {/* Printable exam sheet */}
      <div className="mx-auto max-w-[900px] rounded-[12px] border-[0.5px] border-slate-200 bg-white px-10 py-8 shadow-card">
        <div className="mb-6 flex items-center justify-between border-b-[3px] border-purple-600 pb-4">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900">Federal University of Technology</h2>
            <p className="text-[12px] text-slate-500">Examination & Records Unit — CBT Attendance Sheet</p>
          </div>
          <div className="text-right">
            <h2 className="text-lg font-bold tracking-tight text-slate-900">{sheet.hall.name}</h2>
            <p className="text-[12px] text-slate-500">Hall code</p>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ['Exam date', formatDate(sheet.session.examDate)],
            ['Session', sheet.session.name],
            ['Time', `${sheet.session.startTime} – ${sheet.session.endTime}`],
            ['Candidates', `${sheet.total} / ${sheet.hall.capacity} seats`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border-[0.5px] border-slate-200 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
              <p className="mt-0.5 text-[14px] font-semibold text-slate-900">{value}</p>
            </div>
          ))}
        </div>

        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th className="px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wider">#</th>
              <th className="px-3 py-2 text-left font-mono text-[10px] font-semibold uppercase tracking-wider">Seat</th>
              <th className="px-3 py-2 text-left font-mono text-[10px] font-semibold uppercase tracking-wider">Candidate ID</th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider">Candidate name</th>
              <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider">Programme</th>
              <th className="w-[110px] px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wider">Signature</th>
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map((row) => (
              <tr key={`${row.candidateId}:${row.seatNumber}`} className="border-b-[0.5px] border-slate-200">
                <td className="px-3 py-2 text-center text-slate-500">{row.index}</td>
                <td className="px-3 py-2 font-mono font-semibold text-purple-700">{row.seatNumber}</td>
                <td className="px-3 py-2 font-mono text-slate-700">{row.candidateId}</td>
                <td className="px-3 py-2 text-slate-800">{row.name}</td>
                <td className="px-3 py-2 text-slate-600">{row.careerGroup}</td>
                <td className="px-3 py-2" />
              </tr>
            ))}
            {sheet.rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-slate-400">
                  No candidates assigned to this hall for this session.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="mt-8 flex justify-between gap-8 border-t-[0.5px] border-slate-200 pt-6">
          {['Invigilator', 'Chief Invigilator', 'Exam Officer'].map((role) => (
            <div key={role} className="w-40">
              <div className="h-10 border-b border-slate-400" />
              <p className="mt-2 text-center text-[11px] text-slate-500">{role}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
