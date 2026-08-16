import { PRODUCT_CATEGORY_CODES } from './inventory.js';

// Shared calculation engine for all three railing systems.
//
// All physical measurements are integers in millimetres. This avoids the
// small rounding errors that decimal metre values can introduce in JavaScript.

export const DEFAULTS = Object.freeze({
  preferredMaximumWidth: 1100,
  initialTolerance: 50,
  toleranceStep: 10,
  maximumTolerance: 200,
});

export const POST_WIDTHS_958 = Object.freeze({
  I: 85,
  K: 30,
  S: 115,
});

// Vonalmenti profiles are supplied in 2500 mm bars. Any additional custom-cut
// length is weighted by 1.3 when the script chooses the cheapest combination.
export const VONALMENTI_PROFILE = Object.freeze({
  barLength: 2500,
  cutPriceMultiplier: 1.3,
});

/** Calculate one custom-cut price from its CSV price-per-metre value. */
export function calculateCustomCutPrice(lengthMillimetres, pricePerMetre) {
  return lengthMillimetres * (pricePerMetre / 1000);
}

export const VONALMENTI_COLORS = Object.freeze({
  U1: 'U1 (clear)',
  U2: 'U2 (one-side grey + one-side clear)',
  U3: 'U3 (double-sided grey)',
});

// These values match the productGroup codes in glass_inventory.csv. Keeping
// them together makes the connection between each railing system and its
// compatible glass products explicit.
export const GLASS_PRODUCT_GROUPS = Object.freeze({
  fullHeight: 'G-U1-850',
  halfHeight: 'G-U1-900',
  continuousBase: Object.freeze({
    U1: 'G-U1-1000',
    U2: 'G-U2-1000',
    U3: 'G-U3-1000',
  }),
});

// Values are stable internal form identifiers; labels are the text shown in
// the selector and calculation results.
export const RAIL_VARIANTS = Object.freeze({
  958: Object.freeze({
    '958-top': '958 mm Top-Mounted',
    '1000-top': '1000 mm Top-Mounted',
    '1266-side': '1266 mm Side-Mounted',
  }),
  general: Object.freeze({
    '448-top': '448 mm Top-Mounted',
    '628-side': '628 mm Side-Mounted',
  }),
  vonalmenti: Object.freeze({
    '102-top': '102 mm Top-Mounted',
    '117-side': '117 mm Side-Mounted',
  }),
});

// Connect each form variant to the railing-component rows in the CSV.
export const RAIL_VARIANT_PRODUCT_GROUPS = Object.freeze({
  '958-top': 'R-TM-958',
  '1000-top': 'R-TM-1000',
  '1266-side': 'R-SM-1266',
  '448-top': 'R-TM-448',
  '628-side': 'R-SM-628',
  '102-top': 'R-TM-102',
  '117-side': 'R-SM-117',
});

/** Error type used for input and no-result messages that can be shown safely. */
export class CalculatorError extends Error {}

/**
 * Estimate the panel count using the same project-specific rule as Python.
 *
 * @param {number} total - Complete balcony-section length in millimetres.
 * @param {number} preferredWidth - Preferred panel width in millimetres.
 * @returns {number} Estimated number of panels.
 */
export function autoPanes(total, preferredWidth = DEFAULTS.preferredMaximumWidth) {
  const rawCount = total / preferredWidth;
  if (rawCount === 0) return 0;
  if (rawCount < 1.37) return 1;

  const whole = Math.trunc(rawCount);
  const fraction = rawCount - whole;
  return fraction <= 0.3 ? whole : whole + 1;
}

/**
 * Create maximum-width tiers. The search starts at 1100 mm and permits wider
 * product widths only if the narrower glass products cannot produce a plan.
 *
 * @param {{width: number}[]} glassProducts - Available glass product rows.
 * @param {number} preferredMaximum - First maximum width to try.
 * @returns {number[]} Sorted maximum-width limits.
 */
export function buildTiers(
  glassProducts,
  preferredMaximum = DEFAULTS.preferredMaximumWidth,
) {
  const widerWidths = glassProducts
    .map((product) => product.width)
    .filter((width) => width > preferredMaximum);

  return [...new Set([preferredMaximum, ...widerWidths])].sort((a, b) => a - b);
}

/** Count how many times each width occurs in a proposed combination. */
function countWidths(combination) {
  const counts = new Map();
  for (const width of combination) {
    counts.set(width, (counts.get(width) ?? 0) + 1);
  }
  return counts;
}

