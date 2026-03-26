const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withHealthConnectManifest(config) {
  return withAndroidManifest(config, async (config) => {
    let androidManifest = config.modResults.manifest;
    
    // Add the activity-alias for Android 14
    if (!androidManifest.application[0]['activity-alias']) {
      androidManifest.application[0]['activity-alias'] = [];
    }

    const hasAlias = androidManifest.application[0]['activity-alias'].some(
      alias => alias.$['android:name'] === 'ViewPermissionUsageActivity'
    );

    if (!hasAlias) {
      androidManifest.application[0]['activity-alias'].push({
        $: {
          'android:name': 'ViewPermissionUsageActivity',
          'android:exported': 'true',
          'android:targetActivity': '.MainActivity',
          'android:permission': 'android.permission.START_VIEW_PERMISSION_USAGE'
        },
        'intent-filter': [
          {
            action: [
              {
                $: {
                  'android:name': 'android.intent.action.VIEW_PERMISSION_USAGE'
                }
              }
            ],
            category: [
              {
                $: {
                  'android:name': 'android.intent.category.HEALTH_PERMISSIONS'
                }
              }
            ]
          }
        ]
      });
    }

    return config;
  });
};
