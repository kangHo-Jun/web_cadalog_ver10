import { describe, expect, it } from 'vitest';

import {
  buildCatalogSnapshot,
  CatalogSnapshotValidationError,
  getCatalogGroups,
  makeCatalogProductKey,
} from './catalog-snapshot';

const optionProduct = {
  _categoryNo: 326,
  product_no: 1956,
  product_code: 'P0000CXG',
  product_name: '방염 MDF (국산/580중밀도) <br> 9T',
  detail_image: 'https://example.test/mdf.png',
  price: '0.00',
  options: {
    has_option: 'T',
    options: [{ option_value: [{ value: '9T' }] }],
  },
  variants: [{
    additional_amount: '28380.00',
    custom_variant_code: '(2)300SKBMD9',
    variant_code: 'P0000CXG000A',
    options: [{ value: '9T' }],
  }],
};

const singleProduct = {
  _categoryNo: 327,
  product_no: 2001,
  product_code: 'P0000SGL',
  product_name: '단일 상품',
  detail_image: 'https://example.test/single.png',
  price: '19700.00',
  options: { has_option: 'F' },
};

describe('catalog snapshot contract', () => {
  it('uses product and variant identity for option and single stable keys', () => {
    expect(makeCatalogProductKey(1956, 'P0000CXG000A', false))
      .toBe('1956:P0000CXG000A');
    expect(makeCatalogProductKey(1956, '', true)).toBe('1956:SINGLE');
  });

  it('builds a versioned envelope with stable option identity metadata', () => {
    const snapshot = buildCatalogSnapshot(
      [optionProduct],
      new Date('2026-08-23T03:00:00.000Z'),
    );

    expect(snapshot).toMatchObject({
      schemaVersion: 2,
      generatedAt: '2026-08-23T03:00:00.000Z',
    });
    expect(snapshot.groups.P0000CXG.children[0]).toMatchObject({
      productNo: 1956,
      variantCode: 'P0000CXG000A',
      customVariantCode: '(2)300SKBMD9',
      price: 28380,
    });
  });

  it('normalizes an HTML product name before exposing it to UI consumers', () => {
    const snapshot = buildCatalogSnapshot(
      [optionProduct],
      new Date('2026-08-23T03:00:00.000Z'),
    );

    expect(snapshot.groups.P0000CXG.parentName)
      .toBe('방염 MDF (국산/580중밀도) 9T');
  });

  it('adds an option additional amount to its product base price', () => {
    const snapshot = buildCatalogSnapshot(
      [{ ...optionProduct, price: '120.00' }],
      new Date('2026-08-23T03:00:00.000Z'),
    );

    expect(snapshot.groups.P0000CXG.children[0].price).toBe(28500);
  });

  it('uses the direct product price and SINGLE identity for a single product', () => {
    const snapshot = buildCatalogSnapshot(
      [singleProduct],
      new Date('2026-08-23T03:00:00.000Z'),
    );

    expect(snapshot.groups.P0000SGL.children).toEqual([{
      name: '단일 상품',
      price: 19700,
      productNo: 2001,
      isSingle: true,
    }]);
  });

  it('deduplicates repeated categories while preserving their input order', () => {
    const snapshot = buildCatalogSnapshot(
      [
        optionProduct,
        { ...optionProduct, _categoryNo: 327 },
        { ...optionProduct, _categoryNo: 326 },
      ],
      new Date('2026-08-23T03:00:00.000Z'),
    );

    expect(snapshot.groups.P0000CXG.categoryNo).toEqual([326, 327]);
  });

  it('unwraps v2 envelopes while retaining legacy raw group compatibility', () => {
    const snapshot = buildCatalogSnapshot(
      [optionProduct],
      new Date('2026-08-23T03:00:00.000Z'),
    );
    const legacyGroups = snapshot.groups;

    expect(getCatalogGroups(snapshot)).toBe(snapshot.groups);
    expect(getCatalogGroups(legacyGroups)).toBe(legacyGroups);
  });

  it('rejects an option without a variant code', () => {
    const productWithoutVariantCode = {
      ...optionProduct,
      variants: [{
        ...optionProduct.variants[0],
        variant_code: '',
      }],
    };

    expect(() => buildCatalogSnapshot(
      [productWithoutVariantCode],
      new Date('2026-08-23T03:00:00.000Z'),
    )).toThrow(CatalogSnapshotValidationError);
  });

  it('rejects a product without a product number', () => {
    const productWithoutProductNo = { ...optionProduct, product_no: undefined };

    expect(() => buildCatalogSnapshot(
      [productWithoutProductNo],
      new Date('2026-08-23T03:00:00.000Z'),
    )).toThrow(CatalogSnapshotValidationError);
  });

  it('rejects an empty price before creating a single-product child', () => {
    expect(() => buildCatalogSnapshot(
      [{ ...singleProduct, price: '' }],
      new Date('2026-08-23T03:00:00.000Z'),
    )).toThrow(CatalogSnapshotValidationError);
  });

  it('rejects a zero price before creating a single-product child', () => {
    expect(() => buildCatalogSnapshot(
      [{ ...singleProduct, price: '0.00' }],
      new Date('2026-08-23T03:00:00.000Z'),
    )).toThrow(CatalogSnapshotValidationError);
  });

  it('rejects a negative price before creating a single-product child', () => {
    expect(() => buildCatalogSnapshot(
      [{ ...singleProduct, price: '-1.00' }],
      new Date('2026-08-23T03:00:00.000Z'),
    )).toThrow(CatalogSnapshotValidationError);
  });

  it('rejects a nonfinite price before creating a single-product child', () => {
    expect(() => buildCatalogSnapshot(
      [{ ...singleProduct, price: 'not-a-number' }],
      new Date('2026-08-23T03:00:00.000Z'),
    )).toThrow(CatalogSnapshotValidationError);
  });

  it('rejects an option whose base price plus additional amount is zero', () => {
    const freeOption = {
      ...optionProduct,
      variants: [{ ...optionProduct.variants[0], additional_amount: '0.00' }],
    };

    expect(() => buildCatalogSnapshot(
      [freeOption],
      new Date('2026-08-23T03:00:00.000Z'),
    )).toThrow(CatalogSnapshotValidationError);
  });

  it('rejects duplicate stable option keys instead of choosing a price', () => {
    const duplicatedKeyProduct = {
      ...optionProduct,
      product_code: 'P0000DUP',
    };

    expect(() => buildCatalogSnapshot(
      [optionProduct, duplicatedKeyProduct],
      new Date('2026-08-23T03:00:00.000Z'),
    )).toThrow(CatalogSnapshotValidationError);
  });
});
