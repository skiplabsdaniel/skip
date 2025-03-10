#include <stdint.h>

#include "string.h"

extern "C" {
void free_string(char* str);
const void* SKIP_new_Obstack();
void SKIP_destroy_Obstack(const void* obstack);
void sk_string_check_c_safe(const char* str);
char* sk_string_create(const char* buffer, uint32_t size);

char* SkipRuntime_instantiateResource(const char* identifier,
                                      const char* resource,
                                      const char* parameters);

char* SkipRuntime_closeResourceInstance(const char* identifier);
char* SkipRuntime_subscribe(const char* identifier, const void* notifier,
                            const char* watermark);
char* SkipRuntime_unsubscribe(const char* identifier);
char* SkipRuntime_getAll(const char* resource, const char* parameters,
                         const char* request);
char* SkipRuntime_getArray(const char* resource, const char* data,
                           const char* request);
char* SkipRuntime_update(const char* input, const char* data);
char* SkipRuntime_createNotifier(uint32_t handle);
void SkipRuntime_checkNotifierException(const char* msg);

char* Skip_notifier__notify(uint32_t id, const char* values,
                            const char* watermark, int32_t is_initial);

char* Skip_notifier__close(uint32_t id);

void Skip_unregister_notifier(uint32_t id);

char* Skip_instantiate_resource(const char* identifier, const char* resource,
                                const char* parameters) {
  const void* obstack = SKIP_new_Obstack();
  const char* skidentifier = sk_string_create(identifier, strlen(identifier));
  const char* skresource = sk_string_create(resource, strlen(resource));
  const char* skparameters = sk_string_create(parameters, strlen(parameters));
  const char* skresult =
      SkipRuntime_instantiateResource(skidentifier, skresource, skparameters);
  sk_string_check_c_safe(skresult);
  char* result = strdup(skresult);
  SKIP_destroy_Obstack(obstack);
  return result;
}

char* Skip_close_resource_instance(const char* identifier) {
  const void* obstack = SKIP_new_Obstack();
  const char* skidentifier = sk_string_create(identifier, strlen(identifier));
  const char* skresult = SkipRuntime_closeResourceInstance(skidentifier);
  sk_string_check_c_safe(skresult);
  char* result = strdup(skresult);
  SKIP_destroy_Obstack(obstack);
  return result;
};

char* Skip_subscribe(const char* identifier, uint32_t notifier,
                     const char* watermark) {
  const void* obstack = SKIP_new_Obstack();
  const char* skidentifier = sk_string_create(identifier, strlen(identifier));
  const void* sknotifier = SkipRuntime_createNotifier(notifier);
  const char* skwatermark =
      watermark ? sk_string_create(watermark, strlen(watermark)) : nullptr;
  const char* skresult =
      SkipRuntime_subscribe(skidentifier, sknotifier, skwatermark);
  sk_string_check_c_safe(skresult);
  char* result = strdup(skresult);
  SKIP_destroy_Obstack(obstack);
  return result;
}

char* Skip_unsubscribe(const char* identifier) {
  const void* obstack = SKIP_new_Obstack();
  const char* skidentifier = sk_string_create(identifier, strlen(identifier));
  const char* skresult = SkipRuntime_unsubscribe(skidentifier);
  sk_string_check_c_safe(skresult);
  char* result = strdup(skresult);
  SKIP_destroy_Obstack(obstack);
  return result;
}

char* Skip_get_all(const char* resource, const char* parameters,
                   const char* request) {
  const void* obstack = SKIP_new_Obstack();
  const char* skresource = sk_string_create(resource, strlen(resource));
  const char* skparameters = sk_string_create(parameters, strlen(parameters));
  const char* skrequest =
      request ? sk_string_create(request, strlen(request)) : nullptr;
  const char* skresult =
      SkipRuntime_getAll(skresource, skparameters, skrequest);
  sk_string_check_c_safe(skresult);
  char* result = strdup(skresult);
  SKIP_destroy_Obstack(obstack);
  return result;
}

char* Skip_get_array(const char* resource, const char* data,
                     const char* request) {
  const void* obstack = SKIP_new_Obstack();
  const char* skresource = sk_string_create(resource, strlen(resource));
  const char* skdata = sk_string_create(data, strlen(data));
  const char* skrequest =
      request ? sk_string_create(request, strlen(request)) : nullptr;
  const char* skresult = SkipRuntime_getArray(skresource, skdata, skrequest);
  sk_string_check_c_safe(skresult);
  char* result = strdup(skresult);
  SKIP_destroy_Obstack(obstack);
  return result;
}

char* Skip_set_input(const char* input, const char* data) {
  const void* obstack = SKIP_new_Obstack();
  const char* skinput = sk_string_create(input, strlen(input));
  const char* skdata = sk_string_create(data, strlen(data));
  const char* skresult = SkipRuntime_update(skinput, skdata);
  sk_string_check_c_safe(skresult);
  char* result = strdup(skresult);
  SKIP_destroy_Obstack(obstack);
  return result;
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

}  // extern "C"
