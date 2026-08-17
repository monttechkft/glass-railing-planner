import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  calculateCustomCutPrice,
  calculatePlans,
  calculateProject,
} from '../src/calculator.js';
import {
  mergeProductData,
  parseProductPricesCsv,
  parseProductsCsv,
  parseProductStockCsv,
  PRODUCT_CATEGORY_CODES,
  REQUIRED_PRICE_COLUMNS,
  REQUIRED_PRODUCT_COLUMNS,
  REQUIRED_STOCK_COLUMNS,
} from '../src/inventory.js';
import {
  parseRailingSystemsCsv,
  RAILING_SYSTEM_FAMILIES,
  REQUIRED_RAILING_SYSTEM_COLUMNS,
  validateProductSystemCompatibility,
} from '../src/railingSystems.js';

const productCsvText = await readFile(
  new URL('../data/products.csv', import.meta.url),
  'utf8',
);
const productPriceCsvText = await readFile(
  new URL('../data/product_prices.csv', import.meta.url),
  'utf8',
);
const productStockCsvText = await readFile(
  new URL('../data/product_stock.csv', import.meta.url),
  'utf8',
);
const productDefinitions = parseProductsCsv(productCsvText);
const productPrices = parseProductPricesCsv(productPriceCsvText);
const productStock = parseProductStockCsv(productStockCsvText);
const products = mergeProductData(
  productDefinitions,
  productPrices,
  productStock,
);
const railingSystemCsvText = await readFile(
  new URL('../data/railing_systems.csv', import.meta.url),
  'utf8',
);
const railingSystems = parseRailingSystemsCsv(railingSystemCsvText);

test('custom base-rail cuts scale their CSV price-per-metre by length', () => {
  assert.equal(calculateCustomCutPrice(1000, 30550), 30550);
  assert.equal(calculateCustomCutPrice(1500, 30550), 45825);
  assert.equal(calculateCustomCutPrice(1500, 30605), 45907.5);
});

test('separate CSV files preserve and join all product data', () => {
  assert.equal(productDefinitions.length, 88);
  assert.equal(productPrices.length, 88);
  assert.equal(productStock.length, 88);
  assert.equal(products.length, 88);
  assert.equal(
    products.filter(
      (product) => product.categoryCode === PRODUCT_CATEGORY_CODES.glass,
    ).length,
    74,
  );
  assert.equal(
    products.filter(
      (product) =>
        product.categoryCode === PRODUCT_CATEGORY_CODES.railingComponent,
    ).length,
    14,
  );
  assert.deepEqual(Object.keys(productDefinitions[0]), REQUIRED_PRODUCT_COLUMNS);
  assert.deepEqual(Object.keys(productPrices[0]), REQUIRED_PRICE_COLUMNS);
  assert.deepEqual(Object.keys(productStock[0]), REQUIRED_STOCK_COLUMNS);
  assert.deepEqual(
    productPrices.map(({ productCode, productName }) => ({
      productCode,
      productName,
    })),
    productDefinitions.map(({ productCode, productName }) => ({
      productCode,
      productName,
    })),
  );
  assert.deepEqual(
    productStock.map(({ productCode, productName }) => ({
      productCode,
      productName,
    })),
    productDefinitions.map(({ productCode, productName }) => ({
      productCode,
      productName,
    })),
  );
  assert.deepEqual(products[0], {
    productCode: 'G-H850-W900-U1',
    productName: '900 x 850 mm Clear Glass Panel',
    categoryCode: 'G',
    categoryName: 'Glass Panel',
    groupCode: 'G-H850',
    groupName: '850 mm Glass Panel',
    componentType: 'glassPanel',
    compatibleRailingSystems: ['FP-958-TM'],
    finishCode: 'U1',
    finishName: 'Clear',
    widthMm: 900,
    heightMm: 850,
    layoutWidthMm: 900,
    enabled: true,
    priceHuf: 15300,
    priceUnit: 'piece',
    stockQuantity: 139,
  });
  assert.equal(
    products.find(
      (product) => product.productCode === 'R-UC-102-TM-CUT-F1',
    ).stockQuantity,
    null,
  );
  assert.equal(
    products.find(
      (product) => product.productCode === 'R-UC-117-SM-CUT-F1',
    ).stockQuantity,
    null,
  );
  products
    .filter(
      (product) =>
        product.categoryCode === PRODUCT_CATEGORY_CODES.railingComponent &&
        product.componentType !== 'baseRailCustomCut',
    )
    .forEach((product) => assert.equal(product.stockQuantity, 0));
});

test('current inventory product codes are complete and unique', () => {
  const productCodes = products.map((product) => product.productCode);
  assert.ok(productCodes.every((productCode) => productCode !== ''));
  assert.equal(new Set(productCodes).size, productCodes.length);
});

