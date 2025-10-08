const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs/promises");
const path = require("path");

module.exports = function withAndroidLocalProperties(config) {
  return withDangerousMod(config, ["android", async (innerConfig) => {
    const sdkDir = process.env.ANDROID_SDK_ROOT ?? process.env.ANDROID_HOME;

    if (!sdkDir) {
      console.warn(
        "[with-android-local-properties] Skipped: ANDROID_SDK_ROOT/ANDROID_HOME not set."
      );
      return innerConfig;
    }

    const filePath = path.join(
      innerConfig.modRequest.platformProjectRoot,
      "local.properties"
    );
    const content = `sdk.dir=${sdkDir.replace(/\\/g, "\\\\")}\n`;

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, "utf8");
    console.log(`[with-android-local-properties] Wrote ${filePath}`);

    return innerConfig;
  }]);
};
