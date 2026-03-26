import 'dotenv/config';

export default ({ config }) => {
  return {
    ...config,
    name: 'FusionBite',
    slug: 'fusionbite',
    extra: {
      ...config.extra,
      fdaApiKey: process.env.FDA_API_KEY,
      googleAiApiKey: process.env.GOOGLE_AI_API_KEY,
    },
  };
};