/**
 * Calculate the largest fraction of a recorded stock quantity used by a plan.
 * Like the Python scripts, this ranks plans but does not enforce stock limits.
 */
function dependencyRatio(combination, quantityByWidth) {
  const counts = countWidths(combination);
  return Math.max(
    ...[...counts].map(([width, used]) => used / quantityByWidth.get(width)),
  );
}

/**
 * Return zero when the panel counts permit a perfectly mirrored sequence.
 * Higher values mean more unpaired widths and are less desirable.
 */
export function symmetryPenalty(combination) {
  const counts = countWidths(combination);
  const oddCounts = [...counts.values()].filter((count) => count % 2 === 1).length;
  return combination.length % 2 === 0 ? oddCounts : Math.max(0, oddCounts - 1);
}

/** Population standard deviation used to prefer similarly sized panels. */
function widthDispersion(combination) {
  if (new Set(combination).size === 1) return 0;
  // Convert to metres for this ranking calculation because Python's
  // statistics.pstdev() receives metre values. Keeping the same representation
  // preserves its tie-breaking order for combinations with equal dispersion.
  const metres = combination.map((width) => width / 1000);
  const mean = metres.reduce((sum, width) => sum + width, 0) / metres.length;
  const variance = metres.reduce(
    (sum, width) => sum + (width - mean) ** 2,
    0,
  ) / metres.length;
  return Math.sqrt(variance);
}

/** Build a flat panel list from parallel product-width and count arrays. */
function expandCounts(widths, counts) {
  const combination = [];
  widths.forEach((width, index) => {
    for (let amount = 0; amount < counts[index]; amount += 1) {
      combination.push(width);
    }
  });
  return combination;
}

/** Compare two plans using the same priority order as the Python scripts. */
function comparePlans(a, b) {
  return (
    a.undercut - b.undercut ||
    symmetryPenalty(a.combination) - symmetryPenalty(b.combination) ||
    widthDispersion(a.combination) - widthDispersion(b.combination) ||
    new Set(a.combination).size - new Set(b.combination).size ||
    a.dependencyRatio - b.dependencyRatio
  );
}

/**
 * Find all unordered combinations of exactly `panelCount` panels that fit.
 *
 * The recursive function selects a quantity for each available width. Bounds
 * are checked before descending, avoiding branches that cannot reach the
 * target or that would necessarily exceed it.
 */
export function findCombinations(
  target,
  panelCount,
  tolerance,
  widthCap,
  glassProducts,
) {
  const usableProducts = glassProducts
    .filter((product) => product.width <= widthCap)
    .slice()
    .sort((a, b) => a.width - b.width);

  if (usableProducts.length === 0 || panelCount <= 0) return [];

  const widths = usableProducts.map((product) => product.width);
  const quantityByWidth = new Map(
    glassProducts.map((product) => [product.width, product.quantity]),
  );
  const results = [];
  const lastIndex = widths.length - 1;
  const maximumWidth = widths[lastIndex];

  function addCandidate(counts, total) {
    const undercut = target - total;
    if (undercut < 0 || undercut > tolerance) return;

    const combination = expandCounts(widths, counts);
    if (combination.length !== panelCount) return;

    results.push({
      combination,
      total,
      undercut,
      dependencyRatio: dependencyRatio(combination, quantityByWidth),
    });
  }

  function backtrack(index, remaining, currentTotal, counts) {
    // At the last width, every unassigned panel must use that width.
    if (index === lastIndex) {
      const finalCounts = [...counts, remaining];
      addCandidate(finalCounts, currentTotal + remaining * widths[index]);
      return;
    }

    const width = widths[index];
    for (let amount = 0; amount <= remaining; amount += 1) {
      const nextTotal = currentTotal + amount * width;
      const panelsLeft = remaining - amount;

      if (panelsLeft === 0) {
        const trailingZeros = Array(lastIndex - index).fill(0);
        addCandidate([...counts, amount, ...trailingZeros], nextTotal);
        continue;
      }

      const minimumPossible = nextTotal + panelsLeft * width;
      const maximumPossible = nextTotal + panelsLeft * maximumWidth;
      if (minimumPossible > target || maximumPossible < target - tolerance) continue;

      backtrack(index + 1, panelsLeft, nextTotal, [...counts, amount]);
    }
  }

  backtrack(0, panelCount, 0, []);
  return results.sort(comparePlans);
}

/**
 * Increase the permitted undercut and width cap until a feasible tier is found.
 * Only the best plan from the first successful tier is returned. Search
 * tolerances are application constants rather than user-configurable inputs.
 */
