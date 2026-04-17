import fs from 'node:fs/promises';
import path from 'node:path';
import { buildConverted5etoolsDataset, getDefaultPaths } from './convert_5etools_source_split_items_lib.mjs';

async function writeJson(outputPath, payload) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function main() {
  const paths = getDefaultPaths();
  const dataset = await buildConverted5etoolsDataset({ manifestPath: paths.manifestPath });

  await Promise.all([
    writeJson(paths.docsOutputPath, dataset),
    writeJson(paths.publicOutputPath, dataset),
  ]);

  console.log(`Converted rows: ${dataset.total_items_converted}`);
  console.log(`Loaded source files: ${dataset.source_files_loaded}`);
  console.log(`Manifest entries: ${dataset.source_manifest_total_entries}`);
  console.log(`Docs output: ${path.relative(process.cwd(), paths.docsOutputPath)}`);
  console.log(`Public output: ${path.relative(process.cwd(), paths.publicOutputPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
