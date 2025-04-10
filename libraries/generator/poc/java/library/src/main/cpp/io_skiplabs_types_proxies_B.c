#include <jni.h>

typedef jdouble (*SKIP__io_skiplabs_types_proxies_B__F_getField1)(JNIEnv*, jobject);
typedef jobject (*SKIP__io_skiplabs_types_proxies_B_new)(JNIEnv*, jdouble);

static SKIP__io_skiplabs_types_proxies_B__F_getField1 ptr__io_skiplabs_types_proxies_B__F_getField1;
static SKIP__io_skiplabs_types_proxies_B_new ptr__io_skiplabs_types_proxies_B__new;

JNIEXPORT jdouble JNICALL Java_io_skiplabs_types_proxies_B_skPtrGetField1(
    JNIEnv* env, jobject thisObject) {
  return ptr__io_skiplabs_types_proxies_B__F_getField1(env, thisObject);
}

JNIEXPORT jobject JNICALL Java_io_skiplabs_types_proxies_B_newB(
    JNIEnv* env, jclass clazz, jdouble field1) {
(void)clazz;
  return ptr__io_skiplabs_types_proxies_B__new(env, field1);
}

JNIEXPORT void JNICALL Java_io_skiplabs_types_proxies_B_setSkPtrGetField1(
    JNIEnv* env, jclass clazz, jlong fnPtr) {
  (void)env;
  (void)clazz;
  ptr__io_skiplabs_types_proxies_B__F_getField1 = (SKIP__io_skiplabs_types_proxies_B__F_getField1)fnPtr;
}

JNIEXPORT void JNICALL Java_io_skiplabs_types_proxies_B_setSkPtrNew(
    JNIEnv* env, jclass clazz, jlong fnPtr) {
  (void)env;
  (void)clazz;
  ptr__io_skiplabs_types_proxies_B__new = (SKIP__io_skiplabs_types_proxies_B_new)fnPtr;
}