export function searchWithTolerance({
  target,
  panelCount,
  glassProducts,
}) {
  const tiers = buildTiers(glassProducts);

  // Integer millimetres make this loop include the maximum tolerance exactly.
  for (
    let tolerance = DEFAULTS.initialTolerance;
    tolerance <= DEFAULTS.maximumTolerance;
    tolerance += DEFAULTS.toleranceStep
  ) {
    for (const widthCap of tiers) {
      const plans = findCombinations(
        target,
        panelCount,
        tolerance,
        widthCap,
        glassProducts,
      );
      if (plans.length > 0) {
        return { widthCap, plans: plans.slice(0, 1), tolerance };
      }
    }
  }

  return { widthCap: null, plans: [], tolerance: null };
}

/**
 * Turn a panel multiset into a balanced left-to-right installation sequence.
 */
export function prettySequence(combination) {
  if (symmetryPenalty(combination) === 0) {
    const counts = [...countWidths(combination)].sort(([a], [b]) => a - b);
    const left = [];
    let centre = [];

    for (const [width, amount] of counts) {
      left.push(...Array(Math.floor(amount / 2)).fill(width));
      if (amount % 2 === 1) centre = [width];
    }
    return [...left, ...centre, ...left.slice().reverse()];
  }

  // When perfect symmetry is impossible, distribute sorted widths alternately
  // into positions at the left and right edges.
  const sorted = combination.slice().sort((a, b) => a - b);
  const positions = [];
  let left = 0;
  let right = sorted.length - 1;
  let useLeft = true;

  while (left <= right) {
    if (useLeft) {
      positions.push(left);
      left += 1;
    } else {
      positions.push(right);
      right -= 1;
    }
    useLeft = !useLeft;
  }

  const sequence = Array(sorted.length);
  sorted.forEach((width, index) => {
    sequence[positions[index]] = width;
  });
  return sequence;
}

/** Calculate 958 post counts, total width, and installation sequence. */
export function postUsage958(panelCount, start, end) {
  if (!['I', 'S'].includes(start) || !['I', 'S'].includes(end)) {
    throw new CalculatorError('Start and end posts must be I or S.');
  }

  const counts = {
    I: Number(start === 'I') + Number(end === 'I'),
    K: Math.max(panelCount - 1, 0),
    S: Number(start === 'S') + Number(end === 'S'),
  };
  const totalWidth =
    counts.I * POST_WIDTHS_958.I +
    counts.K * POST_WIDTHS_958.K +
    counts.S * POST_WIDTHS_958.S;
  const sequence = [
    `958${start}`,
    ...Array(counts.K).fill('958K'),
    `958${end}`,
  ];

  return { counts, totalWidth, sequence };
}

/** Throw a readable error if the user-supplied section values are invalid. */
function validateInput(input) {
  if (!Number.isInteger(input.length) || input.length <= 0) {
    throw new CalculatorError('Section length must be greater than zero.');
  }
  if (input.panes !== null && (!Number.isInteger(input.panes) || input.panes <= 0)) {
    throw new CalculatorError('Number of panels must be a positive whole number.');
  }
}

/** Return the display label for a valid system-specific rail variant. */
function resolveRailVariant(system, selectedVariant) {
  const variants = RAIL_VARIANTS[system];
  if (!variants) {
    throw new CalculatorError('Select a supported railing system.');
  }

  // Falling back to the first variant keeps direct API calls compatible while
  // the browser form always supplies an explicit value.
  const variantKey = selectedVariant ?? Object.keys(variants)[0];
  const label = variants[variantKey];
  if (!label) {
    throw new CalculatorError('Select a supported rail variant.');
  }
  return { key: variantKey, label };
}

/**
 * Choose the number of standard profile bars and extra custom-cut length.
 *
 * The cost comparison reproduces vonalmenti_calculator.py: standard bar length
 * has a weight of 1, while additional cut length has a weight of 1.3. If two
 * options cost the same, lower waste and then fewer bars are preferred.
 */
