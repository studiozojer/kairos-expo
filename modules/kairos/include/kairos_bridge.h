#pragma once
#include <stdbool.h>
#ifdef __cplusplus
extern "C" {
#endif
// Stable C ABI from kairos-ffi/src/types.rs. Results are owned by Rust.
typedef struct KairosResult {
  bool success;
  char *data;
  char *error;
} KairosResult;
KairosResult kairos_init(const char *atlas_db_path, const char *ephemeris_path);
KairosResult kairos_calculate_chart(const char *request_json);
KairosResult kairos_search_locations(const char *query, int limit);
void kairos_result_free(KairosResult result);
#ifdef __cplusplus
}
#endif
