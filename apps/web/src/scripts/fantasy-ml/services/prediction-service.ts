// Stub file for Vercel build - actual implementation in /scripts
export class PredictionService {
  static async predict(params: any) {
    return {
      success: false,
      error: 'Prediction service not available in production build'
    };
  }
}

export default PredictionService;