export function optimizeProfiles(totalLength) {
  if (totalLength <= 0) {
    return { barCount: 0, cutLength: 0, waste: 0 };
  }

  const { barLength, cutPriceMultiplier } = VONALMENTI_PROFILE;
  const maximumBars = Math.trunc(totalLength / barLength) + 3;
  let best = null;

  for (let barCount = 0; barCount <= maximumBars; barCount += 1) {
    const barTotal = barCount * barLength;
    const cutLength = barTotal >= totalLength ? 0 : totalLength - barTotal;
    const waste = barTotal >= totalLength ? barTotal - totalLength : 0;
    const cost = barTotal >= totalLength
      ? barTotal
      : barTotal + cutPriceMultiplier * cutLength;
    const candidate = { barCount, cutLength, waste, cost };

    if (
      best === null ||
      candidate.cost < best.cost ||
      (candidate.cost === best.cost && candidate.waste < best.waste) ||
      (candidate.cost === best.cost &&
        candidate.waste === best.waste &&
        candidate.barCount < best.barCount)
    ) {
      best = candidate;
    }
  }

  return {
    barCount: best.barCount,
    cutLength: best.cutLength,
    waste: best.waste,
  };
}

/**
 * Calculate plans for any supported single-section system.
 *
 * @param {object} input - Normalized form values in integer millimetres.
 * @param {object[]} products - Product rows parsed from the inventory CSV.
 * @returns {object} Section metadata and ranked plans ready for the UI.
 */
export function calculatePlans(input, products) {
  validateInput(input);
  if (!Array.isArray(products)) {
    throw new CalculatorError('Product data must be loaded from the inventory CSV.');
  }

  const panelCount = input.panes ?? autoPanes(input.length);
  if (panelCount <= 0) {
    throw new CalculatorError('Could not determine a valid number of panels.');
  }

  let height;
  let productGroup;
  let target;
  let systemDetails;
  const railVariant = resolveRailVariant(input.system, input.railVariant);
  const railProductGroup = RAIL_VARIANT_PRODUCT_GROUPS[railVariant.key];
  const railProducts = products.filter(
    (product) =>
      product.productCategory === PRODUCT_CATEGORY_CODES.railingComponent &&
      product.productGroup === railProductGroup,
  );

  if (input.system === '958') {
    height = 850;
    productGroup = GLASS_PRODUCT_GROUPS.fullHeight;
    const posts = postUsage958(panelCount, input.startPost, input.endPost);
    const postProductCodes = Object.fromEntries(
      ['I', 'K', 'S'].map((postType) => {
        const product = railProducts.find((item) =>
          item.productCode.startsWith(`${railProductGroup}${postType}-`),
        );
        if (!product) {
          throw new CalculatorError(
            `No ${postType} post product is available for ${railVariant.label}.`,
          );
        }
        return [postType, product.productCode];
      }),
    );
    target = input.length - posts.totalWidth;
    systemDetails = {
      type: '958',
      railVariant,
      posts,
      postProductCodes,
      postProductCodeSequence: posts.sequence.map(
        (post) => postProductCodes[post.at(-1)],
      ),
      postCount: panelCount + 1,
    };
  } else if (input.system === 'general') {
    height = 900;
    productGroup = GLASS_PRODUCT_GROUPS.halfHeight;
    if (!Number.isInteger(input.gap) || input.gap < 0) {
      throw new CalculatorError('Panel gap must be zero or greater.');
    }
    const seamTotal = input.gap * Math.max(panelCount - 1, 0);
    target = input.length - seamTotal;
    const postCount = panelCount + 1;
    // F1 is currently the chosen post item when a half-height group contains
    // both F1 and F2 inventory alternatives.
    const postProduct = railProducts.find((product) =>
      product.productCode.endsWith('-F1'),
    );
    if (!postProduct) {
      throw new CalculatorError(
        `No F1 post product is available for ${railVariant.label}.`,
      );
    }
    systemDetails = {
      type: 'general',
      railVariant,
      gap: input.gap,
      seamTotal,
      postCount,
      postProductCode: postProduct.productCode,
      postProductCodeSequence: Array(postCount).fill(postProduct.productCode),
    };
  } else if (input.system === 'vonalmenti') {
    height = 1000;
    if (!Number.isInteger(input.vonalmentiGap) || input.vonalmentiGap < 0) {
      throw new CalculatorError('Panel gap must be zero or greater.');
    }
    if (!(input.color in VONALMENTI_COLORS)) {
      throw new CalculatorError('Select a supported base-rail glass color.');
    }

    productGroup = GLASS_PRODUCT_GROUPS.continuousBase[input.color];
    const seamTotal = input.vonalmentiGap * Math.max(panelCount - 1, 0);
    target = input.length - seamTotal;

    const profileChoice = optimizeProfiles(input.length);
    const standardBarProduct = railProducts.find((product) =>
      product.productCode.endsWith('-T'),
    );
    const customCutProduct = railProducts.find((product) =>
      product.productCode.endsWith('-V'),
    );
    if (!standardBarProduct || !customCutProduct) {
      throw new CalculatorError(
        `Standard-bar and custom-cut products are required for ${railVariant.label}.`,
      );
    }
    systemDetails = {
      type: 'vonalmenti',
      railVariant,
      gap: input.vonalmentiGap,
      seamTotal,
      color: input.color,
      profile: profileChoice,
      profileProductCodes: {
        standardBar: standardBarProduct.productCode,
        customCut: customCutProduct.productCode,
      },
    };
  } else {
    throw new CalculatorError('Select a supported railing system.');
  }

  if (target <= 0) {
    throw new CalculatorError('Posts or gaps occupy too much of the section length.');
  }

  const glassProducts = products.filter(
    (product) =>
      product.productCategory === PRODUCT_CATEGORY_CODES.glass &&
      product.productGroup === productGroup,
  );
  if (glassProducts.length === 0) {
    throw new CalculatorError(`No products are available for ${height} mm glass.`);
  }
  if (input.system === 'vonalmenti') {
    // Keep the displayed color name aligned with the editable CSV column.
    systemDetails.colorName = glassProducts[0].colorName;
  }

  const search = searchWithTolerance({
    target,
    panelCount,
    glassProducts,
  });

  if (search.plans.length === 0) {
    throw new CalculatorError(
      `No feasible combination within ${DEFAULTS.maximumTolerance} mm undercut.`,
    );
  }

  // Widths identify products within the already selected glass product group.
  // This lookup lets the UI show the exact CSV product code for every panel.
  const productCodeByWidth = new Map(
    glassProducts.map((product) => [product.width, product.productCode]),
  );

  return {
    system: input.system,
    sectionLength: input.length,
    panelCount,
    height,
    railVariant,
    targetGlassLength: target,
    widthCap: search.widthCap,
    tolerance: search.tolerance,
    systemDetails,
    plans: search.plans.map((plan) => {
      const sequence = prettySequence(plan.combination);
      return {
        ...plan,
        sequence,
        productCodeSequence: sequence.map((width) => productCodeByWidth.get(width)),
      };
    }),
  };
}

