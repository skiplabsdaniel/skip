#[warn(dead_code)]
use std::{sync::Arc, time::Duration};

use crate::ffi;
use actix_web::rt::time::interval;
use actix_web_lab::sse::{self, ChannelStream, SendError, Sse};
use log::error;
use parking_lot::Mutex;
use std::collections::HashMap;
use tokio::{self, spawn};

#[derive(Debug, Clone, Default)]
struct ClientsInner {
    clients: HashMap<String, sse::Sender>,
}

pub struct Clients {
    inner: Mutex<ClientsInner>,
}

#[allow(dead_code)]
pub struct SseNotifier {
    sender: sse::Sender,
}

impl ffi::Notifier for SseNotifier {
    fn update(&self, values: String, watermark: String, is_initial: bool) -> Result<(), SendError> {
        let event = match is_initial {
            true => "init",
            false => "update",
        };
        actix_web::rt::System::new().block_on(
            self.sender
                .send(sse::Data::new(values).event(event).id(watermark)),
        )
    }

    fn close(&self) -> () {
        let clone = self.sender.clone();
        spawn(async move {
            drop(clone); // drop used to close the stream
        });
    }
}

impl Clients {
    /// Constructs new clients and spawns ping loop.
    pub fn create() -> Arc<Self> {
        let this = Arc::new(Clients {
            inner: Mutex::new(ClientsInner::default()),
        });
        Clients::spawn_ping(Arc::clone(&this));
        this
    }

    /// Pings clients every 10 seconds to see if they are alive and remove them from the broadcast list if not.
    fn spawn_ping(this: Arc<Self>) {
        actix_web::rt::spawn(async move {
            let mut interval = interval(Duration::from_secs(10));
            loop {
                interval.tick().await;
                this.check_stale_clients().await;
            }
        });
    }

    async fn check_client(&self, uuid: &String) {
        match self.inner.lock().clients.get(uuid) {
            Some(client) => {
                if !(client
                    .send(sse::Event::Comment("ping".into()))
                    .await
                    .is_ok())
                {
                    match ffi::unsubscribe(uuid.to_string()) {
                        Ok(()) => _ = self.inner.lock().clients.remove(uuid),
                        Err(e) => error!("{}", e.msg),
                    }
                }
            }
            None => (),
        }
    }

    /// Removes all non-responsive clients from broadcast list.
    pub async fn check_stale_clients(&self) {
        let clients = self.inner.lock().clients.clone();
        let mut ok_clients = HashMap::new();
        for (uuid, client) in clients {
            if client
                .send(sse::Event::Comment("ping".into()))
                .await
                .is_ok()
            {
                ok_clients.insert(uuid, client.clone());
            } else {
                match ffi::unsubscribe(uuid.to_string()) {
                    Ok(()) => (),
                    Err(e) => error!("{}", e.msg),
                }
            }
        }
        self.inner.lock().clients = ok_clients;
    }

    /// Registers client with clients, returning an SSE response body.
    pub async fn new_client(
        &self,
        uuid: String,
        init: Box<dyn Fn(SseNotifier) + Send + Sync>,
    ) -> Sse<ChannelStream> {
        self.check_client(&uuid).await;
        let (tx, rx) = sse::channel(10);
        init(SseNotifier { sender: tx.clone() });
        self.inner.lock().clients.insert(uuid, tx);
        rx
    }
}

//RUSTFLAGS="-C link-args=-Wl,-rpath,/the/lib/path" cargo build
