import { SubmitButton } from '@/components/SubmitButton';

const PAYMENT_METHODS = [['CASH', 'Cash'], ['UPI', 'UPI'], ['BANK_TRANSFER', 'Bank transfer'], ['OTHER', 'Other']] as const;

type ExpenseFormFieldsProps = {
  amount?: number;
  category?: string;
  categoryOptions?: string[];
  paidTo?: string;
  method?: string;
  note?: string;
  submitLabel: string;
  pendingText: string;
};

export function ExpenseFormFields({ amount, category = '', categoryOptions, paidTo = '', method = 'CASH', note = '', submitLabel, pendingText }: ExpenseFormFieldsProps) {
  return <>
    <div className="field">
      <label>Category</label>
      {categoryOptions ? <select name="category" required defaultValue={category || categoryOptions[0]}>{categoryOptions.map((option) => <option key={option}>{option}</option>)}</select> : <input name="category" maxLength={70} required defaultValue={category} />}
    </div>
    <div className="field"><label>Amount (₹)</label><input name="amount" type="number" step="0.01" min="0.01" required inputMode="decimal" placeholder="0.00" defaultValue={amount === undefined ? undefined : (amount / 100).toFixed(2)} /></div>
    <div className="field"><label>Paid To</label><input name="paidTo" maxLength={250} placeholder="Name" defaultValue={paidTo} /></div>
    <div className="field"><label>Payment Method</label><select name="method" defaultValue={method}>{PAYMENT_METHODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
    <div className="field"><label>Remarks (optional)</label><textarea name="note" rows={3} maxLength={250} defaultValue={note} /></div>
    <SubmitButton className="button" style={{ width: '100%' }} pendingText={pendingText}>{submitLabel}</SubmitButton>
  </>;
}
