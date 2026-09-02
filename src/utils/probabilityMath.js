export function calculateProbabilities(topLogprobs, finalTemp, finalTopP) {
  // 1. Sort by raw logprob descending
  const sorted = [...topLogprobs].sort((a, b) => b.logprob - a.logprob);

  // 2. Compute Unnormalized Chance percentages
  const rawSum = sorted.reduce((acc, x) => acc + Math.exp(x.logprob), 0);
  const withRawChance = sorted.map((item) => {
    const chance = rawSum > 0 ? (Math.exp(item.logprob) / rawSum) * 100 : 0;
    return { ...item, rawChance: chance };
  });

  // 3. Compute Chance to Pick (affected by Temp & Top-P)
  let adjusted = sorted.map((item) => {
    let weight = finalTemp <= 0.05 ? 0 : Math.exp(item.logprob / finalTemp);
    return { ...item, weight };
  });
  if (finalTemp <= 0.05 && adjusted.length > 0) {
    adjusted[0].weight = 1.0;
  }

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
