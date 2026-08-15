import inventoryData from '../glass_inventory.json';
import {
  calculateProject,
  CalculatorError,
  RAIL_VARIANTS,
} from './calculator.js';
import './style.css';

const SECTION_COUNT = 4;
const DISABLED_RAIL_VARIANTS = new Set(['1000-top', '1266-side']);
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

/** Format a glass panel as height x width with one shared mm unit. */
function formatGlassDimensions(height, width) {
  return `${height} x ${width} mm`;
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
    const color = result.system === 'vonalmenti'
      ? result.systemDetails.colorDescription
      : null;
    result.plans[0].combination.forEach((width) => {
      const key = `${result.glassHeight}|${width}|${color ?? ''}`;
      const current = counts.get(key) ?? {
        height: result.glassHeight,
        width,
        color,
        quantity: 0,
      };
      current.quantity += 1;
      counts.set(key, current);
    });
  });

  const items = [...counts.values()].sort(
    (a, b) =>
      a.height - b.height ||
      a.width - b.width ||
      String(a.color).localeCompare(String(b.color)),
  );
  const tableWrapper = createElement('div', 'bom-table-wrapper');
  const table = createElement('table', 'bom-table');
  const caption = createElement('caption', null, 'Glass bill of materials');
  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  ['Glass dimensions', 'Quantity', 'Line total'].forEach((label) => {
    headRow.append(createElement('th', null, label));
  });
  head.append(headRow);

  const body = document.createElement('tbody');
  items.forEach((item) => {
    const itemName = item.color
      ? `${formatGlassDimensions(item.height, item.width)} · ${item.color}`
      : formatGlassDimensions(item.height, item.width);
    const row = document.createElement('tr');
    row.append(
      createElement('td', null, itemName),
      createElement('td', null, String(item.quantity)),
      createElement('td', null, formatMillimetres(item.width * item.quantity)),
    );
    body.append(row);
  });

  const total = items.reduce(
    (sum, item) => sum + item.width * item.quantity,
    0,
  );
  const foot = document.createElement('tfoot');
  const footRow = document.createElement('tr');
  const totalLabel = createElement('th', null, 'Glass total');
  totalLabel.colSpan = 2;
  footRow.append(totalLabel, createElement('td', null, formatMillimetres(total)));
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
  ['Post type', 'Quantity'].forEach((label) => {
    headRow.append(createElement('th', null, label));
  });
  head.append(headRow);

  const body = document.createElement('tbody');
  rows
    .filter((row) => row.quantity > 0)
    .forEach((item) => {
      const row = document.createElement('tr');
      row.append(
        createElement('td', null, item.name),
        createElement('td', null, String(item.quantity)),
      );
      body.append(row);
    });

  const totalQuantity = rows.reduce((sum, row) => sum + row.quantity, 0);
  const foot = document.createElement('tfoot');
  const footRow = document.createElement('tr');
  footRow.append(
    createElement('th', null, 'Post total'),
    createElement('td', null, String(totalQuantity)),
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
    return renderPostBillOfMaterials([
      { name: '958I', quantity: totals.I },
      { name: '958K', quantity: totals.K },
      // Both adjoining sections include the same physical corner post, so the
      // aggregated endpoint count contains every corner twice.
      { name: '958S', quantity: totals.S / 2 },
    ]);
  }

  if (firstResult.system === 'general') {
    const quantity = calculatedSections.reduce(
      (sum, { result }) => sum + result.systemDetails.postCount,
      0,
    );
    return renderPostBillOfMaterials([
      { name: firstResult.systemDetails.postLabel, quantity },
    ]);
  }

  return null;
}

/** Aggregate standard bars and distinct custom-cut lengths across sections. */
function renderBaseRailBillOfMaterials(calculatedSections) {
  const railLabel = calculatedSections[0].result.railVariant.label;
  let barCount = 0;
  const customCuts = new Map();

  calculatedSections.forEach(({ result }) => {
    const { barCount: sectionBars, cutLength } = result.systemDetails.profile;
    barCount += sectionBars;
    if (cutLength > 0) {
      customCuts.set(cutLength, (customCuts.get(cutLength) ?? 0) + 1);
    }
  });

  const tableWrapper = createElement('div', 'bom-table-wrapper post-bom');
  const table = createElement('table', 'bom-table');
  const caption = createElement('caption', null, 'Base-rail bill of materials');
  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  ['Rail type', 'Quantity'].forEach((label) => {
    headRow.append(createElement('th', null, label));
  });
  head.append(headRow);

  const body = document.createElement('tbody');
  const barRow = document.createElement('tr');
  barRow.append(
    createElement('td', null, `${railLabel} (2.5m Bar)`),
    createElement('td', null, String(barCount)),
  );
  body.append(barRow);

  [...customCuts]
    .sort(([lengthA], [lengthB]) => lengthA - lengthB)
    .forEach(([cutLength, quantity]) => {
      const row = document.createElement('tr');
      row.append(
        createElement(
          'td',
          null,
          `${railLabel} (${formatMillimetres(cutLength)} Custom Cut)`,
        ),
        createElement('td', null, String(quantity)),
      );
      body.append(row);
    });

  const customCutQuantity = [...customCuts.values()].reduce(
    (sum, quantity) => sum + quantity,
    0,
  );
  const foot = document.createElement('tfoot');
  const footRow = document.createElement('tr');
  footRow.append(
    createElement('th', null, 'Base-Rail total'),
    createElement('td', null, String(barCount + customCutQuantity)),
  );
  foot.append(footRow);

  table.append(caption, head, body, foot);
  tableWrapper.append(table);
  return tableWrapper;
}

/** Create one glass chip labelled with its height and width. */
function createGlassChip(width, glassHeight) {
  const chip = createElement(
    'span',
    'panel-chip',
    formatGlassDimensions(glassHeight, width),
  );
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
function renderLayoutSequence(glassSequence, result) {
  const wrapper = createElement('div', 'sequence combined-layout');

  if (result.system === 'vonalmenti') {
    glassSequence.forEach((width) => {
      wrapper.append(createGlassChip(width, result.glassHeight));
    });
    return wrapper;
  }

  const postSequence = result.system === '958'
    ? result.systemDetails.posts.sequence
    : result.systemDetails.postSequence;

  postSequence.forEach((post, index) => {
    wrapper.append(createPostChip(post));
    if (index < glassSequence.length) {
      wrapper.append(createGlassChip(glassSequence[index], result.glassHeight));
    }
  });
  return wrapper;
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
    renderLayoutSequence(plan.sequence, result),
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
  errorMessage.textContent =
    error instanceof CalculatorError ? error.message : 'An unexpected calculation error occurred.';
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
    renderResults(calculateProject(readFormInput(), inventoryData.inventories));
  } catch (error) {
    renderError(error);
  }
});

// Start with only Section 1 visible and calculate its default 4000 mm plan.
updateSystemFields();
form.requestSubmit();
