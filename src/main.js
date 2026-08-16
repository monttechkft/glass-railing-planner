import productCsvText from '../glass_inventory.csv?raw';
import {
  calculateCustomCutPrice,
  calculateProject,
  CalculatorError,
  RAIL_VARIANTS,
} from './calculator.js';
import { InventoryCsvError, parseInventoryCsv } from './inventory.js';
import './style.css';

const SECTION_COUNT = 4;
const DISABLED_RAIL_VARIANTS = new Set(['1000-top', '1266-side']);
let products = [];
let productDataError = null;
try {
  products = parseInventoryCsv(productCsvText);
} catch (error) {
  productDataError = error;
}
const productsByCode = new Map(
  products.map((product) => [product.productCode, product]),
);
let visibleSectionCount = 1;

// Cache the permanent page elements once. Section controls are rebuilt when
// the railing system changes because each system needs different inputs.
const form = document.querySelector('#calculator-form');
const systemSelect = document.querySelector('#system');
const railVariantSelect = document.querySelector('#rail-variant');
const globalSystemFields = document.querySelector('#global-system-fields');
const sectionsContainer = document.querySelector('#sections-container');
const addSectionButton = document.querySelector('#add-section');
const removeSectionButton = document.querySelector('#remove-section');
const emptyState = document.querySelector('#results-empty');
const errorMessage = document.querySelector('#error-message');
const resultsContainer = document.querySelector('#results');

/** Format one measurement for display in millimetres. */
function formatMillimetres(value) {
  const formatted = Number.isInteger(value)
    ? String(value)
    : value.toFixed(1).replace(/\.0$/, '');
  return `${formatted} mm`;
}

/** Format a base-rail material length in metres without unnecessary zeros. */
function formatMetres(lengthMillimetres) {
  const metres = lengthMillimetres / 1000;
  return `${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 3,
  }).format(metres)} m`;
}

/** Format a glass panel as height x width with one shared mm unit. */
function formatGlassDimensions(height, width) {
  return `${height} x ${width} mm`;
}

/** Format an inventory or calculated price in Hungarian forints. */
function formatHuf(value) {
  return `${new Intl.NumberFormat('en-US').format(value)} HUF`;
}

/** Look up one required inventory price using its stable product code. */
function getProductPrice(productCode) {
  const product = productsByCode.get(productCode);
  if (!product) {
    throw new InventoryCsvError(`No product exists for code "${productCode}".`);
  }
  return product.price;
}

/** Create an element and optionally assign a class and safe text content. */
function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

/** Create a labelled select field from value/label option records. */
function createSelectField({ id, name, label, options }) {
  const field = createElement('div', 'field');
  const fieldLabel = createElement('label', null, label);
  fieldLabel.htmlFor = id;

  const select = document.createElement('select');
  select.id = id;
  select.name = name;
  options.forEach((optionData) => {
    const option = createElement('option', null, optionData.label);
    option.value = optionData.value;
    select.append(option);
  });

  field.append(fieldLabel, select);
  return field;
}

/** Create a labelled number field, optionally with an mm suffix and help. */
function createNumberField({
  id,
  name,
  label,
  min,
  value = '',
  placeholder,
  unit,
  help,
}) {
  const field = createElement('div', 'field');
  const fieldLabel = createElement('label', null, label);
  fieldLabel.htmlFor = id;

  const input = document.createElement('input');
  input.id = id;
  input.name = name;
  input.type = 'number';
  input.min = String(min);
  input.step = '1';
  input.value = value === '' ? '' : String(value);
  if (placeholder) input.placeholder = placeholder;

  if (unit) {
    const inputWrapper = createElement('div', 'input-with-unit');
    inputWrapper.append(input, createElement('span', null, unit));
    field.append(fieldLabel, inputWrapper);
  } else {
    field.append(fieldLabel, input);
  }

  if (help) field.append(createElement('small', null, help));
  return field;
}

