#ifndef SKIP_EXECUTOR_H
#define SKIP_EXECUTOR_H

#include <future>
#include <memory>
#include <stdexcept>

namespace skip {

/**
 * @class Executor
 * @brief This class represents an executor that can either be resolved or
 * rejected. It uses std::promise and std::future to manage the state and allow
 * asynchronous waiting.
 */
class Executor {
 public:
  /**
   * @brief Result type representing either success or rejection.
   *
   * - `ok` is `true` if the executor was successfully resolved.
   * - `reason` is the rejection reason if `ok` is `false`.
   */
  struct Result {
    bool ok;       ///< True if resolved, false if rejected
    char* reason;  ///< Rejection reason, only meaningful if `ok` is false
  };

  /// Constructs a new unresolved Executor.
  Executor();

  /// Destroys the Executor. Ensures that any pending result is handled.
  ~Executor();

  /**
   * @brief Resolves the executor, marking it as successfully completed.
   */
  void resolve();

  /**
   * @brief Rejects the executor with a specified reason.
   * @param reason The string describing the reason for rejection.
   */
  void reject(const char* reason);

  /**
   * @brief Gets the result of the executor.
   * @return Result The result, which can indicate success or a rejection
   * reason.
   */
  Result getResult();

 private:
  std::shared_ptr<std::promise<Result>>
      m_promise;  ///< The promise used to track the executor's state.
  std::future<Result> m_future;  ///< The future associated with the promise.
};

}  // namespace skip

#endif  // SKIP_EXECUTOR_H
