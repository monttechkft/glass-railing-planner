import { Fragment, type CSSProperties } from 'react';
import { calculateCustomCutPrice } from '../calculator.js';
import {
  formatGlassDimensions,
  formatHuf,
  formatMetres,
  formatMillimetres,
} from '../formatters.js';
import type {
  CalculatedSection,
  Product,
  ProjectResult,
  SectionResult,
} from '../types.js';

interface ProductAccess {
  productsByCode: Map<string, Product>;
}

/** Return the exact product selected by the calculation. */
function getProduct(productsByCode: Map<string, Product>, productCode: string) {
  const product = productsByCode.get(productCode);
  if (!product) {
    throw new Error(`No product exists for code "${productCode}".`);
  }
  return product;
}

/** Return a product price and optionally verify how that product is sold. */
function getProductPrice(
  productsByCode: Map<string, Product>,
  productCode: string,
  expectedPriceUnit?: Product['priceUnit'],
) {
  const product = getProduct(productsByCode, productCode);
  if (expectedPriceUnit && product.priceUnit !== expectedPriceUnit) {
    throw new Error(
      `Product "${productCode}" must be priced by ${expectedPriceUnit}.`,
    );
  }
  return product.priceHuf;
}

interface GlassChipProps {
  width: number;
  height: number;
  productCode: string;
}

/** A glass panel keeps the same fixed physical-to-screen scale in every section. */
function GlassChip({ width, height, productCode }: GlassChipProps) {
  const style = {
    '--glass-box-width': `${width / 5}px`,
  } as CSSProperties;

  return (
    <span
      className="panel-chip"
      title={formatGlassDimensions(height, width)}
      style={style}
    >
      {productCode}
    </span>
  );
}

/** A narrow vertical box represents one post in the physical sequence. */
function PostChip({ productCode }: { productCode: string }) {
  return (
    <span className="post-chip">
      <span className="post-chip-label">{productCode}</span>
    </span>
  );
}

/** Build the same left-to-right product-code order represented by the boxes. */
function buildComponentCodeSequence(
  glassProductCodes: string[],
  result: SectionResult,
) {
  if (result.systemDetails.type === 'UC') return glassProductCodes;

  const sequence: string[] = [];
  result.systemDetails.postProductCodeSequence.forEach((postCode, index) => {
    sequence.push(postCode);
    if (index < glassProductCodes.length) {
      sequence.push(glassProductCodes[index]);
    }
  });
  return sequence;
}

