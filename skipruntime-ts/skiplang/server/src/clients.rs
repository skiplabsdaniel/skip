use crate::ffi;
use actix_web_lab::sse::{self, ChannelStream, Sse};
use log::error;
use std::sync::Arc;

#[derive(Debug, Clone)]
pub struct Notification {
    pub values: String,
    pub watermark: String,
    pub is_initial: bool,
}

pub struct Clients {}

impl Clients {
    /// Constructs new clients and spawns ping loop.
    pub fn create() -> Arc<Self> {
        let this = Arc::new(Clients {});
        this
    }

    /// Registers client with clients, returning an SSE response body.
    pub async fn new_client(&self, id: i64) -> Sse<ChannelStream> {
        let (tx, rx) = sse::channel(1);
        tokio::spawn(async move {
            loop {
                match ffi::next_nofication(id) {
                    Some(notif) => {
                        let event = match notif.is_initial {
                            true => "init",
                            false => "update",
                        };
                        match tx
                            .send(
                                sse::Data::new(notif.values)
                                    .event(event)
                                    .id(notif.watermark),
                            )
                            .await
                        {
                            Ok(()) => {
                                log::info!("{event} notification sent on client {}.", id)
                            }
                            Err(e) => {
                                match ffi::unsubscribe(id) {
                                    Ok(()) => (),
                                    Err(e) => error!("{}", e.msg),
                                };
                                log::error!("SSE error on client {}: {}", id, e)
                            }
                        }
                    }
                    None => break,
                }
            }
        });
        rx
    }
}
