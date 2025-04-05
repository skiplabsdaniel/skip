
#include <jni.h>

typedef jlong (*SKIP_A__getField1)(void*);
typedef void* (*Java_A__getField2)(JNIEnv*, void*);
typedef jdouble (*SKIP_B__getField1)(void*);
typedef jobject (*Java_createB)(JNIEnv*, jdouble);
typedef jobject (*Java_createC)(JNIEnv*, void*);
typedef jobject (*Java_createA)(JNIEnv*, jlong, void*);

void* getPointer(JNIEnv* env, jobject obj) {
  char* type;
  char* message;
  jclass clazz = (*env)->GetObjectClass(env, obj);
  jfieldID hfid = (*env)->GetFieldID(env, clazz, "skPtrHandle", "J");
  jlong handle = (*env)->GetLongField(env, obj, hfid);
  return (void*)handle;
}

/*
 * Class:     io_skiplabs_types_proxies_A
 * Method:    skPtrGetField1
 * Signature: (JJ)J
 */
JNIEXPORT jlong JNICALL Java_io_skiplabs_types_proxies_A_skPtrGetField1(
    JNIEnv* env, jobject thisObject, jlong handle, jlong function) {
  (void)env;
  (void)thisObject;
  //
  return ((SKIP_A__getField1)function)((void*)handle);
}

/*
 * Class:     io_skiplabs_types_proxies_A
 * Method:    skPtrGetField2
 * Signature: (JJ)Lio/skiplabs/types/proxies/B;
 */
JNIEXPORT jobject JNICALL Java_io_skiplabs_types_proxies_A_skPtrGetField2(
    JNIEnv* env, jobject thisObject, jlong handle, jlong function) {
  (void)env;
  (void)thisObject;
  //
  return ((Java_A__getField2)function)(env, (void*)handle);
}

/*
 * Class:     io_skiplabs_types_proxies_SkPtrFactory
 * Method:    callCreateA
 * Signature: (JJLio/skiplabs/types/B;)Lio/skiplabs/types/proxies/A;
 */
JNIEXPORT jobject JNICALL
Java_io_skiplabs_types_proxies_SkPtrFactory_callCreateA(JNIEnv* env,
                                                        jclass thisClass,
                                                        jlong function,
                                                        jlong field1,
                                                        jobject field2) {
  return ((Java_createA)function)(env, field1, getPointer(env, field2));
}

/*
 * Class:     io_skiplabs_types_proxies_B
 * Method:    skPtrGetField1
 * Signature: (JJ)D
 */
JNIEXPORT jdouble JNICALL Java_io_skiplabs_types_proxies_B_skPtrGetField1(
    JNIEnv* env, jobject thisObject, jlong handle, jlong function) {
  return ((SKIP_B__getField1)function)((void*)handle);
}

/*
 * Class:     io_skiplabs_types_proxies_SkPtrFactory
 * Method:    callCreateB
 * Signature: (JD)Lio/skiplabs/types/proxies/B;
 */
JNIEXPORT jobject JNICALL
Java_io_skiplabs_types_proxies_SkPtrFactory_callCreateB(JNIEnv* env,
                                                        jclass thisClass,
                                                        jlong function,
                                                        jdouble value) {
  return ((Java_createB)function)(env, value);
}

/*
 * Class:     io_skiplabs_types_proxies_C
 * Method:    skPtrGetField1
 * Signature: (JJ)Lio/skiplabs/types/B;
 */
JNIEXPORT jobject JNICALL Java_io_skiplabs_types_proxies_C_skPtrGetField1(
    JNIEnv* env, jobject thisObject, jlong handle, jlong function) {
  (void)env;
  (void)thisObject;
  //
  return ((Java_A__getField2)function)(env, (void*)handle);
}

/*
 * Class:     io_skiplabs_types_proxies_SkPtrFactory
 * Method:    callCreateC
 * Signature: (JLio/skiplabs/types/B;)Lio/skiplabs/types/proxies/C;
 */
JNIEXPORT jobject JNICALL
Java_io_skiplabs_types_proxies_SkPtrFactory_callCreateC(JNIEnv* env,
                                                        jclass thisClass,
                                                        jlong function,
                                                        jobject b) {
  return ((Java_createC)function)(env, getPointer(env, b));
}
