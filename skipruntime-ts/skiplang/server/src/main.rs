mod clients;
#[path = "./ffi.rs"]
mod ffi;
use actix_web::http::header::HeaderName;
use actix_web::{App, HttpRequest, HttpResponse, HttpServer, Responder, get, post, web};
use actix_web_lab::extract::Path;
use futures_util::future;
use std::sync::Arc;
use uuid::Uuid;

pub struct AppState {
    clients: Arc<clients::Clients>,
}

// SSE
pub async fn sse_client(
    state: web::Data<AppState>,
    Path((uuid,)): Path<(String,)>,
) -> impl Responder {
    state.clients.new_client(uuid).await
}

#[get("/")]
async fn hello() -> impl Responder {
    HttpResponse::Ok().body("Hello world!")
}

#[post("/echo")]
async fn echo(req_body: String) -> impl Responder {
    HttpResponse::Ok().body(req_body)
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

pub async fn instanciate_resource(
    Path((resource,)): Path<(String,)>,
    data: String,
    req: HttpRequest,
) -> impl Responder {
    if check_content_type("application/json", req) {
        let uuid = Uuid::new_v4();
        match ffi::instantiate_resource(uuid.to_string(), resource, data) {
            Ok(()) => HttpResponse::Created().finish(),
            Err(e) => {
                eprintln!("{}", e.msg);
                HttpResponse::InternalServerError().finish()
            }
        }
    } else {
        HttpResponse::NotAcceptable().finish()
    }
}

pub async fn close_resource_instance(Path((uuid,)): Path<(String,)>) -> impl Responder {
    HttpResponse::Ok().body(uuid)
}

pub async fn resource_snapshot(
    Path((resource,)): Path<(String,)>,
    data: String,
    req: HttpRequest,
) -> impl Responder {
    if check_content_type("application/json", req) {
        HttpResponse::Ok().body(format!("snapshot {resource} {data}\n"))
    } else {
        HttpResponse::NotAcceptable().finish()
    }
}

pub async fn resource_snapshot_lookup(
    Path((resource,)): Path<(String,)>,
    data: String,
    req: HttpRequest,
) -> impl Responder {
    if check_content_type("application/json", req) {
        HttpResponse::Ok().body(format!("snapshot lookup {resource} {data}\n"))
    } else {
        HttpResponse::NotAcceptable().finish()
    }
}

pub async fn healthcheck() -> impl Responder {
    HttpResponse::Ok().finish()
}

pub async fn input(
    Path((collection,)): Path<(String,)>,
    data: String,
    req: HttpRequest,
) -> impl Responder {
    if check_content_type("application/json", req) {
        HttpResponse::Ok().body(format!("input {collection} {data}\n"))
    } else {
        HttpResponse::NotAcceptable().finish()
    }
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let clients = clients::Clients::create();
    let s1 =
        HttpServer::new(move || {
            App::new().app_data(web::Data::new(AppState {
                clients: Arc::clone(&clients)
            }))
            .route(
                "/v1/streams/{resource}",
                web::post().to(instanciate_resource),
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
