/**
 * @file context.cpp
 * @brief Thread-local context stack management for the Skip runtime.
 */

#include <stack>

/// @brief Defines the Skip runtime context type.
#define SKContext void*

/// @brief Thread-local stack used to manage context objects per thread.
thread_local std::stack<SKContext> stack;

extern "C" {

/**
 * @brief Pushes a new context onto the thread-local stack.
 *
 * @param context The context to push.
 */
void SkipRuntime_pushContext(SKContext context) {
  stack.push(context);
}

/**
 * @brief Pops the top context from the thread-local stack.
 *
 * Assumes that the stack is not empty.
 */
void SkipRuntime_popContext() {
  stack.pop();
}

/**
 * @brief Retrieves the current (top) context from the stack.
 *
 * @return The top context if the stack is not empty, otherwise nullptr.
 */
SKContext SkipRuntime_getContext() {
  if (!stack.empty()) {
    return stack.top();
  }
  return nullptr;
}

}  // extern "C"