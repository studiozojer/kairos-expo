import { requireNativeModule } from 'expo';

// Resolve lazily so an unavailable native build becomes a recoverable load error.
export function calculateChart(requestJson: string): Promise<string> {
  return requireNativeModule<{ calculateChart(request: string): Promise<string> }>('Kairos')
    .calculateChart(requestJson);
}

export function searchLocations(query: string): Promise<string> {
  return requireNativeModule<{ searchLocations(query: string): Promise<string> }>('Kairos')
    .searchLocations(query);
}

/** Full named catalog at an explicitly supplied reference date/zodiac. */
export function getAllStarPositions(requestJson: string): Promise<string> {
  return requireNativeModule<{ getAllStarPositions(request: string): Promise<string> }>('Kairos')
    .getAllStarPositions(requestJson);
}
