const { withMainActivity } = require('@expo/config-plugins');

module.exports = function withHealthConnectMainActivity(config) {
  return withMainActivity(config, async (config) => {
    let mainActivity = config.modResults.contents;

    // Add import
    const importStatement = `import dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate\n`;
    if (!mainActivity.includes('HealthConnectPermissionDelegate')) {
      mainActivity = mainActivity.replace(
        /import android\.os\.Bundle/,
        `import android.os.Bundle\n${importStatement}`
      );
    }

    // Add setPermissionDelegate
    const delegateStatement = `    HealthConnectPermissionDelegate.setPermissionDelegate(this)\n`;
    if (!mainActivity.includes('setPermissionDelegate(this)')) {
      mainActivity = mainActivity.replace(
        /super\.onCreate\(null\)/,
        `super.onCreate(null)\n${delegateStatement}`
      );
    }

    config.modResults.contents = mainActivity;

    return config;
  });
};
