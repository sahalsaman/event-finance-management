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
  const receiptDate = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(receipt.date)).replace(/\//g, '-');

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
      const scale = width / 3000;
      const right = width * 0.925;
      const sender = receipt.receivedFrom.trim();
      const amountText = new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: receipt.amountMinor % 100 === 0 ? 0 : 2,
        maximumFractionDigits: 2,
      }).format(receipt.amountMinor / 100);
      const fitText = (
        text: string,
        baseSize: number,
        maxWidth: number,
        weight: number,
        style = 'normal',
        family = 'Arial, sans-serif',
      ) => {
        let size = baseSize * scale;
        context.textAlign = 'right';
        context.font = `${style} ${weight} ${size}px ${family}`;
        while (context.measureText(text).width > maxWidth && size > 36 * scale) {
          size -= 2 * scale;
          context.font = `${style} ${weight} ${size}px ${family}`;
        }
        return `${style} ${weight} ${size}px ${family}`;
      };

      const rightColumnWidth = width * 0.29;
      drawText(
        context,
        receipt.receiptNo,
        right,
        canvas.height * 0.277,
        rightColumnWidth,
        fitText(receipt.receiptNo, 88, rightColumnWidth, 400, 'italic', 'Georgia, serif'),
        'right',
        '#2d3820',
      );
      drawText(
        context,
        receiptDate,
        right,
        canvas.height * 0.316,
        rightColumnWidth,
        fitText(receiptDate, 88, rightColumnWidth, 400, 'italic', 'Georgia, serif'),
        'right',
        '#2d3820',
      );
      const nameWidth = width * 0.86;
      context.textAlign = 'center';
      drawText(
        context,
        sender,
        width / 2,
        canvas.height * 0.515,
        nameWidth,
        fitText(sender, 160, nameWidth, 700),
        'center',
        '#2d3820',
      );
      drawText(
        context,
        `₹ ${amountText}`,
        width / 2,
        canvas.height * 0.775,
        width * 0.7,
        `700 ${132 * scale}px Arial, sans-serif`,
        'center',
        '#ffffff',
      );
      setReady(true);
    };
    image.onerror = () => {
      if (active) setError('Could not load the receipt template.');
    };
    image.src = '/MC Receipt.png';

    return () => {
      active = false;
    };
  }, [receiptDate, receipt.amountMinor, receipt.receiptNo, receipt.receivedFrom]);

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
