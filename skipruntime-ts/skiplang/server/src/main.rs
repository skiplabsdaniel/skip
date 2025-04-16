mod clients;
mod error;
mod ffi;
mod worker;

use actix_web::http::header::{ContentType, HeaderName};
use actix_web::{App, Either, HttpRequest, HttpResponse, HttpServer, Responder, web};
use actix_web_lab::extract::Path;
use actix_web_lab::sse::{ChannelStream, Sse};
use futures_util::future;
use log::error;
use std::sync::Arc;
use uuid::Uuid;

pub struct AppState {
    clients: Arc<clients::Clients>,
    worker: worker::ThreadWorker,
}

pub struct RestState {
    worker: worker::ThreadWorker,
}

type SseResult = Either<Sse<ChannelStream>, HttpResponse>;

// SSE
pub async fn sse_client(state: web::Data<AppState>, Path((uuid,)): Path<(String,)>) -> SseResult {
    let uuid_clone = uuid.clone();
    match state
        .worker
        .submit::<_, _>(move || ffi::subscribe(uuid_clone.to_string(), None))
    {
        Ok(sub) => {
            let client = state.clients.new_client(uuid, sub).await;
            Either::Left(client)
        }
        Err(e) => {
            error!("{}", e.msg);
            Either::Right(HttpResponse::InternalServerError().finish())
        }
    }
}

fn check_content_type(supported_type: &str, req: HttpRequest) -> bool {
    let headers = req.headers();
    if let Some(content_type) = headers.get(HeaderName::from_static("content-type")) {
        let value = content_type.to_str().unwrap();
        let extended = format!("{supported_type};");
        if value == supported_type || value.starts_with(&extended) {
            true
        } else {
            false
        }
    } else {
        false
    }
}

pub async fn instantiate_resource(
    state: web::Data<RestState>,
    Path((resource,)): Path<(String,)>,
    data: String,
    req: HttpRequest,
) -> impl Responder {
    if check_content_type("application/json", req) {
        match state.worker.submit::<_, _>(|| {
            let uuid = Uuid::new_v4();
            ffi::instantiate_resource(uuid.to_string(), resource, data)
        }) {
            Ok(()) => HttpResponse::Created().finish(),
            Err(e) => {
                error!("{}", e.msg);
                HttpResponse::InternalServerError().finish()
            }
        }
    } else {
        HttpResponse::NotAcceptable().finish()
    }
}

pub async fn close_resource_instance(
    state: web::Data<RestState>,
    Path((uuid,)): Path<(String,)>,
) -> impl Responder {
    match state
        .worker
        .submit::<_, _>(move || ffi::close_resource_instance(uuid.to_string()))
    {
        Ok(()) => HttpResponse::Ok().finish(),
        Err(e) => {
            error!("{}", e.msg);
            HttpResponse::InternalServerError().finish()
        }
    }
}

pub async fn resource_snapshot(
    state: web::Data<RestState>,
    Path((resource,)): Path<(String,)>,
    data: String,
    req: HttpRequest,
) -> impl Responder {
    if check_content_type("application/json", req) {
        match state
            .worker
            .submit::<_, _>(move || ffi::resource_snapshot(resource.to_string(), data.to_string()))
        {
            Ok(data) => HttpResponse::Ok()
                .content_type(ContentType::json())
                .body(data),
            Err(e) => {
                error!("{}", e.msg);
                HttpResponse::InternalServerError().finish()
            }
        }
    } else {
        HttpResponse::NotAcceptable().finish()
    }
}

pub async fn resource_snapshot_lookup(
    state: web::Data<RestState>,
    Path((resource,)): Path<(String,)>,
    data: String,
    req: HttpRequest,
) -> impl Responder {
    if check_content_type("application/json", req) {
        match state.worker.submit::<_, _>(move || {
            ffi::resource_snapshot_lookup(resource.to_string(), data.to_string())
        }) {
            Ok(data) => HttpResponse::Ok()
                .content_type(ContentType::json())
                .body(data),
            Err(e) => {
                error!("{}", e.msg);
                HttpResponse::InternalServerError().finish()
            }
        }
    } else {
        HttpResponse::NotAcceptable().finish()
    }
}

pub async fn healthcheck() -> impl Responder {
    HttpResponse::Ok().finish()
}

pub async fn input(
    state: web::Data<RestState>,
    Path((collection,)): Path<(String,)>,
    data: String,
    req: HttpRequest,
) -> impl Responder {
    if check_content_type("application/json", req) {
        match state
            .worker
            .submit::<_, _>(move || ffi::set_input(collection.to_string(), data.to_string()))
        {
            Ok(()) => HttpResponse::Ok().finish(),
            Err(e) => {
                error!("{}", e.msg);
                HttpResponse::InternalServerError().finish()
            }
        }
    } else {
        HttpResponse::NotAcceptable().finish()
    }
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // First version limit runtime execution to one thread
    let worker = worker::ThreadWorker::new();
    let clients = clients::Clients::create();
    let worker1 = worker.clone();
    let s1 =
        HttpServer::new(move || {
            App::new().app_data(web::Data::new(RestState { worker: worker1.clone() }))
            .route(
                "/v1/streams/{resource}",
                web::post().to(instantiate_resource),
            )
            .route(
                "/v1/streams/{uuid:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}}",
                web::delete().to(close_resource_instance),
            )
            .route("/v1/snapshot/{resource}", web::post().to(resource_snapshot))
            .route("/v1/snapshot/{resource}/lookup", web::post().to(resource_snapshot_lookup))
            .route("/v1/inputs/{collection}", web::patch().to(input))
            .route("/v1/healthcheck", web::get().to(healthcheck))
        })
        .bind(("127.0.0.1", 8282))?
        .run();

    let s2 = HttpServer::new(move || {
        App::new()
            .app_data(web::Data::new(AppState {
                clients: Arc::clone(&clients),
                worker: worker.clone(),
            }))
            // This route is used to listen events/ sse events
            .route(
                "/v1/streams/{uuid:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}}",
                web::get().to(sse_client),
            )
    })
    .bind(format!("{}:{}", "127.0.0.1", "8181"))?
    .run();

    future::try_join(s1, s2).await?;

    Ok(())
}
