import { requireNativeModule } from 'expo';

// Resolve lazily so an unavailable native build becomes a recoverable load error.
export function calculateChart(requestJson: string): Promise<string> {
  return requireNativeModule<{ calculateChart(request: string): Promise<string> }>('Kairos')
    .calculateChart(requestJson);
}
