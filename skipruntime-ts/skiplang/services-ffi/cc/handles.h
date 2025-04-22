#ifndef HANDLES_H
#define HANDLES_H

#include <functional>
#include <mutex>
#include <optional>
#include <stack>
#include <vector>

#include "executor.h"
#include "notification_queue.h"

namespace skip {

/**
 * @class Handles
 * @brief A generic handle manager for dynamically allocated objects.
 *
 * This class provides a way to create, retrieve, and delete handles
 * associated with objects of type Executor. It ensures thread-safe access
 * and efficient reuse of handles.
 *
 * @tparam Executor The type of object managed by this handle system.
 */
class ExecutorHandles {
 public:
  /**
   * @brief Default constructor.
   */
  ExecutorHandles();

  /**
   * @brief Destructor.
   */
  ~ExecutorHandles();

  /**
   * @brief Creates and registers a new object, returning a unique handle.
   * @param obj Pointer to the object to register.
   * @return A unique handle ID associated with the object.
   */
  uint32_t createHandle(Executor* obj);

  /**
   * @brief Deletes the object associated with a given handle.
   * @param id The handle ID to delete.
   */
  void deleteHandle(uint32_t id);

  /**
   * @brief Retrieves the object associated with a given handle.
   * @param id The handle ID to look up.
   * @return A pointer to the object if found, nullptr otherwise.
   */
  Executor* getHandle(uint32_t id);

 private:
  std::vector<Executor*> m_handles;  ///< Indexed storage of objects.
  std::stack<uint32_t> m_freeIds;    ///< Reusable ID stack.
  std::mutex m_mutex;                ///< Protects internal state.
};

/**
 * @class Handles
 * @brief A generic handle manager for dynamically allocated objects.
 *
 * This class provides a way to create, retrieve, and delete handles
 * associated with objects of type NotificationQueue. It ensures thread-safe
 * access and efficient reuse of handles.
 *
 * @tparam Executor The type of object managed by this handle system.
 */
class NotificationHandles {
 public:
  /**
   * @brief Default constructor.
   */
  NotificationHandles();

  /**
   * @brief Destructor.
   */
  ~NotificationHandles();

  /**
   * @brief Creates and registers a new object, returning a unique handle.
   * @param obj Pointer to the object to register.
   * @return A unique handle ID associated with the object.
   */
  uint32_t createHandle(NotificationQueue* obj);

  /**
   * @brief Deletes the object associated with a given handle.
   * @param id The handle ID to delete.
   */
  void deleteHandle(uint32_t id);

  /**
   * @brief Retrieves the object associated with a given handle.
   * @param id The handle ID to look up.
   * @return A pointer to the object if found, nullptr otherwise.
   */
  NotificationQueue* getHandle(uint32_t id);

 private:
  std::vector<NotificationQueue*> m_handles;  ///< Indexed storage of objects.
  std::stack<uint32_t> m_freeIds;             ///< Reusable ID stack.
  std::mutex m_mutex;                         ///< Protects internal state.
};

}  // namespace skip

#endif  // HANDLES_H
