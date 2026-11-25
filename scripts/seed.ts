import { resetAndSeedDatabase } from '../lib/seed';

async function main() {
  console.log('Starting baseline seed from Sponsor Dataset.xlsx...');
  const summary = await resetAndSeedDatabase();
  console.log('\nSeed complete!');
  console.log(`Total duplicates removed: ${summary.duplicatesRemovedCount}`);
  console.log(`Duplicate IDs: ${summary.duplicateIds.join(', ')}`);
  console.table(summary.counts);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
