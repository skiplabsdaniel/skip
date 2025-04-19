#include <stdbool.h>
#include <stdint.h>

#include "string.h"

typedef struct {
  uint8_t is_ok;      // 1 = Ok, 0 = Err
  const char* value;  // si err
} result_t;

typedef struct {
  int64_t id;         // 0 = Err, > 0 = Ok
  const char* error;  // si err
} subscribe_t;

void free_string(char* str);
const void* SKIP_new_Obstack();
void SKIP_destroy_Obstack(const void* obstack);
void sk_string_check_c_safe(const char* str);
char* sk_string_create(const char* buffer, uint32_t size);

char* SkipRuntime_instantiateResource(const char* identifier,
                                      const char* resource,
                                      const char* parameters,
                                      const void* executor);

char* SkipRuntime_closeResourceInstance(const char* identifier);
subscribe_t SkipRuntime_subscribe(const char* identifier, const void* notifier,
                                  const char* watermark);
char* SkipRuntime_unsubscribe(int64_t id);
result_t SkipRuntime_resourceSnapshot(const char* resource,
                                      const char* parameters);
result_t SkipRuntime_resourceSnapshotLookup(const char* resource,
                                            const char* parameters,
                                            const char* key);
char* SkipRuntime_update(const char* input, const char* data,
                         const void* executor);
const void* SkipRuntime_createNotifier(uint32_t handle);
void SkipRuntime_checkNotifierException(const char* msg);
char* Skip_notifier__notify(uint32_t id, const char* values,
                            const char* watermark, int32_t is_initial);

char* Skip_notifier__close(uint32_t id);
void Skip_unregister_notifier(uint32_t id);

const void* SkipRuntime_createExecutor(uint32_t handle);
void Skip_unregister_executor(uint32_t id);
void Skip_executor_resolve(uint32_t id);
void Skip_executor_reject(uint32_t id, const char* value);
const char* SkipRuntime_initService(const void* service, const void* executor);
const void* Skip_service();

char* check_error_result(const char* skresult, const void* obstack) {
  char* result = NULL;
  if (skresult != NULL) {
    sk_string_check_c_safe(skresult);
    result = strdup(skresult);
  }
  SKIP_destroy_Obstack(obstack);
  return result;
}

char* Skip_init_service(uint32_t executor) {
  const void* obstack = SKIP_new_Obstack();
  const void* skexecutor = SkipRuntime_createExecutor(executor);
  const char* skresult = SkipRuntime_initService(Skip_service(), skexecutor);
  return check_error_result(skresult, obstack);
}

char* Skip_instantiate_resource(const char* identifier, const char* resource,
                                const char* parameters, uint32_t executor) {
  const void* obstack = SKIP_new_Obstack();
  const char* skidentifier = sk_string_create(identifier, strlen(identifier));
  const char* skresource = sk_string_create(resource, strlen(resource));
  const char* skparameters = sk_string_create(parameters, strlen(parameters));
  const void* skexecutor = SkipRuntime_createExecutor(executor);
  const char* skresult = SkipRuntime_instantiateResource(
      skidentifier, skresource, skparameters, skexecutor);
  return check_error_result(skresult, obstack);
}

char* Skip_close_resource_instance(const char* identifier) {
  const void* obstack = SKIP_new_Obstack();
  const char* skidentifier = sk_string_create(identifier, strlen(identifier));
  const char* skresult = SkipRuntime_closeResourceInstance(skidentifier);
  return check_error_result(skresult, obstack);
};

subscribe_t Skip_subscribe(const char* identifier, uint32_t notifier,
                           const char* watermark) {
  const void* obstack = SKIP_new_Obstack();
  const char* skidentifier = sk_string_create(identifier, strlen(identifier));
  const void* sknotifier = SkipRuntime_createNotifier(notifier);
  const char* skwatermark =
      watermark ? sk_string_create(watermark, strlen(watermark)) : NULL;
  subscribe_t skresult =
      SkipRuntime_subscribe(skidentifier, sknotifier, skwatermark);
  char* error = check_error_result(skresult.error, obstack);
  subscribe_t res = {skresult.id, error};
  return res;
}

char* Skip_unsubscribe(uint64_t id) {
  const void* obstack = SKIP_new_Obstack();
  const char* skresult = SkipRuntime_unsubscribe(id);
  return check_error_result(skresult, obstack);
}

result_t Skip_resource_snapshot(const char* resource, const char* parameters) {
  const void* obstack = SKIP_new_Obstack();
  const char* skresource = sk_string_create(resource, strlen(resource));
  const char* skparameters = sk_string_create(parameters, strlen(parameters));
  result_t skresult = SkipRuntime_resourceSnapshot(skresource, skparameters);
  sk_string_check_c_safe(skresult.value);
  char* result = strdup(skresult.value);
  SKIP_destroy_Obstack(obstack);
  result_t res = {skresult.is_ok, result};
  return res;
}

result_t Skip_resource_snapshot_lookup(const char* resource, const char* params,
                                       const char* key) {
  const void* obstack = SKIP_new_Obstack();
  const char* skresource = sk_string_create(resource, strlen(resource));
  const char* skparams = sk_string_create(params, strlen(params));
  const char* skkey = sk_string_create(key, strlen(key));
  result_t skresult =
      SkipRuntime_resourceSnapshotLookup(skresource, skparams, skkey);
  sk_string_check_c_safe(skresult.value);
  char* result = strdup(skresult.value);
  SKIP_destroy_Obstack(obstack);
  result_t res = {skresult.is_ok, result};
  return res;
}

char* Skip_update(const char* input, const char* data, uint32_t executor) {
  const void* obstack = SKIP_new_Obstack();
  const char* skinput = sk_string_create(input, strlen(input));
  const char* skdata = sk_string_create(data, strlen(data));
  const void* skexecutor = SkipRuntime_createExecutor(executor);
  const char* skresult = SkipRuntime_update(skinput, skdata, skexecutor);
  return check_error_result(skresult, obstack);
}

void SkipRuntime_Notifier__notify(uint32_t id, const char* values,
                                  const char* watermark, bool updates) {
  char* message = Skip_notifier__notify(id, values, watermark, updates ? 1 : 0);
  const char* skmessage = sk_string_create(message, strlen(message));
  free_string(message);
  SkipRuntime_checkNotifierException(skmessage);
}

void SkipRuntime_Notifier__close(uint32_t id) {
  char* message = Skip_notifier__close(id);
  const char* skmessage = sk_string_create(message, strlen(message));
  free_string(message);
  SkipRuntime_checkNotifierException(skmessage);
}

void SkipRuntime_deleteNotifier(uint32_t id) {
  Skip_unregister_notifier(id);
}

void SkipRuntime_Executor__resolve(uint32_t id) {
  Skip_executor_resolve(id);
}

void SkipRuntime_Executor__reject(uint32_t id, const char* message) {
  Skip_executor_reject(id, message);
}

void SkipRuntime_deleteExecutor(uint32_t id) {
  Skip_unregister_executor(id);
}