/** Render glass-only or interleaved post/glass layout boxes. */
function LayoutSequence({ result }: { result: SectionResult }) {
  const plan = result.plans[0];

  if (result.systemDetails.type === 'UC') {
    return (
      <div className="sequence combined-layout">
        {plan.sequence.map((width, index) => (
          <GlassChip
            key={`${plan.productCodeSequence[index]}-${index}`}
            width={width}
            height={result.height}
            productCode={plan.productCodeSequence[index]}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="sequence combined-layout">
      {result.systemDetails.postProductCodeSequence.map((postCode, index) => (
        <Fragment key={`${postCode}-${index}`}>
          <PostChip productCode={postCode} />
          {index < plan.sequence.length && (
            <GlassChip
              width={plan.sequence[index]}
              height={result.height}
              productCode={plan.productCodeSequence[index]}
            />
          )}
        </Fragment>
      ))}
    </div>
  );
}

/** One section heading, layout, and text representation. */
function SectionLayout({ section }: { section: CalculatedSection }) {
  const plan = section.result.plans[0];
  const componentCodes = buildComponentCodeSequence(
    plan.productCodeSequence,
    section.result,
  );

  return (
    <section className="section-result">
      <div className="section-result-heading">
        <h3 className="section-result-title">Section {section.number}</h3>
        <span className="fit-badge">
          {formatMillimetres(plan.undercut)} undercut
        </span>
      </div>
      <LayoutSequence result={section.result} />
      <p className="component-sequence-text">
        | {componentCodes.join(' | ')} |
      </p>
    </section>
  );
}

interface GlassBomItem {
  productCode: string;
  productName: string;
  height: number;
  width: number;
  unitPrice: number;
  quantity: number;
}

/** Project-level glass quantities aggregated across all calculated sections. */
function GlassBillOfMaterials({
  sections,
  productsByCode,
}: { sections: CalculatedSection[] } & ProductAccess) {
  const counts = new Map<string, GlassBomItem>();

  sections.forEach(({ result }) => {
    const plan = result.plans[0];
    plan.productCodeSequence.forEach((productCode, index) => {
      const width = plan.sequence[index];
      const existing = counts.get(productCode);
      if (existing) {
        existing.quantity += 1;
        return;
      }
      counts.set(productCode, {
        productCode,
        productName: getProduct(productsByCode, productCode).productName,
        height: result.height,
        width,
        unitPrice: getProductPrice(productsByCode, productCode),
        quantity: 1,
      });
    });
  });

  const items = [...counts.values()].sort(
    (a, b) =>
      a.height - b.height ||
      a.width - b.width ||
      a.productCode.localeCompare(b.productCode),
  );
  const totalWidth = items.reduce(
    (sum, item) => sum + item.width * item.quantity,
    0,
  );
  const totalPrice = items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );

  return (
    <div className="bom-table-wrapper">
      <table className="bom-table">
        <caption>Glass bill of materials</caption>
        <thead>
          <tr>
            <th>Product code</th>
            <th>Product name</th>
            <th>Quantity</th>
            <th>Line total</th>
            <th>Unit price</th>
            <th>Total price</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.productCode}>
              <td>{item.productCode}</td>
              <td>{item.productName}</td>
              <td>{item.quantity}</td>
              <td>{formatMillimetres(item.width * item.quantity)}</td>
              <td>{formatHuf(item.unitPrice)}</td>
              <td>{formatHuf(item.unitPrice * item.quantity)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th>Glass total</th>
            <td />
            <td />
            <td>{formatMillimetres(totalWidth)}</td>
            <td />
            <td>{formatHuf(totalPrice)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

interface PostBomRow {
  productCode: string;
  quantity: number;
}

/** A standalone post table shared by both post-based calculation families. */
function PostBillOfMaterials({
  rows,
  productsByCode,
}: { rows: PostBomRow[] } & ProductAccess) {
  const activeRows = rows.filter((row) => row.quantity > 0);
  const totalPrice = activeRows.reduce(
    (sum, row) =>
      sum + getProductPrice(productsByCode, row.productCode) * row.quantity,
    0,
  );

  return (
    <div className="bom-table-wrapper post-bom">
      <table className="bom-table">
        <caption>Post bill of materials</caption>
        <thead>
          <tr>
            <th>Product code</th>
            <th>Product name</th>
            <th>Quantity</th>
            <th>Unit price</th>
            <th>Total price</th>
          </tr>
        </thead>
        <tbody>
          {activeRows.map((row) => {
            const product = getProduct(productsByCode, row.productCode);
            return (
              <tr key={row.productCode}>
                <td>{row.productCode}</td>
                <td>{product.productName}</td>
                <td>{row.quantity}</td>
                <td>{formatHuf(product.priceHuf)}</td>
                <td>{formatHuf(product.priceHuf * row.quantity)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <th>Post total</th>
            <td />
            <td />
            <td />
            <td>{formatHuf(totalPrice)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/** Aggregate post quantities for the selected post-system family. */
function ProjectPostBillOfMaterials({
  sections,
  productsByCode,
}: { sections: CalculatedSection[] } & ProductAccess) {
  const firstDetails = sections[0].result.systemDetails;

  if (firstDetails.type === 'FP') {
    const totals = sections.reduce(
      (sum, section) => {
        const details = section.result.systemDetails;
        if (details.type !== 'FP') return sum;
        return {
          I: sum.I + details.posts.counts.I,
          K: sum.K + details.posts.counts.K,
          S: sum.S + details.posts.counts.S,
        };
      },
      { I: 0, K: 0, S: 0 },
    );
    return (
      <PostBillOfMaterials
        productsByCode={productsByCode}
        rows={[
          { productCode: firstDetails.postProductCodes.I, quantity: totals.I },
          { productCode: firstDetails.postProductCodes.K, quantity: totals.K },
          // Adjacent sections select the same physical corner post twice.
          {
            productCode: firstDetails.postProductCodes.S,
            quantity: totals.S / 2,
          },
        ]}
      />
    );
  }

  if (firstDetails.type === 'HP') {
    const quantity = sections.reduce((sum, section) => {
      const details = section.result.systemDetails;
      return sum + (details.type === 'HP' ? details.postCount : 0);
    }, 0);
    return (
      <PostBillOfMaterials
        productsByCode={productsByCode}
        rows={[
          { productCode: firstDetails.postProductCode, quantity },
        ]}
      />
    );
  }

  return null;
}

/** Aggregate standard U-channel bars and custom-cut length across sections. */
function BaseRailBillOfMaterials({
  sections,
  productsByCode,
}: { sections: CalculatedSection[] } & ProductAccess) {
  const firstDetails = sections[0].result.systemDetails;
  if (firstDetails.type !== 'UC') return null;

  const { standardBar, customCut } = firstDetails.profileProductCodes;
  const standardBarProduct = getProduct(productsByCode, standardBar);
  const customCutProduct = getProduct(productsByCode, customCut);
  const barUnitPrice = getProductPrice(productsByCode, standardBar, 'piece');
  const customCutPricePerMetre = getProductPrice(
    productsByCode,
    customCut,
    'metre',
  );
  let barCount = 0;
  let customCutTotalLength = 0;

  sections.forEach((section) => {
    const details = section.result.systemDetails;
    if (details.type !== 'UC') return;
    barCount += details.profile.barCount;
    customCutTotalLength += details.profile.cutLength;
  });

  const customCutTotalPrice = calculateCustomCutPrice(
    customCutTotalLength,
    customCutPricePerMetre,
  );

  return (
    <div className="bom-table-wrapper post-bom">
      <table className="bom-table">
        <caption>Base-rail bill of materials</caption>
        <thead>
          <tr>
            <th>Product code</th>
            <th>Product name</th>
            <th>Quantity</th>
            <th>Unit price</th>
            <th>Total price</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{standardBar}</td>
            <td>{standardBarProduct.productName}</td>
            <td>{barCount}</td>
            <td>{formatHuf(barUnitPrice)}</td>
            <td>{formatHuf(barUnitPrice * barCount)}</td>
          </tr>
          {customCutTotalLength > 0 && (
            <tr>
              <td>{customCut}</td>
              <td>{customCutProduct.productName}</td>
              <td>{formatMetres(customCutTotalLength)}</td>
              <td>{formatHuf(customCutPricePerMetre)}</td>
              <td>{formatHuf(customCutTotalPrice)}</td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr>
            <th>Base-Rail total</th>
            <td />
            <td />
            <td />
            <td>
              {formatHuf(barUnitPrice * barCount + customCutTotalPrice)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

interface ResultsPanelProps extends ProductAccess {
  project: ProjectResult | null;
  errorMessage: string | null;
}

/** Recommended-plan panel and its mutually exclusive empty/error/result states. */
export function ResultsPanel({
  project,
  errorMessage,
  productsByCode,
}: ResultsPanelProps) {
  return (
    <section
      className="panel results-panel"
      aria-labelledby="results-heading"
      aria-live="polite"
    >
      <div className="panel-heading">
        <div>
          <h2 id="results-heading">Recommended plan</h2>
        </div>
      </div>

      {errorMessage ? (
        <div className="error-message" role="alert">
          {errorMessage}
        </div>
      ) : project ? (
        <article className="plan-card">
          {project.sections.map((section) => (
            <SectionLayout key={section.number} section={section} />
          ))}
          <GlassBillOfMaterials
            sections={project.sections}
            productsByCode={productsByCode}
          />
          <ProjectPostBillOfMaterials
            sections={project.sections}
            productsByCode={productsByCode}
          />
          {project.system === 'UC' && (
            <BaseRailBillOfMaterials
              sections={project.sections}
              productsByCode={productsByCode}
            />
          )}
        </article>
      ) : (
        <div className="empty-state">
          <div className="empty-mark" aria-hidden="true">
            ↗
          </div>
          <p>Enter the section measurements and calculate to see plans.</p>
        </div>
      )}
    </section>
  );
}
