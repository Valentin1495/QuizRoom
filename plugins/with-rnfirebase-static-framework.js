/**
 * Ensures React Native Firebase builds as static frameworks when Expo's
 * `expo-build-properties` plugin sets `useFrameworks: "static"`, and relaxes
 * non-modular include warnings for RNFB pods.
 */
const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const STATIC_FLAG = "$RNFirebaseAsStaticFramework = true";
const PRE_INSTALL_SENTINEL = "installer.pod_targets.each do |pod|";
const POST_INSTALL_SENTINEL =
  "config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'";

const postInstallInjection = [
  "    installer.pods_project.targets.each do |target|",
  "      next unless target.name == 'RNFBApp'",
  "      target.build_configurations.each do |config|",
  "        config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'",
  "      end",
  "    end",
].join("\n");

const preInstallInjection = [
  "  pre_install do |installer|",
  "    installer.pod_targets.each do |pod|",
  "      next unless %w[RNFBApp RNFBAuth].include?(pod.name)",
  "      def pod.build_type",
  "        Pod::BuildType.static_library",
  "      end",
  "    end",
  "  end",
].join("\n");

function ensureStaticFlag(contents) {
  if (contents.includes(STATIC_FLAG)) {
    return contents;
  }

  const platformPattern = /(^platform :ios[^\n]*\n)/m;
  if (!platformPattern.test(contents)) {
    return contents;
  }

  return contents.replace(platformPattern, (match) => `${STATIC_FLAG}\n\n${match}`);
}

function ensurePostInstallInjection(contents) {
  if (contents.includes(POST_INSTALL_SENTINEL)) {
    return contents;
  }

  const hookPattern = /(react_native_post_install\([\s\S]*?\)\n\s*end)/m;
  const match = contents.match(hookPattern);
  if (!match) {
    return contents;
  }

  const updatedBlock = match[0].replace(
    /\)\n\s*end/m,
    `)\n\n${postInstallInjection}\n  end`
  );

  return contents.replace(hookPattern, updatedBlock);
}

function ensurePreInstallInjection(contents) {
  if (contents.includes(PRE_INSTALL_SENTINEL)) {
    return contents;
  }

  const marker = "  post_install do |installer|";
  if (!contents.includes(marker)) {
    return contents;
  }

  return contents.replace(marker, `${preInstallInjection}\n\n${marker}`);
}

module.exports = function withRnFirebaseStaticFramework(config) {
  return withDangerousMod(config, ["ios", (innerConfig) => {
    const podfilePath = path.join(innerConfig.modRequest.platformProjectRoot, "Podfile");
    let contents = fs.readFileSync(podfilePath, "utf8");

    contents = ensureStaticFlag(contents);
    contents = ensurePreInstallInjection(contents);
    contents = ensurePostInstallInjection(contents);

    fs.writeFileSync(podfilePath, contents);
    return innerConfig;
  }]);
};