/** Create one system-specific Section input group. */
function createSectionInputGroup(sectionNumber) {
  const prefix = `section${sectionNumber}`;
  const fieldset = createElement('fieldset', 'system-fields');
  fieldset.append(createElement('legend', null, `Section ${sectionNumber}`));
  const grid = createElement('div', 'form-grid');

  if (systemSelect.value === '958') {
    grid.append(
      createSelectField({
        id: `${prefix}-start-post`,
        name: `${prefix}StartPost`,
        label: 'Left end',
        options: [
          { value: 'I', label: 'End Post' },
          { value: 'S', label: 'Corner Post' },
        ],
      }),
      createSelectField({
        id: `${prefix}-end-post`,
        name: `${prefix}EndPost`,
        label: 'Right end',
        options: [
          { value: 'I', label: 'End Post' },
          { value: 'S', label: 'Corner Post' },
        ],
      }),
    );
  }

  grid.append(
    createNumberField({
      id: `${prefix}-length`,
      name: `${prefix}Length`,
      label: 'Section length',
      min: 0,
      value: sectionNumber === 1 ? 4000 : '',
      placeholder: sectionNumber === 1 ? undefined : 'Not used',
      unit: 'mm',
    }),
    createNumberField({
      id: `${prefix}-panes`,
      name: `${prefix}Panes`,
      label: 'Number of panels',
      min: 1,
      placeholder: 'Automatic',
      help: 'Leave empty to calculate automatically.',
    }),
  );

  fieldset.append(grid);
  return fieldset;
}

/** Enable section controls according to the current one-to-four limit. */
function updateSectionActionButtons() {
  addSectionButton.disabled = visibleSectionCount >= SECTION_COUNT;
  removeSectionButton.disabled = visibleSectionCount <= 1;
}

/** Rebuild only the number of Section groups the user has chosen to show. */
function renderSectionInputs() {
  sectionsContainer.replaceChildren();
  for (let sectionNumber = 1; sectionNumber <= visibleSectionCount; sectionNumber += 1) {
    sectionsContainer.append(createSectionInputGroup(sectionNumber));
  }
  updateSectionActionButtons();
}

/** Build controls whose values apply to every active section. */
function renderGlobalSystemFields() {
  globalSystemFields.replaceChildren();

  if (systemSelect.value === 'general') {
    globalSystemFields.append(
      createNumberField({
        id: 'global-gap',
        name: 'globalGap',
        label: 'Gap between panels',
        min: 0,
        value: 20,
        unit: 'mm',
      }),
    );
  } else if (systemSelect.value === 'vonalmenti') {
    globalSystemFields.append(
      createNumberField({
        id: 'global-gap',
        name: 'globalGap',
        label: 'Gap between panels',
        min: 0,
        value: 5,
        unit: 'mm',
      }),
      createSelectField({
        id: 'global-color',
        name: 'globalColor',
        label: 'Glass color',
        options: [
          { value: 'U1', label: 'U1 · clear' },
          { value: 'U2', label: 'U2 · grey / clear' },
          { value: 'U3', label: 'U3 · double grey' },
        ],
      }),
    );
  }
}

/** Convert an optional form number to a rounded millimetre integer. */
function readOptionalNumber(data, name, emptyValue) {
  const rawValue = String(data.get(name) ?? '').trim();
  return rawValue === '' ? emptyValue : Math.round(Number(rawValue));
}

/** Read the shared settings and only the currently visible section groups. */
function readFormInput() {
  const data = new FormData(form);
  const globalGap = readOptionalNumber(data, 'globalGap', 0);
  const globalColor = data.get('globalColor');
  const sections = [];

  for (let sectionNumber = 1; sectionNumber <= visibleSectionCount; sectionNumber += 1) {
    const prefix = `section${sectionNumber}`;
    sections.push({
      number: sectionNumber,
      length: readOptionalNumber(data, `${prefix}Length`, 0),
      panes: readOptionalNumber(data, `${prefix}Panes`, null),
      startPost: data.get(`${prefix}StartPost`),
      endPost: data.get(`${prefix}EndPost`),
      gap: globalGap,
      vonalmentiGap: globalGap,
      color: globalColor,
    });
  }

  return {
    system: data.get('system'),
    railVariant: data.get('railVariant'),
    sections,
  };
}

/** Rebuild the shared rail variants and the four system-specific sections. */
function updateSystemFields() {
  railVariantSelect.replaceChildren();
  Object.entries(RAIL_VARIANTS[systemSelect.value]).forEach(([value, label]) => {
    const option = createElement('option', null, label);
    option.value = value;
    option.disabled = DISABLED_RAIL_VARIANTS.has(value);
    railVariantSelect.append(option);
  });
  renderGlobalSystemFields();
  renderSectionInputs();
}

