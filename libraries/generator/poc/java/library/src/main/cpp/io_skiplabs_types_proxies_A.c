#include <jni.h>

typedef jlong (*SKIP__io_skiplabs_types_proxies_A__F_getField1)(JNIEnv*,
                                                                jobject);
typedef jobject (*SKIP__io_skiplabs_types_proxies_A__F_getField2)(JNIEnv*,
                                                                  jobject);
typedef jobject (*SKIP__io_skiplabs_types_proxies_A_new)(JNIEnv*, jlong,
                                                         jobject);

static SKIP__io_skiplabs_types_proxies_A__F_getField1
    ptr__io_skiplabs_types_proxies_A__F_getField1;
static SKIP__io_skiplabs_types_proxies_A__F_getField2
    ptr__io_skiplabs_types_proxies_A__F_getField2;
static SKIP__io_skiplabs_types_proxies_A_new
    ptr__io_skiplabs_types_proxies_A__new;

JNIEXPORT jlong JNICALL Java_io_skiplabs_types_proxies_A_skPtrGetField1(
    JNIEnv* env, jobject thisObject) {
  return ptr__io_skiplabs_types_proxies_A__F_getField1(env, thisObject);
}

JNIEXPORT jobject JNICALL Java_io_skiplabs_types_proxies_A_skPtrGetField2(
    JNIEnv* env, jobject thisObject) {
  return ptr__io_skiplabs_types_proxies_A__F_getField2(env, thisObject);
}

JNIEXPORT jobject JNICALL Java_io_skiplabs_types_proxies_A_newA(
    JNIEnv* env, jclass clazz, jlong field1, jobject field2) {
  (void)clazz;
  return ptr__io_skiplabs_types_proxies_A__new(env, field1, field2);
}

JNIEXPORT void JNICALL Java_io_skiplabs_types_proxies_A_setSkPtrGetField1(
    JNIEnv* env, jclass clazz, jlong fnPtr) {
  (void)env;
  (void)clazz;
  ptr__io_skiplabs_types_proxies_A__F_getField1 =
      (SKIP__io_skiplabs_types_proxies_A__F_getField1)fnPtr;
}

JNIEXPORT void JNICALL Java_io_skiplabs_types_proxies_A_setSkPtrGetField2(
    JNIEnv* env, jclass clazz, jlong fnPtr) {
  (void)env;
  (void)clazz;
  ptr__io_skiplabs_types_proxies_A__F_getField2 =
      (SKIP__io_skiplabs_types_proxies_A__F_getField2)fnPtr;
}

JNIEXPORT void JNICALL Java_io_skiplabs_types_proxies_A_setSkPtrNew(
    JNIEnv* env, jclass clazz, jlong fnPtr) {
  (void)env;
  (void)clazz;
  ptr__io_skiplabs_types_proxies_A__new =
      (SKIP__io_skiplabs_types_proxies_A_new)fnPtr;
}
