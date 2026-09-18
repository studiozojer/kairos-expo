// Run against the bundled native library, atlas and ephemeris on each platform.
#include "kairos_bridge.h"
#include <stdio.h>
int main(int argc, char **argv) {
  if (argc != 4) return 2;
  KairosResult init = kairos_init(argv[1], argv[2]);
  int success = init.success;
  if (!success) fprintf(stderr, "%s\n", init.error ? init.error : "Initialization failed");
  kairos_result_free(init);
  if (!success) return 1;
  KairosResult result = kairos_search_locations(argv[3], 30);
  success = result.success && result.data;
  if (success) puts(result.data);
  else fprintf(stderr, "%s\n", result.error ? result.error : "Search failed");
  kairos_result_free(result);
  return success ? 0 : 1;
}
