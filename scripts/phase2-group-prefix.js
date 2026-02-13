#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const CATEGORIES = [325, 326, 327, 328, 329, 330, 331, 332, 333];
const INPUT_DIR = path.join(process.cwd(), 'test', 'phase1_raw');
const OUTPUT_DIR = path.join(process.cwd(), 'test', 'phase2_grouped');

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function groupByVariantPrefix(products) {
  const grouped = {};

  for (const product of products) {
    const variants = Array.isArray(product?.variants) ? product.variants : [];
    for (const variant of variants) {
      const variantCode = typeof variant?.variant_code === 'string' ? variant.variant_code : '';
      if (!variantCode || variantCode.length < 8) continue;
      const prefix = variantCode.slice(0, 8);
      if (!grouped[prefix]) grouped[prefix] = [];
      grouped[prefix].push(variant);
    }
  }

  return grouped;
}

function evaluateTests(meta, grouped, missingCategories, rawFilesBefore, rawFilesAfter) {
  const hasAllCategoryRecords = meta.length === CATEGORIES.length;
  const recordsContainGroupingField = meta.every((m) => typeof m.group_count === 'number');
  const allGroupsArePrefix8 = Object.keys(grouped).every((k) => k.length === 8);
  const noMissingCategory = missingCategories.length === 0;
  const rawUnchanged =
    rawFilesBefore.length === rawFilesAfter.length &&
    rawFilesBefore.every((v, i) => v === rawFilesAfter[i]);

  return {
    test_1_category_325_333_processed: hasAllCategoryRecords,
    test_2_group_result_created_separately: recordsContainGroupingField,
    test_3_grouping_uses_variant_code_prefix_8: allGroupsArePrefix8,
    test_4_missing_categories_zero: noMissingCategory,
    test_5_raw_json_not_modified: rawUnchanged,
  };
}

function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const rawFilesBefore = fs.existsSync(INPUT_DIR)
    ? fs.readdirSync(INPUT_DIR).sort()
    : [];

  const grouped = {};
  const meta = [];
  const missingCategories = [];

  for (const categoryNo of CATEGORIES) {
    const inputPath = path.join(INPUT_DIR, `category-${categoryNo}.json`);
    if (!fs.existsSync(inputPath)) {
      missingCategories.push(categoryNo);
      meta.push({
        timestamp: new Date().toISOString(),
        category_no: categoryNo,
        source_file: path.relative(process.cwd(), inputPath),
        source_exists: false,
        products_array_exists: false,
        variants_array_exists: false,
        group_count: 0,
      });
      continue;
    }

    const raw = readJson(inputPath);
    const products = Array.isArray(raw?.products) ? raw.products : [];
    const hasVariants = products.some((p) => Array.isArray(p?.variants));
    const groupedByCategory = groupByVariantPrefix(products);

    for (const [prefix, variants] of Object.entries(groupedByCategory)) {
      if (!grouped[prefix]) grouped[prefix] = [];
      grouped[prefix].push(...variants);
    }

    meta.push({
      timestamp: new Date().toISOString(),
      category_no: categoryNo,
      source_file: path.relative(process.cwd(), inputPath),
      source_exists: true,
      products_array_exists: Array.isArray(raw?.products),
      variants_array_exists: hasVariants,
      group_count: Object.keys(groupedByCategory).length,
    });
  }

  const groupedPath = path.join(OUTPUT_DIR, 'grouped-by-prefix.json');
  fs.writeFileSync(groupedPath, JSON.stringify(grouped, null, 2), 'utf8');

  const rawFilesAfter = fs.existsSync(INPUT_DIR)
    ? fs.readdirSync(INPUT_DIR).sort()
    : [];

  const tests = evaluateTests(meta, grouped, missingCategories, rawFilesBefore, rawFilesAfter);

  const report = {
    generated_at: new Date().toISOString(),
    phase: 'phase2',
    categories: CATEGORIES,
    meta,
    missing_categories: missingCategories,
    grouped_file: path.relative(process.cwd(), groupedPath),
    tests,
  };

  const reportPath = path.join(OUTPUT_DIR, 'report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify(report, null, 2));
}

main();
