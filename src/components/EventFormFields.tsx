import { SubmitButton } from '@/components/SubmitButton';

type EventFormFieldsProps = {
  name?: string;
  date?: string;
  location?: string;
  target?: number;
  status?: 'UPCOMING' | 'ACTIVE' | 'COMPLETED';
  submitLabel: string;
  pendingText: string;
};

export function EventFormFields({
  name = '',
  date = '',
  location = '',
  target = 0,
  status = 'UPCOMING',
  submitLabel,
  pendingText,
}: EventFormFieldsProps) {
  return <>
    <div className="field"><label>Event name</label><input name="name" required maxLength={120} defaultValue={name} /></div>
    <div className="field"><label>Date</label><input type="date" name="date" required defaultValue={date} /></div>
    <div className="field"><label>Location (optional)</label><input name="location" maxLength={250} defaultValue={location} /></div>
    <div className="field"><label>Event target (optional)</label><input name="target" type="number" min="0" step="0.01" placeholder="0.00" defaultValue={target > 0 ? (target / 100).toFixed(2) : ''} /></div>
    <div className="field"><label>Event status</label><select name="status" defaultValue={status} required><option value="UPCOMING">Upcoming</option><option value="ACTIVE">Active</option><option value="COMPLETED">Completed</option></select></div>
    <SubmitButton style={{ width: '100%' }} pendingText={pendingText}>{submitLabel}</SubmitButton>
  </>;
}
