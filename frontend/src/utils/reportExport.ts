/**
 * Shared report export utilities.
 * Uses exceljs for CSV/Excel and jspdf + jspdf-autotable for PDF.
 */

import toast from 'react-hot-toast';

// ---------------------------------------------------------------------------
// CSV Export
// ---------------------------------------------------------------------------

interface CsvColumn<T> {
  header: string;
  accessor: keyof T | ((row: T) => string | number);
}

export function exportToCsv<T>(
  data: T[],
  columns: CsvColumn<T>[],
  filename: string,
) {
  if (!data.length) {
    toast.error('No data to export.');
    return;
  }

  const header = columns.map(c => `"${c.header}"`).join(',');

  const rows = data.map(row =>
    columns
      .map(c => {
        const raw =
          typeof c.accessor === 'function'
            ? c.accessor(row)
            : (row[c.accessor as keyof T] as unknown);
        const val = raw === null || raw === undefined ? '' : String(raw);
        return `"${val.replace(/"/g, '""')}"`;
      })
      .join(','),
  );

  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${filename}.csv`);
  toast.success('CSV exported successfully.');
}

// ---------------------------------------------------------------------------
// PDF Export (lazy-loaded to keep bundle small)
// ---------------------------------------------------------------------------

interface PdfColumn {
  header: string;
  dataKey: string;
}

export async function exportToPdf(
  title: string,
  columns: PdfColumn[],
  rows: Record<string, string | number>[],
  filename: string,
) {
  if (!rows.length) {
    toast.error('No data to export.');
    return;
  }

  try {
    const { default: jsPDF } = await import('jspdf');
    await import('jspdf-autotable');

    const doc = new jsPDF({ orientation: rows[0] && Object.keys(rows[0]).length > 5 ? 'landscape' : 'portrait' });

    // Title
    doc.setFontSize(16);
    doc.text(title, 14, 18);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, 14, 25);

    // Table
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (doc as any).autoTable({
      startY: 32,
      head: [columns.map(c => c.header)],
      body: rows.map(r => columns.map(c => r[c.dataKey] ?? '')),
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [8, 20, 90], textColor: 255, fontSize: 9, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { left: 14, right: 14 },
    });

    doc.save(`${filename}.pdf`);
    toast.success('PDF exported successfully.');
  } catch (err) {
    console.error('PDF export failed:', err);
    toast.error('PDF export failed.');
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
