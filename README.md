# Welcome to FusionBite

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the root directory. Reference `.env.example`:

4. Add your API keys to the `.env` file:
   ```
   FDA_API_KEY=your_fda_api_key_here
   GOOGLE_AI_API_KEY=your_google_ai_api_key_here
   ```
5. Start the development server:
   ```bash
   npx expo start
   ```

## Environment Variables

This project uses the following environment variables:

- `FDA_API_KEY`: API key for the FDA Nutrition Database
- `GOOGLE_AI_API_KEY`: API key for Google AI services

Make sure to obtain these API keys and add them to your `.env` file before running the application.
