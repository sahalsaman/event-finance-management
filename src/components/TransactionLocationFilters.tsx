'use client';

import { useState } from 'react';
import {
  INCOME_SECTORS,
  isIncomeSector,
  isSector,
  isUnitForSector,
  UNITS_BY_SECTOR,
  type IncomeSector,
} from '@/lib/sectors';

export function TransactionLocationFilters({
  defaultSector = '',
  defaultUnit = '',
}: {
  defaultSector?: string;
  defaultUnit?: string;
}) {
  const [sector, setSector] = useState<IncomeSector | ''>(
    isIncomeSector(defaultSector) ? defaultSector : '',
  );
  const [unit, setUnit] = useState(
    isIncomeSector(defaultSector) && isUnitForSector(defaultSector, defaultUnit)
      ? defaultUnit
      : '',
  );
  const units = !sector
    ? []
    : sector === 'Other'
      ? ['Other']
      : isSector(sector)
        ? [...UNITS_BY_SECTOR[sector], 'Other']
        : [];

  return (
    <>
      <div className="field">
        <label htmlFor="transaction-sector">Sector</label>
        <select
          id="transaction-sector"
          name="sector"
          value={sector}
          onChange={(event) => {
            const value = event.target.value;
            setSector(isIncomeSector(value) ? value : '');
            setUnit('');
          }}
        >
          <option value="">All sectors</option>
          {INCOME_SECTORS.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="transaction-unit">Unit</label>
        <select
          id="transaction-unit"
          name="unit"
          value={unit}
          disabled={!sector}
          onChange={(event) => setUnit(event.target.value)}
        >
          <option value="">All units</option>
          {units.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>
    </>
  );
}
