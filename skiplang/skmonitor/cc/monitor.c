#include <stddef.h>
#include <stdint.h>

typedef struct sk_session {
  int64_t low;
  int64_t high;
} sk_session_t;

extern sk_session_t* psession;

uint64_t SKIP_persistent_size();
uint64_t SKIP_freetable_size();
uint64_t SKIP_obstack_peak();

void* SKIP_Monitor_createMemory(uint64_t p, uint64_t f, uint64_t o);

void* SKIP_Monitor_memory() {
  return SKIP_Monitor_createMemory(SKIP_persistent_size(),
                                   SKIP_freetable_size(), SKIP_obstack_peak());
}

int64_t SKIP_Monitor_get_session_low() {
  return psession->low;
}

int64_t SKIP_Monitor_get_session_high() {
  return psession->high;
}
