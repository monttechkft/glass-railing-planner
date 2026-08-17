import type { FormEvent } from 'react';
import type {
  EndPostType,
  GlassFinishCode,
  RailingSystem,
  SectionFormState,
  SystemFamilyId,
} from '../types.js';

const MAXIMUM_SECTION_COUNT = 4;

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectFieldProps {
  id: string;
  name: string;
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  fullWidth?: boolean;
}

/** Reusable labelled select used by global and section-specific controls. */
function SelectField({
  id,
  name,
  label,
  value,
  options,
  onChange,
  fullWidth = false,
}: SelectFieldProps) {
  return (
    <div className={`field${fullWidth ? ' full-width' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

interface NumberFieldProps {
  id: string;
  name: string;
  label: string;
  min: number;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  unit?: string;
  help?: string;
}

/** Reusable controlled number input with optional unit and helper text. */
function NumberField({
  id,
  name,
  label,
  min,
  value,
  onChange,
  placeholder,
  unit,
  help,
}: NumberFieldProps) {
  const input = (
    <input
      id={id}
      name={name}
      type="number"
      min={min}
      step="1"
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
    />
  );

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {unit ? (
        <div className="input-with-unit">
          {input}
          <span>{unit}</span>
        </div>
      ) : (
        input
      )}
      {help && <small>{help}</small>}
    </div>
  );
}

interface SectionFieldsProps {
  section: SectionFormState;
  system: SystemFamilyId;
  onChange: (changes: Partial<SectionFormState>) => void;
}

/** Fields for one independently calculated balcony section. */
function SectionFields({ section, system, onChange }: SectionFieldsProps) {
  const prefix = `section${section.number}`;
  const endPostOptions = [
    { value: 'I', label: 'End Post' },
    { value: 'S', label: 'Corner Post' },
  ];

  return (
    <fieldset className="system-fields">
      <legend>Section {section.number}</legend>
      <div className="form-grid">
        {system === 'FP' && (
          <>
            <SelectField
              id={`${prefix}-start-post`}
              name={`${prefix}StartPost`}
              label="Left end"
              value={section.startPost}
              options={endPostOptions}
              onChange={(value) =>
                onChange({ startPost: value as EndPostType })
              }
            />
            <SelectField
              id={`${prefix}-end-post`}
              name={`${prefix}EndPost`}
              label="Right end"
              value={section.endPost}
              options={endPostOptions}
              onChange={(value) =>
                onChange({ endPost: value as EndPostType })
              }
            />
          </>
        )}
        <NumberField
          id={`${prefix}-length`}
          name={`${prefix}Length`}
          label="Section length"
          min={0}
          value={section.length}
          placeholder={section.number === 1 ? undefined : 'Not used'}
          unit="mm"
          onChange={(length) => onChange({ length })}
        />
        <NumberField
          id={`${prefix}-panes`}
          name={`${prefix}Panes`}
          label="Number of panels"
          min={1}
          value={section.panes}
          placeholder="Automatic"
          help="Leave empty to calculate automatically."
          onChange={(panes) => onChange({ panes })}
        />
      </div>
    </fieldset>
  );
}

interface PlannerFormProps {
  system: SystemFamilyId;
  railVariant: string;
  systemFamilies: Array<{
    systemFamilyId: SystemFamilyId;
    systemFamilyName: string;
  }>;
  railVariants: RailingSystem[];
  globalGap: string;
  glassColor: GlassFinishCode;
  sections: SectionFormState[];
  onSystemChange: (system: SystemFamilyId) => void;
  onRailVariantChange: (railVariant: string) => void;
  onGlobalGapChange: (gap: string) => void;
  onGlassColorChange: (color: GlassFinishCode) => void;
  onSectionChange: (
    sectionNumber: number,
    changes: Partial<SectionFormState>,
  ) => void;
  onAddSection: () => void;
  onRemoveSection: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

/** Complete input panel. React state replaces the former generated DOM fields. */
export function PlannerForm({
  system,
  railVariant,
  systemFamilies,
  railVariants,
  globalGap,
  glassColor,
  sections,
  onSystemChange,
  onRailVariantChange,
  onGlobalGapChange,
  onGlassColorChange,
  onSectionChange,
  onAddSection,
  onRemoveSection,
  onSubmit,
}: PlannerFormProps) {
  return (
    <section className="panel form-panel" aria-labelledby="calculator-heading">
      <div className="panel-heading">
        <div>
          <h2 id="calculator-heading">Input data</h2>
        </div>
      </div>

      <button
        className="primary-button header-calculate-button"
        type="submit"
        form="calculator-form"
      >
        Calculate plan
      </button>

      <form id="calculator-form" onSubmit={onSubmit}>
        <SelectField
          id="system"
          name="system"
          label="Railing system"
          value={system}
          options={systemFamilies.map((family) => ({
            value: family.systemFamilyId,
            label: family.systemFamilyName,
          }))}
          onChange={(value) => onSystemChange(value as SystemFamilyId)}
          fullWidth
        />

        <SelectField
          id="rail-variant"
          name="railVariant"
          label="Rail variant"
          value={railVariant}
          options={railVariants.map((variant) => ({
            value: variant.systemId,
            label: variant.systemName,
            disabled: !variant.enabled,
          }))}
          onChange={onRailVariantChange}
          fullWidth
        />

        <div className="form-grid">
          {system === 'HP' && (
            <NumberField
              id="global-gap"
              name="globalGap"
              label="Gap between panels"
              min={0}
              value={globalGap}
              unit="mm"
              onChange={onGlobalGapChange}
            />
          )}
          {system === 'UC' && (
            <>
              <NumberField
                id="global-gap"
                name="globalGap"
                label="Gap between panels"
                min={0}
                value={globalGap}
                unit="mm"
                onChange={onGlobalGapChange}
              />
              <SelectField
                id="global-color"
                name="globalColor"
                label="Glass color"
                value={glassColor}
                options={[
                  { value: 'U1', label: 'U1 · clear' },
                  { value: 'U2', label: 'U2 · grey / clear' },
                  { value: 'U3', label: 'U3 · double grey' },
                ]}
                onChange={(value) =>
                  onGlassColorChange(value as GlassFinishCode)
                }
              />
            </>
          )}
        </div>

        <div className="sections-container">
          {sections.map((section) => (
            <SectionFields
              key={section.number}
              section={section}
              system={system}
              onChange={(changes) =>
                onSectionChange(section.number, changes)
              }
            />
          ))}
        </div>

        <div className="section-actions">
          <button
            className="secondary-button"
            type="button"
            disabled={sections.length >= MAXIMUM_SECTION_COUNT}
            onClick={onAddSection}
          >
            Add section
          </button>
          <button
            className="secondary-button"
            type="button"
            disabled={sections.length <= 1}
            onClick={onRemoveSection}
          >
            Remove section
          </button>
        </div>

        <button className="primary-button" type="submit">
          Calculate plan
        </button>
      </form>
    </section>
  );
}