test('railing-system catalogue is complete and matches product compatibility', () => {
  assert.doesNotThrow(() =>
    validateProductSystemCompatibility(products, railingSystems),
  );
  assert.equal(railingSystems.length, 7);
  assert.deepEqual(Object.keys(railingSystems[0]), REQUIRED_RAILING_SYSTEM_COLUMNS);
  assert.deepEqual(railingSystems[0], {
    systemId: 'FP-958-TM',
    systemName: '958 mm Top-Mounted',
    systemFamilyId: 'FP',
    systemFamilyName: 'Full-Height Post System',
    enabled: true,
  });
  const catalogueIds = new Set(railingSystems.map((system) => system.systemId));
  const compatibilityIds = new Set(
    products.flatMap((product) => product.compatibleRailingSystems),
  );
  assert.deepEqual([...compatibilityIds].sort(), [...catalogueIds].sort());
});

test('catalogue validation rejects an unknown product compatibility ID', () => {
  const invalidProducts = [
    {
      ...products[0],
      compatibleRailingSystems: ['FP-958-TM', 'UNKNOWN-SYSTEM'],
    },
  ];

  assert.throws(
    () => validateProductSystemCompatibility(invalidProducts, railingSystems),
    /unknown railing-system IDs: UNKNOWN-SYSTEM/,
  );
});

test('glass codes expose height, width, and finish consistently', () => {
  const glassProducts = products.filter(
    (product) => product.categoryCode === PRODUCT_CATEGORY_CODES.glass,
  );
  for (const product of glassProducts) {
    assert.equal(product.groupCode, `G-H${product.heightMm}`);
    assert.equal(
      product.productCode,
      `G-H${product.heightMm}-W${product.widthMm}-${product.finishCode}`,
    );
    assert.equal(product.layoutWidthMm, product.widthMm);
  }
});

test('glass product names follow the readable dimension and finish convention', () => {
  const glassProducts = products.filter(
    (product) => product.categoryCode === PRODUCT_CATEGORY_CODES.glass,
  );
  for (const product of glassProducts) {
    assert.equal(
      product.productName,
      `${product.widthMm} x ${product.heightMm} mm ${product.finishName} Glass Panel`,
    );
  }
});

test('railing products use explicit component types and group prefixes', () => {
  const railingComponents = products.filter(
    (product) =>
      product.categoryCode === PRODUCT_CATEGORY_CODES.railingComponent,
  );
  assert.ok(
    railingComponents.every(
      (product) =>
        product.productCode.startsWith(product.groupCode) &&
        product.compatibleRailingSystems.length === 1 &&
        product.groupCode === `R-${product.compatibleRailingSystems[0]}`,
    ),
  );
  assert.deepEqual(
    [...new Set(railingComponents.map((product) => product.componentType))].sort(),
    [
      'baseRailBar',
      'baseRailCustomCut',
      'cornerPost',
      'endPost',
      'intermediatePost',
      'multiPositionPost',
    ],
  );
});

test('project calculations select base-rail products by compatibility, finish, and type', () => {
  const project = calculateProject(
    {
      system: RAILING_SYSTEM_FAMILIES.continuousBaseRail,
      railVariant: 'UC-102-TM',
      sections: [
        {
          number: 1,
          length: 4000,
          panes: null,
          vonalmentiGap: 5,
          color: 'U1',
        },
      ],
    },
    products,
    railingSystems,
  );

  assert.equal(project.sections.length, 1);
  assert.equal(project.sections[0].result.height, 1000);
  assert.equal(project.sections[0].result.systemDetails.finishName, 'Clear');
  assert.deepEqual(
    project.sections[0].result.systemDetails.profileProductCodes,
    {
      standardBar: 'R-UC-102-TM-F1',
      customCut: 'R-UC-102-TM-CUT-F1',
    },
  );
  assert.ok(project.sections[0].result.plans[0].combination.length > 0);
});

test('side-mounted base rail selects its own stock and custom-cut products', () => {
  const project = calculateProject(
    {
      system: RAILING_SYSTEM_FAMILIES.continuousBaseRail,
      railVariant: 'UC-117-SM',
      sections: [
        {
          number: 1,
          length: 4000,
          panes: null,
          vonalmentiGap: 5,
          color: 'U1',
        },
      ],
    },
    products,
    railingSystems,
  );

  assert.deepEqual(
    project.sections[0].result.systemDetails.profileProductCodes,
    {
      standardBar: 'R-UC-117-SM-F1',
      customCut: 'R-UC-117-SM-CUT-F1',
    },
  );
  assert.equal(
    products.find(
      (product) => product.productCode === 'R-UC-117-SM-CUT-F1',
    ).priceHuf,
    30605,
  );
});

