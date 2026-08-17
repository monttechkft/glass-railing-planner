import productCsvText from '../data/products.csv?raw';
import productPriceCsvText from '../data/product_prices.csv?raw';
import productStockCsvText from '../data/product_stock.csv?raw';
import railingSystemCsvText from '../data/railing_systems.csv?raw';
import {
  mergeProductData,
  parseProductPricesCsv,
  parseProductsCsv,
  parseProductStockCsv,
} from './inventory.js';
import {
  parseRailingSystemsCsv,
  validateProductSystemCompatibility,
} from './railingSystems.js';
import type { Product, RailingSystem } from './types.js';

/**
 * Parse and join all embedded CSV files once when the application starts.
 * Keeping this outside React prevents CSV work from repeating on every render.
 */
let products: Product[] = [];
let railingSystems: RailingSystem[] = [];
let dataError: unknown = null;

try {
  products = mergeProductData(
    parseProductsCsv(productCsvText),
    parseProductPricesCsv(productPriceCsvText),
    parseProductStockCsv(productStockCsvText),
  ) as Product[];
  railingSystems = parseRailingSystemsCsv(
    railingSystemCsvText,
  ) as RailingSystem[];
  validateProductSystemCompatibility(products, railingSystems);
} catch (error) {
  dataError = error;
}

export const productData = products;
export const railingSystemData = railingSystems;
export const productDataError = dataError;
export const productsByCode = new Map(
  products.map((product) => [product.productCode, product]),
);
