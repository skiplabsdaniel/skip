#![allow(dead_code)]
use crate::clients::SseNotifier;
use actix_web_lab::sse::SendError;
use lazy_static::lazy_static;
use log;
use std::collections::HashMap;
use std::ffi::{CString, c_char, c_void};
use std::sync::Mutex;
use std::{thread, time};

lazy_static! {
    static ref CALLBACKS: Mutex<HashMap<u32, Box<dyn MutNotifier + Send + Sync>>> =
        Mutex::new(HashMap::new());
    static ref COUNTER: Mutex<u32> = Mutex::new(0);
}

pub fn register_notifier(notifier: Box<dyn MutNotifier + Send + Sync>) -> u32 {
    let mut counter = COUNTER.lock().unwrap();
    let mut callbacks = CALLBACKS.lock().unwrap();

    *counter += 1;
    let id = *counter;

    callbacks.insert(id, notifier);
    id
}

fn unregister_notifier(id: u32) {
    let mut callbacks = CALLBACKS.lock().unwrap();
    callbacks.remove(&id);
}

fn update_notifier(id: u32, values: String, watermark: String, is_initial: bool) -> String {
    let mut callbacks = CALLBACKS.lock().unwrap();
    if let Some(callback) = callbacks.get_mut(&id) {
        match callback.update(values, watermark, is_initial) {
            Ok(()) => "".to_string(),
            Err(e) => e.to_string(),
        }
    } else {
        "Invalid callback '{}'".to_string()
    }
}

fn close_notifier(id: u32) -> String {
    let mut callbacks = CALLBACKS.lock().unwrap();
    if let Some(callback) = callbacks.get_mut(&id) {
        callback.close();
        "".to_string()
    } else {
        "Invalid callback '{}'".to_string()
    }
}

fn init_notifier(id: u32, notifier: SseNotifier) -> () {
    let mut callbacks = CALLBACKS.lock().unwrap();
    if let Some(callback) = callbacks.get_mut(&id) {
        callback.init(notifier)
    }
}

use crate::error;

struct Update {
    values: String,
    watermark: String,
    is_initial: bool,
}

pub trait MutNotifier {
    fn init(&mut self, notifier: SseNotifier) -> ();
    fn update(
        &mut self,
        values: String,
        watermark: String,
        is_initial: bool,
    ) -> Result<(), SendError>;
    fn close(&mut self) -> ();
}

pub trait Notifier {
    fn update(&self, values: String, watermark: String, is_initial: bool) -> Result<(), SendError>;
    fn close(&self) -> ();
}

pub struct Subscriber {
    notifier: Option<SseNotifier>,
    closed: bool,
    updates: Vec<Update>,
}

impl Subscriber {
    pub fn new() -> Self {
        Subscriber {
            notifier: None,
            closed: false,
            updates: Vec::new(),
        }
    }
}

impl MutNotifier for Subscriber {
    fn init(&mut self, notifier: SseNotifier) -> () {
        if self.closed {
            notifier.close()
        } else {
            for update in &self.updates {
                match notifier.update(
                    update.values.clone(),
                    update.watermark.clone(),
                    update.is_initial,
                ) {
                    Err(e) => log::error!("{}", e),
                    Ok(()) => (),
                }
            }
            self.notifier = Some(notifier);
        }
    }

    fn update(
        &mut self,
        values: String,
        watermark: String,
        is_initial: bool,
    ) -> Result<(), SendError> {
        match &self.notifier {
            Some(n) => n.update(values, watermark, is_initial),
            None => {
                self.updates.push(Update {
                    values: values,
                    watermark: watermark,
                    is_initial: is_initial,
                });
                Ok(())
            }
        }
    }

    fn close(&mut self) -> () {
        match &self.notifier {
            Some(n) => n.close(),
            None => self.closed = true,
        }
    }
}

unsafe extern "C" {
    fn SkipRuntime_instantiateResource(
        identifier: *const c_char,
        resource: *const c_char,
        parameters: *const c_char,
    ) -> *mut c_char;
    fn SkipRuntime_closeResourceInstance(identifier: *const c_char) -> *mut c_char;
    fn SkipRuntime_subscribe(
        identifier: *const c_char,
        notifier: *const c_void,
        watermark: *const c_char,
    ) -> *mut c_char;
    fn SkipRuntime_unsubscribe(identifier: *const c_char) -> *mut c_char;
    fn SkipRuntime_getAll(
        resource: *const c_char,
        parameters: *const c_char,
        request: *const c_char,
    ) -> *mut c_char;
    fn SkipRuntime_getArray(
        resource: *const c_char,
        key_parameters: *const c_char,
        request: *const c_char,
    ) -> *mut c_char;
    fn SkipRuntime_update(input: *const c_char, data: *const c_char) -> *mut c_char;
    fn SkipRuntime_createNotifier(handle: u32) -> *const c_void;
}

pub fn instantiate_resource(
    identifier: String,
    resource: String,
    parameters: String,
) -> Result<(), error::SkipError> {
    unsafe {
        let c_identifier = CString::new(identifier).expect("CString::new failed");
        let c_resource = CString::new(resource).expect("CString::new failed");
        let c_parameters = CString::new(parameters).expect("CString::new failed");
        let result = SkipRuntime_instantiateResource(
            c_identifier.as_ptr(),
            c_resource.as_ptr(),
            c_parameters.as_ptr(),
        );
        // Supposed to free the result mut char *
        let c_str = CString::from_raw(result);
        let rust_str = c_str.to_str().expect("Bad encoding");
        let owned = rust_str.to_owned();
        if owned.is_empty() {
            return Ok(());
        } else {
            return Err(error::SkipError { msg: owned });
        }
    };
}

