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

function titleCaseName(name: string): string {
  return name
    .trim()
    .toLocaleLowerCase('en')
    .replace(/(^|[\s'-])\p{L}/gu, (letter) => letter.toLocaleUpperCase('en'));
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
    image.onload = async () => {
      if (!active) return;
      try {
        const [nameFont, amountFont, malayalamFont] = await Promise.all([
          document.fonts.load('italic 500 180px "Playfair Display"'),
          document.fonts.load('800 200px Montserrat'),
          document.fonts.load('700 160px "Noto Serif Malayalam"'),
        ]);
        if (nameFont.length === 0 || amountFont.length === 0 || malayalamFont.length === 0) {
          throw new Error('A receipt font is unavailable');
        }
      } catch {
        if (active) setError('Could not load the receipt fonts. Check your internet connection and try again.');
        return;
      }
      if (!active) return;
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      context.drawImage(image, 0, 0);

      const width = canvas.width;
      const scale = width / 3000;
      const right = width * 0.925;
      const sender = titleCaseName(receipt.receivedFrom);
      const isMalayalamName = /[\u0d00-\u0d7f]/u.test(sender);
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
        fitText(receipt.receiptNo, 109, rightColumnWidth, 400, 'italic', 'Georgia, serif'),
        'right',
        '#242d1c',
      );
      drawText(
        context,
        receiptDate,
        right,
        canvas.height * 0.316,
        rightColumnWidth,
        fitText(receiptDate, 109, rightColumnWidth, 400, 'italic', 'Georgia, serif'),
        'right',
        '#242d1c',
      );
      const nameWidth = width * 0.86;
      context.textAlign = 'center';
      drawText(
        context,
        sender,
        width / 2,
        canvas.height * 0.522,
        nameWidth,
        fitText(
          sender,
          isMalayalamName ? 160 : 180,
          nameWidth,
          isMalayalamName ? 700 : 500,
          isMalayalamName ? 'normal' : 'italic',
          isMalayalamName ? '"Noto Serif Malayalam", serif' : '"Playfair Display", serif',
        ),
        'center',
        '#242d1c',
      );
      const amountColor = '#ffffff';
      const badgeTextWidth = width * 0.42;
      const iconGap = width * 0.015;
      let amountFontSize = 200 * scale;
      let rupeeFont = `600 ${amountFontSize}px Montserrat, sans-serif`;
      let valueFont = `600 ${amountFontSize}px Montserrat, sans-serif`;
      let rupeeWidth = 0;
      let valueWidth = 0;
      do {
        rupeeFont = `600 ${amountFontSize}px Montserrat, sans-serif`;
        valueFont = `600 ${amountFontSize}px Montserrat, sans-serif`;
        context.font = rupeeFont;
        rupeeWidth = context.measureText('₹').width;
        context.font = valueFont;
        valueWidth = context.measureText(amountText).width;
        if (rupeeWidth + iconGap + valueWidth <= badgeTextWidth) break;
        amountFontSize -= 2 * scale;
      } while (amountFontSize > 36 * scale);

      const amountGroupWidth = rupeeWidth + iconGap + valueWidth;
      const amountLeft = (width - amountGroupWidth) / 2;
      const amountY = canvas.height * 0.775;
      drawText(context, '₹', amountLeft, amountY, rupeeWidth, rupeeFont, 'left', amountColor);
      drawText(
        context,
        amountText,
        amountLeft + rupeeWidth + iconGap,
        amountY,
        valueWidth,
        valueFont,
        'left',
        amountColor,
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
