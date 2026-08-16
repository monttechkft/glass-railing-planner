/** Column names the application reads from the Excel-editable inventory CSV. */
export const REQUIRED_PRODUCT_COLUMNS = Object.freeze([
  'productCode',
  'productName',
  'productCategory',
  'productCategoryName',
  'productGroup',
  'productGroupName',
  'height',
  'width',
  'color',
  'colorName',
  'price',
  'quantity',
]);

/** Compact category codes stored in the productCategory CSV column. */
export const PRODUCT_CATEGORY_CODES = Object.freeze({
  glass: 'G',
  railingComponent: 'R',
});

/** Error used when an edited CSV file cannot be interpreted safely. */
export class InventoryCsvError extends Error {}

/**
 * Split CSV text into rows and cells, including Excel-style quoted cells.
 * Double quotes inside a quoted cell are represented by two quote characters.
 */
function readCsvRows(csvText) {
  const rows = [];
  let row = [];
  let cell = '';
  let insideQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const character = csvText[index];

    if (insideQuotes) {
      if (character === '"' && csvText[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        insideQuotes = false;
      } else {
        cell += character;
      }
      continue;
    }

    if (character === '"' && cell === '') {
      insideQuotes = true;
    } else if (character === ',') {
      row.push(cell);
      cell = '';
    } else if (character === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (character !== '\r') {
      cell += character;
    }
  }

  if (insideQuotes) {
    throw new InventoryCsvError('The inventory CSV contains an unclosed quoted cell.');
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** Convert an optional numeric CSV cell while rejecting invalid Excel input. */
function readOptionalInteger(value, columnName, rowNumber) {
  if (value.trim() === '') return null;
  const number = Number(value);
  if (!Number.isInteger(number)) {
    throw new InventoryCsvError(
      `Row ${rowNumber}: ${columnName} must be a whole number or empty.`,
    );
  }
  return number;
}

/** Require a non-empty value in a product row. */
function requireValue(product, columnName, rowNumber) {
  if (product[columnName] === '' || product[columnName] === null) {
    throw new InventoryCsvError(`Row ${rowNumber}: ${columnName} is required.`);
  }
}

/**
 * Convert the inventory CSV to product objects named exactly like its columns.
 * Columns are located by header name, so their order may be changed in Excel.
 */
export function parseInventoryCsv(csvText) {
  const rows = readCsvRows(csvText);
  if (rows.length === 0) {
    throw new InventoryCsvError('The inventory CSV is empty.');
  }

  const headers = rows[0].map((header, index) =>
    index === 0 ? header.replace(/^\uFEFF/, '').trim() : header.trim(),
  );
  const duplicateHeaders = headers.filter(
    (header, index) => headers.indexOf(header) !== index,
  );
  if (duplicateHeaders.length > 0) {
    throw new InventoryCsvError(
      `The inventory CSV has duplicate columns: ${[...new Set(duplicateHeaders)].join(', ')}.`,
    );
  }

  const missingColumns = REQUIRED_PRODUCT_COLUMNS.filter(
    (columnName) => !headers.includes(columnName),
  );
  if (missingColumns.length > 0) {
    throw new InventoryCsvError(
      `The inventory CSV is missing columns: ${missingColumns.join(', ')}.`,
    );
  }

  const products = [];
  rows.slice(1).forEach((cells, rowIndex) => {
    const rowNumber = rowIndex + 2;
    if (cells.every((value) => value.trim() === '')) return;
    if (cells.length !== headers.length) {
      throw new InventoryCsvError(
        `Row ${rowNumber}: expected ${headers.length} cells but found ${cells.length}.`,
      );
    }

    const values = Object.fromEntries(
      headers.map((header, index) => [header, cells[index].trim()]),
    );
    const product = {
      productCode: values.productCode,
      productName: values.productName,
      productCategory: values.productCategory,
      productCategoryName: values.productCategoryName,
      productGroup: values.productGroup,
      productGroupName: values.productGroupName,
      height: readOptionalInteger(values.height, 'height', rowNumber),
      width: readOptionalInteger(values.width, 'width', rowNumber),
      color: values.color,
      colorName: values.colorName,
      price: readOptionalInteger(values.price, 'price', rowNumber),
      quantity: readOptionalInteger(values.quantity, 'quantity', rowNumber),
    };

    // Every planned item must have a stable code because layouts display the
    // exact inventory product selected by the calculation.
    requireValue(product, 'productCode', rowNumber);
    requireValue(product, 'productName', rowNumber);
    requireValue(product, 'productCategory', rowNumber);
    requireValue(product, 'productCategoryName', rowNumber);
    requireValue(product, 'productGroup', rowNumber);
    requireValue(product, 'price', rowNumber);
    if (product.productCategory === PRODUCT_CATEGORY_CODES.glass) {
      requireValue(product, 'height', rowNumber);
      requireValue(product, 'width', rowNumber);
      requireValue(product, 'quantity', rowNumber);
    } else if (product.productCategory === PRODUCT_CATEGORY_CODES.railingComponent) {
      requireValue(product, 'productGroupName', rowNumber);
    } else {
      throw new InventoryCsvError(
        `Row ${rowNumber}: unsupported productCategory "${product.productCategory}"; use G or R.`,
      );
    }

    products.push(product);
  });

  if (products.length === 0) {
    throw new InventoryCsvError('The inventory CSV contains no product rows.');
  }
  return products;
}
