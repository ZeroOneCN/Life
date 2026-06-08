import { apiPost } from '../lib/api';
import type { AssistantChatMessage, AssistantChatResponse } from './assistant.types';

export const assistantApi = {
  chat(messages: AssistantChatMessage[]) {
    return apiPost<AssistantChatResponse>('/assistant/chat', { messages });
  },
};
