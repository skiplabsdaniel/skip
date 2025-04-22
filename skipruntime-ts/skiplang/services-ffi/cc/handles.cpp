#include "handles.h"

extern "C" {
void Skip_info(const char* message);
}

namespace skip {

ExecutorHandles::ExecutorHandles() {}

ExecutorHandles::~ExecutorHandles() {}

uint32_t ExecutorHandles::createHandle(Executor* obj) {
  std::lock_guard<std::mutex> lock(m_mutex);
  uint32_t id;
  // Reuse a handle from m_freeIds stack if available
  if (!m_freeIds.empty()) {
    id = m_freeIds.top();
    m_freeIds.pop();
    m_handles[id] = obj;
  } else {
    m_handles.push_back(obj);
    id = m_handles.size() - 1;
  }
  return id;
}

void ExecutorHandles::deleteHandle(uint32_t id) {
  std::lock_guard<std::mutex> lock(m_mutex);
  // Check if the handle exists in the vector
  if (id >= 0 && id < m_handles.size() && m_handles[id]) {
    m_handles[id] = nullptr;  // Clear the object associated with the handle
    m_freeIds.push(id);       // Make the handle available for reuse
  }
}

Executor* ExecutorHandles::getHandle(uint32_t id) {
  if (id >= 0 && id < m_handles.size() && m_handles[id]) {
    return m_handles[id];
  }
  char buffer[256];
  sprintf(buffer, "Invalid Executor handle identifier %d", id);
  Skip_info(buffer);
  return nullptr;  // Return empty if the handle is not found
}

NotificationHandles::NotificationHandles() {}

NotificationHandles::~NotificationHandles() {}

uint32_t NotificationHandles::createHandle(NotificationQueue* obj) {
  std::lock_guard<std::mutex> lock(m_mutex);
  uint32_t id;
  // Reuse a handle from m_freeIds stack if available
  if (!m_freeIds.empty()) {
    id = m_freeIds.top();
    m_freeIds.pop();
    m_handles[id] = obj;
  } else {
    m_handles.push_back(obj);
    id = m_handles.size() - 1;
  }
  return id;
}

void NotificationHandles::deleteHandle(uint32_t id) {
  std::lock_guard<std::mutex> lock(m_mutex);
  // Check if the handle exists in the vector
  if (id >= 0 && id < m_handles.size() && m_handles[id]) {
    m_handles[id] = nullptr;  // Clear the object associated with the handle
    m_freeIds.push(id);       // Make the handle available for reuse
  }
}

NotificationQueue* NotificationHandles::getHandle(uint32_t id) {
  if (id >= 0 && id < m_handles.size() && m_handles[id]) {
    return m_handles[id];
  }
  return nullptr;  // Return empty if the handle is not found
}

}  // namespace skip
