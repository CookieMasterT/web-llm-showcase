export function calculateProbabilities(topLogprobs, finalTemp, finalTopP) {
  // 1. Sort by raw logprob descending
  const sorted = [...topLogprobs].sort((a, b) => b.logprob - a.logprob);

  // 2. Compute Unnormalized Chance percentages (reconstructed for default temperature T = 1.0)
  // Backend logprobs already have finalTemp applied. To recover default temperature logits,
  // we multiply logprob by finalTemp. When finalTemp == 0, sampling is greedy.
  const rawWeights = sorted.map((item, idx) => {
    if (finalTemp == 0) {
      return idx === 0 ? 1.0 : 0.0;
    }
    const logprob = Number.isFinite(item.logprob) ? item.logprob : -Infinity;
    return Math.exp(logprob * finalTemp);
  });
  const rawSum = rawWeights.reduce((acc, w) => acc + w, 0);
  const withRawChance = sorted.map((item, idx) => {
    const chance = rawSum > 0 ? (rawWeights[idx] / rawSum) * 100 : 0;
    return { ...item, rawChance: chance };
  });

  // 3. Compute Chance to Pick (affected by Temp & Top-P)
  // Backend logprobs already reflect finalTemp, so we do not divide by finalTemp again.
  let adjusted = sorted.map((item, idx) => {
    let weight;
    if (finalTemp <= 0.05) {
      weight = idx === 0 ? 1.0 : 0.0;
    } else {
      weight = Number.isFinite(item.logprob) ? Math.exp(item.logprob) : 0.0;
    }
    return { ...item, weight };
  });

  const adjSum = adjusted.reduce((acc, x) => acc + x.weight, 0);
  adjusted.forEach((item) => {
    item.temp_prob = adjSum > 0 ? item.weight / adjSum : 0;
  });

  // Sort descending by temperature-adjusted probability
  adjusted.sort((a, b) => b.temp_prob - a.temp_prob);

  // Apply Top-P thresholding
  let cumSum = 0;
  let insideTopP = [];
  adjusted.forEach((item) => {
    if (cumSum < finalTopP) {
      insideTopP.push(item);
    }
    cumSum += item.temp_prob;
  });
  if (insideTopP.length === 0 && adjusted.length > 0) {
    insideTopP.push(adjusted[0]);
  }

  // Re-normalize top-p candidates
  const finalSum = insideTopP.reduce((acc, x) => acc + x.temp_prob, 0);
  const pickChances = adjusted.map((item) => {
    const inP = insideTopP.includes(item);
    const chance =
      inP && finalSum > 0 ? (item.temp_prob / finalSum) * 100 : 0.0;
    return { token: item.token, chance };
  });

  return { withRawChance, pickChances };
}