/**
 * Calculate one recommended plan for every non-empty section in a project.
 * A zero-length section is treated as unused, allowing the browser form to
 * offer four sections without requiring the user to fill all of them.
 *
 * @param {object} input - Shared system settings plus up to four sections.
 * @param {object[]} input.sections - Per-section measurements and options.
 * @param {object[]} products - Product rows parsed from the inventory CSV.
 * @returns {object} Calculated sections with their original section numbers.
 */
export function calculateProject(input, products) {
  if (!Array.isArray(input.sections) || input.sections.length === 0) {
    throw new CalculatorError('Enter at least one section.');
  }
  if (input.sections.length > 4) {
    throw new CalculatorError('A project can contain at most four sections.');
  }

  input.sections.forEach((section, index) => {
    const sectionNumber = section.number ?? index + 1;
    if (!Number.isFinite(section.length) || section.length < 0) {
      throw new CalculatorError(`Section ${sectionNumber}: length cannot be negative.`);
    }
  });

  const activeSections = input.sections.filter((section) => section.length > 0);
  if (activeSections.length === 0) {
    throw new CalculatorError('Enter a length greater than zero for at least one section.');
  }

  // A physical corner post is selected once by each of its two adjoining
  // sections. An odd endpoint count would produce half a post in the BoM.
  if (input.system === '958') {
    const cornerEndpointCount = activeSections.reduce(
      (count, section) =>
        count + Number(section.startPost === 'S') + Number(section.endPost === 'S'),
      0,
    );
    if (cornerEndpointCount % 2 !== 0) {
      throw new CalculatorError(
        'The number of Corner Post selections across active sections must be even.',
      );
    }
  }

  const sections = activeSections.map((section, index) => {
    const sectionNumber = section.number ?? index + 1;
    try {
      return {
        number: sectionNumber,
        result: calculatePlans(
          {
            ...section,
            system: input.system,
            railVariant: input.railVariant,
          },
          products,
        ),
      };
    } catch (error) {
      if (error instanceof CalculatorError) {
        throw new CalculatorError(`Section ${sectionNumber}: ${error.message}`);
      }
      throw error;
    }
  });

  return {
    system: input.system,
    railVariant: sections[0].result.railVariant,
    sections,
  };
}
