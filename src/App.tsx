import { useMemo, useState, type FormEvent } from 'react';
import { calculateProject, CalculatorError } from './calculator.js';
import { PlannerForm } from './components/PlannerForm.js';
import { ResultsPanel } from './components/ResultsPanel.js';
import {
  productData,
  productDataError,
  productsByCode,
  railingSystemData,
} from './data.js';
import { InventoryCsvError } from './inventory.js';
import { RailingSystemCsvError } from './railingSystems.js';
import type {
  GlassFinishCode,
  ProjectInput,
  ProjectResult,
  SectionFormState,
  SystemFamilyId,
} from './types.js';

const DEFAULT_SYSTEM: SystemFamilyId =
  railingSystemData[0]?.systemFamilyId ?? 'FP';

/** Create fresh fields when a section is added or the system family changes. */
function createSection(number: number): SectionFormState {
  return {
    number,
    length: number === 1 ? '4000' : '',
    panes: '',
    startPost: 'I',
    endPost: 'I',
  };
}

function createSections(count: number) {
  return Array.from({ length: count }, (_, index) => createSection(index + 1));
}

function defaultGap(system: SystemFamilyId) {
  if (system === 'HP') return '20';
  if (system === 'UC') return '5';
  return '0';
}

function variantsForFamily(system: SystemFamilyId) {
  return railingSystemData.filter(
    (variant) => variant.systemFamilyId === system,
  );
}

function defaultVariant(system: SystemFamilyId) {
  const variants = variantsForFamily(system);
  return variants.find((variant) => variant.enabled)?.systemId ??
    variants[0]?.systemId ??
    '';
}

/** Number inputs stay as strings until submission so an empty value is valid. */
function readOptionalNumber(value: string, emptyValue: number | null) {
  return value.trim() === '' ? emptyValue : Math.round(Number(value));
}

function createProjectInput(
  system: SystemFamilyId,
  railVariant: string,
  globalGap: string,
  glassColor: GlassFinishCode,
  sections: SectionFormState[],
): ProjectInput {
  const gap = readOptionalNumber(globalGap, 0) ?? 0;
  return {
    system,
    railVariant,
    sections: sections.map((section) => ({
      number: section.number,
      length: readOptionalNumber(section.length, 0) ?? 0,
      panes: readOptionalNumber(section.panes, null),
      startPost: section.startPost,
      endPost: section.endPost,
      gap,
      vonalmentiGap: gap,
      color: glassColor,
    })),
  };
}

/** Convert known validation errors into the same user-facing messages as before. */
function formatError(error: unknown) {
  if (error instanceof CalculatorError) return error.message;
  if (error instanceof InventoryCsvError) {
    return `Product data CSV error: ${error.message}`;
  }
  if (error instanceof RailingSystemCsvError) {
    return `Railing-system CSV error: ${error.message}`;
  }
  return 'An unexpected calculation error occurred.';
}

function calculate(input: ProjectInput): ProjectResult {
  if (productDataError) throw productDataError;
  return calculateProject(
    input,
    productData,
    railingSystemData,
  ) as ProjectResult;
}

interface CalculationState {
  project: ProjectResult | null;
  errorMessage: string | null;
}

/** Calculate one state object so result and error can never disagree. */
function createCalculationState(input: ProjectInput): CalculationState {
  try {
    return { project: calculate(input), errorMessage: null };
  } catch (error) {
    return { project: null, errorMessage: formatError(error) };
  }
}

const initialSections = createSections(1);
const initialVariant = defaultVariant(DEFAULT_SYSTEM);
const initialGap = defaultGap(DEFAULT_SYSTEM);
const initialCalculationState = createCalculationState(
  createProjectInput(
    DEFAULT_SYSTEM,
    initialVariant,
    initialGap,
    'U1',
    initialSections,
  ),
);

/** Top-level React state coordinates the form and the last calculated result. */
export function App() {
  const [system, setSystem] = useState<SystemFamilyId>(DEFAULT_SYSTEM);
  const [railVariant, setRailVariant] = useState(initialVariant);
  const [globalGap, setGlobalGap] = useState(initialGap);
  const [glassColor, setGlassColor] = useState<GlassFinishCode>('U1');
  const [sections, setSections] =
    useState<SectionFormState[]>(initialSections);
  const [calculationState, setCalculationState] =
    useState<CalculationState>(initialCalculationState);

  // Show every family once, preserving its first occurrence in catalogue order.
  const systemFamilies = useMemo(() => {
    const seen = new Set<SystemFamilyId>();
    return railingSystemData.flatMap((variant) => {
      if (seen.has(variant.systemFamilyId)) return [];
      seen.add(variant.systemFamilyId);
      return [
        {
          systemFamilyId: variant.systemFamilyId,
          systemFamilyName: variant.systemFamilyName,
        },
      ];
    });
  }, []);

  const railVariants = useMemo(() => variantsForFamily(system), [system]);

  const handleSystemChange = (nextSystem: SystemFamilyId) => {
    setSystem(nextSystem);
    setRailVariant(defaultVariant(nextSystem));
    setGlobalGap(defaultGap(nextSystem));
    setGlassColor('U1');
    // The vanilla UI rebuilt these fields on a system switch. Preserve that
    // behavior while retaining the number of visible section groups.
    setSections((currentSections) => createSections(currentSections.length));
  };

  const handleSectionChange = (
    sectionNumber: number,
    changes: Partial<SectionFormState>,
  ) => {
    setSections((currentSections) =>
      currentSections.map((section) =>
        section.number === sectionNumber
          ? { ...section, ...changes }
          : section,
      ),
    );
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCalculationState(
      createCalculationState(
        createProjectInput(
          system,
          railVariant,
          globalGap,
          glassColor,
          sections,
        ),
      ),
    );
  };

  return (
    <main className="page-shell">
      <header className="hero">
        <h1>Glass railing planner</h1>
      </header>

      <div className="workspace">
        <PlannerForm
          system={system}
          railVariant={railVariant}
          systemFamilies={systemFamilies}
          railVariants={railVariants}
          globalGap={globalGap}
          glassColor={glassColor}
          sections={sections}
          onSystemChange={handleSystemChange}
          onRailVariantChange={setRailVariant}
          onGlobalGapChange={setGlobalGap}
          onGlassColorChange={setGlassColor}
          onSectionChange={handleSectionChange}
          onAddSection={() =>
            setSections((currentSections) => [
              ...currentSections,
              createSection(currentSections.length + 1),
            ])
          }
          onRemoveSection={() =>
            setSections((currentSections) => currentSections.slice(0, -1))
          }
          onSubmit={handleSubmit}
        />
        <ResultsPanel
          project={calculationState.project}
          errorMessage={calculationState.errorMessage}
          productsByCode={productsByCode}
        />
      </div>
    </main>
  );
}
