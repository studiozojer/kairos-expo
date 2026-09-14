Pod::Spec.new do |s|
  s.name = 'KairosBridge'
  s.version = '0.1.0'
  s.summary = 'Kairos ephemeris bridge'
  s.description = 'Local chart calculations through the Rust C ABI.'
  s.author = 'studio zojer'
  s.homepage = 'https://github.com/studiozojer/kairos-expo'
  s.license = { :type => 'Proprietary' }
  s.platforms = { :ios => '17.0' }
  s.source = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = 'ios/*.swift', 'include/*.h'
  s.public_header_files = 'include/*.h'
  s.vendored_frameworks = 'ios/KairosEngine.xcframework'
  s.resource_bundles = { 'KairosEphemeris' => ['assets/Ephemeris/*'] }
  s.libraries = 'c++', 'sqlite3'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
end
