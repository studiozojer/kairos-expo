export async function calculateChart(_requestJson: string): Promise<string> {
  throw new Error('Live charts require the iOS or Android app.');
}

export async function searchLocations(_query: string): Promise<string> {
  throw new Error('Atlas search requires the iOS or Android app.');
}
