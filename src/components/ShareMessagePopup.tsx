import { Share2 } from 'lucide-react';
import { Popup } from '@/components/Popup';
import { ShareMessage } from '@/components/ShareMessage';

export function ShareMessagePopup({
  title,
  message,
  triggerLabel,
}: {
  title: string;
  message: string;
  triggerLabel: string;
}) {
  return (
    <Popup
      title={title}
      trigger={<Share2 size={17} aria-hidden="true" />}
      triggerLabel={triggerLabel}
      triggerClassName="button ghost icon-button"
    >
      <ShareMessage message={message} />
    </Popup>
  );
}