/** Render glass quantities aggregated across every active section. */
function renderGlassBillOfMaterials(calculatedSections) {
  const counts = new Map();

  calculatedSections.forEach(({ result }) => {
    const plan = result.plans[0];
    // The product-code sequence is aligned with the physical width sequence,
    // so each BoM row refers to the exact CSV product selected for the layout.
    plan.productCodeSequence.forEach((productCode, index) => {
      const width = plan.sequence[index];
      const current = counts.get(productCode) ?? {
        productCode,
        height: result.height,
        width,
        unitPrice: getProductPrice(productCode),
        quantity: 0,
      };
      current.quantity += 1;
      counts.set(productCode, current);
    });
  });

  const items = [...counts.values()].sort(
    (a, b) =>
      a.height - b.height ||
      a.width - b.width ||
      a.productCode.localeCompare(b.productCode),
  );
  const tableWrapper = createElement('div', 'bom-table-wrapper');
  const table = createElement('table', 'bom-table');
  const caption = createElement('caption', null, 'Glass bill of materials');
  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  [
    'Product code',
    'Quantity',
    'Line total',
    'Unit price',
    'Total price',
  ].forEach((label) => {
    headRow.append(createElement('th', null, label));
  });
  head.append(headRow);

  const body = document.createElement('tbody');
  items.forEach((item) => {
    const row = document.createElement('tr');
    row.append(
      createElement('td', null, item.productCode),
      createElement('td', null, String(item.quantity)),
      createElement('td', null, formatMillimetres(item.width * item.quantity)),
      createElement('td', null, formatHuf(item.unitPrice)),
      createElement('td', null, formatHuf(item.unitPrice * item.quantity)),
    );
    body.append(row);
  });

  const totalWidth = items.reduce(
    (sum, item) => sum + item.width * item.quantity,
    0,
  );
  const totalPrice = items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );
  const foot = document.createElement('tfoot');
  const footRow = document.createElement('tr');
  const totalLabel = createElement('th', null, 'Glass total');
  totalLabel.colSpan = 2;
  footRow.append(
    totalLabel,
    createElement('td', null, formatMillimetres(totalWidth)),
    createElement('td'),
    createElement('td', null, formatHuf(totalPrice)),
  );
  foot.append(footRow);

  table.append(caption, head, body, foot);
  tableWrapper.append(table);
  return tableWrapper;
}

/** Render already-aggregated post quantities in a standalone table. */
function renderPostBillOfMaterials(rows) {
  const tableWrapper = createElement('div', 'bom-table-wrapper post-bom');
  const table = createElement('table', 'bom-table');
  const caption = createElement('caption', null, 'Post bill of materials');
  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  ['Product code', 'Quantity', 'Unit price', 'Total price'].forEach((label) => {
    headRow.append(createElement('th', null, label));
  });
  head.append(headRow);

  const body = document.createElement('tbody');
  const activeRows = rows.filter((row) => row.quantity > 0);
  activeRows
    .forEach((item) => {
      const unitPrice = getProductPrice(item.name);
      const row = document.createElement('tr');
      row.append(
        createElement('td', null, item.name),
        createElement('td', null, String(item.quantity)),
        createElement('td', null, formatHuf(unitPrice)),
        createElement('td', null, formatHuf(unitPrice * item.quantity)),
      );
      body.append(row);
    });

  const totalQuantity = activeRows.reduce((sum, row) => sum + row.quantity, 0);
  const totalPrice = activeRows.reduce(
    (sum, row) => sum + getProductPrice(row.name) * row.quantity,
    0,
  );
  const foot = document.createElement('tfoot');
  const footRow = document.createElement('tr');
  footRow.append(
    createElement('th', null, 'Post total'),
    createElement('td', null, String(totalQuantity)),
    createElement('td'),
    createElement('td', null, formatHuf(totalPrice)),
  );
  foot.append(footRow);

  table.append(caption, head, body, foot);
  tableWrapper.append(table);
  return tableWrapper;
}

