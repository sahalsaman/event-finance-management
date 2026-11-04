'use client';

import { useId, useState } from 'react';
import { isSector, SECTORS, UNITS_BY_SECTOR, type Sector } from '@/lib/sectors';

export function SectorUnitFields({
  defaultSector = '',
  defaultUnit = '',
}: {
  defaultSector?: string;
  defaultUnit?: string;
}) {
  const initialSector = isSector(defaultSector) ? defaultSector : '';
  const initialUnit = initialSector && UNITS_BY_SECTOR[initialSector].includes(defaultUnit)
    ? defaultUnit
    : '';
  const [sector, setSector] = useState<Sector | ''>(initialSector);
  const [unit, setUnit] = useState(initialUnit);
  const id = useId();
  const units = sector ? UNITS_BY_SECTOR[sector] : [];

  return (
    <>
      <div className="field">
        <label htmlFor={`${id}-sector`}>Select sector</label>
        <select
          id={`${id}-sector`}
          name="sector"
          required
          value={sector}
          onChange={(event) => {
            const value = event.target.value;
            setSector(isSector(value) ? value : '');
            setUnit('');
          }}
        >
          <option value="">Select a sector</option>
          {SECTORS.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor={`${id}-unit`}>Select unit</label>
        <select
          id={`${id}-unit`}
          name="unit"
          required
          value={unit}
          disabled={!sector}
          onChange={(event) => setUnit(event.target.value)}
        >
          <option value="">Select a unit</option>
          {units.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>
    </>
  );
}
