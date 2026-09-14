#include <jni.h>
#include <string>
#include "kairos_bridge.h"

static jstring unwrap(JNIEnv *env, KairosResult result) {
  // Copy before releasing either Rust-owned string, including the error path.
  bool success = result.success && result.data;
  std::string text = success ? result.data : (result.error ? result.error : "Unknown engine error");
  kairos_result_free(result);
  if (!success) {
    env->ThrowNew(env->FindClass("java/lang/IllegalStateException"), text.c_str());
    return nullptr;
  }
  return env->NewStringUTF(text.c_str());
}

extern "C" JNIEXPORT jstring JNICALL
Java_studio_zojer_kairos_engine_KairosNative_initialize(JNIEnv *env, jobject, jstring path, jstring atlasPath) {
  const char *value = env->GetStringUTFChars(path, nullptr);
  if (!value) return nullptr;
  const char *atlas = env->GetStringUTFChars(atlasPath, nullptr);
  if (!atlas) { env->ReleaseStringUTFChars(path, value); return nullptr; }
  auto result = kairos_init(atlas, value);
  env->ReleaseStringUTFChars(atlasPath, atlas);
  env->ReleaseStringUTFChars(path, value);
  return unwrap(env, result);
}

extern "C" JNIEXPORT jstring JNICALL
Java_studio_zojer_kairos_engine_KairosNative_calculate(JNIEnv *env, jobject, jstring request) {
  const char *value = env->GetStringUTFChars(request, nullptr);
  if (!value) return nullptr;
  auto result = kairos_calculate_chart(value);
  env->ReleaseStringUTFChars(request, value);
  return unwrap(env, result);
}

extern "C" JNIEXPORT jstring JNICALL
Java_studio_zojer_kairos_engine_KairosNative_search(JNIEnv *env, jobject, jstring query) {
  const char *value = env->GetStringUTFChars(query, nullptr);
  if (!value) return nullptr;
  auto result = kairos_search_locations(value, 30);
  env->ReleaseStringUTFChars(query, value);
  return unwrap(env, result);
}
