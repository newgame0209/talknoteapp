import ApiClient from './api';

export class AIApi {
  private apiClient: ApiClient;

  constructor() {
    this.apiClient = new ApiClient();
  }

  /**
   * テキストを要約する
   */
  async summarize(text: string, maxLength?: number): Promise<string> {
    try {
      const response = await this.apiClient.post('/ai/summarize', {
        text,
        max_length: maxLength,
      });
      return response.data.summary;
    } catch (error) {
      console.error('Error in summarize:', error);
      throw error;
    }
  }

  /**
   * テキストからタイトルを生成する
   */
  async generateTitle(text: string, maxLength?: number): Promise<string> {
    try {
      const response = await this.apiClient.post('/ai/generate-title', {
        text,
        max_length: maxLength,
      });
      return response.data.title;
    } catch (error) {
      console.error('Error in generateTitle:', error);
      throw error;
    }
  }

  /**
   * テキストを校正する
   */
  async proofread(text: string): Promise<{ corrected_text: string; changes: any[] }> {
    try {
      const response = await this.apiClient.post('/ai/proofread', { text });
      return response.data;
    } catch (error) {
      console.error('Error in proofread:', error);
      throw error;
    }
  }

  /**
   * AIとチャットする
   */
  async chat(messages: { role: string; content: string }[]): Promise<string> {
    try {
      const response = await this.apiClient.post('/ai/chat', { messages });
      return response.data.content;
    } catch (error) {
      console.error('Error in chat:', error);
      throw error;
    }
  }
}

export const aiApi = new AIApi(); 