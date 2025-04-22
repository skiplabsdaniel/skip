#include "notification_queue.h"

namespace skip {

void NotificationQueue::push(const Notification& notification) {
  std::lock_guard<std::mutex> lock(m_mutex);
  m_queue.push(notification);
  m_cond.notify_one();
}

Notification NotificationQueue::pop() {
  std::unique_lock<std::mutex> lock(m_mutex);
  m_cond.wait(lock, [this] { return !m_queue.empty(); });
  Notification notif = m_queue.front();
  m_queue.pop();
  return notif;
}

std::optional<Notification> NotificationQueue::tryPop() {
  std::lock_guard<std::mutex> lock(m_mutex);
  if (m_queue.empty()) return std::nullopt;
  Notification notif = m_queue.front();
  m_queue.pop();
  return notif;
}

bool NotificationQueue::empty() const {
  std::lock_guard<std::mutex> lock(m_mutex);
  return m_queue.empty();
}

}  // namespace skip
