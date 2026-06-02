const DEFAULT_TIERS = [
  { upTo: 10_000, unit: 1_000 },
  { upTo: 100_000, unit: 5_000 },
  { upTo: 1_000_000, unit: 10_000 },
  { upTo: 10_000_000, unit: 50_000 },
  { upTo: null, unit: 100_000 },
];

export const getBidUnit = (currentPrice, customTiers) => {
  const tiers = customTiers?.length > 0 ? customTiers : DEFAULT_TIERS;
  const tier = tiers.find((t) => t.upTo === null || currentPrice < t.upTo);
  return tier?.unit ?? tiers[tiers.length - 1].unit;
};
