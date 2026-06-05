export const DEFAULT_TIERS = [
  { upTo: 10_000,     unit: 1_000   },
  { upTo: 100_000,    unit: 5_000   },
  { upTo: 1_000_000,  unit: 10_000  },
  { upTo: 10_000_000, unit: 50_000  },
  { upTo: null,       unit: 100_000 },
];

export const getBidUnit = (currentPrice, customTiers) => {
  const tiers = customTiers?.length > 0 ? customTiers : DEFAULT_TIERS;
  const tier = tiers.find((t) => t.upTo === null || currentPrice < t.upTo);
  return tier?.unit ?? tiers[tiers.length - 1].unit;
};

export const validateBidTiers = (tiers) => {
  if (!Array.isArray(tiers) || tiers.length === 0) {
    return "입찰 구간은 1개 이상이어야 합니다.";
  }

  for (let i = 0; i < tiers.length; i++) {
    const { upTo, unit } = tiers[i];
    const isLast = i === tiers.length - 1;

    if (!Number.isInteger(unit) || unit <= 0) {
      return `구간 ${i + 1}의 입찰 단위는 양의 정수여야 합니다.`;
    }

    if (isLast) {
      if (upTo !== null && upTo !== undefined) {
        return "마지막 구간의 upTo는 null이어야 합니다.";
      }
    } else {
      if (!Number.isInteger(upTo) || upTo <= 0) {
        return `구간 ${i + 1}의 upTo는 양의 정수여야 합니다.`;
      }
      if (i > 0 && upTo <= tiers[i - 1].upTo) {
        return "구간 상한선(upTo)은 오름차순이어야 합니다.";
      }
    }
  }

  return null;
};
