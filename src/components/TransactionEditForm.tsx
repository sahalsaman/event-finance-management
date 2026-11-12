import { updateExpense, updateIncome } from '@/app/actions';
import { Popup } from '@/components/Popup';
import { Pencil } from 'lucide-react';
import { IncomeFormFields } from '@/components/MoneyForm';
import { ExpenseFormFields } from '@/components/ExpenseFormFields';

type IncomeEdit = {
  type: 'income';
  id: string;
  amount: number;
  category: string;
  sector: string;
  unit: string;
  from: string;
  fromMalayalam: string;
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
        {isIncome ? (
          <IncomeFormFields
            category={record.category}
            amount={record.amount}
            defaultSector={record.sector}
            defaultUnit={record.unit}
            defaultAddress={record.address}
            from={record.from}
            fromMalayalam={record.fromMalayalam}
            method={record.method}
            note={record.note}
            submitLabel="Save Changes"
          />
        ) : (
          <ExpenseFormFields {...record} submitLabel="Save Changes" pendingText="Saving..." />
        )}
      </form>
    </Popup>
  );
}
