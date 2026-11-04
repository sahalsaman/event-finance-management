'use client';

import { useId, useState } from 'react';
import {
  INCOME_SECTORS,
  isIncomeSector,
  isUnitForSector,
  UNITS_BY_SECTOR,
  type IncomeSector,
} from '@/lib/sectors';

export function SectorUnitFields({
  defaultSector = '',
  defaultUnit = '',
  defaultAddress = '',
}: {
  defaultSector?: string;
  defaultUnit?: string;
  defaultAddress?: string;
}) {
  const initialSector = isIncomeSector(defaultSector) ? defaultSector : '';
  const initialUnit = initialSector && isUnitForSector(initialSector, defaultUnit)
    ? defaultUnit
    : '';
  const [sector, setSector] = useState<IncomeSector | ''>(initialSector);
  const [unit, setUnit] = useState(initialUnit);
  const [address, setAddress] = useState(defaultAddress);
  const id = useId();
  const isOther = sector === 'Other' || unit === 'Other';
  const units = sector
    ? sector === 'Other'
      ? ['Other']
      : [...UNITS_BY_SECTOR[sector], 'Other']
    : [];

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
            setSector(isIncomeSector(value) ? value : '');
            setUnit('');
          }}
        >
          <option value="">Select a sector</option>
          {INCOME_SECTORS.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>
      {sector === 'Other' ? (
        <input type="hidden" name="unit" value="Other" />
      ) : (
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
      )}
      {isOther ? (
        <div className="field">
          <label htmlFor={`${id}-address`}>Address (optional)</label>
          <textarea
            id={`${id}-address`}
            name="address"
            rows={2}
            maxLength={500}
            value={address}
            onChange={(event) => setAddress(event.target.value)}
          />
        </div>
      ) : (
        <input type="hidden" name="address" value={address} />
      )}
    </>
  );
}