/** Aggregate and render post quantities from all active post-system sections. */
function renderProjectPostBillOfMaterials(calculatedSections) {
  const firstResult = calculatedSections[0].result;
  if (firstResult.system === '958') {
    const totals = calculatedSections.reduce(
      (sum, { result }) => ({
        I: sum.I + result.systemDetails.posts.counts.I,
        K: sum.K + result.systemDetails.posts.counts.K,
        S: sum.S + result.systemDetails.posts.counts.S,
      }),
      { I: 0, K: 0, S: 0 },
    );
    const productCodes = firstResult.systemDetails.postProductCodes;
    return renderPostBillOfMaterials([
      { name: productCodes.I, quantity: totals.I },
      { name: productCodes.K, quantity: totals.K },
      // Both adjoining sections include the same physical corner post, so the
      // aggregated endpoint count contains every corner twice.
      { name: productCodes.S, quantity: totals.S / 2 },
    ]);
  }

  if (firstResult.system === 'general') {
    const quantity = calculatedSections.reduce(
      (sum, { result }) => sum + result.systemDetails.postCount,
      0,
    );
    return renderPostBillOfMaterials([
      { name: firstResult.systemDetails.postProductCode, quantity },
    ]);
  }

  return null;
}

/** Aggregate standard bars and total custom-cut length across sections. */
function renderBaseRailBillOfMaterials(calculatedSections) {
  const firstResult = calculatedSections[0].result;
  const { standardBar, customCut } =
    firstResult.systemDetails.profileProductCodes;
  const barUnitPrice = getProductPrice(standardBar);
  const customCutPricePerMetre = getProductPrice(customCut);
  let barCount = 0;
  let customCutTotalLength = 0;

  calculatedSections.forEach(({ result }) => {
    const { barCount: sectionBars, cutLength } = result.systemDetails.profile;
    barCount += sectionBars;
    customCutTotalLength += cutLength;
  });

  const tableWrapper = createElement('div', 'bom-table-wrapper post-bom');
  const table = createElement('table', 'bom-table');
  const caption = createElement('caption', null, 'Base-rail bill of materials');
  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  ['Product code', 'Quantity', 'Unit price', 'Total price'].forEach((label) => {
    headRow.append(createElement('th', null, label));
  });
  head.append(headRow);

  const body = document.createElement('tbody');
  const barRow = document.createElement('tr');
  barRow.append(
    createElement('td', null, standardBar),
    createElement('td', null, String(barCount)),
    createElement('td', null, formatHuf(barUnitPrice)),
    createElement('td', null, formatHuf(barUnitPrice * barCount)),
  );
  body.append(barRow);

  // Custom cuts are sold by length. Combine every section into one metre-based
  // row instead of showing each cut as a separate piece.
  const customCutTotalPrice = calculateCustomCutPrice(
    customCutTotalLength,
    customCutPricePerMetre,
  );
  if (customCutTotalLength > 0) {
    const customCutRow = document.createElement('tr');
    customCutRow.append(
      createElement('td', null, customCut),
      createElement('td', null, formatMetres(customCutTotalLength)),
      createElement('td', null, formatHuf(customCutPricePerMetre)),
      createElement('td', null, formatHuf(customCutTotalPrice)),
    );
    body.append(customCutRow);
  }
  const foot = document.createElement('tfoot');
  const footRow = document.createElement('tr');
  footRow.append(
    createElement('th', null, 'Base-Rail total'),
    createElement('td'),
    createElement('td'),
    createElement(
      'td',
      null,
      formatHuf(barUnitPrice * barCount + customCutTotalPrice),
    ),
  );
  foot.append(footRow);

  table.append(caption, head, body, foot);
  tableWrapper.append(table);
  return tableWrapper;
}

/** Create one glass chip labelled with its exact inventory product code. */
function createGlassChip(width, height, productCode) {
  const chip = createElement('span', 'panel-chip', productCode);
  // Keep the dimensions available as a browser tooltip even though the
  // visible label now identifies the corresponding CSV product.
  chip.title = formatGlassDimensions(height, width);
  // Use one screen pixel for every 5 mm of physical panel width. Applying the
  // same scale to every chip preserves the relative proportions exactly.
  chip.style.setProperty('--glass-box-width', `${width / 5}px`);
  return chip;
}

/** Create one vertical post chip for a combined physical layout. */
function createPostChip(post) {
  const chip = createElement('span', 'post-chip');
  chip.append(createElement('span', 'post-chip-label', post));
  return chip;
}

/**
 * Render one physical sequence. Post systems alternate post and glass and
 * always begin and end with a post. Base-rail sections contain only glass.
 */