test('calculation consumes post and bar layout widths from the CSV', () => {
  const adjustedProducts = products.map((product) => {
    const fullHeightWidths = {
      endPost: 100,
      intermediatePost: 40,
      cornerPost: 120,
    };
    if (product.groupCode === 'R-FP-958-TM') {
      return {
        ...product,
        layoutWidthMm: fullHeightWidths[product.componentType],
      };
    }
    if (
      product.groupCode === 'R-UC-102-TM' &&
      product.componentType === 'baseRailBar'
    ) {
      return { ...product, layoutWidthMm: 3000 };
    }
    return product;
  });

  const fullHeight = calculatePlans(
    {
      system: RAILING_SYSTEM_FAMILIES.fullHeightPost,
      length: 5250,
      panes: 5,
      startPost: 'I',
      endPost: 'S',
    },
    adjustedProducts,
    railingSystems,
  );
  assert.equal(fullHeight.targetGlassLength, 4870);

  const baseRail = calculateProject(
    {
      system: RAILING_SYSTEM_FAMILIES.continuousBaseRail,
      railVariant: 'UC-102-TM',
      sections: [
        {
          number: 1,
          length: 4000,
          panes: null,
          vonalmentiGap: 5,
          color: 'U1',
        },
      ],
    },
    adjustedProducts,
    railingSystems,
  );
  assert.deepEqual(baseRail.sections[0].result.systemDetails.profile, {
    barCount: 1,
    cutLength: 1000,
    waste: 0,
  });
});

test('compatibility selects 1000 mm glass for its full-post system', () => {
  const productsWithFutureSystemEnabled = products.map((product) =>
    product.categoryCode === 'R' &&
    product.compatibleRailingSystems.includes('FP-1000-TM')
      ? { ...product, enabled: true }
      : product,
  );
  const result = calculatePlans(
    {
      system: RAILING_SYSTEM_FAMILIES.fullHeightPost,
      railVariant: 'FP-1000-TM',
      length: 5250,
      panes: 5,
      startPost: 'I',
      endPost: 'I',
    },
    productsWithFutureSystemEnabled,
    railingSystems,
  );

  assert.equal(result.height, 1000);
  assert.ok(
    result.plans[0].productCodeSequence.every((code) =>
      code.startsWith('G-H1000-'),
    ),
  );
  assert.ok(
    result.systemDetails.postProductCodeSequence.every((code) =>
      code.startsWith('R-FP-1000-TM-'),
    ),
  );
});

test('CSV uses the documented glass and railing group codes', () => {
  assert.deepEqual(
    [...new Set(products.map((product) => product.groupCode))].sort(),
    [
      'G-H1000',
      'G-H850',
      'G-H900',
      'R-FP-1000-TM',
      'R-FP-958-TM',
      'R-HP-448-TM',
      'R-HP-628-SM',
      'R-UC-102-TM',
      'R-UC-117-SM',
    ],
  );
});

test('CSV-backed post-system calculations preserve representative plans', () => {
  const fullHeight = calculatePlans(
    {
      system: RAILING_SYSTEM_FAMILIES.fullHeightPost,
      length: 5250,
      panes: 5,
      startPost: 'I',
      endPost: 'S',
    },
    products,
    railingSystems,
  );
  const halfHeight = calculatePlans(
    {
      system: RAILING_SYSTEM_FAMILIES.halfHeightPost,
      length: 5250,
      panes: 5,
      railVariant: 'HP-628-SM',
      gap: 20,
    },
    products,
    railingSystems,
  );

  assert.deepEqual(
    fullHeight.plans[0].combination,
    [950, 950, 1000, 1000, 1000],
  );
  assert.deepEqual(
    fullHeight.plans[0].productCodeSequence,
    fullHeight.plans[0].sequence.map(
      (widthMm) => `G-H850-W${widthMm}-U1`,
    ),
  );
  assert.deepEqual(fullHeight.systemDetails.postProductCodeSequence, [
    'R-FP-958-TM-END-F1',
    'R-FP-958-TM-MID-F1',
    'R-FP-958-TM-MID-F1',
    'R-FP-958-TM-MID-F1',
    'R-FP-958-TM-MID-F1',
    'R-FP-958-TM-COR-F1',
  ]);
  assert.deepEqual(
    halfHeight.plans[0].combination,
    [1000, 1000, 1050, 1050, 1050],
  );
  assert.deepEqual(
    halfHeight.systemDetails.postProductCodeSequence,
    Array(6).fill('R-HP-628-SM-F1'),
  );
});

