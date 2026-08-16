import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  calculateCustomCutPrice,
  calculatePlans,
  calculateProject,
} from '../src/calculator.js';
import {
  parseInventoryCsv,
  PRODUCT_CATEGORY_CODES,
  REQUIRED_PRODUCT_COLUMNS,
} from '../src/inventory.js';

const csvText = await readFile(
  new URL('../glass_inventory.csv', import.meta.url),
  'utf8',
);
const products = parseInventoryCsv(csvText);

test('custom base-rail cuts scale their CSV price-per-metre by length', () => {
  assert.equal(calculateCustomCutPrice(1000, 30550), 30550);
  assert.equal(calculateCustomCutPrice(1500, 30550), 45825);
  assert.equal(calculateCustomCutPrice(1500, 30605), 45907.5);
});

test('CSV parsing preserves all product rows and column-based names', () => {
  assert.equal(products.length, 88);
  assert.equal(
    products.filter(
      (product) => product.productCategory === PRODUCT_CATEGORY_CODES.glass,
    ).length,
    74,
  );
  assert.equal(
    products.filter(
      (product) =>
        product.productCategory === PRODUCT_CATEGORY_CODES.railingComponent,
    ).length,
    14,
  );
  assert.deepEqual(Object.keys(products[0]), REQUIRED_PRODUCT_COLUMNS);
  const { productCategoryName, ...firstProductWithoutCategoryName } = products[0];
  assert.ok(productCategoryName.trim().length > 0);
  assert.deepEqual(firstProductWithoutCategoryName, {
    productCode: 'G-U1-900x850',
    productName: '900x850mm Glass Panel - Clear',
    productCategory: 'G',
    productGroup: 'G-U1-850',
    productGroupName: '850mm Glass Panel - Clear',
    height: 850,
    width: 900,
    color: 'U1',
    colorName: 'Clear',
    price: 15300,
    quantity: 139,
  });
});

test('current inventory product codes are complete and unique', () => {
  const productCodes = products.map((product) => product.productCode);
  assert.ok(productCodes.every((productCode) => productCode !== ''));
  assert.equal(new Set(productCodes).size, productCodes.length);
});

test('glass product codes and groups use color before dimensions', () => {
  const glassProducts = products.filter(
    (product) => product.productCategory === PRODUCT_CATEGORY_CODES.glass,
  );
  for (const product of glassProducts) {
    const color = product.productGroup.split('-')[1];
    assert.equal(product.productGroup, `G-${color}-${product.height}`);
    assert.equal(
      product.productCode,
      `G-${color}-${product.width}x${product.height}`,
    );
  }
});

test('glass product names follow the width, height, and color-name convention', () => {
  const glassProducts = products.filter(
    (product) => product.productCategory === PRODUCT_CATEGORY_CODES.glass,
  );
  for (const product of glassProducts) {
    assert.equal(
      product.productName,
      `${product.width}x${product.height}mm Glass Panel - ${product.colorName}`,
    );
  }
});

test('railing-component codes start with their mounting product group', () => {
  const railingComponents = products.filter(
    (product) =>
      product.productCategory === PRODUCT_CATEGORY_CODES.railingComponent,
  );
  assert.ok(
    railingComponents.every((product) =>
      product.productCode.startsWith(product.productGroup),
    ),
  );
});

test('project calculations select glass products by CSV productGroup', () => {
  const project = calculateProject(
    {
      system: 'vonalmenti',
      railVariant: '102-top',
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
  );

  assert.equal(project.sections.length, 1);
  assert.equal(project.sections[0].result.height, 1000);
  assert.equal(project.sections[0].result.systemDetails.colorName, 'Clear');
  assert.deepEqual(
    project.sections[0].result.systemDetails.profileProductCodes,
    {
      standardBar: 'R-TM-102-F1-T',
      customCut: 'R-TM-102-F1-V',
    },
  );
  assert.ok(project.sections[0].result.plans[0].combination.length > 0);
});

test('side-mounted base rail selects its own stock and custom-cut products', () => {
  const project = calculateProject(
    {
      system: 'vonalmenti',
      railVariant: '117-side',
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
  );

  assert.deepEqual(
    project.sections[0].result.systemDetails.profileProductCodes,
    {
      standardBar: 'R-SM-117-F1-T',
      customCut: 'R-SM-117-F1-V',
    },
  );
  assert.equal(
    products.find((product) => product.productCode === 'R-SM-117-F1-V').price,
    30605,
  );
});

test('CSV uses the documented glass and railing product-group codes', () => {
  assert.deepEqual(
    [...new Set(products.map((product) => product.productGroup))].sort(),
    [
      'G-U1-1000',
      'G-U1-850',
      'G-U1-900',
      'G-U2-1000',
      'G-U3-1000',
      'R-SM-117',
      'R-SM-628',
      'R-TM-1000',
      'R-TM-102',
      'R-TM-448',
      'R-TM-958',
    ],
  );
});

test('CSV-backed post-system calculations preserve representative plans', () => {
  const fullHeight = calculatePlans(
    {
      system: '958',
      length: 5250,
      panes: 5,
      startPost: 'I',
      endPost: 'S',
    },
    products,
  );
  const halfHeight = calculatePlans(
    {
      system: 'general',
      length: 5250,
      panes: 5,
      railVariant: '628-side',
      gap: 20,
    },
    products,
  );

  assert.deepEqual(
    fullHeight.plans[0].combination,
    [950, 950, 1000, 1000, 1000],
  );
  assert.deepEqual(
    fullHeight.plans[0].productCodeSequence,
    fullHeight.plans[0].sequence.map((width) => `G-U1-${width}x850`),
  );
  assert.deepEqual(fullHeight.systemDetails.postProductCodeSequence, [
    'R-TM-958I-F1',
    'R-TM-958K-F1',
    'R-TM-958K-F1',
    'R-TM-958K-F1',
    'R-TM-958K-F1',
    'R-TM-958S-F1',
  ]);
  assert.deepEqual(
    halfHeight.plans[0].combination,
    [1000, 1000, 1050, 1050, 1050],
  );
  assert.deepEqual(
    halfHeight.systemDetails.postProductCodeSequence,
    Array(6).fill('R-SM-628-F1'),
  );
});

test('CSV parser resolves values by header name after columns are reordered', () => {
  const reorderedCsv = [
    'width,quantity,productGroup,productCategory,productCode,productGroupName,height,color,colorName,price,productCategoryName,productName',
    '900,4,G-U1-850,G,G-U1-900x850,Custom group name,850,U1,Clear,15300,Custom glass category name,Custom product name',
  ].join('\n');

  assert.deepEqual(parseInventoryCsv(reorderedCsv)[0], {
    productCode: 'G-U1-900x850',
    productName: 'Custom product name',
    productCategory: 'G',
    productCategoryName: 'Custom glass category name',
    productGroup: 'G-U1-850',
    productGroupName: 'Custom group name',
    height: 850,
    width: 900,
    color: 'U1',
    colorName: 'Clear',
    price: 15300,
    quantity: 4,
  });
});
