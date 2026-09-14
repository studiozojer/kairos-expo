// Native ABI proof. Writes the same fixed chart on host, iOS simulator, or Android.
#include "kairos_bridge.h"
#include <stdio.h>

int main(int argc, char **argv) {
  if (argc != 2) return 2;
  KairosResult init = kairos_init(":memory:", argv[1]);
  int initialized = init.success;
  if (!initialized) fprintf(stderr, "%s\n", init.error ? init.error : "Initialization failed");
  kairos_result_free(init);
  if (!initialized) return 1;
  KairosResult result = kairos_calculate_chart(
    "{\"datetime\":\"2026-09-13T19:00:00Z\",\"latitude\":47.6062,\"longitude\":-122.3321,"
    "\"chart_kind\":\"Transit\",\"house_system\":\"Placidus\",\"zodiac_system\":\"Tropical\","
    "\"enabled_bodies\":[\"Sun\",\"Moon\",\"Mercury\",\"Venus\",\"Mars\",\"Jupiter\",\"Saturn\","
    "\"Uranus\",\"Neptune\",\"Pluto\",\"MeanNode\",\"MeanApogee\",\"Chiron\"]}");
  int success = result.success && result.data;
  if (success) puts(result.data);
  else fprintf(stderr, "%s\n", result.error ? result.error : "Calculation failed");
  kairos_result_free(result);
  return success ? 0 : 1;
}
