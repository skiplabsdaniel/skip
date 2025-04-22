#include "worker.h"

namespace skip {

Worker::Worker() {
  m_thread = std::thread([this] {
    while (true) {
      std::function<void()> task;

      {
        std::unique_lock<std::mutex> lock(m_queue_mutex);
        m_queue_state.wait(lock, [this] { return m_stop || !m_tasks.empty(); });

        if (m_stop && m_tasks.empty()) return;

        task = std::move(m_tasks.front());
        m_tasks.pop();
      }

      task();
    }
  });
}

Worker::~Worker() {
  {
    std::unique_lock<std::mutex> lock(m_queue_mutex);
    m_stop = true;
  }

  m_queue_state.notify_all();
  m_thread.join();
}

}  // namespace skip