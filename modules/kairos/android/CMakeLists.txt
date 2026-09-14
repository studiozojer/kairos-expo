cmake_minimum_required(VERSION 3.22.1)
project(kairos_bridge)
add_library(kairos_engine SHARED IMPORTED)
set_target_properties(kairos_engine PROPERTIES IMPORTED_NO_SONAME TRUE IMPORTED_LOCATION
  "${CMAKE_CURRENT_SOURCE_DIR}/src/main/jniLibs/${ANDROID_ABI}/libkairos.so")
add_library(kairos_jni SHARED src/main/cpp/kairos_jni.cpp)
target_include_directories(kairos_jni PRIVATE ../include)
target_link_libraries(kairos_jni kairos_engine)
target_link_options(kairos_jni PRIVATE "-Wl,-z,max-page-size=16384")
