/** Stable product-definition columns read from data/products.csv. */
export const REQUIRED_PRODUCT_COLUMNS = Object.freeze([
  'productCode',
  'productName',
  'categoryCode',
  'categoryName',
  'groupCode',
  'groupName',
  'componentType',
  'compatibleRailingSystems',
  'finishCode',
  'finishName',
  'widthMm',
  'heightMm',
  'layoutWidthMm',
  'enabled',
]);

/** Commercial price columns read from data/product_prices.csv. */
export const REQUIRED_PRICE_COLUMNS = Object.freeze([
  'productCode',
  'priceHuf',
  'priceUnit',
]);

/** Stock columns read from data/product_stock.csv. */
export const REQUIRED_STOCK_COLUMNS = Object.freeze([
  'productCode',
  'stockQuantity',
]);

/** Compact category codes stored in the categoryCode CSV column. */
export const PRODUCT_CATEGORY_CODES = Object.freeze({
  glass: 'G',
  railingComponent: 'R',
});

/** Error used when product, price, or stock data cannot be interpreted safely. */
export class InventoryCsvError extends Error {}

/**
 * Split CSV text into rows and cells, including Excel-style quoted cells.
 * Double quotes inside a quoted cell are represented by two quote characters.
 */
export function readCsvRows(csvText, ErrorType = InventoryCsvError) {
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
    throw new ErrorType('The CSV contains an unclosed quoted cell.');
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** Parse rows by header name while allowing columns to be reordered in Excel. */
function readCsvRecords(csvText, requiredColumns, fileLabel) {
  const rows = readCsvRows(csvText);
  if (rows.length === 0) {
    throw new InventoryCsvError(`The ${fileLabel} CSV is empty.`);
  }

  const headers = rows[0].map((header, index) =>
    index === 0 ? header.replace(/^\uFEFF/, '').trim() : header.trim(),
  );
  const duplicateHeaders = headers.filter(
    (header, index) => headers.indexOf(header) !== index,
  );
  if (duplicateHeaders.length > 0) {
    throw new InventoryCsvError(
      `The ${fileLabel} CSV has duplicate columns: ${[
        ...new Set(duplicateHeaders),
      ].join(', ')}.`,
    );
  }

  const missingColumns = requiredColumns.filter(
    (columnName) => !headers.includes(columnName),
  );
  if (missingColumns.length > 0) {
    throw new InventoryCsvError(
      `The ${fileLabel} CSV is missing columns: ${missingColumns.join(', ')}.`,
    );
  }

  const records = [];
  rows.slice(1).forEach((cells, rowIndex) => {
    const rowNumber = rowIndex + 2;
    if (cells.every((value) => value.trim() === '')) return;
    if (cells.length !== headers.length) {
      throw new InventoryCsvError(
        `${fileLabel} row ${rowNumber}: expected ${headers.length} cells but found ${cells.length}.`,
      );
    }

    records.push({
      rowNumber,
      values: Object.fromEntries(
        headers.map((header, index) => [header, cells[index].trim()]),
      ),
    });
  });

  if (records.length === 0) {
    throw new InventoryCsvError(`The ${fileLabel} CSV contains no data rows.`);
  }
  return records;
}

/** Convert an optional integer cell while rejecting invalid Excel input. */
function readOptionalInteger(value, columnName, rowNumber, fileLabel) {
  if (value.trim() === '') return null;
  const number = Number(value);
  if (!Number.isInteger(number)) {
    throw new InventoryCsvError(
      `${fileLabel} row ${rowNumber}: ${columnName} must be a whole number or empty.`,
    );
  }
  return number;
}

/** Convert the explicit enabled flag instead of relying on non-empty text. */
function readBoolean(value, columnName, rowNumber, fileLabel) {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  throw new InventoryCsvError(
    `${fileLabel} row ${rowNumber}: ${columnName} must be true or false.`,
  );
}

/** Parse a comma-separated compatibility cell into unique system IDs. */
function readCodeList(value, columnName, rowNumber) {
  const codes = value
    .split(',')
    .map((code) => code.trim())
    .filter(Boolean);
  if (codes.length === 0) {
    throw new InventoryCsvError(
      `Products row ${rowNumber}: ${columnName} is required.`,
    );
  }
  if (new Set(codes).size !== codes.length) {
    throw new InventoryCsvError(
      `Products row ${rowNumber}: ${columnName} contains a duplicate system code.`,
    );
  }
  return codes;
}

/** Require a non-empty value in one parsed row. */
function requireValue(record, columnName, rowNumber, fileLabel) {
  if (record[columnName] === '' || record[columnName] === null) {
    throw new InventoryCsvError(
      `${fileLabel} row ${rowNumber}: ${columnName} is required.`,
    );
  }
}

/** Reject duplicate keys before records from different sources are joined. */
function validateUniqueProductCodes(records, fileLabel) {
  const productCodes = records.map((record) => record.productCode);
  const duplicates = productCodes.filter(
    (productCode, index) => productCodes.indexOf(productCode) !== index,
  );
  if (duplicates.length > 0) {
    throw new InventoryCsvError(
      `The ${fileLabel} CSV has duplicate product codes: ${[
        ...new Set(duplicates),
      ].join(', ')}.`,
    );
  }
}

/** Parse stable technical and descriptive product definitions. */
export function parseProductsCsv(csvText) {
  const records = readCsvRecords(csvText, REQUIRED_PRODUCT_COLUMNS, 'products');
  const products = records.map(({ values, rowNumber }) => {
    const product = {
      productCode: values.productCode,
      productName: values.productName,
      categoryCode: values.categoryCode,
      categoryName: values.categoryName,
      groupCode: values.groupCode,
      groupName: values.groupName,
      componentType: values.componentType,
      compatibleRailingSystems: readCodeList(
        values.compatibleRailingSystems,
        'compatibleRailingSystems',
        rowNumber,
      ),
      finishCode: values.finishCode,
      finishName: values.finishName,
      widthMm: readOptionalInteger(
        values.widthMm,
        'widthMm',
        rowNumber,
        'Products',
      ),
      heightMm: readOptionalInteger(
        values.heightMm,
        'heightMm',
        rowNumber,
        'Products',
      ),
      layoutWidthMm: readOptionalInteger(
        values.layoutWidthMm,
        'layoutWidthMm',
        rowNumber,
        'Products',
      ),
      enabled: readBoolean(values.enabled, 'enabled', rowNumber, 'Products'),
    };

    // Every planned item needs a stable code because layouts and BoMs display
    // the exact product selected by the calculation.
    requireValue(product, 'productCode', rowNumber, 'Products');
    requireValue(product, 'productName', rowNumber, 'Products');
    requireValue(product, 'categoryCode', rowNumber, 'Products');
    requireValue(product, 'categoryName', rowNumber, 'Products');
    requireValue(product, 'groupCode', rowNumber, 'Products');
    requireValue(product, 'groupName', rowNumber, 'Products');
    requireValue(product, 'componentType', rowNumber, 'Products');
    requireValue(product, 'finishCode', rowNumber, 'Products');

    if (product.categoryCode === PRODUCT_CATEGORY_CODES.glass) {
      requireValue(product, 'heightMm', rowNumber, 'Products');
      requireValue(product, 'widthMm', rowNumber, 'Products');
      requireValue(product, 'layoutWidthMm', rowNumber, 'Products');
      requireValue(product, 'finishName', rowNumber, 'Products');
      if (product.componentType !== 'glassPanel') {
        throw new InventoryCsvError(
          `Products row ${rowNumber}: a glass product must use componentType "glassPanel".`,
        );
      }
    } else if (
      product.categoryCode === PRODUCT_CATEGORY_CODES.railingComponent
    ) {
      requireValue(product, 'heightMm', rowNumber, 'Products');
      if (product.compatibleRailingSystems.length !== 1) {
        throw new InventoryCsvError(
          `Products row ${rowNumber}: a railing component must belong to exactly one railing system.`,
        );
      }
      const expectedGroupCode = `R-${product.compatibleRailingSystems[0]}`;
      if (product.groupCode !== expectedGroupCode) {
        throw new InventoryCsvError(
          `Products row ${rowNumber}: groupCode must be "${expectedGroupCode}" for this railing system.`,
        );
      }

      if (
        ['endPost', 'intermediatePost', 'cornerPost'].includes(
          product.componentType,
        )
      ) {
        requireValue(product, 'layoutWidthMm', rowNumber, 'Products');
      } else if (product.componentType === 'baseRailBar') {
        requireValue(product, 'widthMm', rowNumber, 'Products');
        requireValue(product, 'layoutWidthMm', rowNumber, 'Products');
      }
    } else {
      throw new InventoryCsvError(
        `Products row ${rowNumber}: unsupported categoryCode "${product.categoryCode}"; use G or R.`,
      );
    }

    return product;
  });

  validateUniqueProductCodes(products, 'products');
  return products;
}

/** Parse product prices maintained by the pricing data source. */
export function parseProductPricesCsv(csvText) {
  const records = readCsvRecords(csvText, REQUIRED_PRICE_COLUMNS, 'prices');
  const prices = records.map(({ values, rowNumber }) => {
    const price = {
      productCode: values.productCode,
      priceHuf: readOptionalInteger(
        values.priceHuf,
        'priceHuf',
        rowNumber,
        'Prices',
      ),
      priceUnit: values.priceUnit,
    };
    requireValue(price, 'productCode', rowNumber, 'Prices');
    requireValue(price, 'priceHuf', rowNumber, 'Prices');
    requireValue(price, 'priceUnit', rowNumber, 'Prices');
    if (price.priceHuf < 0) {
      throw new InventoryCsvError(
        `Prices row ${rowNumber}: priceHuf cannot be negative.`,
      );
    }
    return price;
  });

  validateUniqueProductCodes(prices, 'prices');
  return prices;
}

/** Parse product quantities maintained by the stock data source. */
export function parseProductStockCsv(csvText) {
  const records = readCsvRecords(csvText, REQUIRED_STOCK_COLUMNS, 'stock');
  const stockRecords = records.map(({ values, rowNumber }) => {
    const stock = {
      productCode: values.productCode,
      stockQuantity: readOptionalInteger(
        values.stockQuantity,
        'stockQuantity',
        rowNumber,
        'Stock',
      ),
    };
    requireValue(stock, 'productCode', rowNumber, 'Stock');
    requireValue(stock, 'stockQuantity', rowNumber, 'Stock');
    if (stock.stockQuantity < 0) {
      throw new InventoryCsvError(
        `Stock row ${rowNumber}: stockQuantity cannot be negative.`,
      );
    }
    return stock;
  });

  validateUniqueProductCodes(stockRecords, 'stock');
  return stockRecords;
}

/**
 * Join technical definitions, prices, and stock using the stable productCode.
 * The calculator still receives one convenient product object, while each CSV
 * can be maintained independently by its owning data source.
 */
export function mergeProductData(products, prices, stockRecords) {
  const productsByCode = new Map(
    products.map((product) => [product.productCode, product]),
  );
  const pricesByCode = new Map(
    prices.map((price) => [price.productCode, price]),
  );
  const stockByCode = new Map(
    stockRecords.map((stock) => [stock.productCode, stock]),
  );

  const unknownPriceCodes = prices
    .map((price) => price.productCode)
    .filter((productCode) => !productsByCode.has(productCode));
  const unknownStockCodes = stockRecords
    .map((stock) => stock.productCode)
    .filter((productCode) => !productsByCode.has(productCode));
  if (unknownPriceCodes.length > 0) {
    throw new InventoryCsvError(
      `The prices CSV references unknown product codes: ${unknownPriceCodes.join(', ')}.`,
    );
  }
  if (unknownStockCodes.length > 0) {
    throw new InventoryCsvError(
      `The stock CSV references unknown product codes: ${unknownStockCodes.join(', ')}.`,
    );
  }

  const missingPriceCodes = products
    .map((product) => product.productCode)
    .filter((productCode) => !pricesByCode.has(productCode));
  if (missingPriceCodes.length > 0) {
    throw new InventoryCsvError(
      `The prices CSV is missing product codes: ${missingPriceCodes.join(', ')}.`,
    );
  }

  const missingGlassStockCodes = products
    .filter(
      (product) =>
        product.categoryCode === PRODUCT_CATEGORY_CODES.glass &&
        !stockByCode.has(product.productCode),
    )
    .map((product) => product.productCode);
  if (missingGlassStockCodes.length > 0) {
    throw new InventoryCsvError(
      `The stock CSV is missing glass product codes: ${missingGlassStockCodes.join(', ')}.`,
    );
  }

  return products.map((product) => {
    const price = pricesByCode.get(product.productCode);
    const stock = stockByCode.get(product.productCode);

    if (
      product.categoryCode === PRODUCT_CATEGORY_CODES.glass &&
      price.priceUnit !== 'piece'
    ) {
      throw new InventoryCsvError(
        `Product "${product.productCode}" must use priceUnit "piece".`,
      );
    }
    if (
      product.componentType === 'baseRailBar' &&
      price.priceUnit !== 'piece'
    ) {
      throw new InventoryCsvError(
        `Product "${product.productCode}" must use priceUnit "piece".`,
      );
    }
    if (
      product.componentType === 'baseRailCustomCut' &&
      price.priceUnit !== 'metre'
    ) {
      throw new InventoryCsvError(
        `Product "${product.productCode}" must use priceUnit "metre".`,
      );
    }

    return {
      ...product,
      priceHuf: price.priceHuf,
      priceUnit: price.priceUnit,
      stockQuantity: stock?.stockQuantity ?? null,
    };
  });
}