pub fn close_resource_instance(identifier: String) -> Result<(), error::SkipError> {
    unsafe {
        let c_identifier = CString::new(identifier).expect("CString::new failed");
        let result = SkipRuntime_closeResourceInstance(c_identifier.as_ptr());
        // Supposed to free the result mut char *
        let c_str = CString::from_raw(result);
        let rust_str = c_str.to_str().expect("Bad encoding");
        let owned = rust_str.to_owned();
        if owned.is_empty() {
            return Ok(());
        } else {
            return Err(error::SkipError { msg: owned });
        }
    };
}

pub fn subscribe(
    identifier: String,
    watermark: Option<String>,
) -> Result<Box<dyn Fn(SseNotifier) + Send + Sync>, error::SkipError> {
    unsafe {
        let c_identifier = CString::new(identifier).expect("CString::new failed");
        let c_watermark = match watermark {
            Some(v) => Some(CString::new(v).expect("CString::new failed")),
            _ => None,
        };
        let c_watermark_ptr = match c_watermark {
            Some(v) => v.as_ptr(),
            _ => 0x0 as *const u8,
        };
        let handle = register_notifier(Box::new(Subscriber::new()));
        let sknotifier = SkipRuntime_createNotifier(handle);
        let result = SkipRuntime_subscribe(c_identifier.as_ptr(), sknotifier, c_watermark_ptr);
        // Supposed to free the result mut char *
        let c_str = CString::from_raw(result);
        let rust_str = c_str.to_str().expect("Bad encoding");
        let owned = rust_str.to_owned();
        if owned.is_empty() {
            return Ok(Box::new(move |n| {
                init_notifier(handle, n);
            }));
        } else {
            return Err(error::SkipError { msg: owned });
        }
    }
}

pub fn unsubscribe(identifier: String) -> Result<(), error::SkipError> {
    unsafe {
        let c_identifier = CString::new(identifier).expect("CString::new failed");
        let result = SkipRuntime_unsubscribe(c_identifier.as_ptr());
        // Supposed to free the result mut char *
        let c_str = CString::from_raw(result);
        let rust_str = c_str.to_str().expect("Bad encoding");
        let owned = rust_str.to_owned();
        if owned.is_empty() {
            return Ok(());
        } else {
            return Err(error::SkipError { msg: owned });
        }
    }
}

pub fn resource_snapshot_<F>(
    resource: String,
    data: String,
    f: F,
) -> Result<String, error::SkipError>
where
    F: Fn(*const c_char, *const c_char, *const c_char) -> *mut c_char,
{
    let ten_millis = time::Duration::from_millis(10);
    let mut request: Option<String> = None;
    unsafe {
        let c_resource = CString::new(resource).expect("CString::new failed");
        let c_data = CString::new(data).expect("CString::new failed");
        loop {
            let c_request = match request {
                Some(v) => Some(CString::new(v).expect("CString::new failed")),
                _ => None,
            };
            let c_request_ptr = match c_request {
                Some(v) => v.as_ptr(),
                _ => 0x0 as *const u8,
            };
            let result = f(c_resource.as_ptr(), c_data.as_ptr(), c_request_ptr);
            // Supposed to free the result mut char *
            let c_str = CString::from_raw(result);
            let rust_str = c_str.to_str().expect("Bad encoding");
            let owned = rust_str.to_owned();
            if owned.is_empty() {
                return Err(error::SkipError {
                    msg: "resource_snapshot_lookup: Unknown result.".to_string(),
                });
            } else if owned.starts_with("OK:") {
                return Ok(owned[3..].to_string());
            } else if owned.starts_with("ID:") {
                request = Some(owned[3..].to_string());
                thread::sleep(ten_millis);
            } else {
                return Err(error::SkipError { msg: owned });
            }
        }
    };
}

pub fn resource_snapshot(resource: String, parameters: String) -> Result<String, error::SkipError> {
    resource_snapshot_(resource, parameters, |p1, p2, p3| unsafe {
        SkipRuntime_getAll(p1, p2, p3)
    })
}

pub fn resource_snapshot_lookup(
    resource: String,
    key_parameters: String,
) -> Result<String, error::SkipError> {
    resource_snapshot_(resource, key_parameters, |p1, p2, p3| unsafe {
        SkipRuntime_getArray(p1, p2, p3)
    })
}

pub fn input(input: String, data: String) -> Result<(), error::SkipError> {
    unsafe {
        let c_input = CString::new(input).expect("CString::new failed");
        let c_data = CString::new(data).expect("CString::new failed");
        let result = SkipRuntime_update(c_input.as_ptr(), c_data.as_ptr());
        // Supposed to free the result mut char *
        let c_str = CString::from_raw(result);
        let rust_str = c_str.to_str().expect("Bad encoding");
        let owned = rust_str.to_owned();
        if owned.is_empty() {
            return Ok(());
        } else {
            return Err(error::SkipError { msg: owned });
        }
    }
}
