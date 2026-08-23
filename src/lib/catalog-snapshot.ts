import { GroupedProduct, normalizeProductName } from './product-utils';

export interface CatalogSnapshotEnvelope {
  schemaVersion: 2;
  generatedAt: string;
  groups: Record<string, GroupedProduct>;
}

export class CatalogSnapshotValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CatalogSnapshotValidationError';
  }
}

type CafeVariant = {
  additional_amount?: string | number;
  custom_variant_code?: string;
  options?: Array<{ value?: string }>;
  variant_code?: string;
};

type CafeProduct = {
  _categoryNo?: number;
  detail_image?: string;
  options?: {
    has_option?: string;
    options?: Array<{ option_value?: Array<{ option_text?: string; value?: string }> }>;
  };
  price?: string | number;
  product_code?: string;
  product_name?: string;
  product_no?: number;
  variants?: CafeVariant[];
};

function assertValidPrice(price: number): void {
  if (!Number.isFinite(price) || price <= 0) {
    throw new CatalogSnapshotValidationError('price must be a positive finite number');
  }
}

function isCatalogSnapshotEnvelope(
  snapshot: CatalogSnapshotEnvelope | Record<string, GroupedProduct>,
): snapshot is CatalogSnapshotEnvelope {
  const envelope = snapshot as Partial<CatalogSnapshotEnvelope>;
  return envelope.schemaVersion === 2 && typeof envelope.groups === 'object' && envelope.groups !== null;
}

export function makeCatalogProductKey(
  productNo: number | string,
  variantCode: string,
  isSingle: boolean,
): string {
  return `${productNo}:${isSingle ? 'SINGLE' : variantCode}`;
}

export function buildCatalogSnapshot(
  products: unknown[],
  generatedAt: Date,
): CatalogSnapshotEnvelope {
  const groups: Record<string, GroupedProduct> = {};
  const stableKeys = new Set<string>();

  for (const value of products) {
    const product = value as CafeProduct;
    const groupId = String(product.product_code);
    const productNo = Number(product.product_no);

    if (!Number.isFinite(productNo) || productNo <= 0) {
      throw new CatalogSnapshotValidationError('product_no is required');
    }

    const parentName = normalizeProductName(product.product_name ?? '');
    const basePrice = Number(product.price);

    const categoryNo = product._categoryNo ?? 0;

    if (groups[groupId]) {
      if (!groups[groupId].categoryNo?.includes(categoryNo)) {
        groups[groupId].categoryNo?.push(categoryNo);
      }
      continue;
    }

    const variants = product.variants ?? [];

    let children: GroupedProduct['children'];

    if (product.options?.has_option === 'T') {
      children = (product.options.options?.[0]?.option_value ?? []).map((option) => {
        const name = option.value ?? option.option_text ?? '';
        const variant = variants.find((candidate) =>
          candidate.options?.some((candidateOption) => candidateOption.value === name),
        );

        if (!variant?.variant_code?.trim()) {
          throw new CatalogSnapshotValidationError('Option variant_code is required');
        }

        const price = basePrice + Number(variant.additional_amount);
        assertValidPrice(price);

        return {
          name,
          price,
          productNo,
          variantCode: variant?.variant_code,
          customVariantCode: variant?.custom_variant_code,
        };
      });
    } else {
      assertValidPrice(basePrice);

      children = [{
        name: parentName,
        price: basePrice,
        productNo,
        isSingle: true,
      }];
    }

    for (const child of children) {
      const stableKey = makeCatalogProductKey(
        productNo,
        child.variantCode ?? '',
        child.isSingle === true,
      );

      if (stableKeys.has(stableKey)) {
        throw new CatalogSnapshotValidationError(`Duplicate stable key: ${stableKey}`);
      }

      stableKeys.add(stableKey);
    }

    groups[groupId] = {
      id: groupId,
      parentName,
      detail_image: product.detail_image ?? '',
      categoryNo: [categoryNo],
      children,
    };
  }

  return {
    schemaVersion: 2,
    generatedAt: generatedAt.toISOString(),
    groups,
  };
}

export function getCatalogGroups(
  snapshot: CatalogSnapshotEnvelope | Record<string, GroupedProduct>,
): Record<string, GroupedProduct> {
  return isCatalogSnapshotEnvelope(snapshot) ? snapshot.groups : snapshot;
}
