#include "executor.h"

#include <string.h>

#include <iostream>
#include <thread>

#include "handles.h"

namespace skip {

/**
 * @brief Constructs an Executor object. Initially, the executor is unresolved.
 */
Executor::Executor()
    : m_promise(std::make_shared<std::promise<Result>>()),
      m_future(m_promise->get_future()) {}

/**
 * @brief Destroys the Executor. Ensures that any pending result is processed.
 */
Executor::~Executor() {
  if (m_future.valid()) {
    m_future.get();  // Ensures that the future is either resolved or rejected
  }
}

/**
 * @brief Resolves the executor, marking it as successfully completed.
 */
void Executor::resolve() {
  m_promise->set_value(
      {true, nullptr});  // Resolve with 'ok' as true, no rejection reason
}

/**
 * @brief Rejects the executor with a specified reason.
 * @param reason The reason for rejection.
 */
void Executor::reject(const char* reason) {
  m_promise->set_value(
      {false,
       strdup(reason)});  // Reject with 'ok' as false, and the reason string
}

/**
 * @brief Gets the result of the executor.
 * @return Result The result, which can indicate success (ok=true) or failure
 * (ok=false).
 */
Executor::Result Executor::getResult() {
  return m_future.get();
}

}  // namespace skip