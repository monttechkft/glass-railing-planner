import { readCsvRows } from './inventory.js';

/** Calculation families supported by the current form and engine. */
export const RAILING_SYSTEM_FAMILIES = Object.freeze({
  fullHeightPost: 'FP',
  halfHeightPost: 'HP',
  continuousBaseRail: 'UC',
});

/** Column names required in the Excel-editable railing-system catalogue. */
export const REQUIRED_RAILING_SYSTEM_COLUMNS = Object.freeze([
  'systemId',
  'systemName',
  'systemFamilyId',
  'systemFamilyName',
  'enabled',
]);

/** Error used when the railing-system catalogue cannot be interpreted safely. */
export class RailingSystemCsvError extends Error {}

/** Parse one explicit true/false catalogue cell. */
function readEnabled(value, rowNumber) {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  throw new RailingSystemCsvError(
    `Row ${rowNumber}: enabled must be true or false.`,
  );
}

/**
 * Parse the railing-system catalogue into records used by the form and engine.
 * Header names, rather than column positions, determine how cells are read.
 */
export function parseRailingSystemsCsv(csvText) {
  const rows = readCsvRows(csvText, RailingSystemCsvError);
  if (rows.length === 0) {
    throw new RailingSystemCsvError('The railing-system CSV is empty.');
  }

  const headers = rows[0].map((header, index) =>
    index === 0 ? header.replace(/^\uFEFF/, '').trim() : header.trim(),
  );
  const duplicateHeaders = headers.filter(
    (header, index) => headers.indexOf(header) !== index,
  );
  if (duplicateHeaders.length > 0) {
    throw new RailingSystemCsvError(
      `The railing-system CSV has duplicate columns: ${[
        ...new Set(duplicateHeaders),
      ].join(', ')}.`,
    );
  }

  const missingColumns = REQUIRED_RAILING_SYSTEM_COLUMNS.filter(
    (columnName) => !headers.includes(columnName),
  );
  if (missingColumns.length > 0) {
    throw new RailingSystemCsvError(
      `The railing-system CSV is missing columns: ${missingColumns.join(', ')}.`,
    );
  }

  const supportedFamilyIds = new Set(Object.values(RAILING_SYSTEM_FAMILIES));
  const systems = [];
  rows.slice(1).forEach((cells, rowIndex) => {
    const rowNumber = rowIndex + 2;
    if (cells.every((value) => value.trim() === '')) return;
    if (cells.length !== headers.length) {
      throw new RailingSystemCsvError(
        `Row ${rowNumber}: expected ${headers.length} cells but found ${cells.length}.`,
      );
    }

    const values = Object.fromEntries(
      headers.map((header, index) => [header, cells[index].trim()]),
    );
    for (const columnName of REQUIRED_RAILING_SYSTEM_COLUMNS.slice(0, 4)) {
      if (values[columnName] === '') {
        throw new RailingSystemCsvError(
          `Row ${rowNumber}: ${columnName} is required.`,
        );
      }
    }
    if (!supportedFamilyIds.has(values.systemFamilyId)) {
      throw new RailingSystemCsvError(
        `Row ${rowNumber}: unsupported systemFamilyId "${values.systemFamilyId}".`,
      );
    }

    systems.push({
      systemId: values.systemId,
      systemName: values.systemName,
      systemFamilyId: values.systemFamilyId,
      systemFamilyName: values.systemFamilyName,
      enabled: readEnabled(values.enabled, rowNumber),
    });
  });

  if (systems.length === 0) {
    throw new RailingSystemCsvError(
      'The railing-system CSV contains no system rows.',
    );
  }
  const duplicateIds = systems
    .map((system) => system.systemId)
    .filter((systemId, index, ids) => ids.indexOf(systemId) !== index);
  if (duplicateIds.length > 0) {
    throw new RailingSystemCsvError(
      `The railing-system CSV has duplicate system IDs: ${[
        ...new Set(duplicateIds),
      ].join(', ')}.`,
    );
  }

  for (const familyId of supportedFamilyIds) {
    const familySystems = systems.filter(
      (system) => system.systemFamilyId === familyId,
    );
    if (familySystems.length === 0) {
      throw new RailingSystemCsvError(
        `The railing-system CSV has no entries for family ${familyId}.`,
      );
    }
    const familyNames = new Set(
      familySystems.map((system) => system.systemFamilyName),
    );
    if (familyNames.size !== 1) {
      throw new RailingSystemCsvError(
        `System family ${familyId} must use one consistent family name.`,
      );
    }
  }

  return systems;
}

/** Return catalogue entries for one calculation family in CSV order. */
export function getSystemsForFamily(railingSystems, systemFamilyId) {
  return railingSystems.filter(
    (system) => system.systemFamilyId === systemFamilyId,
  );
}

/**
 * Verify that every system ID referenced by a product exists in the catalogue.
 * Keeping this check at the boundary gives CSV editors a useful error instead
 * of silently making a product unavailable because of a misspelled ID.
 */
export function validateProductSystemCompatibility(products, railingSystems) {
  const catalogueIds = new Set(
    railingSystems.map((system) => system.systemId),
  );
  const unknownIds = [
    ...new Set(
      products
        .flatMap((product) => product.compatibleRailingSystems)
        .filter((systemId) => !catalogueIds.has(systemId)),
    ),
  ];

  if (unknownIds.length > 0) {
    throw new RailingSystemCsvError(
      `Product inventory references unknown railing-system IDs: ${unknownIds.join(', ')}.`,
    );
  }
}
