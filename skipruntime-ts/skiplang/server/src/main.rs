mod clients;
mod error;
mod ffi;

use actix_cors::Cors;
use actix_web::http::header::{ContentType, HeaderName};
use actix_web::middleware::Logger;
use actix_web::{App, Either, HttpRequest, HttpResponse, HttpServer, Responder, web};
use actix_web_lab::extract::Path;
use actix_web_lab::sse::{ChannelStream, Sse};
use clap::{Parser, ValueEnum};
use env_logger;
use futures_util::future;
use log::error;
use std::env;
use std::fmt;
use std::path::Path as FPath;
use std::str::FromStr;
use std::sync::Arc;
use uuid::Uuid;

#[derive(Copy, Clone, PartialEq, Eq, PartialOrd, Ord, ValueEnum, Debug)]
enum CorsValue {
    #[value(name = "default")]
    CDefault,
    #[value(name = "permissive")]
    CPermissive,
}

impl fmt::Display for CorsValue {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            CorsValue::CDefault => write!(f, "default"),
            CorsValue::CPermissive => write!(f, "permissive"),
        }
    }
}

impl FromStr for CorsValue {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "default" => Ok(CorsValue::CDefault),
            "permissive" => Ok(CorsValue::CPermissive),
            _ => Err(format!("Invalid value for CorsValue: {}", s)),
        }
    }
}

#[derive(Parser, Debug)]
#[command(author, version = "none", about)]
struct Args {
    /// The control port number
    #[arg(short, long, default_value_t = 8082)]
    control_port: u16,

    /// The streaming port number
    #[arg(short, long, default_value_t = 8081)]
    streaming_port: u16,

    /// Verbose mode level (multiple v to increase level)
    #[arg(short, long, action = clap::ArgAction::Count)]
    verbose: u8,

    /// The cors directive
    #[arg(long, default_value_t = CorsValue::CDefault)]
    cors: CorsValue,

    /// The number of streaming workers
    #[arg(short, long, default_value_t = 256)]
    workers: usize,
}

pub struct AppState {
    clients: Arc<clients::Clients>,
}

type SseResult = Either<Sse<ChannelStream>, HttpResponse>;

// SSE
pub async fn sse_client(state: web::Data<AppState>, Path((uuid,)): Path<(String,)>) -> SseResult {
    println!("sse_client {}", uuid);
    match ffi::subscribe(uuid.to_string(), None) {
        Ok(sub) => Either::Left(state.clients.new_client(sub).await),
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
    Path((resource,)): Path<(String,)>,
    data: String,
    req: HttpRequest,
) -> impl Responder {
    if check_content_type("application/json", req) {
        let uuid = Uuid::new_v4();
        match ffi::instantiate_resource(uuid.to_string(), resource, data) {
            Ok(()) => {
                let response = match env::var("SKIP_RESOURCE_PREFIX").ok() {
                    Some(prefix) => format!("{}/{}", prefix, uuid),
                    None => uuid.to_string(),
                };
                HttpResponse::Created().body(response)
            }
            Err(e) => {
                error!("{}", e.msg);
                HttpResponse::InternalServerError().finish()
            }
        }
    } else {
        HttpResponse::NotAcceptable().finish()
    }
}

pub async fn close_resource_instance(Path((uuid,)): Path<(String,)>) -> impl Responder {
    match ffi::close_resource_instance(uuid.to_string()) {
        Ok(()) => HttpResponse::Ok().finish(),
        Err(e) => {
            error!("{}", e.msg);
            HttpResponse::InternalServerError().finish()
        }
    }
}

pub async fn resource_snapshot(
    Path((resource,)): Path<(String,)>,
    data: String,
    req: HttpRequest,
) -> impl Responder {
    if check_content_type("application/json", req) {
        match ffi::resource_snapshot(resource.to_string(), data.to_string()) {
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
    Path((resource,)): Path<(String,)>,
    data: String,
    req: HttpRequest,
) -> impl Responder {
    if check_content_type("application/json", req) {
        // TODO json parameters / key
        match ffi::resource_snapshot_lookup(resource.to_string(), data.to_string(), "".to_string())
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

pub async fn healthcheck() -> impl Responder {
    HttpResponse::Ok().finish()
}

pub async fn input(
    Path((collection,)): Path<(String,)>,
    data: String,
    req: HttpRequest,
) -> impl Responder {
    if check_content_type("application/json", req) {
        match ffi::update(collection.to_string(), data.to_string()) {
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
    env_logger::init();
    if env::args().any(|arg| arg == "-V" || arg == "--version") {
        let pkg_name = env!("CARGO_PKG_NAME");
        let pkg_version = env!("CARGO_PKG_VERSION");
        let bin_name = env::args().next().unwrap_or_else(|| pkg_name.into());

        let bin_name = FPath::new(&bin_name)
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or(pkg_name);
        println!("{} {}", bin_name, pkg_version);
        return Ok(());
    }
    let args = Args::parse();
    match ffi::init_service() {
        Ok(_) => (),
        Err(e) => {
            eprintln!("Erreur : {}", e);
            std::process::exit(1);
        }
    };
    let clients = clients::Clients::create();

    let s1 = HttpServer::new(move || {
        App::new()
            .wrap(match args.cors {
                CorsValue::CDefault => Cors::default(),
                CorsValue::CPermissive => Cors::permissive(),
            })
            .wrap(Logger::default())
            .route(
                "/v1/streams/{resource}",
                web::post().to(instantiate_resource),
            )
            .route(
                "/v1/streams/{uuid:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}}",
                web::delete().to(close_resource_instance),
            )
            .route("/v1/snapshot/{resource}", web::post().to(resource_snapshot))
            .route(
                "/v1/snapshot/{resource}/lookup",
                web::post().to(resource_snapshot_lookup),
            )
            .route("/v1/inputs/{collection}", web::patch().to(input))
            .route("/v1/healthcheck", web::get().to(healthcheck))
    })
    .bind(("127.0.0.1", args.control_port))?
    .run();

    println!(
        "Skip control service listening on port {}",
        args.control_port
    );

    let s2 = HttpServer::new(move || {
        App::new()
            .wrap(match args.cors {
                CorsValue::CDefault => Cors::default(),
                CorsValue::CPermissive => Cors::permissive(),
            })
            .wrap(Logger::default())
            .app_data(web::Data::new(AppState {
                clients: Arc::clone(&clients),
            }))
            // This route is used to listen events/ sse events
            .route(
                "/v1/streams/{uuid:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}}",
                web::get().to(sse_client),
            )
    })
    .workers(args.workers)
    .bind(("127.0.0.1", args.streaming_port))?
    .run();

    println!(
        "Skip streaming service listening on port {}",
        args.streaming_port
    );
    future::try_join(s1, s2).await?;
    Ok(())
}
