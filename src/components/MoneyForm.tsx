'use client';

import { useState } from 'react';
import {addIncome,addExpense} from '@/app/actions';
import {SubmitButton} from '@/components/SubmitButton';
import {SectorUnitFields} from '@/components/SectorUnitFields';
import { ExpenseFormFields } from '@/components/ExpenseFormFields';
const expenseCategories=['Food & Refreshments','Stage & Decoration','Transport','Sound & Lighting','Printing','Venue','Other'];
const incomeCategories=['Donation','Rifadha'];
type IncomeFormValues = {
  category?: string;
  amount?: number;
  defaultSector?: string;
  defaultUnit?: string;
  defaultAddress?: string;
  from?: string;
  fromMalayalam?: string;
  method?: string;
  note?: string;
  submitLabel?: string;
};

export function IncomeFormFields({
  category: initialCategory = 'Donation',
  amount,
  defaultSector,
  defaultUnit,
  defaultAddress,
  from = '',
  fromMalayalam = '',
  method = 'CASH',
  note = '',
  submitLabel = 'Save & Print Receipt',
}: IncomeFormValues) {
  const [incomeCategory,setIncomeCategory]=useState(
    initialCategory === 'Rifadha' || initialCategory === 'Rifala' || initialCategory === 'Rifada' ? 'Rifadha' : 'Donation',
  );
  return <>
    <fieldset className="manager-picker">
      <legend>Category</legend>
      {incomeCategories.map((category)=><label className="manager-option" key={category}>
        <input type="radio" name="category" value={category} checked={incomeCategory===category} onChange={()=>setIncomeCategory(category)} required/>
        {category}
      </label>)}
    </fieldset>
    <div className="field">
      <label>Amount (₹)</label>
      <input name="amount" type="number" step="0.01" min={incomeCategory==='Rifadha'?'1000':'0.01'} max="100000" required inputMode="decimal" placeholder="0.00" defaultValue={amount === undefined ? undefined : (amount / 100).toFixed(2)}/>
      {incomeCategory==='Rifadha'&&<small className="muted">Minimum amount for Rifadha is ₹1,000.</small>}
    </div>
    <SectorUnitFields defaultSector={defaultSector} defaultUnit={defaultUnit} defaultAddress={defaultAddress}/>
    <div className="field">
      <label>Received From (English)</label>
      <input name="from" maxLength={250} required placeholder="Name" defaultValue={from}/>
    </div>
    {incomeCategory==='Rifadha'&&<div className="field">
      <label>Received From (Malayalam)</label>
      <input name="from_ml" maxLength={250} required placeholder="പേര്" defaultValue={fromMalayalam}/>
    </div>}
    <div className="field">
      <label>Payment Method</label>
      <select name="method" defaultValue={method}>
        <option value="CASH">Cash</option><option value="UPI">UPI</option><option value="BANK_TRANSFER">Bank transfer</option><option value="OTHER">Other</option>
      </select>
    </div>
    <div className="field">
      <label>Remarks (optional)</label>
      <textarea name="note" rows={3} maxLength={250} defaultValue={note}/>
    </div>
    <SubmitButton className="button" style={{width:'100%'}} pendingText="Saving...">{submitLabel}</SubmitButton>
  </>;
}

export function MoneyForm({type,categories=[],defaultSector=''}:{type:'income'|'expense';categories?:string[];defaultSector?:string}){
  const expense=type==='expense';
  const options=[...new Set([...(expense?expenseCategories:incomeCategories),...categories])];
  return <form className="card" action={expense?addExpense:addIncome}>
    {expense
      ? <>
        <ExpenseFormFields categoryOptions={options} submitLabel="Submit Expense" pendingText="Submitting..." />
      </>
      : <IncomeFormFields defaultSector={defaultSector}/>}
  </form>
}
