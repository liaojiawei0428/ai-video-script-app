// v3.0.0.2: 生图 Agent 页面 (复用 AgentChatPanel)
import { AgentChatPanel, type AgentApi } from '../components/AgentChatPanel';
import * as api from '../lib/api';

const imageAgentApi: AgentApi = {
  createConversation: api.imageAgentCreateConversationApi,
  chat: api.imageAgentChatApi,
  confirm: api.imageAgentConfirmApi,
  translatePlan: api.imageAgentTranslatePlanApi,  // v3.0.0.2: 中文→英文翻译
  updatePlanFields: api.imageAgentUpdatePlanFieldsApi,  // v3.0.0.2: 改 10 字段
  history: api.imageAgentHistoryApi,
  getById: api.imageAgentGetApi,
  deleteConversation: api.imageAgentDeleteApi,  // v3.0.0.17: 永久删除单条会话
};

export function ImageAgentPage() {
  return (
    <AgentChatPanel
      kind="image"
      api={imageAgentApi}
      title="生图助手"
      icon="image"
      accentColor="text-pink-500"
    />
  );
}
