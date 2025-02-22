
#include <stack>

#define SKContext void*

thread_local std::stack<SKContext> stack;

extern "C" {
void SkipRuntime_pushContext(SKContext context) {
  stack.push(context);
}

void SkipRuntime_popContext() {
  stack.pop();
}

SKContext SkipRuntime_getContext() {
  if (!stack.empty()) {
    return stack.top();
  }
  return nullptr;
}

}  // extern "C"