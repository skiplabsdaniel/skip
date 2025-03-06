use crate::error;
use std::sync::mpsc::{Sender, channel};
use std::thread;

#[derive(Clone)]
pub struct ThreadWorker {
    task_sender: Sender<Box<dyn FnOnce() + Send>>,
}

impl ThreadWorker {
    /// Creates a new `ThreadWorker` instance and starts the worker thread.
    pub fn new() -> Self {
        let (task_sender, task_receiver) = channel::<Box<dyn FnOnce() + Send>>();

        thread::spawn(move || {
            for task in task_receiver {
                task(); // Execute the task
            }
        });

        ThreadWorker { task_sender }
    }

    /// Submits a task to the worker and waits for its result.
    pub fn submit<F, R>(&self, task: F) -> Result<R, error::SkipError>
    where
        F: FnOnce() -> Result<R, error::SkipError> + Send + 'static,
        R: Send + 'static,
    {
        let (result_sender, result_receiver) = channel();

        let task = Box::new(move || {
            let result = task();
            result_sender.send(result).unwrap();
        });

        match self
            .task_sender
            .send(task)
            .map_err(|_| "Failed to send task".to_string())
        {
            Ok(()) => (),
            Err(e) => return Err(error::SkipError { msg: e }),
        };

        match result_receiver
            .recv()
            .map_err(|_| "Failed to receive result".to_string())
        {
            Ok(res) => res,
            Err(e) => Err(error::SkipError { msg: e }),
        }
    }
}
