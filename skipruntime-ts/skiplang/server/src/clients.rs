use std::{sync::Arc, time::Duration};

use actix_web::rt::time::interval;
use actix_web_lab::sse::{self, ChannelStream, Sse};
use parking_lot::Mutex;
use std::collections::HashMap;

#[derive(Debug, Clone, Default)]
struct ClientsInner {
    clients: HashMap<String, sse::Sender>,
}

pub struct Clients {
    inner: Mutex<ClientsInner>,
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
                println!("To close {};", uuid);
                // close
            }
        }
        self.inner.lock().clients = ok_clients;
    }

    /// Registers client with clients, returning an SSE response body.
    pub async fn new_client(&self, uuid: String) -> Sse<ChannelStream> {
        let (tx, rx) = sse::channel(10);
        self.inner.lock().clients.insert(uuid, tx);
        rx
    }
}
