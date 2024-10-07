import 'dotenv/config';

export default {
  expo: {
    name: 'FusionBite',
    slug: 'fusionbite',
    
    extra: {
      fdaApiKey: process.env.FDA_API_KEY,
      googleAiApiKey: process.env.GOOGLE_AI_API_KEY,
    },
  },
};