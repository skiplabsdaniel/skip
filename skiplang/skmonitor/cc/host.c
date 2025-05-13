#include <ctype.h>
#include <stdio.h>
#include <time.h>

void* SKIP_Monitor_createTime(__uint64_t s, __uint64_t ns);

void* SKIP_Monitor_now() {
  struct timespec now;
  timespec_get(&now, TIME_UTC);
  return SKIP_Monitor_createTime(now.tv_sec, now.tv_nsec);
}