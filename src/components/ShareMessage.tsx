'use client';

import { useId, useState } from 'react';
import { Copy, MessageCircle } from 'lucide-react';

export function ShareMessage({ message }: { message: string }) {
  const [notice, setNotice] = useState('');
  const messageId = useId();
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message);
      setNotice('Message copied.');
    } catch {
      setNotice('Could not copy the message. Select the text above and copy it manually.');
    }
  }

  return (
    <>
      <div className="field share-message-field">
        <label htmlFor={messageId}>WhatsApp message</label>
        <textarea id={messageId} className="share-message" rows={8} readOnly value={message} />
      </div>
      <div className="share-message-actions">
        <a className="button" href={whatsappUrl} target="_blank" rel="noopener noreferrer">
          <MessageCircle size={17} aria-hidden="true" />
          Share on WhatsApp
        </a>
        <button className="button secondary" type="button" onClick={copyMessage}>
          <Copy size={17} aria-hidden="true" />
          Copy message
        </button>
      </div>
      {notice && <p className="muted" role="status">{notice}</p>}
    </>
  );
}
