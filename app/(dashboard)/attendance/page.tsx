'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Download, Eye, FileSpreadsheet, Printer } from 'lucide-react';
import { apiGet, downloadFile } from '@/lib/api';
import type { SheetListing } from '@/lib/types';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SkeletonTable } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import { formatDate, formatTime } from '@/lib/format';

export default function AttendancePage() {
  const { error } = useToast();
  const [sheets, setSheets] = useState<SheetListing[] | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    apiGet<{ data: SheetListing[] }>('/api/attendance-sheets')
      .then((r) => setSheets(r.data))
      .catch((err) => {
        error('Could not load attendance sheets', err instanceof Error ? err.message : undefined);
        setSheets([]);
      });
  }, [error]);

  async function downloadPdf(sheet: SheetListing) {
    setDownloading(sheet.hallId);
    try {
      await downloadFile(
        `/api/attendance-sheets/${sheet.sessionId}/${sheet.hallId}/pdf`,
        `attendance-${sheet.hallName}-${sheet.examDate}-${sheet.sessionName}.pdf`
      );
    } catch (err) {
      error('Download failed', err instanceof Error ? err.message : undefined);
    } finally {
      setDownloading(null);
    }
  }

  const groups = (sheets ?? []).reduce<Record<string, SheetListing[]>>((acc, s) => {
    const key = `${s.examDate} ${s.sessionName}`;
    (acc[key] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div>
      <PageHeader
        title="Attendance sheets"
        description="Exam-ready attendance sheets per hall and session. Preview, print or download as PDF."
      />

      {!sheets ? (
        <Card>
          <div className="p-4">
            <SkeletonTable rows={8} cols={6} />
          </div>
        </Card>
      ) : sheets.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileSpreadsheet className="h-5 w-5" />}
            title="No attendance sheets yet"
            description="Confirm a schedule first. Sheets are generated automatically for every hall and session with candidates."
            action={{ label: 'Go to scheduling', onClick: () => (window.location.href = '/schedule') }}
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groups).map(([key, daySheets]) => (
            <div key={key}>
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-[13px] font-semibold uppercase tracking-wide text-slate-500">
                  {key.split(' ')[0] !== key ? `${formatDate(key.slice(0, 10))} · ${key.slice(11)}` : key}
                </h2>
                <span className="font-mono text-[11px] text-slate-400">{daySheets.length} hall(s)</span>
              </div>
              <Card className="divide-y-[0.5px] divide-slate-100">
                {daySheets.map((sheet) => (
                  <div key={`${sheet.sessionId}:${sheet.hallId}`} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50/60">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                        <FileSpreadsheet className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-[14px] font-semibold text-slate-900">
                          {sheet.hallName} <span className="font-normal text-slate-400">·</span> {sheet.sessionName}
                        </p>
                        <p className="mt-0.5 text-[12px] text-slate-500">
                          {formatTime(sheet.startTime)} – {formatTime(sheet.endTime)} ·{' '}
                          <span className="font-mono">{sheet.candidates}/{sheet.capacity}</span> candidates
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadPdf(sheet)}
                        disabled={downloading === sheet.hallId}
                      >
                        <Download className="h-4 w-4" />
                        {downloading === sheet.hallId ? 'Downloading…' : 'PDF'}
                      </Button>
                      <Link
                        href={`/attendance/sheet/${sheet.sessionId}/${sheet.hallId}`}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border-[0.5px] border-slate-300 px-3 text-[13px] font-medium text-slate-600 hover:bg-slate-50"
                      >
                        <Printer className="h-4 w-4" /> Print
                      </Link>
                      <Link
                        href={`/attendance/sheet/${sheet.sessionId}/${sheet.hallId}`}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border-[0.5px] border-slate-300 px-3 text-[13px] font-medium text-slate-600 hover:bg-slate-50"
                      >
                        <Eye className="h-4 w-4" /> Preview
                      </Link>
                    </div>
                  </div>
                ))}
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
