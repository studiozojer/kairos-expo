export async function calculateChart(requestJson: string): Promise<string> {
  const response = await fetch('/local/calculate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: requestJson,
  });
  const text = await response.text();
  if (!response.ok) throw new Error(JSON.parse(text).error ?? 'Local chart calculation failed.');
  return text;
}

export async function searchLocations(_query: string): Promise<string> {
  throw new Error('Atlas search requires the iOS or Android app.');
}

export async function getAllStarPositions(_requestJson: string): Promise<string> {
  throw new Error('The star catalog requires the iOS or Android app.');
}