test('separate CSV parsers resolve values after columns are reordered', () => {
  const reorderedProductsCsv = [
    'widthMm,groupCode,categoryCode,productCode,groupName,heightMm,finishCode,finishName,categoryName,productName,compatibleRailingSystems,componentType,layoutWidthMm,enabled',
    '900,G-H850,G,G-H850-W900-U1,Custom group name,850,U1,Clear,Custom category name,Custom product name,FP-958-TM,glassPanel,900,true',
  ].join('\n');
  const reorderedPricesCsv = [
    'priceUnit,productName,productCode,priceHuf',
    'piece,Custom product name,G-H850-W900-U1,15300',
  ].join('\n');
  const reorderedStockCsv = [
    'stockQuantity,productName,productCode',
    '4,Custom product name,G-H850-W900-U1',
  ].join('\n');

  assert.deepEqual(
    mergeProductData(
      parseProductsCsv(reorderedProductsCsv),
      parseProductPricesCsv(reorderedPricesCsv),
      parseProductStockCsv(reorderedStockCsv),
    )[0],
    {
    productCode: 'G-H850-W900-U1',
    productName: 'Custom product name',
    categoryCode: 'G',
    categoryName: 'Custom category name',
    groupCode: 'G-H850',
    groupName: 'Custom group name',
    componentType: 'glassPanel',
    compatibleRailingSystems: ['FP-958-TM'],
    finishCode: 'U1',
    finishName: 'Clear',
    widthMm: 900,
    heightMm: 850,
    layoutWidthMm: 900,
    enabled: true,
    priceHuf: 15300,
    priceUnit: 'piece',
    stockQuantity: 4,
    },
  );
});

test('products CSV parser rejects invalid enabled flags', () => {
  const invalidCsv = [
    REQUIRED_PRODUCT_COLUMNS.join(','),
    'G-H850-W900-U1,Example,G,Glass Panel,G-H850,850 mm Glass Panel,glassPanel,FP-958-TM,U1,Clear,900,850,900,yes',
  ].join('\n');

  assert.throws(
    () => parseProductsCsv(invalidCsv),
    /enabled must be true or false/,
  );
});

test('joined data rejects rows outside products.csv order', () => {
  const misorderedPrices = productPrices.slice();
  [misorderedPrices[0], misorderedPrices[1]] = [
    misorderedPrices[1],
    misorderedPrices[0],
  ];

  assert.throws(
    () =>
      mergeProductData(
        productDefinitions,
        misorderedPrices,
        productStock,
      ),
    /expected productCode .* to match products.csv order/,
  );
});

test('joined data rejects copied rows with mismatched product names', () => {
  const renamedStock = productStock.map((row, index) =>
    index === 0 ? { ...row, productName: 'Wrong product' } : row,
  );

  assert.throws(
    () => mergeProductData(productDefinitions, productPrices, renamedStock),
    /productName must match products.csv/,
  );
});

test('N/A stock remains invalid for every product except custom cuts', () => {
  const stockWithoutFirstGlassQuantity = productStock.map((row, index) =>
    index === 0 ? { ...row, stockQuantity: null } : row,
  );

  assert.throws(
    () =>
      mergeProductData(
        productDefinitions,
        productPrices,
        stockWithoutFirstGlassQuantity,
      ),
    /stock CSV requires a numeric quantity/,
  );

  const postIndex = productDefinitions.findIndex(
    (product) => product.componentType === 'endPost',
  );
  const stockWithoutPostQuantity = productStock.map((row, index) =>
    index === postIndex ? { ...row, stockQuantity: null } : row,
  );
  assert.throws(
    () =>
      mergeProductData(
        productDefinitions,
        productPrices,
        stockWithoutPostQuantity,
      ),
    /stock CSV requires a numeric quantity/,
  );
});

test('custom-cut products require N/A stock', () => {
  const customCutIndex = productDefinitions.findIndex(
    (product) => product.componentType === 'baseRailCustomCut',
  );
  const numericCustomCutStock = productStock.map((row, index) =>
    index === customCutIndex ? { ...row, stockQuantity: 0 } : row,
  );

  assert.throws(
    () =>
      mergeProductData(
        productDefinitions,
        productPrices,
        numericCustomCutStock,
      ),
    /must use N\/A for custom-cut products/,
  );
});

test('stock CSV rejects empty quantities', () => {
  const blankStockCsv = [
    REQUIRED_STOCK_COLUMNS.join(','),
    'G-H850-W900-U1,900 x 850 mm Clear Glass Panel,',
  ].join('\n');

  assert.throws(
    () => parseProductStockCsv(blankStockCsv),
    /empty cells are not allowed/,
  );
});
