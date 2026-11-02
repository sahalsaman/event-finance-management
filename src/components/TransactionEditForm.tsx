import { updateExpense, updateIncome } from '@/app/actions';
import { Popup } from '@/components/Popup';
import { Pencil } from 'lucide-react';

type IncomeEdit = {
  type: 'income';
  id: string;
  amount: number;
  category: string;
  from: string;
  address: string;
  method: string;
  note: string;
};

type ExpenseEdit = {
  type: 'expense';
  id: string;
  amount: number;
  category: string;
  paidTo: string;
  method: string;
  note: string;
};

export function TransactionEditForm({ record }: { record: IncomeEdit | ExpenseEdit }) {
  const isIncome = record.type === 'income';
  return (
    <Popup title={`Edit ${isIncome ? 'Income' : 'Expense'}`} trigger={<Pencil size={17} aria-hidden="true" />} triggerLabel={`Edit ${isIncome ? 'income' : 'expense'}`} triggerClassName="button ghost icon-button">
      <form action={isIncome ? updateIncome : updateExpense}>
        <input type="hidden" name="id" value={record.id} />
        <div className="field">
          <label>Amount (₹)</label>
          <input
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            required
            inputMode="decimal"
            defaultValue={(record.amount / 100).toFixed(2)}
          />
        </div>
        <div className="field">
          <label>Category</label>
          <input name="category" maxLength={70} required defaultValue={record.category} />
        </div>
        {isIncome ? (
          <>
            <div className="field">
              <label>Received From</label>
              <input name="from" maxLength={250} required defaultValue={record.from} />
            </div>
            <div className="field">
              <label>Address (optional)</label>
              <textarea name="address" rows={2} maxLength={500} defaultValue={record.address} />
            </div>
          </>
        ) : (
          <div className="field">
            <label>Paid To</label>
            <input name="paidTo" maxLength={250} defaultValue={record.paidTo} />
          </div>
        )}
        <div className="field">
          <label>Payment Method</label>
          <select name="method" defaultValue={record.method}>
            <option value="CASH">Cash</option>
            <option value="UPI">UPI</option>
            <option value="BANK_TRANSFER">Bank transfer</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <div className="field">
          <label>Remarks (optional)</label>
          <textarea name="note" rows={3} maxLength={250} defaultValue={record.note} />
        </div>
        <button className="button" style={{ width: '100%' }}>Save Changes</button>
      </form>
    </Popup>
  );
}
