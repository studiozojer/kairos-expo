const { withPodfileProperties, withXcodeProject, withGradleProperties } = require('expo/config-plugins');

module.exports = config => {
  config = withPodfileProperties(config, mod => {
    mod.modResults['ios.deploymentTarget'] = '17.0';
    return mod;
  });
  config = withXcodeProject(config, mod => {
    for (const entry of Object.values(mod.modResults.pbxXCBuildConfigurationSection())) {
      if (entry.buildSettings?.IPHONEOS_DEPLOYMENT_TARGET) {
        entry.buildSettings.IPHONEOS_DEPLOYMENT_TARGET = '17.0';
      }
    }
    return mod;
  });
  return withGradleProperties(config, mod => {
    const key = 'reactNativeArchitectures';
    mod.modResults = mod.modResults.filter(item => item.key !== key);
    mod.modResults.push({ type: 'property', key, value: 'arm64-v8a,x86_64' });
    return mod;
  });
};
