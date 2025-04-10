#include <jni.h>

typedef jobject (*SKIP__io_skiplabs_types_proxies_C__F_getField1)(JNIEnv*, jobject);
typedef jobject (*SKIP__io_skiplabs_types_proxies_C_new)(JNIEnv*, jobject);

static SKIP__io_skiplabs_types_proxies_C__F_getField1 ptr__io_skiplabs_types_proxies_C__F_getField1;
static SKIP__io_skiplabs_types_proxies_C_new ptr__io_skiplabs_types_proxies_C__new;

JNIEXPORT jobject JNICALL Java_io_skiplabs_types_proxies_C_skPtrGetField1(
    JNIEnv* env, jobject thisObject) {
  return ptr__io_skiplabs_types_proxies_C__F_getField1(env, thisObject);
}

JNIEXPORT jobject JNICALL Java_io_skiplabs_types_proxies_C_newC(
    JNIEnv* env, jclass clazz, jobject field1) {
(void)clazz;
  return ptr__io_skiplabs_types_proxies_C__new(env, field1);
}

JNIEXPORT void JNICALL Java_io_skiplabs_types_proxies_C_setSkPtrGetField1(
    JNIEnv* env, jclass clazz, jlong fnPtr) {
  (void)env;
  (void)clazz;
  ptr__io_skiplabs_types_proxies_C__F_getField1 = (SKIP__io_skiplabs_types_proxies_C__F_getField1)fnPtr;
}

JNIEXPORT void JNICALL Java_io_skiplabs_types_proxies_C_setSkPtrNew(
    JNIEnv* env, jclass clazz, jlong fnPtr) {
  (void)env;
  (void)clazz;
  ptr__io_skiplabs_types_proxies_C__new = (SKIP__io_skiplabs_types_proxies_C_new)fnPtr;
}

