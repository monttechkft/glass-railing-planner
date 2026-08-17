/** Shared TypeScript contracts at the CSV, calculator, and React boundaries. */

export type SystemFamilyId = 'FP' | 'HP' | 'UC';
export type EndPostType = 'I' | 'S';
export type GlassFinishCode = 'U1' | 'U2' | 'U3';
export type PriceUnit = 'piece' | 'metre';

export interface Product {
  productCode: string;
  productName: string;
  categoryCode: 'G' | 'R';
  categoryName: string;
  groupCode: string;
  groupName: string;
  componentType: string;
  compatibleRailingSystems: string[];
  finishCode: string;
  finishName: string;
  widthMm: number | null;
  heightMm: number;
  layoutWidthMm: number | null;
  enabled: boolean;
  priceHuf: number;
  priceUnit: PriceUnit;
  stockQuantity: number | null;
}

export interface RailingSystem {
  systemId: string;
  systemName: string;
  systemFamilyId: SystemFamilyId;
  systemFamilyName: string;
  enabled: boolean;
}

/** String values are retained while the user edits number inputs. */
export interface SectionFormState {
  number: number;
  length: string;
  panes: string;
  startPost: EndPostType;
  endPost: EndPostType;
}

export interface ProjectSectionInput {
  number: number;
  length: number;
  panes: number | null;
  startPost: EndPostType;
  endPost: EndPostType;
  gap: number;
  vonalmentiGap: number;
  color: GlassFinishCode;
}

export interface ProjectInput {
  system: SystemFamilyId;
  railVariant: string;
  sections: ProjectSectionInput[];
}

export interface RailVariantSelection {
  systemId: string;
  label: string;
}

export interface Plan {
  combination: number[];
  sequence: number[];
  productCodeSequence: string[];
  undercut: number;
  dependencyRatio: number;
}

interface SharedSystemDetails {
  type: SystemFamilyId;
  railVariant: RailVariantSelection;
  postProductCodeSequence?: string[];
}

export interface FullHeightSystemDetails extends SharedSystemDetails {
  type: 'FP';
  posts: {
    counts: Record<EndPostType | 'K', number>;
    totalWidth: number;
    sequence: string[];
  };
  postProductCodes: Record<EndPostType | 'K', string>;
  postProductCodeSequence: string[];
  postCount: number;
}

export interface HalfHeightSystemDetails extends SharedSystemDetails {
  type: 'HP';
  gap: number;
  seamTotal: number;
  postCount: number;
  postProductCode: string;
  postProductCodeSequence: string[];
}

export interface BaseRailSystemDetails extends SharedSystemDetails {
  type: 'UC';
  gap: number;
  seamTotal: number;
  finishCode: GlassFinishCode;
  finishName: string;
  profile: {
    barCount: number;
    cutLength: number;
    waste: number;
  };
  profileProductCodes: {
    standardBar: string;
    customCut: string;
  };
}

export type SystemDetails =
  | FullHeightSystemDetails
  | HalfHeightSystemDetails
  | BaseRailSystemDetails;

export interface SectionResult {
  system: SystemFamilyId;
  sectionLength: number;
  panelCount: number;
  height: number;
  railVariant: RailVariantSelection;
  targetGlassLength: number;
  widthCap: number;
  tolerance: number;
  systemDetails: SystemDetails;
  plans: Plan[];
}

export interface CalculatedSection {
  number: number;
  result: SectionResult;
}

export interface ProjectResult {
  system: SystemFamilyId;
  railVariant: RailVariantSelection;
  sections: CalculatedSection[];
}
