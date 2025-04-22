#ifndef WORKER_H
#define WORKER_H

#include <condition_variable>
#include <functional>
#include <future>
#include <mutex>
#include <queue>
#include <thread>

namespace skip {

class Worker {
 public:
  Worker();
  ~Worker();

  // Enqueue a task and get a future for its result
  template <typename Func>
  auto enqueue(Func task) -> std::future<decltype(task())> {
    using ReturnType = decltype(task());

    auto packaged_task =
        std::make_shared<std::packaged_task<ReturnType()>>(std::move(task));
    std::future<ReturnType> future = packaged_task->get_future();

    {
      std::unique_lock<std::mutex> lock(m_queue_mutex);
      m_tasks.emplace([packaged_task]() { (*packaged_task)(); });
    }

    m_queue_state.notify_one();
    return future;
  }

 private:
  std::thread m_thread;
  std::queue<std::function<void()>> m_tasks;
  std::mutex m_queue_mutex;
  std::condition_variable m_queue_state;
  bool m_stop = false;
};

}  // namespace skip

#endif  // WORKER_H