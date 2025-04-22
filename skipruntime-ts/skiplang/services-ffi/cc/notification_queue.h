#ifndef SKIP_NOTIFICATION_QUEUE_H
#define SKIP_NOTIFICATION_QUEUE_H

#include <condition_variable>
#include <mutex>
#include <optional>
#include <queue>
#include <string>

namespace skip {

/**
 * @brief A notification structure containing values, watermark, and an initial
 * flag.
 */
struct Notification {
  std::string valeurs;    ///< Notification textual payload.
  std::string watermark;  ///< Identifier or progress marker.
  bool is_initial;        ///< Indicates if this is the initial notification.
};

/**
 * @brief A thread-safe queue for managing Notification objects.
 */
class NotificationQueue {
 public:
  /**
   * @brief Adds a notification to the queue.
   * @param notification The notification to add.
   */
  void push(const Notification& notification);

  /**
   * @brief Removes and returns the front notification from the queue
   * (blocking).
   * @return The next Notification in the queue.
   */
  Notification pop();

  /**
   * @brief Attempts to remove and return the front notification from the queue
   * (non-blocking).
   * @return An optional Notification; std::nullopt if the queue is empty.
   */
  std::optional<Notification> tryPop();

  /**
   * @brief Checks if the queue is empty.
   * @return True if the queue is empty; false otherwise.
   */
  bool empty() const;

 private:
  mutable std::mutex m_mutex;        ///< Mutex for synchronizing access.
  std::condition_variable m_cond;    ///< Condition variable for blocking pop().
  std::queue<Notification> m_queue;  ///< Internal storage of notifications.
};

}  // namespace skip

#endif  // SKIP_NOTIFICATION_QUEUE_H