function renderLayoutSequence(glassSequence, productCodeSequence, result) {
  const wrapper = createElement('div', 'sequence combined-layout');

  if (result.system === 'vonalmenti') {
    glassSequence.forEach((width, index) => {
      wrapper.append(
        createGlassChip(width, result.height, productCodeSequence[index]),
      );
    });
    return wrapper;
  }

  const postSequence = result.systemDetails.postProductCodeSequence;

  postSequence.forEach((post, index) => {
    wrapper.append(createPostChip(post));
    if (index < glassSequence.length) {
      wrapper.append(
        createGlassChip(
          glassSequence[index],
          result.height,
          productCodeSequence[index],
        ),
      );
    }
  });
  return wrapper;
}

/** Build the same left-to-right product-code order shown by the layout boxes. */
function buildComponentCodeSequence(glassProductCodes, result) {
  if (result.system === 'vonalmenti') return glassProductCodes;

  const sequence = [];
  result.systemDetails.postProductCodeSequence.forEach((postCode, index) => {
    sequence.push(postCode);
    if (index < glassProductCodes.length) {
      sequence.push(glassProductCodes[index]);
    }
  });
  return sequence;
}

/** Format component codes with a separator at both outer edges. */
function formatComponentCodeSequence(componentCodes) {
  return `| ${componentCodes.join(' | ')} |`;
}

/** Render one active section and its independently optimized layout. */
function renderSectionLayout(calculatedSection) {
  const { number, result } = calculatedSection;
  const plan = result.plans[0];
  const block = createElement('section', 'section-result');
  const heading = createElement('div', 'section-result-heading');
  heading.append(
    createElement('h3', 'section-result-title', `Section ${number}`),
    createElement('span', 'fit-badge', `${formatMillimetres(plan.undercut)} undercut`),
  );
  block.append(
    heading,
    renderLayoutSequence(plan.sequence, plan.productCodeSequence, result),
    createElement(
      'p',
      'component-sequence-text',
      formatComponentCodeSequence(
        buildComponentCodeSequence(plan.productCodeSequence, result),
      ),
    ),
  );
  return block;
}

/** Replace the result area with all layouts and project-level aggregated BoMs. */
function renderResults(project) {
  resultsContainer.replaceChildren();
  const article = createElement('article', 'plan-card');

  project.sections.forEach((section) => {
    article.append(renderSectionLayout(section));
  });
  article.append(renderGlassBillOfMaterials(project.sections));

  const postBillOfMaterials = renderProjectPostBillOfMaterials(project.sections);
  if (postBillOfMaterials) article.append(postBillOfMaterials);
  if (project.system === 'vonalmenti') {
    article.append(renderBaseRailBillOfMaterials(project.sections));
  }

  resultsContainer.append(article);
  emptyState.hidden = true;
  errorMessage.hidden = true;
  resultsContainer.hidden = false;
}

/** Replace the result area with a readable validation or search error. */
function renderError(error) {
  if (error instanceof CalculatorError) {
    errorMessage.textContent = error.message;
  } else if (error instanceof InventoryCsvError) {
    errorMessage.textContent = `Inventory CSV error: ${error.message}`;
  } else {
    errorMessage.textContent = 'An unexpected calculation error occurred.';
  }
  emptyState.hidden = true;
  resultsContainer.hidden = true;
  errorMessage.hidden = false;
}

systemSelect.addEventListener('change', updateSystemFields);
addSectionButton.addEventListener('click', () => {
  if (visibleSectionCount >= SECTION_COUNT) return;
  visibleSectionCount += 1;
  sectionsContainer.append(createSectionInputGroup(visibleSectionCount));
  updateSectionActionButtons();
});
removeSectionButton.addEventListener('click', () => {
  if (visibleSectionCount <= 1) return;
  sectionsContainer.lastElementChild?.remove();
  visibleSectionCount -= 1;
  updateSectionActionButtons();
});
form.addEventListener('submit', (event) => {
  event.preventDefault();
  try {
    if (productDataError) throw productDataError;
    renderResults(calculateProject(readFormInput(), products));
  } catch (error) {
    renderError(error);
  }
});

// Start with only Section 1 visible and calculate its default 4000 mm plan.
updateSystemFields();
form.requestSubmit();
