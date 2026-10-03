#include "kairos_bridge.h"
#include <stdio.h>
#include <stdlib.h>

// Run against each app's packaged simulator library, in separate processes.
int main(int argc, char **argv) {
  if (argc != 3) return 2;
  KairosResult init = kairos_init(":memory:", argv[1]);
  int ready = init.success;
  if (!ready) fprintf(stderr, "%s\n", init.error ? init.error : "Initialization failed");
  kairos_result_free(init);
  if (!ready) return 1;
  FILE *requests = fopen(argv[2], "r");
  if (!requests) return 2;
  char *line = NULL;
  size_t capacity = 0;
  while (getline(&line, &capacity, requests) > 0) {
    KairosResult result = kairos_calculate_chart(line);
    if (!result.success || !result.data) {
      fprintf(stderr, "%s\n", result.error ? result.error : "Calculation failed");
      kairos_result_free(result); free(line); fclose(requests); return 1;
    }
    puts(result.data);
    kairos_result_free(result);
  }
  free(line); fclose(requests); return 0;
}
