#include "kairos_bridge.h"
#include <stdio.h>
// Each line is a real chart for the same instant/location, one per picker option.
int main(int argc, char **argv) {
  if (argc != 2) return 2;
  KairosResult init = kairos_init(":memory:", argv[1]);
  int success = init.success;
  kairos_result_free(init);
  if (!success) return 1;
  const char *systems[] = {"Whole Sign", "Placidus", "Equal", "Koch", "Porphyrius",
    "Regiomontanus", "Campanus", "Meridian", "Morinus", "Alcabitus", "Topocentric", "Vehlow", "Equal (MC)"};
  for (int i = 0; i < 13; ++i) {
    char request[512];
    snprintf(request, sizeof(request),
      "{\"datetime\":\"2026-09-13T19:00:00Z\",\"latitude\":47.6062,\"longitude\":-122.3321,"
      "\"chart_kind\":\"Transit\",\"house_system\":\"%s\",\"zodiac_system\":\"Tropical\",\"enabled_bodies\":[\"Sun\",\"Moon\"]}", systems[i]);
    KairosResult chart = kairos_calculate_chart(request);
    success = chart.success && chart.data;
    if (success) puts(chart.data);
    else fprintf(stderr, "%s: %s\n", systems[i], chart.error ? chart.error : "Calculation failed");
    kairos_result_free(chart);
    if (!success) return 1;
  }
  return 0;
}
