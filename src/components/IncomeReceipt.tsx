'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, Share2 } from 'lucide-react';

type ReceiptDetails = {
  receiptNo: string;
  date: string;
  receivedFrom: string;
  amountMinor: number;
  eventName: string;
};

function underThousand(value: number): string {
  const ones = [
    'Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen',
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const words: string[] = [];
  if (value >= 100) {
    words.push(`${ones[Math.floor(value / 100)]} Hundred`);
    value %= 100;
  }
  if (value >= 20) {
    words.push(tens[Math.floor(value / 10)]);
    value %= 10;
  }
  if (value > 0) words.push(ones[value]);
  return words.join(' ');
}

function amountInWords(amountMinor: number): string {
  let rupees = Math.floor(amountMinor / 100);
  const paise = amountMinor % 100;
  const parts: string[] = [];
  const units: [number, string][] = [
    [10_000_000, 'Crore'],
    [100_000, 'Lakh'],
    [1_000, 'Thousand'],
    [1, ''],
  ];
  for (const [unit, label] of units) {
    if (rupees < unit) continue;
    const count = Math.floor(rupees / unit);
    parts.push(underThousand(count), label);
    rupees %= unit;
  }
  const words = parts.filter(Boolean).join(' ');
  const paiseText = paise > 0 ? ` and ${underThousand(paise)} Paise` : '';
  return `${words || 'Zero'} Rupees${paiseText} Only`;
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Could not generate the receipt image'));
    }, 'image/png');
  });
}

function drawText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  font: string,
  align: CanvasTextAlign = 'right',
  color = '#111111',
) {
  context.font = font;
  context.textAlign = align;
  context.textBaseline = 'middle';
  context.fillStyle = color;
  context.fillText(text, x, y, maxWidth);
}

export function IncomeReceipt({ receipt }: { receipt: ReceiptDetails }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const formattedDate = new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  }).format(new Date(receipt.date));

  useEffect(() => {
    let active = true;
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) {
      setError('Receipt preview is not supported in this browser.');
      return;
    }

    const image = new Image();
    image.onload = () => {
      if (!active) return;
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      context.drawImage(image, 0, 0);

      const width = canvas.width;
      const scale = width / 1748;
      const right = width * 0.88;
      const maxWidth = width * 0.66;
      const sender = receipt.receivedFrom.trim().toLocaleUpperCase('en-IN');
      const dateText = formattedDate;
      const amountText = new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: receipt.amountMinor % 100 === 0 ? 0 : 2,
        maximumFractionDigits: 2,
      }).format(receipt.amountMinor / 100);
      const fitRightText = (text: string, baseSize: number) => {
        let size = baseSize * scale;
        context.textAlign = 'right';
        context.font = `700 ${size}px Arial, sans-serif`;
        while (context.measureText(text).width > maxWidth && size > 20 * scale) {
          size -= 2 * scale;
          context.font = `700 ${size}px Arial, sans-serif`;
        }
        return `700 ${size}px Arial, sans-serif`;
      };

      drawText(context, receipt.receiptNo, right, canvas.height * 0.417, maxWidth, fitRightText(receipt.receiptNo, 48), 'right', '#294a9b');
      drawText(context, dateText, right, canvas.height * 0.505, maxWidth, fitRightText(dateText, 48));
      drawText(context, sender, right, canvas.height * 0.595, maxWidth, fitRightText(sender, 48));
      drawText(context, `₹${amountText}`, width / 2, canvas.height * 0.724, width * 0.7, `700 ${150 * scale}px Arial, sans-serif`, 'center', '#398c5f');
      drawText(context, amountInWords(receipt.amountMinor), width / 2, canvas.height * 0.773, width * 0.75, `500 ${40 * scale}px Arial, sans-serif`, 'center');
      setReady(true);
    };
    image.onerror = () => {
      if (active) setError('Could not load the receipt template.');
    };
    image.src = '/ereciept.png';

    return () => {
      active = false;
    };
  }, [formattedDate, receipt.amountMinor, receipt.receiptNo, receipt.receivedFrom]);

  async function downloadReceipt() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const blob = await canvasBlob(canvas);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${receipt.receiptNo}.png`;
      link.click();
      URL.revokeObjectURL(url);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Receipt download failed.');
    }
  }

  async function shareReceipt() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const blob = await canvasBlob(canvas);
      const file = new File([blob], `${receipt.receiptNo}.png`, { type: 'image/png' });
      if (!navigator.share || !navigator.canShare?.({ files: [file] })) {
        setError('Image sharing is not supported on this device. Download the receipt to share it manually.');
        return;
      }
      await navigator.share({
        title: `E-Receipt ${receipt.receiptNo}`,
        text: `E-Receipt for ${receipt.receivedFrom}`,
        files: [file],
      });
      setError('');
    } catch (reason) {
      if (reason instanceof Error && reason.name === 'AbortError') return;
      setError(reason instanceof Error ? reason.message : 'Receipt sharing failed.');
    }
  }

  return (
    <div className="receipt-page">
      <div className="receipt-back-row">
        <Link className="button ghost icon-button" href="/transactions" aria-label="Back to transactions" title="Back to transactions">
          <ArrowLeft size={18} aria-hidden="true" />
        </Link>
        <div className="receipt-title-row">
          <h1>E-Receipt</h1>
          <span className="muted">{receipt.eventName}</span>
        </div>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <canvas ref={canvasRef} className="receipt-canvas" aria-label={`Receipt ${receipt.receiptNo}`} />
      <div className="receipt-actions">
        <button className="button secondary" type="button" onClick={shareReceipt} disabled={!ready}>
          <Share2 size={17} aria-hidden="true" /> Share
        </button>
        <button className="button" type="button" onClick={downloadReceipt} disabled={!ready}>
          <Download size={17} aria-hidden="true" /> Download
        </button>
      </div>
    </div>
  );
}
