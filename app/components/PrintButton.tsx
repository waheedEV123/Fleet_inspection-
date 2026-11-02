'use client';
export default function PrintButton({ label = 'Print' }: { label?: string }) {
  return <button type="button" className="btn link no-print" onClick={() => window.print()}>{label}</button>;
}
